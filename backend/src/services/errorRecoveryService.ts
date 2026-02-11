import { logger } from '../utils/logger';

export type ErrorType =
  | 'llm_timeout'
  | 'llm_rate_limit'
  | 'llm_invalid_response'
  | 'docker_timeout'
  | 'docker_memory'
  | 'docker_network'
  | 'execution_failed'
  | 'parse_error'
  | 'unknown';

interface RecoveryStrategy {
  type: ErrorType;
  maxRetries: number;
  backoffMs: number;
  fallback?: () => Promise<unknown>;
}

export interface AnalysisResult {
  problemStatement: string;
  solution: string;
  algorithm: string;
  observations: { input: string; output: string }[];
}

const recoveryStrategies: Map<ErrorType, RecoveryStrategy> = new Map([
  ['llm_timeout', { type: 'llm_timeout', maxRetries: 3, backoffMs: 2000 }],
  ['llm_rate_limit', { type: 'llm_rate_limit', maxRetries: 3, backoffMs: 5000 }],
  ['llm_invalid_response', { type: 'llm_invalid_response', maxRetries: 2, backoffMs: 1000 }],
  ['docker_timeout', { type: 'docker_timeout', maxRetries: 1, backoffMs: 0 }],
  ['docker_memory', { type: 'docker_memory', maxRetries: 0, backoffMs: 0 }],
  ['execution_failed', { type: 'execution_failed', maxRetries: 2, backoffMs: 500 }],
  ['parse_error', { type: 'parse_error', maxRetries: 2, backoffMs: 500 }],
  ['unknown', { type: 'unknown', maxRetries: 1, backoffMs: 1000 }],
]);

/**
 * Classify error type from error message/object
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  if (message.includes('timeout') && (message.includes('llm') || message.includes('gemini'))) {
    return 'llm_timeout';
  }
  if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
    return 'llm_rate_limit';
  }
  if (message.includes('invalid') && (message.includes('json') || message.includes('response'))) {
    return 'llm_invalid_response';
  }
  if (message.includes('timeout') && message.includes('docker')) {
    return 'docker_timeout';
  }
  if (message.includes('memory') || message.includes('oom')) {
    return 'docker_memory';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'docker_network';
  }
  if (message.includes('execution') || message.includes('exit code')) {
    return 'execution_failed';
  }
  if (message.includes('parse')) {
    return 'parse_error';
  }

  return 'unknown';
}

/**
 * Execute operation with retry and recovery
 */
export async function withRecovery<T>(
  operation: () => Promise<T>,
  errorType: ErrorType,
  context?: Record<string, unknown>
): Promise<T> {
  const strategy = recoveryStrategies.get(errorType) || {
    type: 'unknown',
    maxRetries: 1,
    backoffMs: 1000,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = strategy.backoffMs * Math.pow(2, attempt - 1);
        logger.info(`Retry attempt ${attempt}/${strategy.maxRetries} after ${backoff}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }

      return await operation();
    } catch (error) {
      lastError = error as Error;
      const actualType = classifyError(lastError);

      logger.warn(`Operation failed (${actualType}):`, lastError.message);

      if (actualType !== errorType) {
        // Different error type, may need different strategy
        const newStrategy = recoveryStrategies.get(actualType);
        if (!newStrategy || newStrategy.maxRetries === 0) {
          throw lastError;
        }
      }
    }
  }

  // All retries exhausted
  if (strategy.fallback) {
    logger.info('Using fallback strategy');
    return (await strategy.fallback()) as T;
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Generate fallback result when all else fails
 */
export function generateFallbackResult(
  observations: { input: string; output: string }[]
): AnalysisResult {
  // Generate a basic analysis based on observation patterns
  const patterns = analyzeBasicPatterns(observations);

  return {
    problemStatement: `# Analysis Result (Fallback Mode)

## Observations
The program was tested with ${observations.length} test cases.

## Detected Patterns
${patterns.join('\n')}

## Note
Full analysis could not be completed due to errors. Manual review recommended.

## Sample I/O Data
${observations
  .slice(0, 5)
  .map((obs, i) => `### Test ${i + 1}\n**Input:**\n\`\`\`\n${obs.input}\`\`\`\n**Output:** \`${obs.output}\``)
  .join('\n\n')}`,
    solution: `// Solution could not be generated automatically
// Based on ${observations.length} test observations
// Please review the patterns and implement manually`,
    algorithm: 'Unknown - Requires manual analysis',
    observations,
  };
}

/**
 * Analyze basic patterns from observations
 */
function analyzeBasicPatterns(observations: { input: string; output: string }[]): string[] {
  const patterns: string[] = [];

  // Check if outputs are numeric
  const numericOutputs = observations.every((obs) =>
    /^-?\d+(\.\d+)?$/.test(obs.output.trim())
  );
  if (numericOutputs) {
    patterns.push('- Output is always a single numeric value');
  }

  // Check for Yes/No outputs
  const booleanOutputs = observations.every((obs) =>
    ['yes', 'no', '0', '1', 'true', 'false'].includes(obs.output.trim().toLowerCase())
  );
  if (booleanOutputs) {
    patterns.push('- Output is binary (Yes/No or 0/1)');
  }

  // Check output value range
  const values = observations
    .map((obs) => parseFloat(obs.output))
    .filter((v) => !isNaN(v));

  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    patterns.push(`- Output range: ${min} to ${max}`);
  }

  // Check if output contains spaces (array/list output)
  const arrayOutputs = observations.some((obs) => obs.output.trim().includes(' '));
  if (arrayOutputs) {
    patterns.push('- Some outputs contain multiple values (array/list format)');
  }

  // Check correlation with input size
  const sizeCorrelation = observations.filter((obs) => {
    const firstNum = parseInt(obs.input.match(/-?\d+/)?.[0] || '0');
    const output = parseFloat(obs.output);
    return firstNum === output;
  }).length;

  if (sizeCorrelation > observations.length * 0.5) {
    patterns.push('- Output may correlate with input size or first number');
  }

  if (patterns.length === 0) {
    patterns.push('- No obvious patterns detected');
  }

  return patterns;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(type: ErrorType, error: Error): string {
  switch (type) {
    case 'llm_timeout':
      return 'AI service is taking too long. Please try again later.';
    case 'llm_rate_limit':
      return 'Service is temporarily rate limited. Please try again in a few minutes.';
    case 'llm_invalid_response':
      return 'AI service returned an unexpected response. Retrying with different parameters.';
    case 'docker_timeout':
      return 'Executable took too long to run. The program may have an infinite loop.';
    case 'docker_memory':
      return 'Executable exceeded memory limits.';
    case 'docker_network':
      return 'Docker network error. Please ensure Docker is running properly.';
    case 'execution_failed':
      return 'Executable failed to run. It may be corrupted or incompatible.';
    case 'parse_error':
      return 'Failed to parse the response. Please try again.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: Error): boolean {
  const type = classifyError(error);
  const strategy = recoveryStrategies.get(type);
  return strategy ? strategy.maxRetries > 0 : false;
}

/**
 * Create a timeout wrapper for async operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorType: ErrorType
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms (${errorType})`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
