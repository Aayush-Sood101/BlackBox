import { logger } from '../utils/logger';

export interface TestCase {
  input: string;
  rationale: string;
  category: string;
  priority: number;
}

export interface ParsedConstraints {
  variables: Array<{
    name: string;
    min: number;
    max: number;
  }>;
  structuralHints: string[];
}

interface TestCaseStrategy {
  name: string;
  description: string;
  weight: number;
  generator: (constraints: ParsedConstraints) => TestCase[];
}

/**
 * Parse constraints from input format and constraint text
 */
export function parseConstraints(inputFormat: string, constraintsText: string): ParsedConstraints {
  const variables: ParsedConstraints['variables'] = [];
  const structuralHints: string[] = [];

  // Parse constraint patterns like "1 ≤ n ≤ 100" or "1 <= n <= 10^5"
  const constraintPatterns = [
    /(\d+)\s*[≤<=]\s*([a-zA-Z_]\w*)\s*[≤<=]\s*(\d+(?:\^\d+)?)/g,
    /([a-zA-Z_]\w*)\s*[≤<=]\s*(\d+(?:\^\d+)?)/g,
  ];

  for (const pattern of constraintPatterns) {
    let match;
    while ((match = pattern.exec(constraintsText)) !== null) {
      if (match.length === 4) {
        // Full range: min ≤ var ≤ max
        const min = parseInt(match[1]);
        const name = match[2];
        const max = parseNumber(match[3]);
        variables.push({ name, min, max });
      } else if (match.length === 3) {
        // Upper bound only: var ≤ max
        const name = match[1];
        const max = parseNumber(match[2]);
        variables.push({ name, min: 1, max });
      }
    }
  }

  // Detect structural hints from input format
  const formatLower = inputFormat.toLowerCase();
  if (formatLower.includes('array') || formatLower.includes('n integers') || formatLower.includes('n elements')) {
    structuralHints.push('array-based');
  }
  if (formatLower.includes('string')) {
    structuralHints.push('string-based');
  }
  if (formatLower.includes('graph') || formatLower.includes('edge')) {
    structuralHints.push('graph-based');
  }
  if (formatLower.includes('tree')) {
    structuralHints.push('tree-based');
  }
  if (formatLower.includes('matrix') || formatLower.includes('grid')) {
    structuralHints.push('matrix-based');
  }

  // Default constraints if none found
  if (variables.length === 0) {
    variables.push({ name: 'n', min: 1, max: 100 });
  }

  return { variables, structuralHints };
}

function parseNumber(str: string): number {
  if (str.includes('^')) {
    const [base, exp] = str.split('^').map(Number);
    return Math.pow(base, exp);
  }
  return parseInt(str);
}

/**
 * Collection of test case generation strategies
 */
export const testCaseStrategies: TestCaseStrategy[] = [
  // Strategy 1: Boundary Value Testing
  {
    name: 'boundary',
    description: 'Test at constraint boundaries',
    weight: 10,
    generator: (constraints) => {
      const cases: TestCase[] = [];

      for (const v of constraints.variables) {
        if (v.name.toLowerCase() === 'n' || v.name.toLowerCase() === 'size') {
          // Minimum boundary
          cases.push({
            input: generateInputForValue(v.name, v.min, constraints),
            rationale: `Minimum ${v.name} = ${v.min}`,
            category: 'boundary',
            priority: 10,
          });

          // Maximum boundary (capped for practicality)
          const maxVal = Math.min(v.max, 20);
          cases.push({
            input: generateInputForValue(v.name, maxVal, constraints),
            rationale: `Maximum practical ${v.name} = ${maxVal}`,
            category: 'boundary',
            priority: 10,
          });

          // Just above minimum
          if (v.max - v.min > 2) {
            cases.push({
              input: generateInputForValue(v.name, v.min + 1, constraints),
              rationale: `Near minimum ${v.name} = ${v.min + 1}`,
              category: 'boundary',
              priority: 8,
            });
          }
        }
      }

      return cases;
    },
  },

  // Strategy 2: Zero and Identity Cases
  {
    name: 'identity',
    description: 'Test with zeros, ones, and identity values',
    weight: 9,
    generator: (constraints) => {
      return [
        {
          input: '1\n0\n',
          rationale: 'Single zero element',
          category: 'identity',
          priority: 9,
        },
        {
          input: '1\n1\n',
          rationale: 'Single one element',
          category: 'identity',
          priority: 9,
        },
        {
          input: '5\n0 0 0 0 0\n',
          rationale: 'All zeros',
          category: 'identity',
          priority: 9,
        },
        {
          input: '5\n1 1 1 1 1\n',
          rationale: 'All ones',
          category: 'identity',
          priority: 9,
        },
      ];
    },
  },

  // Strategy 3: Sign Variation
  {
    name: 'signs',
    description: 'Test with different sign combinations',
    weight: 8,
    generator: (constraints) => {
      return [
        {
          input: '5\n-1 -2 -3 -4 -5\n',
          rationale: 'All negative values',
          category: 'signs',
          priority: 8,
        },
        {
          input: '5\n1 2 3 4 5\n',
          rationale: 'All positive values',
          category: 'signs',
          priority: 8,
        },
        {
          input: '6\n-3 -2 -1 1 2 3\n',
          rationale: 'Mixed positive and negative (no zero)',
          category: 'signs',
          priority: 8,
        },
        {
          input: '7\n-3 -2 -1 0 1 2 3\n',
          rationale: 'Mixed with zero in middle',
          category: 'signs',
          priority: 8,
        },
        {
          input: '6\n-1 1 -1 1 -1 1\n',
          rationale: 'Alternating signs',
          category: 'signs',
          priority: 7,
        },
      ];
    },
  },

  // Strategy 4: Ordering Patterns
  {
    name: 'ordering',
    description: 'Test sorted and reverse-sorted inputs',
    weight: 8,
    generator: (constraints) => {
      return [
        {
          input: '5\n1 2 3 4 5\n',
          rationale: 'Strictly ascending',
          category: 'ordering',
          priority: 8,
        },
        {
          input: '5\n5 4 3 2 1\n',
          rationale: 'Strictly descending',
          category: 'ordering',
          priority: 8,
        },
        {
          input: '5\n1 1 2 2 3\n',
          rationale: 'Non-strictly ascending (with duplicates)',
          category: 'ordering',
          priority: 7,
        },
        {
          input: '6\n1 3 2 6 5 4\n',
          rationale: 'Partially sorted (ascending pairs)',
          category: 'ordering',
          priority: 6,
        },
        {
          input: '5\n3 1 4 1 5\n',
          rationale: 'Random order',
          category: 'ordering',
          priority: 6,
        },
      ];
    },
  },

  // Strategy 5: Duplicates and Uniqueness
  {
    name: 'duplicates',
    description: 'Test with various duplicate patterns',
    weight: 7,
    generator: (constraints) => {
      return [
        {
          input: '5\n7 7 7 7 7\n',
          rationale: 'All elements identical',
          category: 'duplicates',
          priority: 8,
        },
        {
          input: '5\n1 2 3 4 5\n',
          rationale: 'All unique elements',
          category: 'duplicates',
          priority: 7,
        },
        {
          input: '6\n1 2 2 3 3 3\n',
          rationale: 'Increasing frequency of duplicates',
          category: 'duplicates',
          priority: 6,
        },
        {
          input: '8\n1 1 2 2 3 3 4 4\n',
          rationale: 'Pairs of duplicates',
          category: 'duplicates',
          priority: 6,
        },
      ];
    },
  },

  // Strategy 6: Mathematical Sequences
  {
    name: 'sequences',
    description: 'Test with mathematical sequences',
    weight: 7,
    generator: (constraints) => {
      return [
        {
          input: '5\n2 4 6 8 10\n',
          rationale: 'Arithmetic sequence (even numbers)',
          category: 'sequences',
          priority: 7,
        },
        {
          input: '5\n1 3 5 7 9\n',
          rationale: 'Arithmetic sequence (odd numbers)',
          category: 'sequences',
          priority: 7,
        },
        {
          input: '5\n1 2 4 8 16\n',
          rationale: 'Geometric sequence (powers of 2)',
          category: 'sequences',
          priority: 7,
        },
        {
          input: '6\n1 1 2 3 5 8\n',
          rationale: 'Fibonacci-like sequence',
          category: 'sequences',
          priority: 7,
        },
        {
          input: '5\n2 3 5 7 11\n',
          rationale: 'Prime numbers',
          category: 'sequences',
          priority: 6,
        },
        {
          input: '5\n1 4 9 16 25\n',
          rationale: 'Perfect squares',
          category: 'sequences',
          priority: 6,
        },
      ];
    },
  },

  // Strategy 7: Large Values (within constraints)
  {
    name: 'large_values',
    description: 'Test with large absolute values',
    weight: 7,
    generator: (constraints) => {
      return [
        {
          input: '3\n1000000000 1000000000 1000000000\n',
          rationale: 'Large positive values (potential overflow)',
          category: 'large_values',
          priority: 8,
        },
        {
          input: '3\n-1000000000 -1000000000 -1000000000\n',
          rationale: 'Large negative values',
          category: 'large_values',
          priority: 8,
        },
        {
          input: '2\n1000000000 -1000000000\n',
          rationale: 'Maximum range difference',
          category: 'large_values',
          priority: 8,
        },
        {
          input: '4\n999999999 1 -999999999 -1\n',
          rationale: 'Near-maximum values mixed with small',
          category: 'large_values',
          priority: 7,
        },
      ];
    },
  },

  // Strategy 8: Special Structures (for DP/Greedy detection)
  {
    name: 'dp_patterns',
    description: 'Patterns that reveal DP/Greedy behavior',
    weight: 6,
    generator: (constraints) => {
      return [
        {
          input: '6\n-2 1 -3 4 -1 2\n',
          rationale: "Kadane's algorithm pattern (max subarray)",
          category: 'dp_patterns',
          priority: 6,
        },
        {
          input: '6\n2 3 1 5 4 6\n',
          rationale: 'LIS pattern (longest increasing subsequence)',
          category: 'dp_patterns',
          priority: 6,
        },
        {
          input: '8\n1 2 1 2 1 2 1 2\n',
          rationale: 'Repeating pattern (periodicity detection)',
          category: 'dp_patterns',
          priority: 5,
        },
        {
          input: '5\n5 4 3 2 1\n',
          rationale: 'Worst case for some greedy algorithms',
          category: 'dp_patterns',
          priority: 6,
        },
      ];
    },
  },
];

/**
 * Helper function to generate input for a specific value
 */
function generateInputForValue(
  varName: string,
  value: number,
  constraints: ParsedConstraints
): string {
  // For array-based problems, generate array of given size
  if (constraints.structuralHints.includes('array-based') && varName.toLowerCase() === 'n') {
    const elements = Array.from({ length: value }, (_, i) => i + 1).join(' ');
    return `${value}\n${elements}\n`;
  }

  return `${value}\n`;
}

/**
 * Generate a comprehensive test suite using all strategies
 */
export function generateComprehensiveTestSuite(
  inputFormat: string,
  constraintsText: string,
  targetCount: number = 25
): TestCase[] {
  const constraints = parseConstraints(inputFormat, constraintsText);
  const allCases: TestCase[] = [];

  // Run all strategies
  for (const strategy of testCaseStrategies) {
    try {
      const cases = strategy.generator(constraints);
      allCases.push(...cases);
    } catch (error) {
      logger.warn(`Strategy ${strategy.name} failed:`, error);
    }
  }

  // Sort by priority and deduplicate
  allCases.sort((a, b) => b.priority - a.priority);

  const uniqueCases = new Map<string, TestCase>();
  for (const tc of allCases) {
    const normalizedInput = tc.input.trim().replace(/\s+/g, ' ');
    if (!uniqueCases.has(normalizedInput)) {
      uniqueCases.set(normalizedInput, tc);
    }
  }

  // Return top N cases
  return Array.from(uniqueCases.values()).slice(0, targetCount);
}

/**
 * Get test cases by category
 */
export function getTestCasesByCategory(
  inputFormat: string,
  constraintsText: string,
  category: string
): TestCase[] {
  const allCases = generateComprehensiveTestSuite(inputFormat, constraintsText, 50);
  return allCases.filter((tc) => tc.category === category);
}
