# PHASE 2: Enhanced Inference & Core Intelligence

## Overview

**Duration**: Week 3-4  
**Objective**: Implement advanced test case generation strategies, multi-hypothesis validation, sophisticated pattern recognition for DP/Greedy/Graph algorithms, real-time WebSocket communication, and comprehensive error handling.

**Prerequisites**: Phase 1 completed with basic pipeline working.

---

## Table of Contents

1. [Advanced Test Case Generation](#1-advanced-test-case-generation)
2. [Multi-Hypothesis Validation System](#2-multi-hypothesis-validation-system)
3. [Pattern Recognition Engine](#3-pattern-recognition-engine)
4. [WebSocket Real-Time Communication](#4-websocket-real-time-communication)
5. [Enhanced LLM Prompting](#5-enhanced-llm-prompting)
6. [Iterative Refinement Pipeline](#6-iterative-refinement-pipeline)
7. [Error Recovery & Fallback Strategies](#7-error-recovery--fallback-strategies)
8. [Testing & Validation](#8-testing--validation)

---

## 1. Advanced Test Case Generation

### 1.1 Test Case Strategy System

Create a new service for intelligent test case generation: `src/services/testCaseStrategyService.ts`

```typescript
import { logger } from '../utils/logger';

export interface TestCaseStrategy {
  name: string;
  description: string;
  generator: (constraints: ParsedConstraints) => TestCase[];
  weight: number; // Priority weight for selection
}

export interface ParsedConstraints {
  variables: {
    name: string;
    type: 'integer' | 'float' | 'string' | 'array';
    min?: number;
    max?: number;
    elementType?: string;
    elementMin?: number;
    elementMax?: number;
  }[];
  relationships: string[];
  structuralHints: string[];
}

export interface TestCase {
  input: string;
  rationale: string;
  category: string;
  priority: number;
}

/**
 * Parse constraints from natural language description
 */
export function parseConstraints(
  inputFormat: string,
  constraintsText: string
): ParsedConstraints {
  const parsed: ParsedConstraints = {
    variables: [],
    relationships: [],
    structuralHints: [],
  };

  // Extract variable patterns
  const intPattern = /(\w+)\s*[:\-]?\s*(?:integer|int)\s*(?:\(?\s*(-?\d+)\s*[≤<]=?\s*\w+\s*[≤<]=?\s*(-?\d+)\s*\)?)?/gi;
  const arrayPattern = /(\w+)\s*[:\-]?\s*(?:array|list)\s*of\s*(\w+)/gi;
  const rangePattern = /(-?\d+)\s*[≤<]=?\s*(\w+)\s*[≤<]=?\s*(-?\d+)/g;

  // Parse integer variables with ranges
  let match;
  while ((match = rangePattern.exec(constraintsText)) !== null) {
    const [, min, varName, max] = match;
    const existing = parsed.variables.find(v => v.name === varName);
    if (existing) {
      existing.min = parseInt(min);
      existing.max = parseInt(max);
    } else {
      parsed.variables.push({
        name: varName,
        type: 'integer',
        min: parseInt(min),
        max: parseInt(max),
      });
    }
  }

  // Detect structural hints
  const lowerFormat = inputFormat.toLowerCase();
  if (lowerFormat.includes('array') || lowerFormat.includes('sequence')) {
    parsed.structuralHints.push('array-based');
  }
  if (lowerFormat.includes('matrix') || lowerFormat.includes('grid')) {
    parsed.structuralHints.push('matrix-based');
  }
  if (lowerFormat.includes('graph') || lowerFormat.includes('edge') || lowerFormat.includes('node')) {
    parsed.structuralHints.push('graph-based');
  }
  if (lowerFormat.includes('string') || lowerFormat.includes('character')) {
    parsed.structuralHints.push('string-based');
  }

  // Default values if parsing fails
  if (parsed.variables.length === 0) {
    parsed.variables.push({
      name: 'n',
      type: 'integer',
      min: 1,
      max: 100000,
    });
  }

  return parsed;
}

/**
 * All available test case strategies
 */
export const testCaseStrategies: TestCaseStrategy[] = [
  // Strategy 1: Boundary Values
  {
    name: 'boundary',
    description: 'Test minimum and maximum constraint values',
    weight: 10,
    generator: (constraints) => {
      const cases: TestCase[] = [];
      
      for (const v of constraints.variables) {
        if (v.type === 'integer' && v.min !== undefined && v.max !== undefined) {
          // Minimum value
          cases.push({
            input: generateInputForValue(v.name, v.min, constraints),
            rationale: `Minimum ${v.name} = ${v.min}`,
            category: 'boundary',
            priority: 10,
          });
          
          // Maximum value
          cases.push({
            input: generateInputForValue(v.name, v.max, constraints),
            rationale: `Maximum ${v.name} = ${v.max}`,
            category: 'boundary',
            priority: 10,
          });
          
          // Just below/above boundaries
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
          rationale: 'Kadane\'s algorithm pattern (max subarray)',
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
```

### 1.2 Adaptive Test Case Generation

Create `src/services/adaptiveTestService.ts`:

```typescript
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
  hypotheses: Hypothesis[],
  inputFormat: string
): Promise<TestCase[]> {
  const discriminatingTests: TestCase[] = [];

  // Find pairs of hypotheses that predict differently
  for (let i = 0; i < hypotheses.length; i++) {
    for (let j = i + 1; j < hypotheses.length; j++) {
      const h1 = hypotheses[i];
      const h2 = hypotheses[j];

      // Generate test case that would distinguish these hypotheses
      const testCase = generateDiscriminatingTest(h1, h2, inputFormat);
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
  h1: Hypothesis,
  h2: Hypothesis,
  inputFormat: string
): TestCase | null {
  // This is a simplified heuristic-based approach
  // The actual implementation would use LLM to generate targeted tests
  
  const patterns: { [key: string]: TestCase } = {
    'sum_vs_max': {
      input: '3\n1 1 5\n',
      rationale: 'Distinguishes sum (7) from max (5)',
      category: 'discriminating',
      priority: 10,
    },
    'sum_vs_count': {
      input: '3\n2 3 4\n',
      rationale: 'Distinguishes sum (9) from count (3)',
      category: 'discriminating',
      priority: 10,
    },
    'max_vs_min': {
      input: '3\n1 5 3\n',
      rationale: 'Distinguishes max (5) from min (1)',
      category: 'discriminating',
      priority: 10,
    },
    'median_vs_middle': {
      input: '5\n5 1 3 2 4\n',
      rationale: 'Distinguishes median (3) from middle element (3) - need even array',
      category: 'discriminating',
      priority: 10,
    },
    'average_vs_sum': {
      input: '3\n3 3 3\n',
      rationale: 'Tests if output is sum (9) or average (3)',
      category: 'discriminating',
      priority: 10,
    },
  };

  // Match hypothesis names to patterns
  const key = `${h1.name}_vs_${h2.name}`.toLowerCase();
  const reverseKey = `${h2.name}_vs_${h1.name}`.toLowerCase();

  return patterns[key] || patterns[reverseKey] || null;
}

/**
 * Analyze observation patterns to suggest next test categories
 */
export function suggestNextTestCategories(
  observations: Observation[]
): string[] {
  const suggestions: string[] = [];

  // Check if we have negative numbers tested
  const hasNegative = observations.some(obs => 
    obs.input.includes('-')
  );
  if (!hasNegative) {
    suggestions.push('negative_values');
  }

  // Check if we have large numbers tested
  const hasLarge = observations.some(obs => 
    /\d{7,}/.test(obs.input)
  );
  if (!hasLarge) {
    suggestions.push('large_values');
  }

  // Check if we have single element tested
  const hasSingle = observations.some(obs => 
    obs.input.startsWith('1\n')
  );
  if (!hasSingle) {
    suggestions.push('minimal_cases');
  }

  // Check for zero patterns
  const hasZeros = observations.some(obs => 
    obs.input.includes(' 0 ') || obs.input.includes('\n0\n')
  );
  if (!hasZeros) {
    suggestions.push('zero_cases');
  }

  return suggestions;
}
```

### 1.3 LLM-Enhanced Test Generation

Update `src/services/llmService.ts` with enhanced prompting:

```typescript
/**
 * Stage 1 Enhanced: Generate test cases with LLM using strategic prompting
 */
export async function generateEnhancedTestCases(
  inputFormat: string,
  constraints: string,
  previousObservations?: { input: string; output: string }[]
): Promise<TestCase[]> {
  let contextSection = '';
  
  if (previousObservations && previousObservations.length > 0) {
    contextSection = `
PREVIOUS OBSERVATIONS (use these to generate MORE DISCRIMINATING tests):
${previousObservations.slice(-10).map((obs, i) => 
  `${i + 1}. Input: ${obs.input.trim()} → Output: ${obs.output}`
).join('\n')}

Based on these observations, generate additional test cases that would help distinguish between:
- Sum vs. Product vs. Count operations
- Max vs. Min vs. Average operations  
- Sorting vs. Searching operations
- Simple computation vs. DP/Greedy algorithms
`;
  }

  const prompt = `You are an expert competitive programmer and testing specialist.

INPUT FORMAT:
${inputFormat}

CONSTRAINTS:
${constraints || 'Standard competitive programming constraints'}
${contextSection}

TASK: Generate exactly 20 strategically diverse test cases.

CRITICAL REQUIREMENTS:
Your test cases MUST include ALL of these categories:

1. BOUNDARY TESTS (3 cases):
   - Minimum valid input (n=1 or smallest allowed)
   - Maximum practical input (use reasonable large values)
   - Values at constraint boundaries

2. ZERO/IDENTITY TESTS (3 cases):
   - Input with zeros
   - Input with all ones
   - Empty-like inputs if valid

3. SIGN VARIATION TESTS (3 cases):
   - All positive values
   - All negative values
   - Mixed positive, negative, and zero

4. ORDERING TESTS (3 cases):
   - Sorted ascending
   - Sorted descending
   - Random order

5. DUPLICATE TESTS (2 cases):
   - All same elements
   - Various duplicates

6. SEQUENCE PATTERN TESTS (3 cases):
   - Arithmetic sequence
   - Geometric sequence (powers)
   - Mathematical pattern (primes, fibonacci, squares)

7. OVERFLOW/PRECISION TESTS (2 cases):
   - Large positive values that might cause overflow
   - Large negative values

8. SPECIAL CASES (1 case):
   - Edge case specific to the problem domain

OUTPUT: Return ONLY a valid JSON array. Each element must have:
{
  "input": "exact input string with \\n for newlines",
  "rationale": "why this test case is important",
  "category": "one of: boundary, identity, signs, ordering, duplicates, sequences, overflow, special"
}

Example:
[
  {"input": "1\\n42\\n", "rationale": "Single element boundary test", "category": "boundary"},
  {"input": "5\\n-5 -4 -3 -2 -1\\n", "rationale": "All negative sorted", "category": "signs"}
]

Generate exactly 20 test cases now:`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  return parseEnhancedTestCases(response);
}

function parseEnhancedTestCases(response: string): TestCase[] {
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return parsed.map((item: any, index: number) => ({
      input: String(item.input || '').replace(/\\n/g, '\n'),
      rationale: String(item.rationale || 'Test case'),
      category: String(item.category || 'general'),
      priority: 10 - Math.floor(index / 3), // Decreasing priority
    }));
  } catch (error) {
    logger.error('Failed to parse enhanced test cases:', error);
    return [];
  }
}
```

---

## 2. Multi-Hypothesis Validation System

### 2.1 Hypothesis Engine

Create `src/services/hypothesisEngine.ts`:

```typescript
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
  | 'aggregation'   // Sum, Product, Count, etc.
  | 'selection'     // Max, Min, Median, etc.
  | 'sorting'       // Check sorted, Sort output
  | 'searching'     // Binary search, Linear search
  | 'mathematical'  // GCD, LCM, Factorial, etc.
  | 'dp'            // Dynamic programming patterns
  | 'string'        // String operations
  | 'other';

/**
 * Library of common algorithmic hypotheses
 */
export const hypothesisLibrary: Omit<Hypothesis, 'confidence' | 'matchCount' | 'mismatchCount'>[] = [
  // Aggregation Hypotheses
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
      const expected = numbers.filter(n => n > 0).length;
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
      const expected = numbers.filter(n => n < 0).length;
      return {
        matches: expected.toString() === output.trim(),
        expected: expected.toString(),
      };
    },
  },

  // Selection Hypotheses
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
    id: 'median',
    name: 'Median',
    description: 'Output is the median element',
    category: 'selection',
    validator: (input, output) => {
      const numbers = extractNumbers(input);
      if (numbers.length === 0) return { matches: false };
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const expected = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
      return {
        matches: expected.toString() === output.trim(),
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

  // Mathematical Hypotheses
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
      const numbers = extractNumbers(input).map(Math.abs);
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

  // Sorting Hypotheses
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

  // DP Patterns
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
];

// Helper functions
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
  let a = 1, b = 1;
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
    let lo = 0, hi = dp.length;
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
 * Validate all hypotheses against observations
 */
export function validateHypotheses(
  observations: { input: string; output: string }[]
): Hypothesis[] {
  return hypothesisLibrary.map(h => {
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
  }).filter(h => h.confidence > 0.5) // Only keep plausible hypotheses
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get top hypotheses that explain the observations
 */
export function getTopHypotheses(
  observations: { input: string; output: string }[],
  limit: number = 3
): Hypothesis[] {
  const validated = validateHypotheses(observations);
  
  // Return hypotheses with 100% match first, then by confidence
  const perfectMatches = validated.filter(h => h.confidence === 1);
  if (perfectMatches.length > 0) {
    return perfectMatches.slice(0, limit);
  }

  return validated.slice(0, limit);
}
```

### 2.2 Hypothesis-Guided Inference

Update `src/services/pipelineService.ts`:

```typescript
import { validateHypotheses, getTopHypotheses } from './hypothesisEngine';
import { generateDiscriminatingTests } from './adaptiveTestService';

export async function runEnhancedPipeline(
  jobId: string,
  executablePath: string,
  inputFormat: string,
  constraints: string
): Promise<void> {
  const job = analysisJobs.get(jobId);
  if (!job) throw new Error('Job not found');

  try {
    job.status = 'running';

    // Stage 1: Initial Test Case Generation
    logger.info(`[${jobId}] Stage 1: Generating initial test cases`);
    job.stage = 'generating';
    
    const initialTests = await generateEnhancedTestCases(inputFormat, constraints);
    logger.info(`[${jobId}] Generated ${initialTests.length} initial test cases`);

    // Stage 2: Execute Initial Tests
    logger.info(`[${jobId}] Stage 2: Executing initial tests`);
    job.stage = 'executing';
    
    let observations = await executeTestCases(executablePath, initialTests);
    job.observations = observations;

    // Stage 2.5: Hypothesis Validation & Adaptive Testing
    logger.info(`[${jobId}] Stage 2.5: Validating hypotheses`);
    
    let topHypotheses = getTopHypotheses(observations);
    logger.info(`[${jobId}] Top hypotheses: ${topHypotheses.map(h => `${h.name}(${(h.confidence*100).toFixed(0)}%)`).join(', ')}`);

    // If multiple hypotheses have similar confidence, generate discriminating tests
    if (topHypotheses.length > 1 && 
        topHypotheses[0].confidence - topHypotheses[1].confidence < 0.2) {
      
      logger.info(`[${jobId}] Generating discriminating tests`);
      
      const additionalTests = await generateDiscriminatingTests(
        observations,
        topHypotheses,
        inputFormat
      );

      if (additionalTests.length > 0) {
        const additionalObservations = await executeTestCases(executablePath, additionalTests);
        observations = [...observations, ...additionalObservations];
        job.observations = observations;

        // Re-validate with new observations
        topHypotheses = getTopHypotheses(observations);
        logger.info(`[${jobId}] Updated hypotheses: ${topHypotheses.map(h => `${h.name}(${(h.confidence*100).toFixed(0)}%)`).join(', ')}`);
      }
    }

    // Stage 3: LLM Inference with Hypothesis Context
    logger.info(`[${jobId}] Stage 3: Inferring problem with hypothesis context`);
    job.stage = 'inferring';
    
    const result = await inferProblemWithHypotheses(
      inputFormat,
      constraints,
      observations,
      topHypotheses
    );
    
    // Complete
    job.status = 'complete';
    job.stage = 'complete';
    job.result = result;
    logger.info(`[${jobId}] Analysis complete: ${result.algorithm}`);

    await cleanupJob(jobId, executablePath);

  } catch (error) {
    logger.error(`[${jobId}] Pipeline error:`, error);
    job.status = 'error';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    await cleanupJob(jobId, executablePath).catch(() => {});
    throw error;
  }
}
```

---

## 3. Pattern Recognition Engine

### 3.1 Pattern Detector

Create `src/services/patternDetector.ts`:

```typescript
import { logger } from '../utils/logger';

export interface DetectedPattern {
  type: PatternType;
  confidence: number;
  evidence: string[];
  suggestedAlgorithm: string;
}

export type PatternType =
  | 'linear_aggregation'     // O(n) sum/count operations
  | 'quadratic_comparison'   // O(n²) comparisons
  | 'logarithmic_search'     // Binary search behavior
  | 'sorting_based'          // Output depends on sorted order
  | 'dp_optimal'             // Optimal substructure visible
  | 'greedy_local'           // Local optimal choices
  | 'mathematical_transform' // Pure mathematical computation
  | 'string_manipulation'    // Character-level operations
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
  const sizeOutputPairs = observations.map(obs => {
    const numbers = extractNumbers(obs.input);
    return {
      size: numbers.length,
      inputSum: numbers.reduce((a, b) => a + b, 0),
      output: parseFloat(obs.output),
    };
  }).filter(p => !isNaN(p.output));

  // Check sum correlation
  const sumMatches = sizeOutputPairs.filter(p => p.inputSum === p.output).length;
  if (sumMatches > sizeOutputPairs.length * 0.8) {
    confidence = 0.9;
    evidence.push(`${sumMatches}/${sizeOutputPairs.length} observations match sum hypothesis`);
  }

  // Check count correlation
  const countMatches = sizeOutputPairs.filter(p => p.size === p.output).length;
  if (countMatches > sizeOutputPairs.length * 0.8) {
    confidence = Math.max(confidence, 0.85);
    evidence.push(`${countMatches}/${sizeOutputPairs.length} observations match count hypothesis`);
  }

  if (confidence > 0.5) {
    return {
      type: 'linear_aggregation',
      confidence,
      evidence,
      suggestedAlgorithm: 'Linear scan / Aggregation',
    };
  }

  return null;
}

/**
 * Detect sorting-based behavior
 */
function detectSortingBehavior(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];
  let confidence = 0;

  // Check if output is affected by input order
  const sortedOutputMatches = observations.filter(obs => {
    const numbers = extractNumbers(obs.input);
    const sorted = [...numbers].sort((a, b) => a - b);
    const outputNumbers = obs.output.trim().split(/\s+/).map(Number);
    
    // Check if output equals sorted input
    if (sorted.length === outputNumbers.length && 
        sorted.every((v, i) => v === outputNumbers[i])) {
      return true;
    }
    
    // Check if output equals max/min (selection)
    if (outputNumbers.length === 1) {
      const out = outputNumbers[0];
      if (out === sorted[0] || out === sorted[sorted.length - 1]) {
        return true;
      }
    }
    
    return false;
  });

  confidence = sortedOutputMatches.length / observations.length;
  
  if (confidence > 0.7) {
    evidence.push(`${sortedOutputMatches.length}/${observations.length} outputs relate to sorted order`);
    return {
      type: 'sorting_based',
      confidence,
      evidence,
      suggestedAlgorithm: 'Sorting / Selection',
    };
  }

  return null;
}

/**
 * Detect mathematical transform patterns
 */
function detectMathematicalTransform(observations: Observation[]): DetectedPattern | null {
  const evidence: string[] = [];
  let confidence = 0;

  // Check for factorial pattern
  const factorialMatches = observations.filter(obs => {
    const n = extractFirstNumber(obs.input);
    if (n === null || n > 20 || n < 0) return false;
    const expected = factorial(n);
    return expected.toString() === obs.output.trim();
  });

  if (factorialMatches.length > observations.length * 0.8) {
    confidence = 0.95;
    evidence.push('Factorial pattern detected');
    return {
      type: 'mathematical_transform',
      confidence,
      evidence,
      suggestedAlgorithm: 'Factorial computation',
    };
  }

  // Check for Fibonacci pattern
  const fibMatches = observations.filter(obs => {
    const n = extractFirstNumber(obs.input);
    if (n === null || n > 45 || n < 1) return false;
    const expected = fibonacci(n);
    return expected.toString() === obs.output.trim();
  });

  if (fibMatches.length > observations.length * 0.8) {
    confidence = 0.95;
    evidence.push('Fibonacci pattern detected');
    return {
      type: 'mathematical_transform',
      confidence,
      evidence,
      suggestedAlgorithm: 'Fibonacci number computation',
    };
  }

  // Check for prime detection pattern
  const primeMatches = observations.filter(obs => {
    const n = extractFirstNumber(obs.input);
    if (n === null) return false;
    const isPrime = checkPrime(n);
    const out = obs.output.trim().toLowerCase();
    return (isPrime && ['yes', '1', 'true'].includes(out)) ||
           (!isPrime && ['no', '0', 'false'].includes(out));
  });

  if (primeMatches.length > observations.length * 0.8) {
    confidence = 0.9;
    evidence.push('Prime check pattern detected');
    return {
      type: 'mathematical_transform',
      confidence,
      evidence,
      suggestedAlgorithm: 'Prime number detection',
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
  const kadaneMatches = observations.filter(obs => {
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
      suggestedAlgorithm: 'Kadane\'s Algorithm (Maximum Subarray Sum)',
    };
  }

  // Check for LIS length
  const lisMatches = observations.filter(obs => {
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
      suggestedAlgorithm: 'Longest Increasing Subsequence',
    };
  }

  return null;
}

// Helper functions (same as hypothesisEngine)
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

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function fibonacci(n: number): number {
  if (n <= 2) return 1;
  let a = 1, b = 1;
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
    let lo = 0, hi = dp.length;
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
```

---

## 4. WebSocket Real-Time Communication

### 4.1 WebSocket Server Setup

Install dependencies:

```bash
npm install ws
npm install -D @types/ws
```

Create `src/services/websocketService.ts`:

```typescript
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';

interface Client {
  ws: WebSocket;
  jobId: string | null;
}

const clients = new Map<string, Client>();
let wss: WebSocketServer;

export function initializeWebSocket(server: any): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = generateClientId();
    clients.set(clientId, { ws, jobId: null });

    logger.info(`WebSocket client connected: ${clientId}`);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(clientId, message);
      } catch (error) {
        logger.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for ${clientId}:`, error);
    });

    // Send connection acknowledgment
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });

  logger.info('WebSocket server initialized');
}

function handleMessage(clientId: string, message: any): void {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'subscribe':
      client.jobId = message.jobId;
      logger.info(`Client ${clientId} subscribed to job ${message.jobId}`);
      break;

    case 'unsubscribe':
      client.jobId = null;
      break;

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

/**
 * Broadcast job status update to subscribed clients
 */
export function broadcastJobUpdate(jobId: string, update: any): void {
  const message = JSON.stringify({
    type: 'job_update',
    jobId,
    ...update,
  });

  for (const [clientId, client] of clients.entries()) {
    if (client.jobId === jobId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

/**
 * Send stage progress update
 */
export function sendStageUpdate(
  jobId: string,
  stage: string,
  progress?: number,
  details?: any
): void {
  broadcastJobUpdate(jobId, {
    type: 'stage_update',
    stage,
    progress,
    details,
    timestamp: Date.now(),
  });
}

/**
 * Send test case execution update
 */
export function sendTestCaseUpdate(
  jobId: string,
  testIndex: number,
  totalTests: number,
  result?: { input: string; output: string }
): void {
  broadcastJobUpdate(jobId, {
    type: 'test_update',
    testIndex,
    totalTests,
    progress: ((testIndex + 1) / totalTests) * 100,
    result,
  });
}

/**
 * Send hypothesis update
 */
export function sendHypothesisUpdate(
  jobId: string,
  hypotheses: Array<{ name: string; confidence: number }>
): void {
  broadcastJobUpdate(jobId, {
    type: 'hypothesis_update',
    hypotheses,
  });
}

/**
 * Send completion notification
 */
export function sendCompletion(jobId: string, result: any): void {
  broadcastJobUpdate(jobId, {
    type: 'complete',
    result,
  });
}

/**
 * Send error notification
 */
export function sendError(jobId: string, error: string): void {
  broadcastJobUpdate(jobId, {
    type: 'error',
    error,
  });
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### 4.2 Update Server Entry Point

Update `src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import apiRoutes from './routes/api';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { initializeWebSocket } from './services/websocketService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket
initializeWebSocket(server);

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket available at ws://localhost:${PORT}/ws`);
});

export default app;
```

### 4.3 Frontend WebSocket Hook

Create `frontend/hooks/useWebSocket.ts`:

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  jobId?: string;
  stage?: string;
  progress?: number;
  details?: any;
  result?: any;
  error?: string;
  hypotheses?: Array<{ name: string; confidence: number }>;
  testIndex?: number;
  totalTests?: number;
}

interface UseWebSocketOptions {
  url: string;
  jobId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onStageChange?: (stage: string, progress?: number) => void;
  onHypothesesUpdate?: (hypotheses: Array<{ name: string; confidence: number }>) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { url, jobId, onMessage, onStageChange, onHypothesesUpdate, onComplete, onError } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (jobId) {
        ws.send(JSON.stringify({ type: 'subscribe', jobId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
        onMessage?.(message);

        switch (message.type) {
          case 'stage_update':
            onStageChange?.(message.stage!, message.progress);
            break;
          case 'hypothesis_update':
            onHypothesesUpdate?.(message.hypotheses!);
            break;
          case 'complete':
            onComplete?.(message.result);
            break;
          case 'error':
            onError?.(message.error!);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [url, jobId, onMessage, onStageChange, onHypothesesUpdate, onComplete, onError]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((newJobId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', jobId: newJobId }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (jobId && isConnected) {
      subscribe(jobId);
    }
  }, [jobId, isConnected, subscribe]);

  return {
    isConnected,
    lastMessage,
    subscribe,
    disconnect,
  };
}
```

---

## 5. Enhanced LLM Prompting

### 5.1 Context-Aware Problem Inference

Add to `src/services/llmService.ts`:

```typescript
import { Hypothesis } from './hypothesisEngine';
import { DetectedPattern } from './patternDetector';

/**
 * Infer problem with hypothesis and pattern context
 */
export async function inferProblemWithHypotheses(
  inputFormat: string,
  constraints: string,
  observations: { input: string; output: string }[],
  hypotheses: Hypothesis[],
  patterns?: DetectedPattern[]
): Promise<AnalysisResult> {
  const hypothesisContext = hypotheses.length > 0
    ? `
PRE-ANALYSIS (Automated Pattern Detection):
The following algorithmic patterns have been detected with high confidence:
${hypotheses.slice(0, 5).map(h => `- ${h.name}: ${(h.confidence * 100).toFixed(0)}% confidence (${h.matchCount}/${h.matchCount + h.mismatchCount} matches)
  Description: ${h.description}`).join('\n')}

${patterns && patterns.length > 0 ? `
Detected computational patterns:
${patterns.map(p => `- ${p.type}: ${(p.confidence * 100).toFixed(0)}% confidence
  Suggested algorithm: ${p.suggestedAlgorithm}
  Evidence: ${p.evidence.join('; ')}`).join('\n')}
` : ''}
USE THIS CONTEXT to validate and refine your analysis. If the pre-analysis matches your observations, use it to inform your problem statement.`
    : '';

  const observationsStr = observations
    .slice(0, 30)
    .map((obs, i) => `Test ${i + 1}:\n  Input: ${obs.input.trim()}\n  Output: ${obs.output}`)
    .join('\n\n');

  const prompt = `You are an expert competitive programmer performing black-box analysis.

INPUT FORMAT:
${inputFormat}

CONSTRAINTS:
${constraints || 'Standard competitive programming constraints'}
${hypothesisContext}

OBSERVED INPUT-OUTPUT PAIRS:
${observationsStr}

TASK: Determine the exact competitive programming problem this program solves.

ANALYSIS METHODOLOGY:
1. **Verify Pre-Analysis**: Check if the detected patterns match ALL observations
2. **Look for Edge Cases**: Pay attention to:
   - Single element inputs
   - Zero/negative values
   - Large values (overflow potential)
   - Sorted vs unsorted inputs
3. **Eliminate False Positives**: Ensure no observation contradicts your hypothesis
4. **Determine Exact Problem**: Be specific - "Array Sum" is different from "Sum of Positive Elements"

OUTPUT FORMAT (use these exact markers):

===PROBLEM_TITLE===
[Exact descriptive title]

===PROBLEM_STATEMENT===
[Complete problem description]

### Input Format
[Line by line input description]

### Output Format
[Exact output specification]

### Constraints
[All constraints in mathematical notation]

===SAMPLE_EXPLANATION===
[Step-by-step explanation of one test case]

===ALGORITHM===
[Algorithm name and category]

===SOLUTION_CODE===
\`\`\`cpp
#include <iostream>
// Clean, well-commented C++ code
// Handle edge cases
// Use appropriate data types (long long for large sums)
\`\`\`

===TIME_COMPLEXITY===
[Big-O analysis]

===SPACE_COMPLEXITY===
[Big-O analysis]

===CONFIDENCE===
[Low/Medium/High] - with reasoning

Begin comprehensive analysis:`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  return parseEnhancedInferenceResponse(response, observations);
}

function parseEnhancedInferenceResponse(
  response: string, 
  observations: { input: string; output: string }[]
): AnalysisResult {
  // Extract sections using markers
  const sections: { [key: string]: string } = {};
  
  const patterns = [
    { key: 'title', regex: /===PROBLEM_TITLE===\s*([\s\S]*?)(?====|$)/ },
    { key: 'statement', regex: /===PROBLEM_STATEMENT===\s*([\s\S]*?)(?====|$)/ },
    { key: 'explanation', regex: /===SAMPLE_EXPLANATION===\s*([\s\S]*?)(?====|$)/ },
    { key: 'algorithm', regex: /===ALGORITHM===\s*([\s\S]*?)(?====|$)/ },
    { key: 'code', regex: /===SOLUTION_CODE===\s*([\s\S]*?)(?====|$)/ },
    { key: 'time', regex: /===TIME_COMPLEXITY===\s*([\s\S]*?)(?====|$)/ },
    { key: 'space', regex: /===SPACE_COMPLEXITY===\s*([\s\S]*?)(?====|$)/ },
    { key: 'confidence', regex: /===CONFIDENCE===\s*([\s\S]*?)(?====|$)/ },
  ];
  
  for (const { key, regex } of patterns) {
    const match = response.match(regex);
    if (match) {
      sections[key] = match[1].trim();
    }
  }
  
  // Extract code
  let solutionCode = sections.code || '';
  const codeBlockMatch = solutionCode.match(/```(?:cpp|c\+\+)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    solutionCode = codeBlockMatch[1].trim();
  }
  
  // Build formatted problem statement
  const problemStatement = `# ${sections.title || 'Problem Analysis'}

## Problem Statement
${sections.statement || 'Problem description could not be determined.'}

## Sample Explanation
${sections.explanation || 'No explanation available.'}

## Complexity Analysis
- **Time Complexity**: ${sections.time || 'Not analyzed'}
- **Space Complexity**: ${sections.space || 'Not analyzed'}

## Confidence Level
${sections.confidence || 'Medium'}`;

  return {
    problemStatement,
    solution: solutionCode || '// Solution code could not be generated',
    algorithm: sections.algorithm || 'Unknown',
    observations: observations.slice(0, 20), // Include subset for display
  };
}
```

---

## 6. Iterative Refinement Pipeline

### 6.1 Refinement Service

Create `src/services/refinementService.ts`:

```typescript
import { logger } from '../utils/logger';
import { AnalysisResult } from './jobService';

interface RefinementContext {
  originalResult: AnalysisResult;
  observations: { input: string; output: string }[];
  inputFormat: string;
  constraints: string;
}

/**
 * Verify the generated solution against observations
 */
export async function verifySolution(
  result: AnalysisResult,
  observations: { input: string; output: string }[]
): Promise<{
  verified: boolean;
  mismatches: { input: string; expected: string; actual: string }[];
  accuracy: number;
}> {
  // This would ideally compile and run the generated solution
  // For now, we do a basic verification through LLM
  
  const mismatches: { input: string; expected: string; actual: string }[] = [];
  let matchCount = 0;

  // We can't actually execute the generated code without a compiler
  // So we verify based on the algorithm description and pattern matching
  
  // For actual verification, you would:
  // 1. Compile the C++ code in a sandbox
  // 2. Run it against all observations
  // 3. Compare outputs

  // Placeholder implementation
  const accuracy = 1.0; // Assume high accuracy if LLM is confident
  
  return {
    verified: accuracy > 0.9,
    mismatches,
    accuracy,
  };
}

/**
 * Refine the result if verification fails
 */
export async function refineResult(
  context: RefinementContext,
  verificationResult: { mismatches: any[]; accuracy: number }
): Promise<AnalysisResult> {
  // If accuracy is acceptable, return original
  if (verificationResult.accuracy > 0.8) {
    return context.originalResult;
  }

  logger.info('Refining result due to low accuracy');

  // Build refinement prompt with mismatch information
  const mismatchContext = verificationResult.mismatches
    .slice(0, 5)
    .map(m => `Input: ${m.input}\nExpected: ${m.expected}\nActual: ${m.actual}`)
    .join('\n\n');

  // Call LLM with refinement prompt
  // This would use a modified version of inferProblemWithHypotheses
  
  // For now, return original result
  return context.originalResult;
}
```

---

## 7. Error Recovery & Fallback Strategies

### 7.1 Error Handler

Create `src/services/errorRecoveryService.ts`:

```typescript
import { logger } from '../utils/logger';
import { AnalysisResult } from './jobService';

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
  fallback?: () => Promise<any>;
}

const recoveryStrategies: Map<ErrorType, RecoveryStrategy> = new Map([
  ['llm_timeout', { type: 'llm_timeout', maxRetries: 3, backoffMs: 2000 }],
  ['llm_rate_limit', { type: 'llm_rate_limit', maxRetries: 3, backoffMs: 5000 }],
  ['llm_invalid_response', { type: 'llm_invalid_response', maxRetries: 2, backoffMs: 1000 }],
  ['docker_timeout', { type: 'docker_timeout', maxRetries: 1, backoffMs: 0 }],
  ['docker_memory', { type: 'docker_memory', maxRetries: 0, backoffMs: 0 }],
  ['execution_failed', { type: 'execution_failed', maxRetries: 2, backoffMs: 500 }],
]);

/**
 * Classify error type from error message/object
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout') && message.includes('llm')) return 'llm_timeout';
  if (message.includes('rate limit') || message.includes('429')) return 'llm_rate_limit';
  if (message.includes('invalid') && message.includes('json')) return 'llm_invalid_response';
  if (message.includes('timeout') && message.includes('docker')) return 'docker_timeout';
  if (message.includes('memory') || message.includes('oom')) return 'docker_memory';
  if (message.includes('execution') || message.includes('exit code')) return 'execution_failed';
  if (message.includes('parse')) return 'parse_error';
  
  return 'unknown';
}

/**
 * Execute operation with retry and recovery
 */
export async function withRecovery<T>(
  operation: () => Promise<T>,
  errorType: ErrorType,
  context?: any
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
        await new Promise(resolve => setTimeout(resolve, backoff));
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
    return await strategy.fallback();
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
    problemStatement: `# Analysis Result

## Observations
The program was tested with ${observations.length} test cases.

## Detected Patterns
${patterns.join('\n')}

## Note
Full analysis could not be completed. Manual review recommended.`,
    solution: '// Solution could not be generated automatically',
    algorithm: 'Unknown - Requires manual analysis',
    observations,
  };
}

function analyzeBasicPatterns(
  observations: { input: string; output: string }[]
): string[] {
  const patterns: string[] = [];
  
  // Check if outputs are numeric
  const numericOutputs = observations.every(obs => 
    /^-?\d+(\.\d+)?$/.test(obs.output.trim())
  );
  if (numericOutputs) {
    patterns.push('- Output is always a single numeric value');
  }
  
  // Check for Yes/No outputs
  const booleanOutputs = observations.every(obs => 
    ['yes', 'no', '0', '1', 'true', 'false'].includes(obs.output.trim().toLowerCase())
  );
  if (booleanOutputs) {
    patterns.push('- Output is binary (Yes/No or 0/1)');
  }
  
  // Check output value range
  const values = observations
    .map(obs => parseFloat(obs.output))
    .filter(v => !isNaN(v));
  
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    patterns.push(`- Output range: ${min} to ${max}`);
  }
  
  return patterns;
}
```

### 7.2 Graceful Degradation

Update pipeline to use recovery:

```typescript
// In pipelineService.ts
import { withRecovery, classifyError, generateFallbackResult } from './errorRecoveryService';

export async function runRobustPipeline(
  jobId: string,
  executablePath: string,
  inputFormat: string,
  constraints: string
): Promise<void> {
  const job = analysisJobs.get(jobId);
  if (!job) throw new Error('Job not found');

  try {
    job.status = 'running';

    // Stage 1: Generate Test Cases with recovery
    job.stage = 'generating';
    
    const testCases = await withRecovery(
      () => generateEnhancedTestCases(inputFormat, constraints),
      'llm_timeout'
    );

    // Stage 2: Execute with error handling
    job.stage = 'executing';
    
    const observations = await executeTestCasesWithRecovery(
      executablePath,
      testCases,
      jobId
    );

    if (observations.length < 3) {
      throw new Error('Insufficient successful test executions');
    }

    // Stage 3: Inference with fallback
    job.stage = 'inferring';
    
    let result: AnalysisResult;
    try {
      const hypotheses = getTopHypotheses(observations);
      result = await withRecovery(
        () => inferProblemWithHypotheses(inputFormat, constraints, observations, hypotheses),
        'llm_timeout'
      );
    } catch (error) {
      logger.warn(`LLM inference failed, using fallback: ${error}`);
      result = generateFallbackResult(observations);
    }

    job.status = 'complete';
    job.stage = 'complete';
    job.result = result;

  } catch (error) {
    const errorType = classifyError(error as Error);
    logger.error(`Pipeline failed (${errorType}):`, error);
    
    job.status = 'error';
    job.error = getErrorMessage(errorType, error as Error);
    
    // Try to provide partial results if available
    if (job.observations && job.observations.length > 0) {
      job.result = generateFallbackResult(job.observations);
    }
  }
}

function getErrorMessage(type: ErrorType, error: Error): string {
  switch (type) {
    case 'llm_rate_limit':
      return 'Service is temporarily rate limited. Please try again in a few minutes.';
    case 'docker_timeout':
      return 'Executable took too long to run. The program may have an infinite loop.';
    case 'docker_memory':
      return 'Executable exceeded memory limits.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}
```

---

## 8. Testing & Validation

### 8.1 Phase 2 Test Suite

Create `backend/tests/phase2.test.ts`:

```typescript
import { generateComprehensiveTestSuite } from '../src/services/testCaseStrategyService';
import { validateHypotheses, getTopHypotheses } from '../src/services/hypothesisEngine';
import { detectPatterns } from '../src/services/patternDetector';

describe('Phase 2: Enhanced Inference', () => {
  describe('Test Case Generation', () => {
    it('should generate diverse test cases', () => {
      const testCases = generateComprehensiveTestSuite(
        'First line: n\nSecond line: n integers',
        '1 ≤ n ≤ 100',
        25
      );

      expect(testCases.length).toBeGreaterThanOrEqual(15);
      
      // Check category diversity
      const categories = new Set(testCases.map(tc => tc.category));
      expect(categories.size).toBeGreaterThanOrEqual(5);
    });

    it('should include boundary tests', () => {
      const testCases = generateComprehensiveTestSuite(
        'Single integer n',
        '1 ≤ n ≤ 100',
        20
      );

      const boundaryTests = testCases.filter(tc => tc.category === 'boundary');
      expect(boundaryTests.length).toBeGreaterThan(0);
    });
  });

  describe('Hypothesis Validation', () => {
    it('should correctly identify sum algorithm', () => {
      const observations = [
        { input: '3\n1 2 3\n', output: '6' },
        { input: '5\n1 2 3 4 5\n', output: '15' },
        { input: '4\n-1 -2 -3 -4\n', output: '-10' },
        { input: '2\n0 0\n', output: '0' },
      ];

      const hypotheses = getTopHypotheses(observations);
      
      expect(hypotheses[0].name).toBe('Array Sum');
      expect(hypotheses[0].confidence).toBe(1);
    });

    it('should correctly identify max algorithm', () => {
      const observations = [
        { input: '3\n1 2 3\n', output: '3' },
        { input: '5\n5 4 3 2 1\n', output: '5' },
        { input: '4\n-1 -2 -3 -4\n', output: '-1' },
        { input: '3\n7 7 7\n', output: '7' },
      ];

      const hypotheses = getTopHypotheses(observations);
      
      expect(hypotheses[0].name).toBe('Maximum Element');
      expect(hypotheses[0].confidence).toBe(1);
    });

    it('should correctly identify fibonacci', () => {
      const observations = [
        { input: '1\n', output: '1' },
        { input: '2\n', output: '1' },
        { input: '5\n', output: '5' },
        { input: '10\n', output: '55' },
      ];

      const hypotheses = getTopHypotheses(observations);
      
      expect(hypotheses[0].name).toBe('Nth Fibonacci');
      expect(hypotheses[0].confidence).toBe(1);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect linear aggregation', () => {
      const observations = [
        { input: '3\n1 2 3\n', output: '6' },
        { input: '5\n10 20 30 40 50\n', output: '150' },
      ];

      const patterns = detectPatterns(observations);
      
      expect(patterns.some(p => p.type === 'linear_aggregation')).toBe(true);
    });

    it('should detect mathematical transform', () => {
      const observations = [
        { input: '5\n', output: '120' },
        { input: '3\n', output: '6' },
        { input: '4\n', output: '24' },
      ];

      const patterns = detectPatterns(observations);
      
      expect(patterns.some(p => p.suggestedAlgorithm.includes('Factorial'))).toBe(true);
    });
  });
});
```

### 8.2 Integration Test Scenarios

```typescript
// Test scenarios for manual/automated testing

const testScenarios = [
  {
    name: 'Simple Sum',
    inputFormat: 'First line: n\nSecond line: n integers',
    expectedAlgorithm: 'Array Sum',
    sampleIO: [
      { input: '5\n1 2 3 4 5', output: '15' },
    ],
  },
  {
    name: 'Maximum Element',
    inputFormat: 'First line: n\nSecond line: n integers',
    expectedAlgorithm: 'Maximum Element',
    sampleIO: [
      { input: '5\n1 5 3 2 4', output: '5' },
    ],
  },
  {
    name: 'Fibonacci',
    inputFormat: 'Single integer n',
    constraints: '1 ≤ n ≤ 30',
    expectedAlgorithm: 'Fibonacci',
    sampleIO: [
      { input: '10', output: '55' },
    ],
  },
  {
    name: 'Max Subarray (Kadane)',
    inputFormat: 'First line: n\nSecond line: n integers',
    expectedAlgorithm: 'Kadane',
    sampleIO: [
      { input: '6\n-2 1 -3 4 -1 2', output: '5' },
    ],
  },
  {
    name: 'GCD of Array',
    inputFormat: 'First line: n\nSecond line: n integers',
    expectedAlgorithm: 'GCD',
    sampleIO: [
      { input: '3\n12 18 24', output: '6' },
    ],
  },
];
```

---

## Phase 2 Completion Checklist

- [ ] Advanced test case generation with multiple strategies
- [ ] Constraint parsing and adaptive test generation
- [ ] Hypothesis validation engine with 20+ common patterns
- [ ] Pattern detection for algorithmic categories
- [ ] WebSocket real-time progress updates
- [ ] Enhanced LLM prompting with hypothesis context
- [ ] Multi-hypothesis discrimination tests
- [ ] Error recovery and fallback strategies
- [ ] Iterative refinement capability
- [ ] Unit tests for hypothesis engine
- [ ] Integration tests for full pipeline

---

**Next Phase**: Production Hardening (PHASE-3.md) - Complete security lockdown, performance optimization, deployment, and evaluation on 100+ problems.
