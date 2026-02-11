import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';
import { logger, createJobLogger } from '../utils/logger';
import { 
  executeInSandbox, 
  mockExecution, 
  ExecutionResult 
} from './dockerService';
import {
  generateTestCases,
  inferProblem,
  generateMockTestCases,
  generateMockInference,
  generateEnhancedTestCases,
  inferProblemWithHypotheses,
  generateMockEnhancedInference,
  TestCase,
  Observation,
  InferenceResult,
} from './llmService';
import { getTopHypotheses, validateHypotheses, Hypothesis } from './hypothesisEngine';
import { detectPatterns, DetectedPattern } from './patternDetector';
import { generateAdaptiveTests } from './adaptiveTestService';
import { generateComprehensiveTestSuite } from './testCaseStrategyService';
import {
  sendStageUpdate,
  sendTestCaseUpdate,
  sendHypothesisUpdate,
  sendPatternUpdate,
  sendCompletion,
  sendError,
  sendLogMessage,
} from './websocketService';
import {
  withRecovery,
  classifyError,
  generateFallbackResult,
  getErrorMessage,
  AnalysisResult as FallbackResult,
} from './errorRecoveryService';
import { verifySolution, refineResult, analyzeResultQuality } from './refinementService';

export interface AnalysisRequest {
  executablePath: string;
  inputFormat: string;
  constraints: string;
  useMock?: boolean;
}

export interface AnalysisProgress {
  stage: 'generating' | 'executing' | 'inferring' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: any;
}

export interface AnalysisResult {
  jobId: string;
  success: boolean;
  inference?: InferenceResult;
  observations?: Observation[];
  testCases?: TestCase[];
  executionStats?: {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    averageExecutionTime: number;
  };
  error?: string;
}

// Store for progress callbacks
const progressCallbacks = new Map<string, (progress: AnalysisProgress) => void>();

/**
 * Register progress callback for a job
 */
export function onProgress(jobId: string, callback: (progress: AnalysisProgress) => void): void {
  progressCallbacks.set(jobId, callback);
}

/**
 * Unregister progress callback
 */
export function offProgress(jobId: string): void {
  progressCallbacks.delete(jobId);
}

/**
 * Emit progress update
 */
function emitProgress(jobId: string, progress: AnalysisProgress): void {
  const callback = progressCallbacks.get(jobId);
  if (callback) {
    callback(progress);
  }
}

/**
 * Run the complete analysis pipeline
 */
export async function runAnalysisPipeline(
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const jobId = uuidv4();
  const jobLogger = createJobLogger(jobId);
  
  jobLogger.info('Starting analysis pipeline', {
    inputFormat: request.inputFormat,
    useMock: request.useMock,
  });

  try {
    // Stage 1: Generate Test Cases
    emitProgress(jobId, {
      stage: 'generating',
      progress: 0,
      message: 'Generating intelligent test cases...',
    });

    jobLogger.info('Stage 1: Generating test cases');
    
    let testCases: TestCase[];
    if (request.useMock) {
      testCases = generateMockTestCases(request.inputFormat, 10);
    } else {
      testCases = await generateTestCases(
        request.inputFormat,
        request.constraints,
        20
      );
    }

    jobLogger.info(`Generated ${testCases.length} test cases`);
    
    emitProgress(jobId, {
      stage: 'generating',
      progress: 25,
      message: `Generated ${testCases.length} test cases`,
      details: { testCaseCount: testCases.length },
    });

    // Stage 2: Execute Test Cases
    emitProgress(jobId, {
      stage: 'executing',
      progress: 25,
      message: 'Executing test cases in sandbox...',
    });

    jobLogger.info('Stage 2: Executing test cases', { 
      useMock: request.useMock,
      executablePath: request.executablePath 
    });
    
    const observations: Observation[] = [];
    let successfulTests = 0;
    let failedTests = 0;
    let totalExecutionTime = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      
      try {
        let result: ExecutionResult;
        
        if (request.useMock) {
          jobLogger.info(`Test case ${i + 1}: Using MOCK execution`);
          result = await mockExecution(tc.input);
        } else {
          jobLogger.info(`Test case ${i + 1}: Using DOCKER execution`, {
            input: tc.input.substring(0, 100),
            executablePath: request.executablePath
          });
          result = await executeInSandbox(request.executablePath, tc.input);
          jobLogger.info(`Test case ${i + 1}: Docker result`, {
            output: result.output?.substring(0, 200),
            stderr: result.stderr?.substring(0, 200),
            exitCode: result.exitCode,
            error: result.error
          });
        }

        if (!result.error && !result.timedOut && result.exitCode === 0) {
          observations.push({
            input: tc.input,
            output: result.output,
          });
          successfulTests++;
          jobLogger.info(`Test case ${i + 1}: SUCCESS`, { 
            input: tc.input.substring(0, 50), 
            output: result.output.substring(0, 50) 
          });
        } else {
          failedTests++;
          jobLogger.warn(`Test case ${i + 1} failed`, {
            error: result.error,
            timedOut: result.timedOut,
            exitCode: result.exitCode,
          });
        }

        totalExecutionTime += result.executionTime;
      } catch (error) {
        failedTests++;
        jobLogger.error(`Test case ${i + 1} execution error:`, error);
      }

      // Update progress
      const progress = 25 + (50 * (i + 1) / testCases.length);
      emitProgress(jobId, {
        stage: 'executing',
        progress,
        message: `Executed ${i + 1}/${testCases.length} test cases`,
        details: {
          current: i + 1,
          total: testCases.length,
          successful: successfulTests,
          failed: failedTests,
        },
      });
    }

    jobLogger.info(`Execution complete: ${successfulTests} successful, ${failedTests} failed`);

    if (observations.length === 0) {
      throw new Error('No successful test executions. Cannot infer problem.');
    }

    // Stage 3: Infer Problem
    emitProgress(jobId, {
      stage: 'inferring',
      progress: 75,
      message: 'Analyzing behavior patterns...',
    });

    jobLogger.info('Stage 3: Inferring problem from observations');

    let inference: InferenceResult;
    if (request.useMock) {
      inference = generateMockInference(observations);
    } else {
      inference = await inferProblem(
        request.inputFormat,
        request.constraints,
        observations
      );
    }

    jobLogger.info(`Inferred problem: ${inference.problemTitle}`, {
      confidence: inference.confidence,
    });

    // Complete
    emitProgress(jobId, {
      stage: 'complete',
      progress: 100,
      message: 'Analysis complete!',
      details: {
        problemTitle: inference.problemTitle,
        confidence: inference.confidence,
      },
    });

    const result: AnalysisResult = {
      jobId,
      success: true,
      inference,
      observations,
      testCases,
      executionStats: {
        totalTests: testCases.length,
        successfulTests,
        failedTests,
        averageExecutionTime: totalExecutionTime / testCases.length,
      },
    };

    jobLogger.info('Pipeline complete');
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    jobLogger.error('Pipeline failed:', error);
    
    emitProgress(jobId, {
      stage: 'error',
      progress: 0,
      message: `Analysis failed: ${errorMessage}`,
    });

    return {
      jobId,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Create job directory and save executable
 */
export async function createJob(
  fileBuffer: Buffer,
  originalName: string
): Promise<{ jobId: string; executablePath: string }> {
  const jobId = uuidv4();
  const jobDir = path.join(config.upload.uploadDir, jobId);
  
  await fs.mkdir(jobDir, { recursive: true });
  
  const executablePath = path.join(jobDir, 'program.exe');
  await fs.writeFile(executablePath, fileBuffer);
  
  logger.info(`Created job ${jobId} with executable ${originalName}`);
  
  return { jobId, executablePath };
}

/**
 * Cleanup job directory
 */
export async function cleanupJob(jobId: string): Promise<void> {
  const jobDir = path.join(config.upload.uploadDir, jobId);
  
  try {
    await fs.rm(jobDir, { recursive: true, force: true });
    logger.info(`Cleaned up job ${jobId}`);
  } catch (error) {
    logger.warn(`Failed to cleanup job ${jobId}:`, error);
  }
}

// ========== PHASE 2 ENHANCED PIPELINE ==========

export interface EnhancedAnalysisResult extends AnalysisResult {
  hypotheses?: Array<{ name: string; confidence: number }>;
  patterns?: Array<{ type: string; confidence: number; algorithm: string }>;
  qualityScore?: number;
}

/**
 * Run the enhanced analysis pipeline with Phase 2 features:
 * - Multi-strategy test case generation
 * - Hypothesis validation (20+ patterns)
 * - Adaptive test generation
 * - Pattern detection
 * - Real-time WebSocket updates
 * - Error recovery and fallbacks
 */
export async function runEnhancedPipeline(
  request: AnalysisRequest
): Promise<EnhancedAnalysisResult> {
  const jobId = uuidv4();
  const jobLogger = createJobLogger(jobId);

  jobLogger.info('Starting enhanced analysis pipeline (Phase 2)', {
    inputFormat: request.inputFormat,
    useMock: request.useMock,
  });

  try {
    // ===== Stage 1: Generate Comprehensive Test Suite =====
    sendStageUpdate(jobId, 'generating', 0, { phase: 'initial_tests' });
    sendLogMessage(jobId, 'Generating comprehensive test suite...');

    emitProgress(jobId, {
      stage: 'generating',
      progress: 0,
      message: 'Generating comprehensive test suite...',
    });

    jobLogger.info('Stage 1: Generating comprehensive test suite');

    // Use strategy-based test generation first
    let testCases: TestCase[];
    const strategyTests = generateComprehensiveTestSuite(
      request.inputFormat,
      request.constraints,
      15
    );

    if (request.useMock) {
      testCases = [...strategyTests, ...generateMockTestCases(request.inputFormat, 5)];
    } else {
      try {
        const llmTests = await withRecovery(
          () => generateEnhancedTestCases(request.inputFormat, request.constraints),
          'llm_timeout'
        );
        // Merge strategy tests and LLM tests, removing duplicates
        const allTests = [...strategyTests, ...llmTests];
        const uniqueTests = new Map<string, TestCase>();
        for (const tc of allTests) {
          const key = tc.input.trim().replace(/\s+/g, ' ');
          if (!uniqueTests.has(key)) {
            uniqueTests.set(key, tc);
          }
        }
        testCases = Array.from(uniqueTests.values()).slice(0, 25);
      } catch (error) {
        jobLogger.warn('LLM test generation failed, using strategy tests only');
        testCases = strategyTests;
      }
    }

    jobLogger.info(`Generated ${testCases.length} test cases`);
    sendStageUpdate(jobId, 'generating', 20, { testCount: testCases.length });

    emitProgress(jobId, {
      stage: 'generating',
      progress: 20,
      message: `Generated ${testCases.length} diverse test cases`,
      details: { testCaseCount: testCases.length },
    });

    // ===== Stage 2: Execute Initial Test Cases =====
    sendStageUpdate(jobId, 'executing', 20, { phase: 'initial_execution' });
    sendLogMessage(jobId, 'Executing test cases in secure sandbox...');

    emitProgress(jobId, {
      stage: 'executing',
      progress: 20,
      message: 'Executing test cases in sandbox...',
    });

    jobLogger.info('Stage 2: Executing initial test cases');

    let observations: Observation[] = [];
    let successfulTests = 0;
    let failedTests = 0;
    let totalExecutionTime = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];

      try {
        let result: ExecutionResult;

        if (request.useMock) {
          result = await mockExecution(tc.input);
        } else {
          result = await executeInSandbox(request.executablePath, tc.input);
        }

        if (!result.error && !result.timedOut && result.exitCode === 0) {
          observations.push({
            input: tc.input,
            output: result.output,
          });
          successfulTests++;
        } else {
          failedTests++;
          jobLogger.warn(`Test case ${i + 1} failed`, {
            error: result.error,
            timedOut: result.timedOut,
            exitCode: result.exitCode,
          });
        }

        totalExecutionTime += result.executionTime;
      } catch (error) {
        failedTests++;
        jobLogger.error(`Test case ${i + 1} execution error:`, error);
      }

      // Update progress
      const progress = 20 + (30 * (i + 1)) / testCases.length;
      sendTestCaseUpdate(jobId, i, testCases.length, observations[observations.length - 1]);

      emitProgress(jobId, {
        stage: 'executing',
        progress,
        message: `Executed ${i + 1}/${testCases.length} test cases`,
        details: {
          current: i + 1,
          total: testCases.length,
          successful: successfulTests,
          failed: failedTests,
        },
      });
    }

    jobLogger.info(`Initial execution: ${successfulTests} successful, ${failedTests} failed`);

    if (observations.length === 0) {
      throw new Error('No successful test executions. Cannot infer problem.');
    }

    // ===== Stage 2.5: Hypothesis Validation & Adaptive Testing =====
    sendStageUpdate(jobId, 'executing', 50, { phase: 'hypothesis_validation' });
    sendLogMessage(jobId, 'Validating hypotheses against observations...');

    jobLogger.info('Stage 2.5: Validating hypotheses');

    let topHypotheses = getTopHypotheses(observations);
    jobLogger.info(
      `Top hypotheses: ${topHypotheses.map((h) => `${h.name}(${(h.confidence * 100).toFixed(0)}%)`).join(', ')}`
    );

    sendHypothesisUpdate(
      jobId,
      topHypotheses.map((h) => ({ name: h.name, confidence: h.confidence }))
    );

    // If multiple hypotheses have similar confidence, generate discriminating tests
    if (
      topHypotheses.length > 1 &&
      topHypotheses[0].confidence - topHypotheses[1].confidence < 0.2
    ) {
      sendLogMessage(jobId, 'Generating discriminating tests to refine analysis...');
      jobLogger.info('Generating discriminating tests');

      const adaptiveTests = await generateAdaptiveTests(
        observations,
        topHypotheses.map((h) => ({ name: h.name, confidence: h.confidence })),
        request.inputFormat
      );

      if (adaptiveTests.length > 0) {
        jobLogger.info(`Running ${adaptiveTests.length} additional discriminating tests`);

        for (let i = 0; i < adaptiveTests.length; i++) {
          const tc = adaptiveTests[i];

          try {
            let result: ExecutionResult;

            if (request.useMock) {
              result = await mockExecution(tc.input);
            } else {
              result = await executeInSandbox(request.executablePath, tc.input);
            }

            if (!result.error && !result.timedOut && result.exitCode === 0) {
              observations.push({
                input: tc.input,
                output: result.output,
              });
              successfulTests++;
            }

            totalExecutionTime += result.executionTime;
          } catch (error) {
            jobLogger.error(`Adaptive test ${i + 1} error:`, error);
          }
        }

        // Re-validate with new observations
        topHypotheses = getTopHypotheses(observations);
        jobLogger.info(
          `Updated hypotheses: ${topHypotheses.map((h) => `${h.name}(${(h.confidence * 100).toFixed(0)}%)`).join(', ')}`
        );

        sendHypothesisUpdate(
          jobId,
          topHypotheses.map((h) => ({ name: h.name, confidence: h.confidence }))
        );
      }
    }

    // Detect computational patterns
    const detectedPatterns = detectPatterns(observations);
    if (detectedPatterns.length > 0) {
      jobLogger.info(
        `Detected patterns: ${detectedPatterns.map((p) => `${p.suggestedAlgorithm}(${(p.confidence * 100).toFixed(0)}%)`).join(', ')}`
      );
      sendPatternUpdate(
        jobId,
        detectedPatterns.map((p) => ({
          type: p.type,
          confidence: p.confidence,
          algorithm: p.suggestedAlgorithm,
        }))
      );
    }

    // ===== Stage 3: LLM Inference with Hypothesis Context =====
    sendStageUpdate(jobId, 'inferring', 70, { phase: 'llm_inference' });
    sendLogMessage(jobId, 'Analyzing behavior patterns with AI...');

    emitProgress(jobId, {
      stage: 'inferring',
      progress: 70,
      message: 'Analyzing behavior patterns with hypothesis context...',
    });

    jobLogger.info('Stage 3: Inferring problem with hypothesis context');

    let inference: InferenceResult;
    let fallbackUsed = false;

    if (request.useMock) {
      inference = generateMockEnhancedInference(
        observations,
        topHypotheses.map((h) => ({
          name: h.name,
          confidence: h.confidence,
          description: h.description,
        }))
      );
    } else {
      try {
        inference = await withRecovery(
          () =>
            inferProblemWithHypotheses(
              request.inputFormat,
              request.constraints,
              observations,
              topHypotheses.map((h) => ({
                name: h.name,
                confidence: h.confidence,
                description: h.description,
              })),
              detectedPatterns
            ),
          'llm_timeout'
        );
      } catch (error) {
        jobLogger.warn('LLM inference failed, using fallback');
        fallbackUsed = true;

        // Generate fallback using hypothesis-based mock
        if (topHypotheses.length > 0 && topHypotheses[0].confidence > 0.8) {
          inference = generateMockEnhancedInference(
            observations,
            topHypotheses.map((h) => ({
              name: h.name,
              confidence: h.confidence,
              description: h.description,
            }))
          );
        } else {
          const fallback = generateFallbackResult(observations);
          inference = {
            problemTitle: 'Analysis Result (Partial)',
            problemStatement: fallback.problemStatement,
            inputFormat: request.inputFormat,
            outputFormat: 'See problem statement',
            constraints: request.constraints || 'Unknown',
            sampleTestCases: observations.slice(0, 3).map((obs) => ({
              input: obs.input,
              output: obs.output,
              explanation: 'Generated from test execution',
            })),
            solutionCode: fallback.solution,
            algorithmExplanation: fallback.algorithm,
            timeComplexity: 'Unknown',
            spaceComplexity: 'Unknown',
            confidence: 0.5,
          };
        }
      }
    }

    jobLogger.info(`Inferred problem: ${inference.problemTitle}`, {
      confidence: inference.confidence,
      fallbackUsed,
    });

    // ===== Stage 4: Result Verification & Refinement =====
    sendStageUpdate(jobId, 'inferring', 90, { phase: 'verification' });
    sendLogMessage(jobId, 'Verifying and refining results...');

    const analysisResult: FallbackResult = {
      problemStatement: `# ${inference.problemTitle}\n\n${inference.problemStatement}`,
      solution: inference.solutionCode,
      algorithm: inference.algorithmExplanation,
      observations,
    };

    const verification = await verifySolution(analysisResult, observations);
    const qualityAnalysis = analyzeResultQuality(analysisResult);

    jobLogger.info(`Result quality: ${qualityAnalysis.score}/100`, {
      verified: verification.verified,
      accuracy: verification.accuracy,
    });

    if (qualityAnalysis.issues.length > 0) {
      jobLogger.warn('Quality issues:', qualityAnalysis.issues);
    }

    // ===== Complete =====
    sendStageUpdate(jobId, 'complete', 100);
    sendCompletion(jobId, {
      problemTitle: inference.problemTitle,
      confidence: inference.confidence,
      qualityScore: qualityAnalysis.score,
    });

    emitProgress(jobId, {
      stage: 'complete',
      progress: 100,
      message: 'Analysis complete!',
      details: {
        problemTitle: inference.problemTitle,
        confidence: inference.confidence,
        qualityScore: qualityAnalysis.score,
      },
    });

    const result: EnhancedAnalysisResult = {
      jobId,
      success: true,
      inference,
      observations,
      testCases,
      executionStats: {
        totalTests: testCases.length,
        successfulTests,
        failedTests,
        averageExecutionTime: totalExecutionTime / testCases.length,
      },
      hypotheses: topHypotheses.map((h) => ({
        name: h.name,
        confidence: h.confidence,
      })),
      patterns: detectedPatterns.map((p) => ({
        type: p.type,
        confidence: p.confidence,
        algorithm: p.suggestedAlgorithm,
      })),
      qualityScore: qualityAnalysis.score,
    };

    jobLogger.info('Enhanced pipeline complete');
    return result;
  } catch (error) {
    const err = error as Error;
    const errorType = classifyError(err);
    const errorMessage = getErrorMessage(errorType, err);

    jobLogger.error(`Pipeline failed (${errorType}):`, error);

    sendError(jobId, errorMessage);

    emitProgress(jobId, {
      stage: 'error',
      progress: 0,
      message: `Analysis failed: ${errorMessage}`,
    });

    return {
      jobId,
      success: false,
      error: errorMessage,
    };
  }
}
