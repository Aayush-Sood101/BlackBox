import Docker from 'dockerode';
import { config } from '../config';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const docker = new Docker();

export interface ExecutionResult {
  output: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionTime: number;
  error?: string;
}

export interface ExecutionOptions {
  timeout?: number;
  memoryLimit?: number;
}

/**
 * Check if Docker is available and running
 */
export async function checkDockerHealth(): Promise<{
  healthy: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const version = await docker.version();
    return {
      healthy: true,
      version: version.Version,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Docker not available',
    };
  }
}

/**
 * Check if sandbox image exists, build if not
 */
export async function ensureSandboxImage(): Promise<boolean> {
  try {
    const images = await docker.listImages({
      filters: { reference: [config.docker.sandboxImage] },
    });
    
    if (images.length === 0) {
      logger.warn(`Sandbox image ${config.docker.sandboxImage} not found. Please build it first.`);
      return false;
    }
    
    logger.info(`Sandbox image ${config.docker.sandboxImage} is available`);
    return true;
  } catch (error) {
    logger.error('Failed to check sandbox image:', error);
    return false;
  }
}

/**
 * Parse Docker multiplexed logs into stdout and stderr
 */
function parseDockerLogs(logs: Buffer): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';
  let offset = 0;

  while (offset < logs.length - 8) {
    const streamType = logs[offset];
    const size = logs.readUInt32BE(offset + 4);

    if (offset + 8 + size > logs.length) break;

    const chunk = logs.slice(offset + 8, offset + 8 + size).toString('utf8');
    
    if (streamType === 1) {
      stdout += chunk;
    } else if (streamType === 2) {
      stderr += chunk;
    }

    offset += 8 + size;
  }

  // Fallback for non-multiplexed logs
  if (!stdout && !stderr) {
    stdout = logs.toString('utf8');
  }

  return { stdout, stderr };
}

/**
 * Execute program in Docker sandbox
 */
export async function executeInSandbox(
  executablePath: string,
  input: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const timeout = options.timeout || config.docker.timeout;
  const memoryLimit = options.memoryLimit || config.docker.memoryLimit;
  
  const containerName = `sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  let container: Docker.Container | null = null;
  
  const startTime = Date.now();
  let timedOut = false;

  try {
    // Write input to file
    const jobDir = path.dirname(executablePath);
    const inputPath = path.join(jobDir, 'input.txt');
    await fs.writeFile(inputPath, input);
    
    logger.debug(`Creating container ${containerName}`);

    // Create container with security constraints
    container = await docker.createContainer({
      Image: config.docker.sandboxImage,
      name: containerName,
      Cmd: [
        '/bin/sh', '-c',
        `cd /sandbox && timeout ${Math.ceil(timeout / 1000)}s wine program.exe < input.txt 2>&1 || echo "[EXIT:$?]"`
      ],
      WorkingDir: '/sandbox',
      Env: [
        'WINEDEBUG=-all',
        'DISPLAY=',
      ],
      HostConfig: {
        // Memory limit
        Memory: memoryLimit,
        MemorySwap: memoryLimit,
        
        // Network isolation
        NetworkMode: 'none',
        
        // Mount the job directory
        Binds: [`${jobDir}:/sandbox:rw`],
        
        // Security options
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        
        // Resource limits
        PidsLimit: 50,
        
        // Auto remove disabled - we'll clean up manually
        AutoRemove: false,
      },
      StopTimeout: 1,
    });

    // Start container
    await container.start();
    logger.debug(`Container ${containerName} started`);

    // Wait for completion with timeout
    const waitPromise = container.wait();
    const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve({ StatusCode: -1 });
      }, timeout + 2000);
    });

    const result = await Promise.race([waitPromise, timeoutPromise]);

    // Get logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
    });

    const { stdout, stderr } = parseDockerLogs(logs as Buffer);
    
    const executionTime = Date.now() - startTime;

    logger.debug(`Container ${containerName} finished`, {
      exitCode: result.StatusCode,
      timedOut,
      executionTime,
    });

    return {
      output: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result.StatusCode,
      timedOut,
      executionTime,
    };

  } catch (error) {
    logger.error(`Docker execution error for ${containerName}:`, error);
    
    return {
      output: '',
      stderr: '',
      exitCode: -1,
      timedOut: false,
      executionTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown execution error',
    };
  } finally {
    // Cleanup container
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true, v: true });
        logger.debug(`Container ${containerName} cleaned up`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup container ${containerName}:`, cleanupError);
      }
    }
  }
}

/**
 * Mock execution for testing without Docker
 */
export async function mockExecution(
  input: string
): Promise<ExecutionResult> {
  // Simple mock that simulates array sum (for testing)
  const lines = input.trim().split('\n');
  
  try {
    if (lines.length >= 2) {
      const n = parseInt(lines[0]);
      const numbers = lines[1].split(' ').map(x => parseInt(x));
      const sum = numbers.reduce((a, b) => a + b, 0);
      
      return {
        output: sum.toString(),
        stderr: '',
        exitCode: 0,
        timedOut: false,
        executionTime: 10,
      };
    }
    
    // Single number input (like Fibonacci)
    const n = parseInt(lines[0]);
    const fib = (n: number): number => {
      if (n <= 2) return 1;
      let a = 1, b = 1;
      for (let i = 3; i <= n; i++) {
        const c = a + b;
        a = b;
        b = c;
      }
      return b;
    };
    
    return {
      output: fib(n).toString(),
      stderr: '',
      exitCode: 0,
      timedOut: false,
      executionTime: 10,
    };
  } catch {
    return {
      output: '',
      stderr: 'Parse error',
      exitCode: 1,
      timedOut: false,
      executionTime: 10,
      error: 'Failed to parse input',
    };
  }
}
