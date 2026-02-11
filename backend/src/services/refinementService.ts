import { logger } from '../utils/logger';
import { AnalysisResult } from './errorRecoveryService';

interface RefinementContext {
  originalResult: AnalysisResult;
  observations: { input: string; output: string }[];
  inputFormat: string;
  constraints: string;
}

interface VerificationResult {
  verified: boolean;
  mismatches: Mismatch[];
  accuracy: number;
}

interface Mismatch {
  input: string;
  expected: string;
  actual: string;
}

/**
 * Verify the generated solution against observations
 * Note: This is a basic verification without actual code execution
 * Full verification would require compiling and running the generated code
 */
export async function verifySolution(
  result: AnalysisResult,
  observations: { input: string; output: string }[]
): Promise<VerificationResult> {
  const mismatches: Mismatch[] = [];

  // Check if solution code looks complete
  const solutionCode = result.solution;
  const hasMainFunction = /int\s+main|void\s+main|def\s+main|function\s+main/.test(solutionCode);
  const hasInputHandling = /cin|scanf|input\(|readline/.test(solutionCode);
  const hasOutputHandling = /cout|printf|print\(|console\.log/.test(solutionCode);

  let codeCompleteness = 0;
  if (hasMainFunction) codeCompleteness += 0.4;
  if (hasInputHandling) codeCompleteness += 0.3;
  if (hasOutputHandling) codeCompleteness += 0.3;

  // Check if algorithm description is meaningful
  const algorithmDescribed = result.algorithm && result.algorithm !== 'Unknown' && result.algorithm.length > 3;
  const algorithmScore = algorithmDescribed ? 0.2 : 0;

  // Check problem statement completeness
  const hasInputFormat = result.problemStatement.toLowerCase().includes('input');
  const hasOutputFormat = result.problemStatement.toLowerCase().includes('output');
  const hasConstraints = result.problemStatement.toLowerCase().includes('constraint');
  const statementCompleteness = ((hasInputFormat ? 1 : 0) + (hasOutputFormat ? 1 : 0) + (hasConstraints ? 1 : 0)) / 3 * 0.2;

  // Calculate overall accuracy estimate
  const accuracy = Math.min(1, codeCompleteness * 0.6 + algorithmScore + statementCompleteness);

  logger.debug(`Verification - Code completeness: ${codeCompleteness.toFixed(2)}, Algorithm: ${algorithmScore}, Statement: ${statementCompleteness.toFixed(2)}, Total: ${accuracy.toFixed(2)}`);

  return {
    verified: accuracy > 0.8,
    mismatches,
    accuracy,
  };
}

/**
 * Refine the result if verification fails
 */
export async function refineResult(
  context: RefinementContext,
  verificationResult: VerificationResult
): Promise<AnalysisResult> {
  // If accuracy is acceptable, return original
  if (verificationResult.accuracy > 0.7) {
    logger.debug('Result accuracy acceptable, no refinement needed');
    return context.originalResult;
  }

  logger.info('Refining result due to low accuracy');

  // Enhance the result with additional context
  const enhancedResult = { ...context.originalResult };

  // Add missing sections to problem statement if needed
  if (!context.originalResult.problemStatement.includes('## Input Format')) {
    enhancedResult.problemStatement = appendInputFormat(
      context.originalResult.problemStatement,
      context.inputFormat
    );
  }

  if (!context.originalResult.problemStatement.includes('## Constraints') && context.constraints) {
    enhancedResult.problemStatement = appendConstraints(
      enhancedResult.problemStatement,
      context.constraints
    );
  }

  // Add sample test cases if not present
  if (!context.originalResult.problemStatement.includes('## Sample')) {
    enhancedResult.problemStatement = appendSampleCases(
      enhancedResult.problemStatement,
      context.observations.slice(0, 3)
    );
  }

  return enhancedResult;
}

/**
 * Append input format section to problem statement
 */
function appendInputFormat(statement: string, inputFormat: string): string {
  return `${statement}

## Input Format
${inputFormat}`;
}

/**
 * Append constraints section to problem statement
 */
function appendConstraints(statement: string, constraints: string): string {
  return `${statement}

## Constraints
${constraints}`;
}

/**
 * Append sample test cases to problem statement
 */
function appendSampleCases(
  statement: string,
  observations: { input: string; output: string }[]
): string {
  if (observations.length === 0) return statement;

  const samples = observations
    .map(
      (obs, i) => `### Sample ${i + 1}
**Input:**
\`\`\`
${obs.input.trim()}
\`\`\`
**Output:**
\`\`\`
${obs.output.trim()}
\`\`\``
    )
    .join('\n\n');

  return `${statement}

## Sample Test Cases
${samples}`;
}

/**
 * Analyze the quality of the generated result
 */
export function analyzeResultQuality(result: AnalysisResult): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Check problem statement
  if (!result.problemStatement || result.problemStatement.length < 100) {
    issues.push('Problem statement is too short');
    suggestions.push('Generate a more detailed problem description');
    score -= 20;
  }

  // Check for input format description
  if (!result.problemStatement.toLowerCase().includes('input')) {
    issues.push('Missing input format description');
    suggestions.push('Add clear input format specification');
    score -= 10;
  }

  // Check for output format description
  if (!result.problemStatement.toLowerCase().includes('output')) {
    issues.push('Missing output format description');
    suggestions.push('Add clear output format specification');
    score -= 10;
  }

  // Check solution code
  if (!result.solution || result.solution.length < 50) {
    issues.push('Solution code is missing or too short');
    suggestions.push('Generate complete solution code');
    score -= 30;
  }

  // Check for common code issues
  if (result.solution.includes('// TODO') || result.solution.includes('...')) {
    issues.push('Solution code contains placeholders');
    suggestions.push('Complete all placeholder code sections');
    score -= 15;
  }

  // Check algorithm description
  if (!result.algorithm || result.algorithm === 'Unknown') {
    issues.push('Algorithm not identified');
    suggestions.push('Determine and describe the algorithm used');
    score -= 15;
  }

  // Check observations
  if (!result.observations || result.observations.length < 3) {
    issues.push('Too few test observations');
    suggestions.push('Run more test cases for better analysis');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}

/**
 * Compare two results and determine which is better
 */
export function compareResults(
  result1: AnalysisResult,
  result2: AnalysisResult
): { better: AnalysisResult; reason: string } {
  const quality1 = analyzeResultQuality(result1);
  const quality2 = analyzeResultQuality(result2);

  if (quality1.score > quality2.score) {
    return {
      better: result1,
      reason: `First result has higher quality score (${quality1.score} vs ${quality2.score})`,
    };
  } else if (quality2.score > quality1.score) {
    return {
      better: result2,
      reason: `Second result has higher quality score (${quality2.score} vs ${quality1.score})`,
    };
  }

  // If scores are equal, prefer the one with more observations
  if (result1.observations.length > result2.observations.length) {
    return {
      better: result1,
      reason: 'First result has more test observations',
    };
  } else if (result2.observations.length > result1.observations.length) {
    return {
      better: result2,
      reason: 'Second result has more test observations',
    };
  }

  // Default to first result
  return {
    better: result1,
    reason: 'Results are equivalent',
  };
}
