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
  count: number = 20
): Promise<TestCase[]> {
  const model = genAI.getGenerativeModel({ 
    model: config.gemini.model,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 4096,
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
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON array found in LLM response');
    }
    
    const testCases: TestCase[] = JSON.parse(jsonMatch[0]);
    
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
    
    // Extract JSON from response (handle potential markdown wrapping)
    let jsonText = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const inference: InferenceResult = JSON.parse(jsonText);
    
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
