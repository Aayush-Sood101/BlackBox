import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export interface TestCase {
  input: string;
  rationale: string;
}

export interface Observation {
  input: string;
  output: string;
}

export interface InferenceResult {
  problemTitle: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleTestCases: Array<{
    input: string;
    output: string;
    explanation: string;
  }>;
  solutionCode: string;
  algorithmExplanation: string;
  timeComplexity: string;
  spaceComplexity: string;
  confidence: number;
}

/**
 * Generate test cases using LLM
 */
export async function generateTestCases(
  inputFormat: string,
  constraints: string,
  count: number = 10  // Reduced from 20 to prevent truncation
): Promise<TestCase[]> {
  const model = genAI.getGenerativeModel({ 
    model: config.gemini.model,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 8192,  // Increased to prevent truncation
    },
  });

  const prompt = `You are an expert competitive programmer designing test cases for behavioral analysis of a black-box program.

Given:
- Input format: ${inputFormat}
- Constraints: ${constraints}

Generate ${count} diverse test cases that maximize behavioral observability. Your test cases must strategically cover:

1. **Minimal Cases**: Single element, smallest valid input
2. **Maximal Cases**: Largest sizes within constraints
3. **Edge Cases**: All zeros, all negative, all positive, mixed signs
4. **Boundary Values**: Min/max constraint values, values near zero
5. **Structural Patterns**: Sorted ascending, sorted descending, all same elements, alternating
6. **Mathematical Patterns**: Arithmetic sequence, geometric sequence, primes, Fibonacci-like
7. **Random/Chaotic**: Unstructured random values

Goal: Create tests that help distinguish between different possible algorithms (sum vs max vs sort vs DP, etc.)

Respond ONLY with a valid JSON array. No explanations before or after. Format:
[
  {"input": "5\\n1 2 3 4 5", "rationale": "Small sorted sequence"},
  {"input": "1\\n42", "rationale": "Single element edge case"}
]

Important: 
- Use \\n for newlines in the input strings
- Each test case must be a complete valid input matching the format
- Ensure variety to distinguish between different algorithmic behaviors`;

  try {
    logger.info('Generating test cases with LLM');
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    logger.debug('Raw LLM response for test cases:', { 
      responseLength: text.length,
      responsePreview: text.substring(0, 500) 
    });
    
    // Extract JSON from response - handle markdown code blocks
    let jsonText = text;
    
    // Remove markdown code blocks if present (with or without closing backticks for truncated responses)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
    
    // Find JSON array - handle potentially truncated arrays
    let jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    
    // Helper function to extract complete test case objects from text
    const extractCompleteObjects = (text: string): TestCase[] => {
      const results: TestCase[] = [];
      // Match complete JSON objects with input and rationale
      // Use a more robust pattern that handles escaped characters in strings
      const objectRegex = /\{\s*"input"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"rationale"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
      let match;
      
      while ((match = objectRegex.exec(text)) !== null) {
        results.push({
          input: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          rationale: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"')
        });
      }
      return results;
    };
    
    // First try: direct JSON parse
    let testCases: TestCase[] = [];
    
    if (jsonMatch) {
      try {
        testCases = JSON.parse(jsonMatch[0]);
        logger.info(`Parsed ${testCases.length} test cases directly from JSON`);
      } catch (parseError) {
        logger.warn('Direct JSON parse failed, will extract objects', { 
          error: String(parseError),
          jsonLength: jsonMatch[0].length 
        });
      }
    }
    
    // Second try: extract complete objects from the text
    if (testCases.length === 0) {
      testCases = extractCompleteObjects(jsonText);
      if (testCases.length > 0) {
        logger.info(`Extracted ${testCases.length} test cases via regex from truncated response`);
      }
    }
    
    // Final check
    if (testCases.length === 0) {
      logger.error('No valid test cases found in LLM response', {
        responsePreview: text.substring(0, 1000),
        fullResponse: text
      });
      throw new Error(`No valid test cases found in LLM response. Response preview: ${text.substring(0, 200)}...`);
    }
    
    logger.info(`Generated ${testCases.length} test cases`);
    return testCases;
  } catch (error) {
    logger.error('Failed to generate test cases:', error);
    throw error;
  }
}

/**
 * Infer problem from observations using LLM
 */
export async function inferProblem(
  inputFormat: string,
  constraints: string,
  observations: Observation[]
): Promise<InferenceResult> {
  const model = genAI.getGenerativeModel({ 
    model: config.gemini.model,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const observationsText = observations
    .map((o, i) => `Test ${i + 1}:\nInput:\n${o.input}\nOutput:\n${o.output}`)
    .join('\n\n');

  const prompt = `You are an expert competitive programmer analyzing black-box program behavior.

Given:
- Input format: ${inputFormat}
- Constraints: ${constraints}
- Observations (${observations.length} input-output pairs):

${observationsText}

Task: Infer the competitive programming problem this program solves.

Analysis Process:
1. **Pattern Recognition**: What mathematical relationship exists between inputs and outputs?
2. **Hypothesis Generation**: List possible algorithms (sum, max, min, sort, DP, etc.)
3. **Hypothesis Validation**: Test each hypothesis against ALL observations
4. **Elimination**: Discard hypotheses that don't match all observations
5. **Conclusion**: Identify the most likely algorithm

Respond ONLY with a valid JSON object (no markdown, no code blocks). Format:
{
  "problemTitle": "Problem Name",
  "problemStatement": "Full problem description in 2-3 sentences",
  "inputFormat": "Detailed input format description",
  "outputFormat": "Detailed output format description",
  "constraints": "All constraints in bullet points",
  "sampleTestCases": [
    {
      "input": "5\\n1 2 3 4 5",
      "output": "15",
      "explanation": "1 + 2 + 3 + 4 + 5 = 15"
    }
  ],
  "solutionCode": "Complete C++ solution code here",
  "algorithmExplanation": "Step-by-step explanation of the algorithm",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "confidence": 0.95
}

Important:
- The confidence should be between 0 and 1, reflecting how certain you are
- The solution code should be complete, compilable C++ code
- Use \\n for newlines in input/output strings
- Do not wrap the JSON in markdown code blocks`;

  try {
    logger.info('Inferring problem from observations');
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    logger.debug('Raw LLM response for inference:', { 
      responseLength: text.length,
      responsePreview: text.substring(0, 500) 
    });
    
    // Extract JSON from response (handle potential markdown wrapping)
    let jsonText = text;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
    
    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    let inference: InferenceResult;
    try {
      inference = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('JSON parse error in inference', {
        parseError,
        jsonAttempt: jsonText.substring(0, 500),
        fullResponse: text
      });
      throw new Error(`Failed to parse inference JSON: ${parseError}. Response preview: ${text.substring(0, 200)}...`);
    }
    
    logger.info(`Inferred problem: ${inference.problemTitle} (confidence: ${inference.confidence})`);
    return inference;
  } catch (error) {
    logger.error('Failed to infer problem:', error);
    throw error;
  }
}

/**
 * Generate mock test cases for testing without API
 */
export function generateMockTestCases(inputFormat: string, count: number = 10): TestCase[] {
  const testCases: TestCase[] = [
    { input: '1\n42', rationale: 'Single element' },
    { input: '5\n1 2 3 4 5', rationale: 'Small sorted ascending' },
    { input: '5\n5 4 3 2 1', rationale: 'Small sorted descending' },
    { input: '3\n0 0 0', rationale: 'All zeros' },
    { input: '4\n-1 -2 -3 -4', rationale: 'All negative' },
    { input: '6\n-3 -1 0 1 2 5', rationale: 'Mixed positive and negative' },
    { input: '4\n7 7 7 7', rationale: 'All same elements' },
    { input: '5\n1 -1 1 -1 1', rationale: 'Alternating signs' },
    { input: '3\n1000000000 1000000000 1000000000', rationale: 'Large values' },
    { input: '10\n1 2 3 4 5 6 7 8 9 10', rationale: 'Longer sequence' },
  ];
  
  return testCases.slice(0, count);
}

/**
 * Generate mock inference result for testing
 */
export function generateMockInference(observations: Observation[]): InferenceResult {
  // Simple analysis of observations to determine if it's sum, max, etc.
  let isSum = true;
  let isMax = true;
  
  for (const obs of observations) {
    const lines = obs.input.trim().split('\n');
    if (lines.length < 2) continue;
    
    const numbers = lines[1].split(' ').map(x => parseInt(x));
    const output = parseInt(obs.output);
    
    const sum = numbers.reduce((a, b) => a + b, 0);
    const max = Math.max(...numbers);
    
    if (sum !== output) isSum = false;
    if (max !== output) isMax = false;
  }
  
  if (isSum) {
    return {
      problemTitle: 'Array Sum',
      problemStatement: 'Given an array of n integers, calculate and print the sum of all elements.',
      inputFormat: 'First line contains integer n. Second line contains n space-separated integers.',
      outputFormat: 'Print a single integer: the sum of all array elements.',
      constraints: '1 ≤ n ≤ 100000, -10^9 ≤ a[i] ≤ 10^9',
      sampleTestCases: [
        { input: '5\n1 2 3 4 5', output: '15', explanation: '1 + 2 + 3 + 4 + 5 = 15' }
      ],
      solutionCode: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        sum += x;
    }
    
    cout << sum << endl;
    return 0;
}`,
      algorithmExplanation: 'Read n integers and accumulate their sum using a running total.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      confidence: 0.95,
    };
  }
  
  // Default fallback
  return {
    problemTitle: 'Unknown Problem',
    problemStatement: 'Could not determine the exact problem from the observations.',
    inputFormat: 'Unknown',
    outputFormat: 'Unknown',
    constraints: 'Unknown',
    sampleTestCases: [],
    solutionCode: '// Could not generate solution',
    algorithmExplanation: 'Insufficient data to determine algorithm.',
    timeComplexity: 'Unknown',
    spaceComplexity: 'Unknown',
    confidence: 0.3,
  };
}

// ========== PHASE 2 ENHANCED FUNCTIONS ==========

export interface Hypothesis {
  name: string;
  confidence: number;
  description?: string;
}

export interface DetectedPattern {
  type: string;
  confidence: number;
  suggestedAlgorithm: string;
}

/**
 * Generate enhanced test cases with LLM using strategic prompting
 */
export async function generateEnhancedTestCases(
  inputFormat: string,
  constraints: string,
  previousObservations?: Observation[]
): Promise<TestCase[]> {
  const model = genAI.getGenerativeModel({
    model: config.gemini.model,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 8192,  // Increased to prevent truncation
    },
  });

  let contextSection = '';

  if (previousObservations && previousObservations.length > 0) {
    contextSection = `
PREVIOUS OBSERVATIONS (use these to generate MORE DISCRIMINATING tests):
${previousObservations
  .slice(-10)
  .map((obs, i) => `${i + 1}. Input: ${obs.input.trim()} → Output: ${obs.output}`)
  .join('\n')}

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
  "rationale": "why this test case is important"
}

Example:
[
  {"input": "1\\n42\\n", "rationale": "Single element boundary test"},
  {"input": "5\\n-5 -4 -3 -2 -1\\n", "rationale": "All negative sorted"}
]

Generate exactly 10 test cases now:`;

  try {
    logger.info('Generating enhanced test cases with LLM');

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    logger.debug('Raw LLM response for enhanced test cases:', { 
      responseLength: text.length,
      responsePreview: text.substring(0, 500) 
    });

    // Extract JSON from response - handle markdown code blocks (with or without closing backticks)
    let jsonText = text;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    // Find JSON array
    let jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    
    // Helper function to extract complete test case objects from text
    const extractCompleteObjects = (text: string): TestCase[] => {
      const results: TestCase[] = [];
      // Robust pattern that handles escaped characters
      const objectRegex = /\{\s*"input"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"rationale"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
      let match;
      
      while ((match = objectRegex.exec(text)) !== null) {
        results.push({
          input: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          rationale: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"')
        });
      }
      return results;
    };
    
    // First try: direct JSON parse
    let testCases: TestCase[] = [];
    
    if (jsonMatch) {
      try {
        const parsedArray = JSON.parse(jsonMatch[0]);
        testCases = parsedArray.map((tc: { input: string; rationale: string }) => ({
          input: tc.input.replace(/\\n/g, '\n'),
          rationale: tc.rationale,
        }));
        logger.info(`Parsed ${testCases.length} enhanced test cases directly from JSON`);
      } catch (parseError) {
        logger.warn('Direct JSON parse failed for enhanced test cases, will extract objects', { 
          error: String(parseError) 
        });
      }
    }
    
    // Second try: extract complete objects from the text
    if (testCases.length === 0) {
      testCases = extractCompleteObjects(jsonText);
      if (testCases.length > 0) {
        logger.info(`Extracted ${testCases.length} enhanced test cases via regex from truncated response`);
      }
    }
    
    // Final check
    if (testCases.length === 0) {
      logger.error('No valid enhanced test cases found in LLM response', {
        responsePreview: text.substring(0, 1000),
        fullResponse: text
      });
      throw new Error(`No valid test cases found in LLM response. Response preview: ${text.substring(0, 200)}...`);
    }

    logger.info(`Generated ${testCases.length} enhanced test cases`);
    return testCases;
  } catch (error) {
    logger.error('Failed to generate enhanced test cases:', error);
    throw error;
  }
}

/**
 * Infer problem with hypothesis and pattern context
 */
export async function inferProblemWithHypotheses(
  inputFormat: string,
  constraints: string,
  observations: Observation[],
  hypotheses: Hypothesis[],
  patterns?: DetectedPattern[]
): Promise<InferenceResult> {
  const model = genAI.getGenerativeModel({
    model: config.gemini.model,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const hypothesisContext =
    hypotheses.length > 0
      ? `
PRE-ANALYSIS (Automated Pattern Detection):
The following algorithmic patterns have been detected with high confidence:
${hypotheses
  .slice(0, 5)
  .map(
    (h) =>
      `- ${h.name}: ${(h.confidence * 100).toFixed(0)}% confidence${h.description ? `\n  Description: ${h.description}` : ''}`
  )
  .join('\n')}

${
  patterns && patterns.length > 0
    ? `
Detected computational patterns:
${patterns
  .map(
    (p) =>
      `- ${p.type}: ${(p.confidence * 100).toFixed(0)}% confidence
  Suggested algorithm: ${p.suggestedAlgorithm}`
  )
  .join('\n')}
`
    : ''
}
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

OUTPUT FORMAT - Respond ONLY with a valid JSON object:

{
  "problemTitle": "Exact descriptive title",
  "problemStatement": "Complete problem description",
  "inputFormat": "Line by line input description",
  "outputFormat": "Exact output specification",
  "constraints": "All constraints in mathematical notation",
  "sampleTestCases": [
    {
      "input": "input with \\n for newlines",
      "output": "expected output",
      "explanation": "step-by-step explanation"
    }
  ],
  "solutionCode": "Complete C++ solution with proper includes and main function",
  "algorithmExplanation": "Algorithm name and detailed explanation",
  "timeComplexity": "Big-O analysis",
  "spaceComplexity": "Big-O analysis",
  "confidence": 0.95
}

Important:
- Do NOT wrap in markdown code blocks
- Use \\n for newlines in strings
- Include complete, compilable C++ code
- Use long long for potential overflow scenarios
- Handle edge cases in the solution`;

  try {
    logger.info('Inferring problem with hypothesis context');

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    logger.debug('Raw LLM response for hypothesis inference:', { 
      responseLength: text.length,
      responsePreview: text.substring(0, 500) 
    });

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonText = text;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
    
    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let inference: InferenceResult;
    try {
      inference = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('JSON parse error in hypothesis inference', {
        parseError,
        jsonAttempt: jsonText.substring(0, 500),
        fullResponse: text
      });
      throw new Error(`Failed to parse inference JSON: ${parseError}. Response preview: ${text.substring(0, 200)}...`);
    }

    logger.info(
      `Inferred problem: ${inference.problemTitle} (confidence: ${inference.confidence})`
    );
    return inference;
  } catch (error) {
    logger.error('Failed to infer problem with hypotheses:', error);
    throw error;
  }
}

/**
 * Generate mock enhanced inference for testing
 */
export function generateMockEnhancedInference(
  observations: Observation[],
  hypotheses: Hypothesis[]
): InferenceResult {
  // Use the top hypothesis if available
  if (hypotheses.length > 0 && hypotheses[0].confidence > 0.9) {
    const topHypothesis = hypotheses[0];

    // Map common hypothesis names to mock results
    const mockResults: Record<string, Partial<InferenceResult>> = {
      'Array Sum': {
        problemTitle: 'Array Sum',
        problemStatement:
          'Given an array of n integers, calculate and print the sum of all elements.',
        algorithmExplanation: 'Linear scan accumulating the sum of all elements.',
        solutionCode: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        sum += x;
    }
    
    cout << sum << endl;
    return 0;
}`,
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
      },
      'Maximum Element': {
        problemTitle: 'Maximum Element',
        problemStatement:
          'Given an array of n integers, find and print the maximum element.',
        algorithmExplanation: 'Linear scan keeping track of the maximum value seen.',
        solutionCode: `#include <iostream>
#include <climits>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    int maxVal = INT_MIN;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        if (x > maxVal) maxVal = x;
    }
    
    cout << maxVal << endl;
    return 0;
}`,
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
      },
      'Minimum Element': {
        problemTitle: 'Minimum Element',
        problemStatement:
          'Given an array of n integers, find and print the minimum element.',
        algorithmExplanation: 'Linear scan keeping track of the minimum value seen.',
        solutionCode: `#include <iostream>
#include <climits>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    int minVal = INT_MAX;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        if (x < minVal) minVal = x;
    }
    
    cout << minVal << endl;
    return 0;
}`,
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
      },
    };

    const base = mockResults[topHypothesis.name] || {};

    return {
      problemTitle: base.problemTitle || topHypothesis.name,
      problemStatement:
        base.problemStatement || `Problem detected as ${topHypothesis.name}`,
      inputFormat:
        'First line contains integer n. Second line contains n space-separated integers.',
      outputFormat: 'Print a single integer.',
      constraints: '1 ≤ n ≤ 100000, -10^9 ≤ a[i] ≤ 10^9',
      sampleTestCases:
        observations.length > 0
          ? [
              {
                input: observations[0].input,
                output: observations[0].output,
                explanation: `Result computed using ${topHypothesis.name} algorithm`,
              },
            ]
          : [],
      solutionCode: base.solutionCode || '// Solution based on ' + topHypothesis.name,
      algorithmExplanation:
        base.algorithmExplanation || `${topHypothesis.name} algorithm`,
      timeComplexity: base.timeComplexity || 'O(n)',
      spaceComplexity: base.spaceComplexity || 'O(1)',
      confidence: topHypothesis.confidence,
    };
  }

  // Fallback to basic mock inference
  return generateMockInference(observations);
}
