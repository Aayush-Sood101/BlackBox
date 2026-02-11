/**
 * Basic test script for backend services
 */
import { logger } from './utils/logger';
import { generateMockTestCases, generateMockInference } from './services/llmService';
import { mockExecution } from './services/dockerService';
import { runAnalysisPipeline } from './services/pipelineService';

async function runTests() {
  logger.info('Starting backend tests...\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Mock Test Case Generation
  try {
    logger.info('Test 1: Mock Test Case Generation');
    const testCases = generateMockTestCases('n integers', 5);
    
    if (testCases.length === 5) {
      logger.info('✅ Test 1 PASSED: Generated 5 mock test cases');
      passed++;
    } else {
      logger.error(`❌ Test 1 FAILED: Expected 5 test cases, got ${testCases.length}`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 1 FAILED:', error);
    failed++;
  }

  // Test 2: Mock Execution
  try {
    logger.info('\nTest 2: Mock Execution (Sum)');
    const result = await mockExecution('5\n1 2 3 4 5');
    
    if (result.output === '15' && result.exitCode === 0) {
      logger.info('✅ Test 2 PASSED: Mock execution returned correct sum (15)');
      passed++;
    } else {
      logger.error(`❌ Test 2 FAILED: Expected "15", got "${result.output}"`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 2 FAILED:', error);
    failed++;
  }

  // Test 3: Mock Inference
  try {
    logger.info('\nTest 3: Mock Inference');
    const observations = [
      { input: '3\n1 2 3', output: '6' },
      { input: '4\n1 1 1 1', output: '4' },
      { input: '2\n10 20', output: '30' },
    ];
    
    const inference = generateMockInference(observations);
    
    if (inference.problemTitle === 'Array Sum' && inference.confidence >= 0.9) {
      logger.info(`✅ Test 3 PASSED: Correctly inferred "${inference.problemTitle}" with confidence ${inference.confidence}`);
      passed++;
    } else {
      logger.error(`❌ Test 3 FAILED: Got "${inference.problemTitle}" with confidence ${inference.confidence}`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 3 FAILED:', error);
    failed++;
  }

  // Test 4: Full Pipeline (Mock Mode)
  try {
    logger.info('\nTest 4: Full Pipeline (Mock Mode)');
    
    const result = await runAnalysisPipeline({
      executablePath: '/mock/test.exe',
      inputFormat: 'First line: integer n\nSecond line: n space-separated integers',
      constraints: '1 ≤ n ≤ 100000',
      useMock: true,
    });
    
    if (result.success && result.inference?.problemTitle) {
      logger.info(`✅ Test 4 PASSED: Pipeline completed successfully`);
      logger.info(`   Problem: ${result.inference.problemTitle}`);
      logger.info(`   Confidence: ${result.inference.confidence}`);
      logger.info(`   Test cases: ${result.executionStats?.totalTests}`);
      logger.info(`   Successful: ${result.executionStats?.successfulTests}`);
      passed++;
    } else {
      logger.error(`❌ Test 4 FAILED: ${result.error}`);
      failed++;
    }
  } catch (error) {
    logger.error('❌ Test 4 FAILED:', error);
    failed++;
  }

  // Summary
  logger.info('\n' + '='.repeat(50));
  logger.info(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  logger.info('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  logger.error('Test runner error:', error);
  process.exit(1);
});
