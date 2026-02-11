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
  TestCase,
  Observation,
  InferenceResult,
} from './llmService';

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

    jobLogger.info('Stage 2: Executing test cases');
    
    const observations: Observation[] = [];
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
