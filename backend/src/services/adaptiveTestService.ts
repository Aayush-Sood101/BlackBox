import { TestCase } from './testCaseStrategyService';
import { logger } from '../utils/logger';

interface Observation {
  input: string;
  output: string;
}

interface Hypothesis {
  name: string;
  confidence: number;
  predictions: Map<string, string>;
}

/**
 * Generate additional test cases based on current observations
 * to discriminate between competing hypotheses
 */
export async function generateDiscriminatingTests(
  currentObservations: Observation[],
  hypotheses: Array<{ name: string; confidence: number }>,
  inputFormat: string
): Promise<TestCase[]> {
  const discriminatingTests: TestCase[] = [];

  // Find pairs of hypotheses that predict differently
  for (let i = 0; i < hypotheses.length; i++) {
    for (let j = i + 1; j < hypotheses.length; j++) {
      const h1 = hypotheses[i];
      const h2 = hypotheses[j];

      // Generate test case that would distinguish these hypotheses
      const testCase = generateDiscriminatingTest(h1.name, h2.name, inputFormat);
      if (testCase) {
        discriminatingTests.push(testCase);
      }
    }
  }

  return discriminatingTests.slice(0, 5); // Limit additional tests
}

/**
 * Generate a test case that distinguishes between two hypotheses
 */
function generateDiscriminatingTest(
  h1Name: string,
  h2Name: string,
  inputFormat: string
): TestCase | null {
  // Heuristic-based approach for common hypothesis pairs
  const patterns: { [key: string]: TestCase } = {
    sum_vs_max: {
      input: '3\n1 1 5\n',
      rationale: 'Distinguishes sum (7) from max (5)',
      category: 'discriminating',
      priority: 10,
    },
    sum_vs_count: {
      input: '3\n2 3 4\n',
      rationale: 'Distinguishes sum (9) from count (3)',
      category: 'discriminating',
      priority: 10,
    },
    max_vs_min: {
      input: '3\n1 5 3\n',
      rationale: 'Distinguishes max (5) from min (1)',
      category: 'discriminating',
      priority: 10,
    },
    median_vs_mean: {
      input: '5\n1 2 3 4 100\n',
      rationale: 'Distinguishes median (3) from mean (22)',
      category: 'discriminating',
      priority: 10,
    },
    average_vs_sum: {
      input: '3\n3 6 9\n',
      rationale: 'Tests if output is sum (18) or average (6)',
      category: 'discriminating',
      priority: 10,
    },
    product_vs_sum: {
      input: '3\n2 2 2\n',
      rationale: 'Distinguishes product (8) from sum (6)',
      category: 'discriminating',
      priority: 10,
    },
    gcd_vs_min: {
      input: '3\n6 9 12\n',
      rationale: 'Distinguishes GCD (3) from min (6)',
      category: 'discriminating',
      priority: 10,
    },
    lcm_vs_max: {
      input: '3\n2 3 4\n',
      rationale: 'Distinguishes LCM (12) from max (4)',
      category: 'discriminating',
      priority: 10,
    },
    range_vs_max: {
      input: '4\n-5 0 5 10\n',
      rationale: 'Distinguishes range (15) from max (10)',
      category: 'discriminating',
      priority: 10,
    },
    first_vs_last: {
      input: '4\n7 8 9 10\n',
      rationale: 'Distinguishes first (7) from last (10)',
      category: 'discriminating',
      priority: 10,
    },
    count_positive_vs_count: {
      input: '5\n-1 -2 3 4 5\n',
      rationale: 'Distinguishes count positive (3) from total count (5)',
      category: 'discriminating',
      priority: 10,
    },
  };

  // Normalize hypothesis names for matching
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

  const key1 = `${normalize(h1Name)}_vs_${normalize(h2Name)}`;
  const key2 = `${normalize(h2Name)}_vs_${normalize(h1Name)}`;

  // Try to find a matching pattern
  for (const [patternKey, testCase] of Object.entries(patterns)) {
    if (
      patternKey.includes(normalize(h1Name)) &&
      patternKey.includes(normalize(h2Name))
    ) {
      return testCase;
    }
  }

  return patterns[key1] || patterns[key2] || null;
}

/**
 * Analyze observation patterns to suggest next test categories
 */
export function suggestNextTestCategories(observations: Observation[]): string[] {
  const suggestions: string[] = [];

  // Check if we have negative numbers tested
  const hasNegative = observations.some((obs) => obs.input.includes('-'));
  if (!hasNegative) {
    suggestions.push('negative_values');
  }

  // Check if we have large numbers tested
  const hasLarge = observations.some((obs) => /\d{7,}/.test(obs.input));
  if (!hasLarge) {
    suggestions.push('large_values');
  }

  // Check if we have single element tested
  const hasSingle = observations.some((obs) => obs.input.startsWith('1\n'));
  if (!hasSingle) {
    suggestions.push('minimal_cases');
  }

  // Check for zero patterns
  const hasZeros = observations.some(
    (obs) => obs.input.includes(' 0 ') || obs.input.includes('\n0\n')
  );
  if (!hasZeros) {
    suggestions.push('zero_cases');
  }

  // Check for sorted inputs
  const hasSorted = observations.some((obs) => {
    const numbers = extractNumbers(obs.input);
    return isSorted(numbers);
  });
  if (!hasSorted) {
    suggestions.push('sorted_inputs');
  }

  // Check for duplicate tests
  const hasDuplicates = observations.some((obs) => {
    const numbers = extractNumbers(obs.input);
    return new Set(numbers).size < numbers.length;
  });
  if (!hasDuplicates) {
    suggestions.push('duplicate_elements');
  }

  return suggestions;
}

/**
 * Generate additional test cases for suggested categories
 */
export function generateCategoryTests(category: string): TestCase[] {
  const categoryTests: { [key: string]: TestCase[] } = {
    negative_values: [
      {
        input: '5\n-1 -2 -3 -4 -5\n',
        rationale: 'All negative values test',
        category: 'negative_values',
        priority: 9,
      },
      {
        input: '6\n-3 -1 0 1 2 3\n',
        rationale: 'Mixed negative, zero, positive',
        category: 'negative_values',
        priority: 9,
      },
    ],
    large_values: [
      {
        input: '3\n1000000000 1000000000 1000000000\n',
        rationale: 'Large values (overflow check)',
        category: 'large_values',
        priority: 9,
      },
      {
        input: '2\n-2000000000 2000000000\n',
        rationale: 'Extreme range',
        category: 'large_values',
        priority: 9,
      },
    ],
    minimal_cases: [
      {
        input: '1\n42\n',
        rationale: 'Single element',
        category: 'minimal_cases',
        priority: 10,
      },
      {
        input: '2\n1 2\n',
        rationale: 'Two elements',
        category: 'minimal_cases',
        priority: 9,
      },
    ],
    zero_cases: [
      {
        input: '5\n0 0 0 0 0\n',
        rationale: 'All zeros',
        category: 'zero_cases',
        priority: 9,
      },
      {
        input: '3\n0 1 0\n',
        rationale: 'Zeros with one',
        category: 'zero_cases',
        priority: 8,
      },
    ],
    sorted_inputs: [
      {
        input: '5\n1 2 3 4 5\n',
        rationale: 'Sorted ascending',
        category: 'sorted_inputs',
        priority: 8,
      },
      {
        input: '5\n5 4 3 2 1\n',
        rationale: 'Sorted descending',
        category: 'sorted_inputs',
        priority: 8,
      },
    ],
    duplicate_elements: [
      {
        input: '5\n7 7 7 7 7\n',
        rationale: 'All same elements',
        category: 'duplicate_elements',
        priority: 8,
      },
      {
        input: '6\n1 1 2 2 3 3\n',
        rationale: 'Pairs of duplicates',
        category: 'duplicate_elements',
        priority: 7,
      },
    ],
  };

  return categoryTests[category] || [];
}

/**
 * Adaptive test generation based on current analysis state
 */
export async function generateAdaptiveTests(
  observations: Observation[],
  hypotheses: Array<{ name: string; confidence: number }>,
  inputFormat: string
): Promise<TestCase[]> {
  const allTests: TestCase[] = [];

  // 1. Generate discriminating tests for close hypotheses
  if (hypotheses.length > 1) {
    const closeHypotheses = hypotheses.filter(
      (h) => h.confidence > 0.5 && hypotheses[0].confidence - h.confidence < 0.3
    );

    if (closeHypotheses.length > 1) {
      const discriminatingTests = await generateDiscriminatingTests(
        observations,
        closeHypotheses,
        inputFormat
      );
      allTests.push(...discriminatingTests);
    }
  }

  // 2. Generate tests for missing categories
  const suggestions = suggestNextTestCategories(observations);
  for (const category of suggestions.slice(0, 3)) {
    const categoryTests = generateCategoryTests(category);
    allTests.push(...categoryTests);
  }

  // Deduplicate and limit
  const uniqueTests = new Map<string, TestCase>();
  for (const tc of allTests) {
    const normalizedInput = tc.input.trim().replace(/\s+/g, ' ');
    if (!uniqueTests.has(normalizedInput)) {
      uniqueTests.set(normalizedInput, tc);
    }
  }

  return Array.from(uniqueTests.values()).slice(0, 10);
}

// Helper functions
function extractNumbers(input: string): number[] {
  const matches = input.match(/-?\d+/g);
  if (!matches) return [];
  return matches.map(Number);
}

function isSorted(arr: number[]): boolean {
  if (arr.length <= 1) return true;
  const ascending = arr.every((val, i, a) => i === 0 || a[i - 1] <= val);
  const descending = arr.every((val, i, a) => i === 0 || a[i - 1] >= val);
  return ascending || descending;
}
