/**
 * Phase 2 Test Suite
 * Tests for advanced test case generation, hypothesis validation,
 * pattern detection, and enhanced pipeline
 */
import { logger } from './utils/logger';
import { generateComprehensiveTestSuite, parseConstraints } from './services/testCaseStrategyService';
import { generateAdaptiveTests, suggestNextTestCategories } from './services/adaptiveTestService';
import { getTopHypotheses, validateHypotheses, hypothesisLibrary } from './services/hypothesisEngine';
import { detectPatterns } from './services/patternDetector';
import { generateMockEnhancedInference } from './services/llmService';
import { classifyError, generateFallbackResult, isRecoverableError } from './services/errorRecoveryService';
import { analyzeResultQuality, verifySolution } from './services/refinementService';

async function runPhase2Tests() {
  logger.info('='.repeat(60));
  logger.info('Starting Phase 2 Tests...');
  logger.info('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  // ===== Test 1: Constraint Parsing =====
  try {
    logger.info('Test 1: Constraint Parsing');
    const constraints = parseConstraints(
      'First line: n integers',
      '1 ≤ n ≤ 100, -10^9 ≤ a[i] ≤ 10^9'
    );

    if (
      constraints.variables.length >= 1 &&
      constraints.structuralHints.includes('array-based')
    ) {
      logger.info('✅ Test 1 PASSED: Correctly parsed constraints');
      logger.info(`   Variables: ${constraints.variables.map(v => `${v.name}(${v.min}-${v.max})`).join(', ')}`);
      logger.info(`   Hints: ${constraints.structuralHints.join(', ')}`);
      passed++;
    } else {
      logger.error('❌ Test 1 FAILED: Parsing incomplete');
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 1 FAILED:', error);
    failed++;
  }

  // ===== Test 2: Comprehensive Test Suite Generation =====
  try {
    logger.info('\nTest 2: Comprehensive Test Suite Generation');
    const testCases = generateComprehensiveTestSuite(
      'First line: n\nSecond line: n integers',
      '1 ≤ n ≤ 100',
      25
    );

    // Check category diversity
    const categories = new Set(testCases.map(tc => tc.category));
    
    if (testCases.length >= 15 && categories.size >= 5) {
      logger.info('✅ Test 2 PASSED: Generated diverse test suite');
      logger.info(`   Total tests: ${testCases.length}`);
      logger.info(`   Categories: ${Array.from(categories).join(', ')}`);
      passed++;
    } else {
      logger.error(`❌ Test 2 FAILED: Expected 15+ tests with 5+ categories, got ${testCases.length} tests with ${categories.size} categories`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 2 FAILED:', error);
    failed++;
  }

  // ===== Test 3: Hypothesis Validation - Sum =====
  try {
    logger.info('\nTest 3: Hypothesis Validation - Sum Detection');
    const sumObservations = [
      { input: '3\n1 2 3\n', output: '6' },
      { input: '5\n1 2 3 4 5\n', output: '15' },
      { input: '4\n-1 -2 -3 -4\n', output: '-10' },
      { input: '2\n0 0\n', output: '0' },
    ];

    const hypotheses = getTopHypotheses(sumObservations);

    if (hypotheses.length > 0 && hypotheses[0].name === 'Array Sum' && hypotheses[0].confidence === 1) {
      logger.info('✅ Test 3 PASSED: Correctly identified Array Sum');
      logger.info(`   Top hypothesis: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      passed++;
    } else {
      logger.error(`❌ Test 3 FAILED: Expected "Array Sum" with 100% confidence`);
      if (hypotheses.length > 0) {
        logger.error(`   Got: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      }
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 3 FAILED:', error);
    failed++;
  }

  // ===== Test 4: Hypothesis Validation - Maximum =====
  try {
    logger.info('\nTest 4: Hypothesis Validation - Maximum Detection');
    const maxObservations = [
      { input: '3\n1 2 3\n', output: '3' },
      { input: '5\n5 4 3 2 1\n', output: '5' },
      { input: '4\n-1 -2 -3 -4\n', output: '-1' },
      { input: '3\n7 7 7\n', output: '7' },
    ];

    const hypotheses = getTopHypotheses(maxObservations);

    if (hypotheses.length > 0 && hypotheses[0].name === 'Maximum Element' && hypotheses[0].confidence === 1) {
      logger.info('✅ Test 4 PASSED: Correctly identified Maximum Element');
      logger.info(`   Top hypothesis: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      passed++;
    } else {
      logger.error(`❌ Test 4 FAILED: Expected "Maximum Element" with 100% confidence`);
      if (hypotheses.length > 0) {
        logger.error(`   Got: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      }
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 4 FAILED:', error);
    failed++;
  }

  // ===== Test 5: Hypothesis Validation - Fibonacci =====
  try {
    logger.info('\nTest 5: Hypothesis Validation - Fibonacci Detection');
    const fibObservations = [
      { input: '1\n', output: '1' },
      { input: '2\n', output: '1' },
      { input: '5\n', output: '5' },
      { input: '10\n', output: '55' },
    ];

    const hypotheses = getTopHypotheses(fibObservations);

    if (hypotheses.length > 0 && hypotheses[0].name === 'Nth Fibonacci' && hypotheses[0].confidence === 1) {
      logger.info('✅ Test 5 PASSED: Correctly identified Nth Fibonacci');
      logger.info(`   Top hypothesis: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      passed++;
    } else {
      logger.error(`❌ Test 5 FAILED: Expected "Nth Fibonacci" with 100% confidence`);
      if (hypotheses.length > 0) {
        logger.error(`   Got: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      }
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 5 FAILED:', error);
    failed++;
  }

  // ===== Test 6: Hypothesis Validation - GCD =====
  try {
    logger.info('\nTest 6: Hypothesis Validation - GCD Detection');
    const gcdObservations = [
      { input: '2\n12 18\n', output: '6' },
      { input: '3\n24 36 48\n', output: '12' },
      { input: '2\n17 13\n', output: '1' },
      { input: '3\n100 50 25\n', output: '25' },
    ];

    const hypotheses = getTopHypotheses(gcdObservations);

    if (hypotheses.length > 0 && hypotheses[0].name === 'GCD of All' && hypotheses[0].confidence === 1) {
      logger.info('✅ Test 6 PASSED: Correctly identified GCD');
      logger.info(`   Top hypothesis: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      passed++;
    } else {
      logger.error(`❌ Test 6 FAILED: Expected "GCD of All" with 100% confidence`);
      if (hypotheses.length > 0) {
        logger.error(`   Got: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      }
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 6 FAILED:', error);
    failed++;
  }

  // ===== Test 7: Hypothesis Validation - Kadane (Max Subarray Sum) =====
  try {
    logger.info('\nTest 7: Hypothesis Validation - Kadane\'s Algorithm');
    const kadaneObservations = [
      { input: '6\n-2 1 -3 4 -1 2\n', output: '5' }, // [4, -1, 2]
      { input: '5\n1 2 3 4 5\n', output: '15' }, // All positive
      { input: '3\n-1 -2 -3\n', output: '-1' }, // All negative, take largest
      { input: '4\n-2 -1 2 1\n', output: '3' }, // [2, 1]
    ];

    const hypotheses = getTopHypotheses(kadaneObservations);

    if (hypotheses.length > 0 && hypotheses[0].name === 'Max Subarray Sum (Kadane)' && hypotheses[0].confidence === 1) {
      logger.info('✅ Test 7 PASSED: Correctly identified Kadane\'s Algorithm');
      logger.info(`   Top hypothesis: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      passed++;
    } else {
      logger.error(`❌ Test 7 FAILED: Expected "Max Subarray Sum (Kadane)" with 100% confidence`);
      if (hypotheses.length > 0) {
        logger.error(`   Got: ${hypotheses[0].name} (${(hypotheses[0].confidence * 100).toFixed(0)}%)`);
      }
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 7 FAILED:', error);
    failed++;
  }

  // ===== Test 8: Pattern Detection =====
  try {
    logger.info('\nTest 8: Pattern Detection');
    const observations = [
      { input: '3\n1 2 3\n', output: '6' },
      { input: '5\n10 20 30 40 50\n', output: '150' },
    ];

    const patterns = detectPatterns(observations);

    if (patterns.length > 0 && patterns.some(p => p.type === 'linear_aggregation')) {
      logger.info('✅ Test 8 PASSED: Detected linear aggregation pattern');
      logger.info(`   Patterns: ${patterns.map(p => `${p.type}(${(p.confidence * 100).toFixed(0)}%)`).join(', ')}`);
      passed++;
    } else {
      logger.error('❌ Test 8 FAILED: Expected linear_aggregation pattern');
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 8 FAILED:', error);
    failed++;
  }

  // ===== Test 9: Adaptive Test Suggestion =====
  try {
    logger.info('\nTest 9: Adaptive Test Suggestion');
    const observations = [
      { input: '3\n1 2 3\n', output: '6' },
      { input: '5\n1 2 3 4 5\n', output: '15' },
    ];

    const suggestions = suggestNextTestCategories(observations);

    if (suggestions.length > 0) {
      logger.info('✅ Test 9 PASSED: Generated test category suggestions');
      logger.info(`   Suggestions: ${suggestions.join(', ')}`);
      passed++;
    } else {
      logger.error('❌ Test 9 FAILED: No suggestions generated');
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 9 FAILED:', error);
    failed++;
  }

  // ===== Test 10: Error Classification =====
  try {
    logger.info('\nTest 10: Error Classification');
    
    const errors = [
      { msg: 'LLM timeout after 30s', expected: 'llm_timeout' },
      { msg: 'Rate limit exceeded (429)', expected: 'llm_rate_limit' },
      { msg: 'Docker container timeout', expected: 'docker_timeout' },
      { msg: 'Out of memory (OOM)', expected: 'docker_memory' },
    ];

    let allCorrect = true;
    for (const { msg, expected } of errors) {
      const classified = classifyError(new Error(msg));
      if (classified !== expected) {
        allCorrect = false;
        logger.error(`   "${msg}" classified as "${classified}" (expected "${expected}")`);
      }
    }

    if (allCorrect) {
      logger.info('✅ Test 10 PASSED: Error classification working correctly');
      passed++;
    } else {
      logger.error('❌ Test 10 FAILED: Some errors misclassified');
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 10 FAILED:', error);
    failed++;
  }

  // ===== Test 11: Fallback Result Generation =====
  try {
    logger.info('\nTest 11: Fallback Result Generation');
    const observations = [
      { input: '3\n1 2 3\n', output: '6' },
      { input: '5\n1 2 3 4 5\n', output: '15' },
    ];

    const fallback = generateFallbackResult(observations);

    if (
      fallback.problemStatement.includes('Analysis Result') &&
      fallback.observations.length === observations.length
    ) {
      logger.info('✅ Test 11 PASSED: Fallback result generated correctly');
      passed++;
    } else {
      logger.error('❌ Test 11 FAILED: Fallback result incomplete');
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 11 FAILED:', error);
    failed++;
  }

  // ===== Test 12: Result Quality Analysis =====
  try {
    logger.info('\nTest 12: Result Quality Analysis');
    
    const goodResult = {
      problemStatement: `# Array Sum\n\n## Problem Statement\nGiven array, find sum.\n\n## Input Format\nFirst line: n\nSecond line: n integers\n\n## Output Format\nPrint the sum\n\n## Constraints\n1 ≤ n ≤ 100000`,
      solution: `#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    long long sum = 0;
    for(int i = 0; i < n; i++) {
        int x; cin >> x;
        sum += x;
    }
    cout << sum << endl;
    return 0;
}`,
      algorithm: 'Linear scan with accumulator',
      observations: [
        { input: '3\n1 2 3\n', output: '6' },
        { input: '5\n1 2 3 4 5\n', output: '15' },
        { input: '2\n10 20\n', output: '30' },
      ],
    };

    const quality = analyzeResultQuality(goodResult);

    if (quality.score >= 70) {
      logger.info('✅ Test 12 PASSED: Quality analysis working');
      logger.info(`   Score: ${quality.score}/100`);
      if (quality.issues.length > 0) {
        logger.info(`   Issues: ${quality.issues.join('; ')}`);
      }
      passed++;
    } else {
      logger.error(`❌ Test 12 FAILED: Expected score >= 70, got ${quality.score}`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 12 FAILED:', error);
    failed++;
  }

  // ===== Test 13: Mock Enhanced Inference =====
  try {
    logger.info('\nTest 13: Mock Enhanced Inference');
    
    const observations = [
      { input: '3\n1 2 3\n', output: '6' },
      { input: '5\n1 2 3 4 5\n', output: '15' },
    ];

    const hypotheses = [
      { name: 'Array Sum', confidence: 1, description: 'Sum of all elements' },
    ];

    const inference = generateMockEnhancedInference(observations, hypotheses);

    if (inference.problemTitle === 'Array Sum' && inference.confidence >= 0.9) {
      logger.info('✅ Test 13 PASSED: Enhanced mock inference working');
      logger.info(`   Title: ${inference.problemTitle}`);
      logger.info(`   Confidence: ${inference.confidence}`);
      passed++;
    } else {
      logger.error('❌ Test 13 FAILED: Inference incorrect');
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 13 FAILED:', error);
    failed++;
  }

  // ===== Test 14: Hypothesis Library Coverage =====
  try {
    logger.info('\nTest 14: Hypothesis Library Coverage');
    
    const categories = new Set(hypothesisLibrary.map(h => h.category));
    const totalHypotheses = hypothesisLibrary.length;

    if (totalHypotheses >= 20 && categories.size >= 5) {
      logger.info('✅ Test 14 PASSED: Hypothesis library has sufficient coverage');
      logger.info(`   Total hypotheses: ${totalHypotheses}`);
      logger.info(`   Categories: ${Array.from(categories).join(', ')}`);
      passed++;
    } else {
      logger.error(`❌ Test 14 FAILED: Expected 20+ hypotheses with 5+ categories`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 14 FAILED:', error);
    failed++;
  }

  // ===== Summary =====
  logger.info('\n' + '='.repeat(60));
  logger.info(`Phase 2 Tests Complete: ${passed} passed, ${failed} failed`);
  logger.info('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runPhase2Tests().catch((error) => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});
