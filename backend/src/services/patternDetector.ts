import { logger } from '../utils/logger';

export interface DetectedPattern {
  type: PatternType;
  confidence: number;
  evidence: string[];
  suggestedAlgorithm: string;
}

export type PatternType =
  | 'linear_aggregation' // O(n) sum/count operations
  | 'quadratic_comparison' // O(n²) comparisons
  | 'logarithmic_search' // Binary search behavior
  | 'sorting_based' // Output depends on sorted order
  | 'dp_optimal' // Optimal substructure visible
  | 'greedy_local' // Local optimal choices
  | 'mathematical_transform' // Pure mathematical computation
  | 'string_manipulation' // Character-level operations
  | 'unknown';

interface Observation {
  input: string;
  output: string;
}

/**
 * Analyze observations to detect algorithmic patterns
 */
export function detectPatterns(observations: Observation[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Pattern 1: Linear Aggregation Detection
  const linearPattern = detectLinearAggregation(observations);
  if (linearPattern) patterns.push(linearPattern);

  // Pattern 2: Sorting-Based Detection
  const sortingPattern = detectSortingBehavior(observations);
  if (sortingPattern) patterns.push(sortingPattern);

  // Pattern 3: Mathematical Transform
  const mathPattern = detectMathematicalTransform(observations);
  if (mathPattern) patterns.push(mathPattern);

  // Pattern 4: DP Optimal Structure
  const dpPattern = detectDPStructure(observations);
  if (dpPattern) patterns.push(dpPattern);

  // Pattern 5: Binary/Boolean Output
  const booleanPattern = detectBooleanOutput(observations);
  if (booleanPattern) patterns.push(booleanPattern);

  // Pattern 6: Selection Pattern
  const selectionPattern = detectSelectionPattern(observations);
  if (selectionPattern) patterns.push(selectionPattern);

  // Sort by confidence
  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect linear aggregation patterns (sum, count, etc.)
 */
function detectLinearAggregation(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];
  let confidence = 0;

  // Check if output scales linearly with input size
  const sizeOutputPairs = observations
    .map((obs) => {
      const numbers = extractNumbers(obs.input);
      return {
        size: numbers.length,
        inputSum: numbers.reduce((a, b) => a + b, 0),
        inputProduct: numbers.reduce((a, b) => a * b, 1),
        output: parseFloat(obs.output),
      };
    })
    .filter((p) => !isNaN(p.output));

  // Check sum correlation
  const sumMatches = sizeOutputPairs.filter((p) => p.inputSum === p.output).length;
  if (sumMatches > sizeOutputPairs.length * 0.8) {
    confidence = 0.95;
    evidence.push(`${sumMatches}/${sizeOutputPairs.length} observations match sum hypothesis`);
    return {
      type: 'linear_aggregation',
      confidence,
      evidence,
      suggestedAlgorithm: 'Array Sum - Linear scan',
    };
  }

  // Check product correlation
  const productMatches = sizeOutputPairs.filter((p) => p.inputProduct === p.output).length;
  if (productMatches > sizeOutputPairs.length * 0.8) {
    confidence = 0.9;
    evidence.push(`${productMatches}/${sizeOutputPairs.length} observations match product hypothesis`);
    return {
      type: 'linear_aggregation',
      confidence,
      evidence,
      suggestedAlgorithm: 'Array Product - Linear scan',
    };
  }

  // Check count correlation
  const countMatches = sizeOutputPairs.filter((p) => p.size === p.output).length;
  if (countMatches > sizeOutputPairs.length * 0.8) {
    confidence = 0.85;
    evidence.push(`${countMatches}/${sizeOutputPairs.length} observations match count hypothesis`);
    return {
      type: 'linear_aggregation',
      confidence,
      evidence,
      suggestedAlgorithm: 'Element Count',
    };
  }

  return null;
}

/**
 * Detect sorting-based behavior
 */
function detectSortingBehavior(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];

  // Check if output equals sorted input
  const sortedOutputMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    const sorted = [...numbers].sort((a, b) => a - b);
    const outputNumbers = obs.output
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    // Check if output equals sorted input
    if (
      sorted.length === outputNumbers.length &&
      sorted.every((v, i) => v === outputNumbers[i])
    ) {
      return true;
    }

    return false;
  });

  const sortedConfidence = sortedOutputMatches.length / observations.length;
  if (sortedConfidence > 0.8) {
    evidence.push(`${sortedOutputMatches.length}/${observations.length} outputs match sorted input`);
    return {
      type: 'sorting_based',
      confidence: sortedConfidence,
      evidence,
      suggestedAlgorithm: 'Sort Array - O(n log n)',
    };
  }

  // Check if output relates to max/min (selection)
  const maxMinMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    if (numbers.length === 0) return false;
    const output = parseFloat(obs.output.trim());
    if (isNaN(output)) return false;

    const max = Math.max(...numbers);
    const min = Math.min(...numbers);

    return output === max || output === min;
  });

  const selectionConfidence = maxMinMatches.length / observations.length;
  if (selectionConfidence > 0.7) {
    evidence.push(`${maxMinMatches.length}/${observations.length} outputs relate to max/min`);
    return {
      type: 'sorting_based',
      confidence: selectionConfidence,
      evidence,
      suggestedAlgorithm: 'Selection (Max/Min) - Linear scan',
    };
  }

  return null;
}

/**
 * Detect mathematical transform patterns
 */
function detectMathematicalTransform(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];

  // Check for factorial pattern
  const factorialMatches = observations.filter((obs) => {
    const n = extractFirstNumber(obs.input);
    if (n === null || n > 20 || n < 0) return false;
    const expected = factorial(n);
    return expected.toString() === obs.output.trim();
  });

  if (factorialMatches.length > observations.length * 0.8) {
    evidence.push('Factorial pattern detected');
    return {
      type: 'mathematical_transform',
      confidence: 0.95,
      evidence,
      suggestedAlgorithm: 'Factorial computation - O(n)',
    };
  }

  // Check for Fibonacci pattern
  const fibMatches = observations.filter((obs) => {
    const n = extractFirstNumber(obs.input);
    if (n === null || n > 45 || n < 1) return false;
    const expected = fibonacci(n);
    return expected.toString() === obs.output.trim();
  });

  if (fibMatches.length > observations.length * 0.8) {
    evidence.push('Fibonacci pattern detected');
    return {
      type: 'mathematical_transform',
      confidence: 0.95,
      evidence,
      suggestedAlgorithm: 'Fibonacci number computation - O(n)',
    };
  }

  // Check for GCD pattern
  const gcdMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input).map(Math.abs);
    if (numbers.length === 0) return false;
    const expected = numbers.reduce(gcd, numbers[0]);
    return expected.toString() === obs.output.trim();
  });

  if (gcdMatches.length > observations.length * 0.7) {
    evidence.push('GCD pattern detected');
    return {
      type: 'mathematical_transform',
      confidence: 0.9,
      evidence,
      suggestedAlgorithm: 'GCD computation - Euclidean algorithm',
    };
  }

  // Check for digit sum pattern
  const digitSumMatches = observations.filter((obs) => {
    const n = extractFirstNumber(obs.input);
    if (n === null) return false;
    const expected = Math.abs(n)
      .toString()
      .split('')
      .reduce((a, b) => a + parseInt(b), 0);
    return expected.toString() === obs.output.trim();
  });

  if (digitSumMatches.length > observations.length * 0.8) {
    evidence.push('Digit sum pattern detected');
    return {
      type: 'mathematical_transform',
      confidence: 0.9,
      evidence,
      suggestedAlgorithm: 'Digit Sum computation',
    };
  }

  return null;
}

/**
 * Detect dynamic programming structure
 */
function detectDPStructure(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];

  // Check for maximum subarray sum (Kadane's algorithm)
  const kadaneMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    if (numbers.length === 0) return false;
    const expected = kadane(numbers);
    return expected.toString() === obs.output.trim();
  });

  if (kadaneMatches.length > observations.length * 0.8) {
    evidence.push('Maximum subarray sum pattern detected');
    return {
      type: 'dp_optimal',
      confidence: 0.9,
      evidence,
      suggestedAlgorithm: "Kadane's Algorithm (Maximum Subarray Sum) - O(n)",
    };
  }

  // Check for LIS length
  const lisMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    if (numbers.length === 0) return false;
    const expected = lisLength(numbers);
    return expected.toString() === obs.output.trim();
  });

  if (lisMatches.length > observations.length * 0.7) {
    evidence.push('LIS pattern detected');
    return {
      type: 'dp_optimal',
      confidence: 0.85,
      evidence,
      suggestedAlgorithm: 'Longest Increasing Subsequence - O(n log n)',
    };
  }

  return null;
}

/**
 * Detect boolean/binary output patterns
 */
function detectBooleanOutput(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];

  // Check if all outputs are boolean-like
  const booleanOutputs = observations.every((obs) => {
    const out = obs.output.trim().toLowerCase();
    return ['yes', 'no', '0', '1', 'true', 'false'].includes(out);
  });

  if (!booleanOutputs) return null;

  // Check for prime detection pattern
  const primeMatches = observations.filter((obs) => {
    const n = extractFirstNumber(obs.input);
    if (n === null) return false;
    const isPrime = checkPrime(n);
    const out = obs.output.trim().toLowerCase();
    return (
      (isPrime && ['yes', '1', 'true'].includes(out)) ||
      (!isPrime && ['no', '0', 'false'].includes(out))
    );
  });

  if (primeMatches.length > observations.length * 0.8) {
    evidence.push('Prime check pattern detected');
    return {
      type: 'mathematical_transform',
      confidence: 0.9,
      evidence,
      suggestedAlgorithm: 'Prime number detection - O(√n)',
    };
  }

  // Check for sorted check pattern
  const sortedCheckMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    const isSorted = numbers.every((val, i, arr) => i === 0 || arr[i - 1] <= val);
    const out = obs.output.trim().toLowerCase();
    return (
      (isSorted && ['yes', '1', 'true'].includes(out)) ||
      (!isSorted && ['no', '0', 'false'].includes(out))
    );
  });

  if (sortedCheckMatches.length > observations.length * 0.8) {
    evidence.push('Sorted check pattern detected');
    return {
      type: 'sorting_based',
      confidence: 0.85,
      evidence,
      suggestedAlgorithm: 'Check if array is sorted - O(n)',
    };
  }

  return null;
}

/**
 * Detect selection patterns (max, min, median, etc.)
 */
function detectSelectionPattern(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];

  // Check for max pattern
  const maxMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    if (numbers.length === 0) return false;
    const output = parseFloat(obs.output.trim());
    if (isNaN(output)) return false;
    return Math.max(...numbers) === output;
  });

  if (maxMatches.length > observations.length * 0.9) {
    evidence.push(`${maxMatches.length}/${observations.length} outputs match maximum`);
    return {
      type: 'linear_aggregation',
      confidence: 0.95,
      evidence,
      suggestedAlgorithm: 'Find Maximum - O(n)',
    };
  }

  // Check for min pattern
  const minMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    if (numbers.length === 0) return false;
    const output = parseFloat(obs.output.trim());
    if (isNaN(output)) return false;
    return Math.min(...numbers) === output;
  });

  if (minMatches.length > observations.length * 0.9) {
    evidence.push(`${minMatches.length}/${observations.length} outputs match minimum`);
    return {
      type: 'linear_aggregation',
      confidence: 0.95,
      evidence,
      suggestedAlgorithm: 'Find Minimum - O(n)',
    };
  }

  // Check for range (max-min) pattern
  const rangeMatches = observations.filter((obs) => {
    const numbers = extractNumbers(obs.input);
    if (numbers.length === 0) return false;
    const output = parseFloat(obs.output.trim());
    if (isNaN(output)) return false;
    return Math.max(...numbers) - Math.min(...numbers) === output;
  });

  if (rangeMatches.length > observations.length * 0.85) {
    evidence.push(`${rangeMatches.length}/${observations.length} outputs match range (max-min)`);
    return {
      type: 'linear_aggregation',
      confidence: 0.9,
      evidence,
      suggestedAlgorithm: 'Find Range (Max - Min) - O(n)',
    };
  }

  return null;
}

// ============ HELPER FUNCTIONS ============

function extractNumbers(input: string): number[] {
  const matches = input.match(/-?\d+/g);
  if (!matches || matches.length <= 1) return matches ? matches.map(Number) : [];
  const firstNum = parseInt(matches[0]);
  if (firstNum === matches.length - 1) {
    return matches.slice(1).map(Number);
  }
  return matches.map(Number);
}

function extractFirstNumber(input: string): number | null {
  const match = input.match(/-?\d+/);
  return match ? parseInt(match[0]) : null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function fibonacci(n: number): number {
  if (n <= 2) return 1;
  let a = 1,
    b = 1;
  for (let i = 3; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

function checkPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

function kadane(arr: number[]): number {
  let maxSoFar = arr[0];
  let maxEndingHere = arr[0];
  for (let i = 1; i < arr.length; i++) {
    maxEndingHere = Math.max(arr[i], maxEndingHere + arr[i]);
    maxSoFar = Math.max(maxSoFar, maxEndingHere);
  }
  return maxSoFar;
}

function lisLength(arr: number[]): number {
  const dp: number[] = [];
  for (const num of arr) {
    let lo = 0,
      hi = dp.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (dp[mid] < num) lo = mid + 1;
      else hi = mid;
    }
    if (lo === dp.length) dp.push(num);
    else dp[lo] = num;
  }
  return dp.length;
}

/**
 * Get all detected patterns with their algorithms
 */
export function getPatternSummary(observations: Observation[]): string {
  const patterns = detectPatterns(observations);

  if (patterns.length === 0) {
    return 'No algorithmic patterns detected with high confidence.';
  }

  return patterns
    .map(
      (p) =>
        `- ${p.suggestedAlgorithm} (${(p.confidence * 100).toFixed(0)}% confidence)\n  Evidence: ${p.evidence.join('; ')}`
    )
    .join('\n\n');
}
