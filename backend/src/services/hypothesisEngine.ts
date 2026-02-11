import { logger } from '../utils/logger';

export interface Hypothesis {
  id: string;
  name: string;
  description: string;
  category: HypothesisCategory;
  validator: (input: string, output: string) => ValidationResult;
  confidence: number;
  matchCount: number;
  mismatchCount: number;
}

export interface ValidationResult {
  matches: boolean;
  expected?: string;
  explanation?: string;
}

export type HypothesisCategory =
  | 'aggregation' // Sum, Product, Count, etc.
  | 'selection' // Max, Min, Median, etc.
  | 'sorting' // Check sorted, Sort output
  | 'searching' // Binary search, Linear search
  | 'mathematical' // GCD, LCM, Factorial, etc.
  | 'dp' // Dynamic programming patterns
  | 'string' // String operations
  | 'other';

/**
 * Library of common algorithmic hypotheses (20+)
 */
export const hypothesisLibrary: Omit<
  Hypothesis,
  'confidence' | 'matchCount' | 'mismatchCount'
>[] = [
  // ============ AGGREGATION HYPOTHESES ============

  {
    id: 'sum',
    name: 'Array Sum',
    description: 'Output is the sum of all elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = numbers.reduce((a, b) => a + b, 0);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'product',
    name: 'Array Product',
    description: 'Output is the product of all elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = numbers.reduce((a, b) => a * b, 1);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'count',
    name: 'Element Count',
    description: 'Output is the count of elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'count_positive',
    name: 'Count Positive',
    description: 'Output is count of positive elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.filter((n) => n > 0).length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'count_negative',
    name: 'Count Negative',
    description: 'Output is count of negative elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.filter((n) => n < 0).length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'count_zero',
    name: 'Count Zeros',
    description: 'Output is count of zero elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.filter((n) => n === 0).length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'count_even',
    name: 'Count Even',
    description: 'Output is count of even elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.filter((n) => n % 2 === 0).length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'count_odd',
    name: 'Count Odd',
    description: 'Output is count of odd elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.filter((n) => n % 2 !== 0).length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'sum_positive',
    name: 'Sum Positive',
    description: 'Output is sum of positive elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = numbers.filter((n) => n > 0).reduce((a, b) => a + b, 0);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'average',
    name: 'Average',
    description: 'Output is the average (mean) of elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      const outputNum = parseFloat(output.trim());
      // Allow for floating point tolerance
      return {
        matches: Math.abs(expected - outputNum) < 0.001 || 
                 Math.floor(expected).toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },

  // ============ SELECTION HYPOTHESES ============

  {
    id: 'max',
    name: 'Maximum Element',
    description: 'Output is the maximum element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = Math.max(...numbers);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'min',
    name: 'Minimum Element',
    description: 'Output is the minimum element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = Math.min(...numbers);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'first',
    name: 'First Element',
    description: 'Output is the first element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      return {
        matches: numbers[0].toString() === output.trim(),
        expected: numbers[0].toString(),
      };
    },
  },
  {
    id: 'last',
    name: 'Last Element',
    description: 'Output is the last element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      return {
        matches: numbers[numbers.length - 1].toString() === output.trim(),
        expected: numbers[numbers.length - 1].toString(),
      };
    },
  },
  {
    id: 'second_max',
    name: 'Second Maximum',
    description: 'Output is the second largest element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length < 2) return { matches: false };
      const sorted = [...numbers].sort((a, b) => b - a);
      const expected = sorted[1];
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'median',
    name: 'Median',
    description: 'Output is the median element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const expected =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      const outputNum = parseFloat(output.trim());
      return {
        matches: Math.abs(expected - outputNum) < 0.001 ||
                 Math.floor(expected).toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'range',
    name: 'Range (Max - Min)',
    description: 'Output is max minus min',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = Math.max(...numbers) - Math.min(...numbers);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'mode',
    name: 'Mode (Most Frequent)',
    description: 'Output is the most frequent element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const freq = new Map<number, number>();
      for (const n of numbers) {
        freq.set(n, (freq.get(n) || 0) + 1);
      }
      let maxFreq = 0;
      let mode = numbers[0];
      for (const [num, count] of freq.entries()) {
        if (count > maxFreq) {
          maxFreq = count;
          mode = num;
        }
      }
      return {
        matches: mode.toString() === output.trim(),
        expected: mode.toString(),
      };
    },
  },

  // ============ MATHEMATICAL HYPOTHESES ============

  {
    id: 'gcd',
    name: 'GCD of All',
    description: 'Output is GCD of all elements',
    category: 'mathematical',
    validator: (input, output) => {
      const numbers = extractNumbers(input).map(Math.abs);
      if (numbers.length === 0) return { matches: false };
      const expected = numbers.reduce(gcd, numbers[0]);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'lcm',
    name: 'LCM of All',
    description: 'Output is LCM of all elements',
    category: 'mathematical',
    validator: (input, output) => {
      const numbers = extractNumbers(input).map(Math.abs).filter((n) => n > 0);
      if (numbers.length === 0) return { matches: false };
      const expected = numbers.reduce(lcm, numbers[0]);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'factorial_n',
    name: 'Factorial of N',
    description: 'Output is factorial of first number',
    category: 'mathematical',
    validator: (input, output) => {
      const n = extractFirstNumber(input);
      if (n === null || n < 0 || n > 20) return { matches: false };
      const expected = factorial(n);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'fibonacci_n',
    name: 'Nth Fibonacci',
    description: 'Output is nth Fibonacci number',
    category: 'mathematical',
    validator: (input, output) => {
      const n = extractFirstNumber(input);
      if (n === null || n < 1 || n > 45) return { matches: false };
      const expected = fibonacci(n);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'is_prime',
    name: 'Prime Check',
    description: 'Output YES/NO or 1/0 for prime check',
    category: 'mathematical',
    validator: (input, output) => {
      const n = extractFirstNumber(input);
      if (n === null) return { matches: false };
      const isPrime = checkPrime(n);
      const outLower = output.trim().toLowerCase();
      const expected = isPrime ? ['yes', '1', 'true'] : ['no', '0', 'false'];
      return {
        matches: expected.includes(outLower),
        expected: isPrime ? 'YES/1' : 'NO/0',
      };
    },
  },
  {
    id: 'power_of_two',
    name: 'Power of Two Check',
    description: 'Check if number is a power of two',
    category: 'mathematical',
    validator: (input, output) => {
      const n = extractFirstNumber(input);
      if (n === null) return { matches: false };
      const isPowerOfTwo = n > 0 && (n & (n - 1)) === 0;
      const outLower = output.trim().toLowerCase();
      const expected = isPowerOfTwo ? ['yes', '1', 'true'] : ['no', '0', 'false'];
      return {
        matches: expected.includes(outLower),
        expected: isPowerOfTwo ? 'YES/1' : 'NO/0',
      };
    },
  },
  {
    id: 'perfect_square',
    name: 'Perfect Square Check',
    description: 'Check if number is a perfect square',
    category: 'mathematical',
    validator: (input, output) => {
      const n = extractFirstNumber(input);
      if (n === null || n < 0) return { matches: false };
      const sqrt = Math.sqrt(n);
      const isPerfectSquare = Number.isInteger(sqrt);
      const outLower = output.trim().toLowerCase();
      const expected = isPerfectSquare ? ['yes', '1', 'true'] : ['no', '0', 'false'];
      return {
        matches: expected.includes(outLower),
        expected: isPerfectSquare ? 'YES/1' : 'NO/0',
      };
    },
  },
  {
    id: 'digit_sum',
    name: 'Digit Sum',
    description: 'Sum of digits of the first number',
    category: 'mathematical',
    validator: (input, output) => {
      const n = extractFirstNumber(input);
      if (n === null) return { matches: false };
      const expected = Math.abs(n)
        .toString()
        .split('')
        .reduce((a, b) => a + parseInt(b), 0);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },

  // ============ SORTING HYPOTHESES ============

  {
    id: 'is_sorted_asc',
    name: 'Check Sorted Ascending',
    description: 'Output YES/NO if array is sorted ascending',
    category: 'sorting',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const isSorted = numbers.every((val, i, arr) => i === 0 || arr[i - 1] <= val);
      const outLower = output.trim().toLowerCase();
      const expected = isSorted ? ['yes', '1', 'true'] : ['no', '0', 'false'];
      return {
        matches: expected.includes(outLower),
        expected: isSorted ? 'YES/1' : 'NO/0',
      };
    },
  },
  {
    id: 'is_sorted_desc',
    name: 'Check Sorted Descending',
    description: 'Output YES/NO if array is sorted descending',
    category: 'sorting',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const isSorted = numbers.every((val, i, arr) => i === 0 || arr[i - 1] >= val);
      const outLower = output.trim().toLowerCase();
      const expected = isSorted ? ['yes', '1', 'true'] : ['no', '0', 'false'];
      return {
        matches: expected.includes(outLower),
        expected: isSorted ? 'YES/1' : 'NO/0',
      };
    },
  },
  {
    id: 'sorted_output',
    name: 'Sort and Output',
    description: 'Output is the array sorted ascending',
    category: 'sorting',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = [...numbers].sort((a, b) => a - b).join(' ');
      const actual = output.trim().replace(/\s+/g, ' ');
      return {
        matches: expected === actual,
        expected: expected,
      };
    },
  },
  {
    id: 'sorted_desc_output',
    name: 'Sort Descending and Output',
    description: 'Output is the array sorted descending',
    category: 'sorting',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = [...numbers].sort((a, b) => b - a).join(' ');
      const actual = output.trim().replace(/\s+/g, ' ');
      return {
        matches: expected === actual,
        expected: expected,
      };
    },
  },
  {
    id: 'reverse_output',
    name: 'Reverse Array',
    description: 'Output is the array reversed',
    category: 'sorting',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = [...numbers].reverse().join(' ');
      const actual = output.trim().replace(/\s+/g, ' ');
      return {
        matches: expected === actual,
        expected: expected,
      };
    },
  },
  {
    id: 'unique_count',
    name: 'Count Unique',
    description: 'Output is count of unique elements',
    category: 'aggregation',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      const expected = new Set(numbers).size;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },

  // ============ DP PATTERNS ============

  {
    id: 'max_subarray_sum',
    name: 'Max Subarray Sum (Kadane)',
    description: 'Output is maximum subarray sum',
    category: 'dp',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = kadane(numbers);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'lis_length',
    name: 'LIS Length',
    description: 'Output is length of longest increasing subsequence',
    category: 'dp',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = lisLength(numbers);
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
  {
    id: 'lds_length',
    name: 'LDS Length',
    description: 'Output is length of longest decreasing subsequence',
    category: 'dp',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const expected = lisLength(numbers.map((n) => -n));
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },
];

// ============ HELPER FUNCTIONS ============

function extractNumbers(input: string): number[] {
  const matches = input.match(/-?\d+/g);
  if (!matches || matches.length <= 1) return matches ? matches.map(Number) : [];
  // Skip first number if it looks like array size
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

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
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
  for (let i = 3; i <= n; i++) {
    [a, b] = [b, a + b];
  }
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

// ============ VALIDATION FUNCTIONS ============

/**
 * Validate all hypotheses against observations
 */
export function validateHypotheses(
  observations: { input: string; output: string }[]
): Hypothesis[] {
  return hypothesisLibrary
    .map((h) => {
      let matchCount = 0;
      let mismatchCount = 0;

      for (const obs of observations) {
        const result = h.validator(obs.input, obs.output);
        if (result.matches) {
          matchCount++;
        } else {
          mismatchCount++;
        }
      }

      const total = matchCount + mismatchCount;
      const confidence = total > 0 ? matchCount / total : 0;

      return {
        ...h,
        confidence,
        matchCount,
        mismatchCount,
      };
    })
    .filter((h) => h.confidence > 0.5) // Only keep plausible hypotheses
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get top hypotheses that explain the observations
 */
export function getTopHypotheses(
  observations: { input: string; output: string }[],
  limit: number = 5
): Hypothesis[] {
  const validated = validateHypotheses(observations);

  // Return hypotheses with 100% match first, then by confidence
  const perfectMatches = validated.filter((h) => h.confidence === 1);
  if (perfectMatches.length > 0) {
    return perfectMatches.slice(0, limit);
  }

  return validated.slice(0, limit);
}

/**
 * Get hypotheses grouped by category
 */
export function getHypothesesByCategory(
  observations: { input: string; output: string }[]
): Map<HypothesisCategory, Hypothesis[]> {
  const validated = validateHypotheses(observations);
  const grouped = new Map<HypothesisCategory, Hypothesis[]>();

  for (const h of validated) {
    const existing = grouped.get(h.category) || [];
    existing.push(h);
    grouped.set(h.category, existing);
  }

  return grouped;
}
