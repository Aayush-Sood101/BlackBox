# PHASE 3: Production Hardening, Security & Evaluation

## Overview

**Duration**: Week 5-8  
**Objective**: Implement comprehensive security measures, optimize performance, deploy to production, conduct extensive evaluation on 100+ competitive programming problems, and refine the system based on real-world usage.

**Prerequisites**: Phase 1 and Phase 2 completed with full pipeline working.

---

## Table of Contents

1. [Security Hardening](#1-security-hardening)
2. [Resource Management & Limits](#2-resource-management--limits)
3. [Performance Optimization](#3-performance-optimization)
4. [Monitoring & Logging](#4-monitoring--logging)
5. [Deployment Configuration](#5-deployment-configuration)
6. [Evaluation Framework](#6-evaluation-framework)
7. [Problem Dataset & Testing](#7-problem-dataset--testing)
8. [Prompt Refinement](#8-prompt-refinement)
9. [Production Checklist](#9-production-checklist)

---

## 1. Security Hardening

### 1.1 Docker Security Configuration

#### Enhanced Dockerfile (`docker/Dockerfile.sandbox`)

```dockerfile
# Use minimal base image
FROM alpine:3.19 AS base

# Install minimal dependencies
RUN apk add --no-cache \
    wine=8.21-r0 \
    xvfb \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Create unprivileged user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox -h /home/sandbox -s /sbin/nologin

# Set up sandbox directory
WORKDIR /sandbox
RUN mkdir -p /sandbox && chown -R sandbox:sandbox /sandbox

# Security hardening
RUN chmod 755 /sandbox \
    && chmod 700 /home/sandbox

# Remove unnecessary binaries
RUN rm -rf /usr/bin/wget /usr/bin/curl /usr/bin/nc /usr/bin/telnet 2>/dev/null || true

# Switch to non-root user
USER sandbox

# Read-only filesystem (override specific paths as needed)
ENV HOME=/home/sandbox
ENV WINEARCH=win32
ENV WINEPREFIX=/home/sandbox/.wine

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD test -d /sandbox || exit 1

# Default entrypoint
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo 'Ready'"]
```

#### Docker Compose Production Configuration (`docker/docker-compose.prod.yml`)

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - uploads:/app/uploads
      - logs:/app/logs
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:size=100M,mode=1777
    networks:
      - internal
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
    security_opt:
      - no-new-privileges:true
    read_only: true
    networks:
      - internal
      - external

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - external
      - internal

volumes:
  uploads:
  logs:

networks:
  internal:
    driver: bridge
    internal: true
  external:
    driver: bridge
```

### 1.2 Seccomp Profile

Create `docker/seccomp-production.json`:

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "archMap": [
    {
      "architecture": "SCMP_ARCH_X86_64",
      "subArchitectures": [
        "SCMP_ARCH_X86",
        "SCMP_ARCH_X32"
      ]
    }
  ],
  "syscalls": [
    {
      "names": [
        "read",
        "write",
        "close",
        "fstat",
        "lseek",
        "mmap",
        "mprotect",
        "munmap",
        "brk",
        "rt_sigaction",
        "rt_sigprocmask",
        "ioctl",
        "access",
        "pipe",
        "select",
        "sched_yield",
        "mremap",
        "msync",
        "mincore",
        "madvise",
        "dup",
        "dup2",
        "nanosleep",
        "getpid",
        "exit",
        "exit_group",
        "uname",
        "fcntl",
        "flock",
        "fsync",
        "fdatasync",
        "ftruncate",
        "getcwd",
        "readlink",
        "stat",
        "lstat",
        "poll",
        "getdents",
        "getdents64",
        "gettid",
        "futex",
        "set_robust_list",
        "get_robust_list",
        "clock_gettime",
        "clock_nanosleep",
        "arch_prctl",
        "set_tid_address",
        "openat",
        "newfstatat",
        "pread64",
        "pwrite64",
        "readv",
        "writev",
        "preadv",
        "pwritev",
        "getrandom"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": [
        "clone",
        "fork",
        "vfork",
        "execve"
      ],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    },
    {
      "names": [
        "socket",
        "connect",
        "accept",
        "sendto",
        "recvfrom",
        "bind",
        "listen"
      ],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    },
    {
      "names": [
        "ptrace",
        "mount",
        "umount2",
        "pivot_root",
        "chroot",
        "setuid",
        "setgid",
        "setreuid",
        "setregid",
        "setresuid",
        "setresgid",
        "personality"
      ],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    }
  ]
}
```

### 1.3 Security Service

Create `src/services/securityService.ts`:

```typescript
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Security configuration and utilities
 */
export const securityConfig = {
  maxFileSize: 10 * 1024 * 1024,      // 10 MB
  maxInputSize: 1 * 1024 * 1024,       // 1 MB
  allowedExtensions: ['.exe'],
  containerTimeout: 5000,              // 5 seconds
  containerMemory: 256 * 1024 * 1024,  // 256 MB
  maxConcurrentExecutions: 10,
  rateLimitWindow: 60000,              // 1 minute
  rateLimitMax: 10,                    // 10 requests per minute per IP
};

/**
 * Rate limiting store
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit for an IP
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + securityConfig.rateLimitWindow,
    });
    return true;
  }

  if (entry.count >= securityConfig.rateLimitMax) {
    logger.warn(`Rate limit exceeded for IP: ${ip}`);
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Validate uploaded file
 */
export function validateFile(file: {
  size: number;
  originalname: string;
  buffer?: Buffer;
}): { valid: boolean; error?: string } {
  // Check size
  if (file.size > securityConfig.maxFileSize) {
    return { valid: false, error: 'File size exceeds limit' };
  }

  // Check extension
  const ext = file.originalname.toLowerCase().slice(-4);
  if (!securityConfig.allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Invalid file extension' };
  }

  // Check for PE header (basic .exe validation)
  if (file.buffer) {
    if (file.buffer[0] !== 0x4D || file.buffer[1] !== 0x5A) { // MZ header
      return { valid: false, error: 'Invalid executable file format' };
    }
  }

  return { valid: true };
}

/**
 * Sanitize input for execution
 */
export function sanitizeExecutionInput(input: string): {
  sanitized: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let sanitized = input;

  // Remove null bytes
  if (sanitized.includes('\0')) {
    sanitized = sanitized.replace(/\0/g, '');
    warnings.push('Removed null bytes from input');
  }

  // Check for shell metacharacters
  const shellChars = /[`${}|;&<>()\\]/g;
  if (shellChars.test(sanitized)) {
    // For competitive programming input, these are suspicious
    const matches = sanitized.match(shellChars);
    warnings.push(`Suspicious characters detected: ${matches?.join('')}`);
    // Allow but log - some problems might legitimately use special chars
  }

  // Limit input size
  if (sanitized.length > securityConfig.maxInputSize) {
    sanitized = sanitized.slice(0, securityConfig.maxInputSize);
    warnings.push('Input truncated to size limit');
  }

  // Normalize line endings
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return { sanitized, warnings };
}

/**
 * Generate secure random job ID
 */
export function generateSecureJobId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash sensitive data for logging
 */
export function hashForLogging(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
}

/**
 * Concurrent execution limiter
 */
let activeExecutions = 0;

export async function withExecutionLimit<T>(
  operation: () => Promise<T>
): Promise<T> {
  if (activeExecutions >= securityConfig.maxConcurrentExecutions) {
    throw new Error('Too many concurrent executions. Please try again later.');
  }

  activeExecutions++;
  try {
    return await operation();
  } finally {
    activeExecutions--;
  }
}

/**
 * Clean up rate limit store periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000);
```

### 1.4 Rate Limiting Middleware

Create `src/middleware/rateLimit.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../services/securityService';

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: 60,
    });
  }

  next();
}
```

### 1.5 Input Validation Middleware

Create `src/middleware/securityValidation.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { validateFile, sanitizeExecutionInput } from '../services/securityService';
import { logger } from '../utils/logger';

export function validateUpload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const validation = validateFile({
    size: req.file.size,
    originalname: req.file.originalname,
    buffer: req.file.buffer,
  });

  if (!validation.valid) {
    logger.warn(`File validation failed: ${validation.error}`);
    return res.status(400).json({ error: validation.error });
  }

  next();
}

export function sanitizeInputs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.body.inputFormat) {
    const { sanitized, warnings } = sanitizeExecutionInput(req.body.inputFormat);
    req.body.inputFormat = sanitized;
    
    if (warnings.length > 0) {
      logger.warn(`Input sanitization warnings: ${warnings.join(', ')}`);
    }
  }

  if (req.body.constraints) {
    const { sanitized } = sanitizeExecutionInput(req.body.constraints);
    req.body.constraints = sanitized;
  }

  next();
}
```

---

## 2. Resource Management & Limits

### 2.1 Enhanced Docker Service

Update `src/services/dockerService.ts`:

```typescript
import Docker from 'dockerode';
import { logger } from '../utils/logger';
import { securityConfig, withExecutionLimit } from './securityService';
import path from 'path';
import fs from 'fs/promises';

const docker = new Docker();

interface ExecutionResult {
  output: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  memoryExceeded: boolean;
  executionTime: number;
  error?: string;
}

interface ExecutionOptions {
  timeout?: number;
  memoryLimit?: number;
  cpuShares?: number;
}

/**
 * Execute program in hardened sandbox with full resource controls
 */
export async function executeInHardenedSandbox(
  executablePath: string,
  input: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  return withExecutionLimit(async () => {
    const timeout = options.timeout || securityConfig.containerTimeout;
    const memoryLimit = options.memoryLimit || securityConfig.containerMemory;
    const cpuShares = options.cpuShares || 512; // Default to half of default (1024)

    const containerName = `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let container: Docker.Container | null = null;

    const startTime = Date.now();
    let timedOut = false;
    let memoryExceeded = false;

    try {
      // Prepare input file
      const jobDir = path.dirname(executablePath);
      const inputPath = path.join(jobDir, 'input.txt');
      await fs.writeFile(inputPath, input);

      // Create container with full security configuration
      container = await docker.createContainer({
        Image: process.env.SANDBOX_IMAGE || 'sandbox:latest',
        name: containerName,
        Cmd: [
          `cd /sandbox && timeout ${Math.ceil(timeout / 1000)}s wine program.exe < input.txt 2>&1 || echo "[EXIT:$?]"`,
        ],
        User: 'sandbox',
        WorkingDir: '/sandbox',
        Env: [
          'WINEDEBUG=-all',
          'DISPLAY=',
        ],
        HostConfig: {
          // Memory limits
          Memory: memoryLimit,
          MemorySwap: memoryLimit, // No swap
          MemoryReservation: Math.floor(memoryLimit * 0.8),
          
          // CPU limits
          CpuShares: cpuShares,
          CpuQuota: 50000,  // 50% of one CPU
          CpuPeriod: 100000,
          
          // Security
          NetworkMode: 'none',
          ReadonlyRootfs: false, // Wine needs some write access
          SecurityOpt: [
            'no-new-privileges:true',
            `seccomp=${path.resolve('docker/seccomp-production.json')}`,
          ],
          CapDrop: ['ALL'],
          
          // Storage
          Binds: [`${jobDir}:/sandbox:ro`],
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=50m',
            '/home/sandbox/.wine': 'rw,noexec,nosuid,size=100m',
          },
          
          // Process limits
          PidsLimit: 50,
          Ulimits: [
            { Name: 'nofile', Soft: 64, Hard: 64 },
            { Name: 'nproc', Soft: 10, Hard: 10 },
            { Name: 'fsize', Soft: 10 * 1024 * 1024, Hard: 10 * 1024 * 1024 },
          ],
          
          // Cleanup
          AutoRemove: false, // We'll remove manually after getting logs
        },
        StopTimeout: 1,
      });

      // Start container
      await container.start();

      // Wait with timeout
      const waitPromise = container.wait();
      const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve({ StatusCode: -1 });
        }, timeout + 2000);
      });

      const result = await Promise.race([waitPromise, timeoutPromise]);

      // Check for OOM
      const inspection = await container.inspect();
      if (inspection.State.OOMKilled) {
        memoryExceeded = true;
      }

      // Get logs
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
      });

      const { stdout, stderr } = parseDockerLogs(logs);
      
      const executionTime = Date.now() - startTime;

      return {
        output: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: result.StatusCode,
        timedOut,
        memoryExceeded,
        executionTime,
      };

    } catch (error) {
      logger.error('Docker execution error:', error);
      return {
        output: '',
        stderr: '',
        exitCode: -1,
        timedOut: false,
        memoryExceeded: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Cleanup container
      if (container) {
        try {
          await container.stop({ t: 0 }).catch(() => {});
          await container.remove({ force: true, v: true });
        } catch (cleanupError) {
          logger.warn('Container cleanup error:', cleanupError);
        }
      }
    }
  });
}

/**
 * Parse Docker multiplexed logs
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

  // Fallback for non-multiplexed
  if (!stdout && !stderr) {
    stdout = logs.toString('utf8');
  }

  return { stdout, stderr };
}

/**
 * Check Docker daemon health
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
 * Clean up orphaned containers
 */
export async function cleanupOrphanedContainers(): Promise<number> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        name: ['sandbox-'],
        status: ['exited', 'dead', 'created'],
      },
    });

    let cleaned = 0;
    for (const containerInfo of containers) {
      try {
        const container = docker.getContainer(containerInfo.Id);
        await container.remove({ force: true, v: true });
        cleaned++;
      } catch (err) {
        logger.warn(`Failed to remove container ${containerInfo.Id}:`, err);
      }
    }

    return cleaned;
  } catch (error) {
    logger.error('Orphan cleanup error:', error);
    return 0;
  }
}

// Run cleanup every 5 minutes
setInterval(async () => {
  const cleaned = await cleanupOrphanedContainers();
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} orphaned containers`);
  }
}, 5 * 60 * 1000);
```

### 2.2 Resource Monitoring

Create `src/services/resourceMonitor.ts`:

```typescript
import os from 'os';
import { logger } from '../utils/logger';

interface SystemResources {
  cpuUsage: number;
  memoryUsage: number;
  memoryFree: number;
  memoryTotal: number;
  loadAverage: number[];
}

/**
 * Get current system resource usage
 */
export function getSystemResources(): SystemResources {
  const cpus = os.cpus();
  const totalCpu = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total);
  }, 0);

  const memoryFree = os.freemem();
  const memoryTotal = os.totalmem();

  return {
    cpuUsage: (totalCpu / cpus.length) * 100,
    memoryUsage: ((memoryTotal - memoryFree) / memoryTotal) * 100,
    memoryFree,
    memoryTotal,
    loadAverage: os.loadavg(),
  };
}

/**
 * Check if system has enough resources for execution
 */
export function canAcceptNewExecution(): {
  allowed: boolean;
  reason?: string;
} {
  const resources = getSystemResources();

  // Check CPU
  if (resources.cpuUsage > 90) {
    return { allowed: false, reason: 'CPU usage too high' };
  }

  // Check memory
  if (resources.memoryUsage > 90) {
    return { allowed: false, reason: 'Memory usage too high' };
  }

  // Check load average (1 minute)
  const cpuCount = os.cpus().length;
  if (resources.loadAverage[0] > cpuCount * 2) {
    return { allowed: false, reason: 'System load too high' };
  }

  return { allowed: true };
}

/**
 * Resource usage tracking for analytics
 */
interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  timeoutExecutions: number;
  memoryExceededExecutions: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
}

const stats: ExecutionStats = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  timeoutExecutions: 0,
  memoryExceededExecutions: 0,
  averageExecutionTime: 0,
  totalExecutionTime: 0,
};

export function recordExecution(result: {
  success: boolean;
  timedOut: boolean;
  memoryExceeded: boolean;
  executionTime: number;
}): void {
  stats.totalExecutions++;
  stats.totalExecutionTime += result.executionTime;
  stats.averageExecutionTime = stats.totalExecutionTime / stats.totalExecutions;

  if (result.success) {
    stats.successfulExecutions++;
  } else {
    stats.failedExecutions++;
  }

  if (result.timedOut) {
    stats.timeoutExecutions++;
  }

  if (result.memoryExceeded) {
    stats.memoryExceededExecutions++;
  }
}

export function getExecutionStats(): ExecutionStats {
  return { ...stats };
}

// Log resource usage periodically
setInterval(() => {
  const resources = getSystemResources();
  logger.debug('System resources:', {
    cpu: `${resources.cpuUsage.toFixed(1)}%`,
    memory: `${resources.memoryUsage.toFixed(1)}%`,
    load: resources.loadAverage.map(l => l.toFixed(2)).join(', '),
  });
}, 60000);
```

---

## 3. Performance Optimization

### 3.1 Caching Service

Create `src/services/cacheService.ts`:

```typescript
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  private generateKey(...parts: string[]): string {
    return crypto.createHash('md5').update(parts.join('|')).digest('hex');
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hits++;
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      hits: 0,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  stats(): { size: number; totalHits: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }
    return { size: this.cache.size, totalHits };
  }
}

// Cache instances for different purposes
export const testCaseCache = new LRUCache<any[]>(100, 3600000); // 1 hour TTL
export const hypothesisCache = new LRUCache<any[]>(100, 1800000); // 30 min TTL
export const resultCache = new LRUCache<any>(500, 7200000); // 2 hour TTL

/**
 * Generate cache key for test cases
 */
export function getTestCaseCacheKey(inputFormat: string, constraints: string): string {
  return crypto.createHash('md5')
    .update(`tc:${inputFormat}:${constraints}`)
    .digest('hex');
}

/**
 * Generate cache key for observations (content-based)
 */
export function getObservationsCacheKey(
  observations: { input: string; output: string }[]
): string {
  const content = observations
    .map(o => `${o.input}:${o.output}`)
    .sort()
    .join('|');
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Cache wrapper for async operations
 */
export async function withCache<T>(
  cache: LRUCache<T>,
  key: string,
  operation: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get(key);
  if (cached !== undefined) {
    logger.debug(`Cache hit for key: ${key.slice(0, 8)}...`);
    return cached;
  }

  // Execute operation
  const result = await operation();
  
  // Store in cache
  cache.set(key, result, ttl);
  logger.debug(`Cache miss, stored key: ${key.slice(0, 8)}...`);
  
  return result;
}
```

### 3.2 Parallel Execution

Create `src/services/parallelExecutor.ts`:

```typescript
import { executeInHardenedSandbox } from './dockerService';
import { logger } from '../utils/logger';

interface TestCase {
  input: string;
  rationale: string;
  category?: string;
  priority?: number;
}

interface Observation {
  input: string;
  output: string;
  executionTime: number;
  success: boolean;
}

/**
 * Execute test cases with controlled parallelism
 */
export async function executeTestCasesParallel(
  executablePath: string,
  testCases: TestCase[],
  options: {
    maxConcurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<Observation[]> {
  const { maxConcurrency = 3, onProgress } = options;
  const observations: Observation[] = [];
  let completed = 0;

  // Process in batches
  for (let i = 0; i < testCases.length; i += maxConcurrency) {
    const batch = testCases.slice(i, i + maxConcurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (tc) => {
        try {
          const result = await executeInHardenedSandbox(
            executablePath,
            tc.input
          );

          return {
            input: tc.input,
            output: result.timedOut ? '[TIMEOUT]' : 
                    result.memoryExceeded ? '[MEMORY_EXCEEDED]' :
                    result.error ? '[ERROR]' : result.output,
            executionTime: result.executionTime,
            success: !result.timedOut && !result.memoryExceeded && !result.error,
          };
        } catch (error) {
          logger.warn(`Test case execution error:`, error);
          return {
            input: tc.input,
            output: '[EXECUTION_ERROR]',
            executionTime: 0,
            success: false,
          };
        }
      })
    );

    observations.push(...batchResults);
    completed += batch.length;
    
    if (onProgress) {
      onProgress(completed, testCases.length);
    }

    // Small delay between batches to prevent resource contention
    if (i + maxConcurrency < testCases.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return observations;
}

/**
 * Smart batch size calculation based on system resources
 */
export function calculateOptimalBatchSize(): number {
  const cpuCount = require('os').cpus().length;
  // Use half the CPU count, minimum 2, maximum 5
  return Math.max(2, Math.min(5, Math.floor(cpuCount / 2)));
}
```

### 3.3 LLM Request Optimization

Create `src/services/llmOptimizer.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface LLMRequest {
  prompt: string;
  priority: 'high' | 'normal' | 'low';
  timeout?: number;
  retries?: number;
}

interface LLMResponse {
  text: string;
  tokensUsed: number;
  latency: number;
}

// Request queue for rate limiting
const requestQueue: {
  request: LLMRequest;
  resolve: (response: LLMResponse) => void;
  reject: (error: Error) => void;
}[] = [];

let isProcessing = false;
const MIN_REQUEST_INTERVAL = 500; // ms between requests
let lastRequestTime = 0;

/**
 * Optimized LLM request with queuing and retry
 */
export async function optimizedLLMRequest(
  request: LLMRequest
): Promise<LLMResponse> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ request, resolve, reject });
    
    // Sort by priority
    requestQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.request.priority] - priorityOrder[b.request.priority];
    });

    processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  const item = requestQueue.shift()!;
  
  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }

    const startTime = Date.now();
    const response = await executeWithRetry(item.request);
    const latency = Date.now() - startTime;
    
    lastRequestTime = Date.now();
    
    item.resolve({
      text: response.text,
      tokensUsed: response.tokensUsed,
      latency,
    });
  } catch (error) {
    item.reject(error as Error);
  } finally {
    isProcessing = false;
    
    // Process next in queue
    if (requestQueue.length > 0) {
      setTimeout(processQueue, MIN_REQUEST_INTERVAL);
    }
  }
}

async function executeWithRetry(
  request: LLMRequest
): Promise<{ text: string; tokensUsed: number }> {
  const maxRetries = request.retries || 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      });

      const result = await model.generateContent(request.prompt);
      const response = result.response;
      
      return {
        text: response.text(),
        tokensUsed: response.usageMetadata?.totalTokenCount || 0,
      };
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      const errorMessage = lastError.message.toLowerCase();
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        // Exponential backoff for rate limits
        const backoff = Math.pow(2, attempt) * 1000;
        logger.warn(`Rate limited, waiting ${backoff}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else if (errorMessage.includes('timeout')) {
        // Shorter backoff for timeouts
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Non-retryable error
        throw lastError;
      }
    }
  }

  throw lastError || new Error('LLM request failed after retries');
}

/**
 * Estimate token count for a prompt (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Optimize prompt to reduce token usage
 */
export function optimizePrompt(prompt: string): string {
  return prompt
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    // Trim
    .trim();
}
```

---

## 4. Monitoring & Logging

### 4.1 Structured Logging

Update `src/utils/logger.ts`:

```typescript
import winston from 'winston';
import path from 'path';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Human-readable format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, jobId, ...meta }) => {
    const jobPrefix = jobId ? `[${jobId.slice(0, 8)}] ` : '';
    const metaStr = Object.keys(meta).length > 0 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    return `${timestamp} ${level}: ${jobPrefix}${message}${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: { service: 'exe-runner' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' 
        ? structuredFormat 
        : consoleFormat,
    }),
    
    // File outputs
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'audit.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
    }),
  ],
});

// Create child logger with job context
export function createJobLogger(jobId: string) {
  return logger.child({ jobId });
}

// Audit logging for security events
export function auditLog(event: string, details: any) {
  logger.info(`AUDIT: ${event}`, {
    audit: true,
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// Performance logging
export function perfLog(operation: string, durationMs: number, details?: any) {
  logger.debug(`PERF: ${operation}`, {
    performance: true,
    operation,
    durationMs,
    ...details,
  });
}
```

### 4.2 Metrics Collection

Create `src/services/metricsService.ts`:

```typescript
import { logger } from '../utils/logger';

interface Metrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    byEndpoint: Map<string, number>;
  };
  executions: {
    total: number;
    successful: number;
    timedOut: number;
    memoryExceeded: number;
    averageTimeMs: number;
  };
  llm: {
    totalCalls: number;
    totalTokens: number;
    averageLatencyMs: number;
    errors: number;
  };
  inference: {
    total: number;
    successful: number;
    byAlgorithm: Map<string, number>;
    averageConfidence: number;
  };
  system: {
    startTime: Date;
    lastRequestTime: Date | null;
  };
}

const metrics: Metrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    byEndpoint: new Map(),
  },
  executions: {
    total: 0,
    successful: 0,
    timedOut: 0,
    memoryExceeded: 0,
    averageTimeMs: 0,
  },
  llm: {
    totalCalls: 0,
    totalTokens: 0,
    averageLatencyMs: 0,
    errors: 0,
  },
  inference: {
    total: 0,
    successful: 0,
    byAlgorithm: new Map(),
    averageConfidence: 0,
  },
  system: {
    startTime: new Date(),
    lastRequestTime: null,
  },
};

// Track request
export function trackRequest(endpoint: string, success: boolean) {
  metrics.requests.total++;
  if (success) {
    metrics.requests.successful++;
  } else {
    metrics.requests.failed++;
  }
  
  const count = metrics.requests.byEndpoint.get(endpoint) || 0;
  metrics.requests.byEndpoint.set(endpoint, count + 1);
  
  metrics.system.lastRequestTime = new Date();
}

// Track execution
export function trackExecution(result: {
  success: boolean;
  timedOut: boolean;
  memoryExceeded: boolean;
  timeMs: number;
}) {
  metrics.executions.total++;
  
  if (result.success) metrics.executions.successful++;
  if (result.timedOut) metrics.executions.timedOut++;
  if (result.memoryExceeded) metrics.executions.memoryExceeded++;
  
  // Update average
  const prevTotal = metrics.executions.total - 1;
  metrics.executions.averageTimeMs = 
    (metrics.executions.averageTimeMs * prevTotal + result.timeMs) / metrics.executions.total;
}

// Track LLM call
export function trackLLMCall(tokens: number, latencyMs: number, error: boolean) {
  metrics.llm.totalCalls++;
  metrics.llm.totalTokens += tokens;
  
  if (error) {
    metrics.llm.errors++;
  }
  
  const prevCalls = metrics.llm.totalCalls - 1;
  metrics.llm.averageLatencyMs = 
    (metrics.llm.averageLatencyMs * prevCalls + latencyMs) / metrics.llm.totalCalls;
}

// Track inference result
export function trackInference(algorithm: string, confidence: number, success: boolean) {
  metrics.inference.total++;
  
  if (success) metrics.inference.successful++;
  
  const count = metrics.inference.byAlgorithm.get(algorithm) || 0;
  metrics.inference.byAlgorithm.set(algorithm, count + 1);
  
  const prevTotal = metrics.inference.total - 1;
  metrics.inference.averageConfidence = 
    (metrics.inference.averageConfidence * prevTotal + confidence) / metrics.inference.total;
}

// Get current metrics
export function getMetrics(): any {
  const uptime = Date.now() - metrics.system.startTime.getTime();
  
  return {
    requests: {
      ...metrics.requests,
      byEndpoint: Object.fromEntries(metrics.requests.byEndpoint),
    },
    executions: { ...metrics.executions },
    llm: { ...metrics.llm },
    inference: {
      ...metrics.inference,
      byAlgorithm: Object.fromEntries(metrics.inference.byAlgorithm),
    },
    system: {
      uptimeMs: uptime,
      uptimeHours: uptime / 3600000,
      startTime: metrics.system.startTime.toISOString(),
      lastRequestTime: metrics.system.lastRequestTime?.toISOString(),
    },
  };
}

// Log metrics periodically
setInterval(() => {
  const m = getMetrics();
  logger.info('Metrics snapshot', {
    metrics: {
      requests: m.requests.total,
      successRate: m.requests.total > 0 
        ? ((m.requests.successful / m.requests.total) * 100).toFixed(1) + '%'
        : 'N/A',
      executions: m.executions.total,
      avgExecTime: m.executions.averageTimeMs.toFixed(0) + 'ms',
      llmCalls: m.llm.totalCalls,
      llmTokens: m.llm.totalTokens,
    },
  });
}, 300000); // Every 5 minutes
```

### 4.3 Health Check Endpoint

Update routes to include health check:

```typescript
// src/routes/api.ts
router.get('/health', async (req, res) => {
  const dockerHealth = await checkDockerHealth();
  const systemResources = getSystemResources();
  const canAccept = canAcceptNewExecution();
  
  const status = {
    status: dockerHealth.healthy && canAccept.allowed ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      docker: dockerHealth.healthy ? 'ok' : 'fail',
      resources: canAccept.allowed ? 'ok' : 'warn',
      llm: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
    },
    system: {
      cpu: `${systemResources.cpuUsage.toFixed(1)}%`,
      memory: `${systemResources.memoryUsage.toFixed(1)}%`,
      load: systemResources.loadAverage[0].toFixed(2),
    },
  };

  const httpStatus = status.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(status);
});

router.get('/metrics', (req, res) => {
  // Only allow in development or with auth
  if (process.env.NODE_ENV === 'production' && !req.headers['x-metrics-key']) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json(getMetrics());
});
```

---

## 5. Deployment Configuration

### 5.1 Production Dockerfile for Backend

Create `backend/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install required packages
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Create directories
RUN mkdir -p logs uploads && chown -R appuser:appgroup logs uploads

# Switch to non-root user
USER appuser

# Environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

### 5.2 Production Dockerfile for Frontend

Create `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
```

### 5.3 Nginx Configuration

Create `docker/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/m;

    # Upstream servers
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name _;

        # Redirect to HTTPS in production
        # return 301 https://$host$request_uri;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # API
        location /api {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeout for long-running analysis
            proxy_read_timeout 120s;
            proxy_connect_timeout 10s;
        }

        # File upload endpoint
        location /api/analyze {
            limit_req zone=upload burst=5 nodelay;
            
            client_max_body_size 10M;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_read_timeout 120s;
        }

        # WebSocket
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 3600s;
        }

        # Health check
        location /health {
            proxy_pass http://backend/api/health;
            access_log off;
        }
    }
}
```

### 5.4 Environment Configuration

Create `deploy/.env.production`:

```env
# Server
NODE_ENV=production
PORT=3001

# Security
ALLOWED_ORIGINS=https://yourdomain.com

# Gemini API
GEMINI_API_KEY=your_production_api_key
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# Docker
SANDBOX_IMAGE=sandbox:latest
DOCKER_TIMEOUT=5000
DOCKER_MEMORY_LIMIT=268435456

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10

# Logging
LOG_LEVEL=info

# Monitoring
METRICS_KEY=your_secure_metrics_key
```

---

## 6. Evaluation Framework

### 6.1 Evaluation Service

Create `src/services/evaluationService.ts`:

```typescript
import { logger } from '../utils/logger';
import { runAnalysisPipeline } from './pipelineService';
import fs from 'fs/promises';
import path from 'path';

interface TestProblem {
  name: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  inputFormat: string;
  constraints: string;
  expectedAlgorithm: string;
  sampleIO: { input: string; output: string }[];
  executablePath: string;
}

interface EvaluationResult {
  problem: string;
  category: string;
  difficulty: string;
  success: boolean;
  inferredAlgorithm: string;
  expectedAlgorithm: string;
  confidence: number;
  executionTimeMs: number;
  testCasesGenerated: number;
  testCasesPassed: number;
  error?: string;
}

interface EvaluationSummary {
  totalProblems: number;
  successful: number;
  failed: number;
  accuracyRate: number;
  byDifficulty: {
    easy: { total: number; success: number; rate: number };
    medium: { total: number; success: number; rate: number };
    hard: { total: number; success: number; rate: number };
  };
  byCategory: Map<string, { total: number; success: number; rate: number }>;
  averageExecutionTimeMs: number;
  averageConfidence: number;
  results: EvaluationResult[];
}

/**
 * Evaluate the system against a set of test problems
 */
export async function evaluateSystem(
  problems: TestProblem[],
  options: {
    onProgress?: (completed: number, total: number, current: string) => void;
    parallel?: boolean;
  } = {}
): Promise<EvaluationSummary> {
  const results: EvaluationResult[] = [];
  const { onProgress, parallel = false } = options;

  logger.info(`Starting evaluation of ${problems.length} problems`);

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    
    if (onProgress) {
      onProgress(i, problems.length, problem.name);
    }

    logger.info(`Evaluating: ${problem.name} (${problem.difficulty})`);
    
    try {
      const startTime = Date.now();
      
      // Run the full pipeline
      const result = await runEvaluationPipeline(problem);
      
      const executionTime = Date.now() - startTime;
      
      // Determine success
      const success = isAlgorithmMatch(
        result.inferredAlgorithm,
        problem.expectedAlgorithm
      );

      results.push({
        problem: problem.name,
        category: problem.category,
        difficulty: problem.difficulty,
        success,
        inferredAlgorithm: result.inferredAlgorithm,
        expectedAlgorithm: problem.expectedAlgorithm,
        confidence: result.confidence,
        executionTimeMs: executionTime,
        testCasesGenerated: result.testCasesGenerated,
        testCasesPassed: result.testCasesPassed,
      });

      logger.info(`Result: ${success ? 'SUCCESS' : 'FAIL'} - ` +
        `Inferred: ${result.inferredAlgorithm}, ` +
        `Expected: ${problem.expectedAlgorithm}`);

    } catch (error) {
      logger.error(`Evaluation error for ${problem.name}:`, error);
      
      results.push({
        problem: problem.name,
        category: problem.category,
        difficulty: problem.difficulty,
        success: false,
        inferredAlgorithm: 'ERROR',
        expectedAlgorithm: problem.expectedAlgorithm,
        confidence: 0,
        executionTimeMs: 0,
        testCasesGenerated: 0,
        testCasesPassed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Small delay between evaluations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return generateSummary(results);
}

async function runEvaluationPipeline(problem: TestProblem): Promise<{
  inferredAlgorithm: string;
  confidence: number;
  testCasesGenerated: number;
  testCasesPassed: number;
}> {
  // This would use the actual pipeline
  // Simplified for evaluation purposes
  
  const jobId = `eval-${Date.now()}`;
  
  // Import and run the enhanced pipeline
  const { runEnhancedPipeline } = await import('./pipelineService');
  
  // ... implementation details ...
  
  return {
    inferredAlgorithm: 'Placeholder',
    confidence: 0.9,
    testCasesGenerated: 20,
    testCasesPassed: 18,
  };
}

function isAlgorithmMatch(inferred: string, expected: string): boolean {
  // Normalize algorithm names for comparison
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/algorithm/g, '')
    .replace(/problem/g, '');

  const inferredNorm = normalize(inferred);
  const expectedNorm = normalize(expected);

  // Exact match
  if (inferredNorm === expectedNorm) return true;

  // Alias matching
  const aliases: { [key: string]: string[] } = {
    'sum': ['arraysum', 'totalsum', 'sumofelements'],
    'max': ['maximum', 'maxelement', 'findmax'],
    'min': ['minimum', 'minelement', 'findmin'],
    'sort': ['sorting', 'arraysort', 'sortarray'],
    'binarysearch': ['bsearch', 'binsearch'],
    'kadane': ['maxsubarray', 'maximumsubarray', 'maxsubarraysum'],
    'fibonacci': ['fib', 'fibonaccinumber'],
    'gcd': ['greatestcommondivisor', 'euclidean'],
    'lis': ['longestincreasingsubsequence'],
    'dp': ['dynamicprogramming'],
  };

  for (const [canonical, aliasList] of Object.entries(aliases)) {
    const allVariants = [canonical, ...aliasList];
    if (allVariants.some(v => inferredNorm.includes(v)) &&
        allVariants.some(v => expectedNorm.includes(v))) {
      return true;
    }
  }

  return false;
}

function generateSummary(results: EvaluationResult[]): EvaluationSummary {
  const successful = results.filter(r => r.success).length;
  
  const byDifficulty = {
    easy: { total: 0, success: 0, rate: 0 },
    medium: { total: 0, success: 0, rate: 0 },
    hard: { total: 0, success: 0, rate: 0 },
  };

  const byCategory = new Map<string, { total: number; success: number; rate: number }>();

  let totalTime = 0;
  let totalConfidence = 0;

  for (const result of results) {
    // By difficulty
    byDifficulty[result.difficulty].total++;
    if (result.success) {
      byDifficulty[result.difficulty].success++;
    }

    // By category
    if (!byCategory.has(result.category)) {
      byCategory.set(result.category, { total: 0, success: 0, rate: 0 });
    }
    const cat = byCategory.get(result.category)!;
    cat.total++;
    if (result.success) cat.success++;

    totalTime += result.executionTimeMs;
    totalConfidence += result.confidence;
  }

  // Calculate rates
  for (const diff of ['easy', 'medium', 'hard'] as const) {
    if (byDifficulty[diff].total > 0) {
      byDifficulty[diff].rate = byDifficulty[diff].success / byDifficulty[diff].total;
    }
  }

  for (const cat of byCategory.values()) {
    if (cat.total > 0) {
      cat.rate = cat.success / cat.total;
    }
  }

  return {
    totalProblems: results.length,
    successful,
    failed: results.length - successful,
    accuracyRate: results.length > 0 ? successful / results.length : 0,
    byDifficulty,
    byCategory,
    averageExecutionTimeMs: results.length > 0 ? totalTime / results.length : 0,
    averageConfidence: results.length > 0 ? totalConfidence / results.length : 0,
    results,
  };
}

/**
 * Generate evaluation report
 */
export function generateReport(summary: EvaluationSummary): string {
  let report = `# Evaluation Report

## Summary
- **Total Problems**: ${summary.totalProblems}
- **Successful**: ${summary.successful} (${(summary.accuracyRate * 100).toFixed(1)}%)
- **Failed**: ${summary.failed}
- **Average Execution Time**: ${(summary.averageExecutionTimeMs / 1000).toFixed(1)}s
- **Average Confidence**: ${(summary.averageConfidence * 100).toFixed(1)}%

## Results by Difficulty

| Difficulty | Total | Success | Rate |
|------------|-------|---------|------|
| Easy | ${summary.byDifficulty.easy.total} | ${summary.byDifficulty.easy.success} | ${(summary.byDifficulty.easy.rate * 100).toFixed(1)}% |
| Medium | ${summary.byDifficulty.medium.total} | ${summary.byDifficulty.medium.success} | ${(summary.byDifficulty.medium.rate * 100).toFixed(1)}% |
| Hard | ${summary.byDifficulty.hard.total} | ${summary.byDifficulty.hard.success} | ${(summary.byDifficulty.hard.rate * 100).toFixed(1)}% |

## Results by Category

| Category | Total | Success | Rate |
|----------|-------|---------|------|
`;

  for (const [category, stats] of summary.byCategory.entries()) {
    report += `| ${category} | ${stats.total} | ${stats.success} | ${(stats.rate * 100).toFixed(1)}% |\n`;
  }

  report += `\n## Detailed Results\n\n`;

  for (const result of summary.results) {
    const status = result.success ? '✅' : '❌';
    report += `### ${status} ${result.problem}
- **Category**: ${result.category}
- **Difficulty**: ${result.difficulty}
- **Expected**: ${result.expectedAlgorithm}
- **Inferred**: ${result.inferredAlgorithm}
- **Confidence**: ${(result.confidence * 100).toFixed(1)}%
- **Time**: ${(result.executionTimeMs / 1000).toFixed(1)}s
${result.error ? `- **Error**: ${result.error}` : ''}

`;
  }

  return report;
}
```

---

## 7. Problem Dataset & Testing

### 7.1 Test Problem Definitions

Create `evaluation/problems.json`:

```json
{
  "problems": [
    {
      "name": "Array Sum",
      "category": "aggregation",
      "difficulty": "easy",
      "inputFormat": "First line: integer n\nSecond line: n space-separated integers",
      "constraints": "1 ≤ n ≤ 100000, -10^9 ≤ a[i] ≤ 10^9",
      "expectedAlgorithm": "Array Sum",
      "executablePath": "test_executables/sum.exe"
    },
    {
      "name": "Maximum Element",
      "category": "selection",
      "difficulty": "easy",
      "inputFormat": "First line: integer n\nSecond line: n space-separated integers",
      "constraints": "1 ≤ n ≤ 100000, -10^9 ≤ a[i] ≤ 10^9",
      "expectedAlgorithm": "Maximum Element",
      "executablePath": "test_executables/max.exe"
    },
    {
      "name": "Minimum Element",
      "category": "selection",
      "difficulty": "easy",
      "inputFormat": "First line: integer n\nSecond line: n space-separated integers",
      "constraints": "1 ≤ n ≤ 100000",
      "expectedAlgorithm": "Minimum Element",
      "executablePath": "test_executables/min.exe"
    },
    {
      "name": "Fibonacci Number",
      "category": "mathematical",
      "difficulty": "easy",
      "inputFormat": "Single integer n",
      "constraints": "1 ≤ n ≤ 45",
      "expectedAlgorithm": "Fibonacci",
      "executablePath": "test_executables/fibonacci.exe"
    },
    {
      "name": "Factorial",
      "category": "mathematical",
      "difficulty": "easy",
      "inputFormat": "Single integer n",
      "constraints": "0 ≤ n ≤ 20",
      "expectedAlgorithm": "Factorial",
      "executablePath": "test_executables/factorial.exe"
    },
    {
      "name": "GCD of Array",
      "category": "mathematical",
      "difficulty": "medium",
      "inputFormat": "First line: integer n\nSecond line: n positive integers",
      "constraints": "2 ≤ n ≤ 1000, 1 ≤ a[i] ≤ 10^9",
      "expectedAlgorithm": "GCD",
      "executablePath": "test_executables/gcd.exe"
    },
    {
      "name": "Binary Search",
      "category": "searching",
      "difficulty": "medium",
      "inputFormat": "First line: n and x\nSecond line: n sorted integers",
      "constraints": "1 ≤ n ≤ 100000",
      "expectedAlgorithm": "Binary Search",
      "executablePath": "test_executables/bsearch.exe"
    },
    {
      "name": "Maximum Subarray Sum",
      "category": "dp",
      "difficulty": "medium",
      "inputFormat": "First line: integer n\nSecond line: n integers",
      "constraints": "1 ≤ n ≤ 100000",
      "expectedAlgorithm": "Kadane's Algorithm",
      "executablePath": "test_executables/kadane.exe"
    },
    {
      "name": "Longest Increasing Subsequence",
      "category": "dp",
      "difficulty": "hard",
      "inputFormat": "First line: integer n\nSecond line: n integers",
      "constraints": "1 ≤ n ≤ 100000",
      "expectedAlgorithm": "LIS",
      "executablePath": "test_executables/lis.exe"
    },
    {
      "name": "Prime Check",
      "category": "mathematical",
      "difficulty": "easy",
      "inputFormat": "Single integer n",
      "constraints": "1 ≤ n ≤ 10^9",
      "expectedAlgorithm": "Prime Check",
      "executablePath": "test_executables/prime.exe"
    }
  ]
}
```

### 7.2 Test Executable Source Code

Create `evaluation/sources/sum.cpp`:

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    
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
}
```

Create `evaluation/sources/kadane.cpp`:

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    
    int n;
    cin >> n;
    
    vector<long long> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    
    long long maxSum = a[0];
    long long currentSum = a[0];
    
    for (int i = 1; i < n; i++) {
        currentSum = max(a[i], currentSum + a[i]);
        maxSum = max(maxSum, currentSum);
    }
    
    cout << maxSum << endl;
    return 0;
}
```

### 7.3 Evaluation Script

Create `evaluation/run_evaluation.ts`:

```typescript
import { evaluateSystem, generateReport } from '../src/services/evaluationService';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('Loading test problems...');
  
  const problemsData = await fs.readFile(
    path.join(__dirname, 'problems.json'),
    'utf-8'
  );
  const { problems } = JSON.parse(problemsData);

  console.log(`Loaded ${problems.length} problems`);
  console.log('Starting evaluation...\n');

  const summary = await evaluateSystem(problems, {
    onProgress: (completed, total, current) => {
      console.log(`[${completed}/${total}] Evaluating: ${current}`);
    },
  });

  // Generate report
  const report = generateReport(summary);
  
  // Save report
  const reportPath = path.join(__dirname, 'results', `report_${Date.now()}.md`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report);

  console.log('\n=== Evaluation Complete ===');
  console.log(`Total: ${summary.totalProblems}`);
  console.log(`Success Rate: ${(summary.accuracyRate * 100).toFixed(1)}%`);
  console.log(`Report saved to: ${reportPath}`);

  // Target metrics
  console.log('\n=== Target vs Actual ===');
  console.log(`Easy (target 95%): ${(summary.byDifficulty.easy.rate * 100).toFixed(1)}%`);
  console.log(`Medium (target 80%): ${(summary.byDifficulty.medium.rate * 100).toFixed(1)}%`);
  console.log(`Hard (target 60%): ${(summary.byDifficulty.hard.rate * 100).toFixed(1)}%`);
}

main().catch(console.error);
```

---

## 8. Prompt Refinement

### 8.1 Prompt A/B Testing

Create `src/services/promptTesting.ts`:

```typescript
import { logger } from '../utils/logger';

interface PromptVariant {
  id: string;
  name: string;
  promptTemplate: string;
  weight: number;
}

interface PromptTestResult {
  variantId: string;
  success: boolean;
  confidence: number;
  executionTimeMs: number;
}

const promptVariants: PromptVariant[] = [
  {
    id: 'v1_structured',
    name: 'Structured Analysis',
    weight: 50,
    promptTemplate: `You are analyzing a black-box competitive programming solution.

[STRUCTURED ANALYSIS PROMPT - includes step-by-step markers]`,
  },
  {
    id: 'v2_hypothesis',
    name: 'Hypothesis First',
    weight: 30,
    promptTemplate: `Given the following observations, generate and validate hypotheses.

[HYPOTHESIS-DRIVEN PROMPT]`,
  },
  {
    id: 'v3_minimal',
    name: 'Minimal Context',
    weight: 20,
    promptTemplate: `Analyze these input-output pairs and identify the algorithm.

[MINIMAL PROMPT FOR COST SAVINGS]`,
  },
];

const testResults: PromptTestResult[] = [];

/**
 * Select prompt variant based on weights
 */
export function selectPromptVariant(): PromptVariant {
  const totalWeight = promptVariants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const variant of promptVariants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant;
    }
  }
  
  return promptVariants[0];
}

/**
 * Record test result for a prompt variant
 */
export function recordPromptResult(result: PromptTestResult): void {
  testResults.push(result);
  
  // Keep last 1000 results
  if (testResults.length > 1000) {
    testResults.shift();
  }
}

/**
 * Get performance metrics for each variant
 */
export function getPromptPerformance(): Map<string, {
  count: number;
  successRate: number;
  avgConfidence: number;
  avgTime: number;
}> {
  const metrics = new Map();
  
  for (const variant of promptVariants) {
    const variantResults = testResults.filter(r => r.variantId === variant.id);
    
    if (variantResults.length === 0) {
      metrics.set(variant.id, {
        count: 0,
        successRate: 0,
        avgConfidence: 0,
        avgTime: 0,
      });
      continue;
    }
    
    const successCount = variantResults.filter(r => r.success).length;
    const totalConfidence = variantResults.reduce((sum, r) => sum + r.confidence, 0);
    const totalTime = variantResults.reduce((sum, r) => sum + r.executionTimeMs, 0);
    
    metrics.set(variant.id, {
      count: variantResults.length,
      successRate: successCount / variantResults.length,
      avgConfidence: totalConfidence / variantResults.length,
      avgTime: totalTime / variantResults.length,
    });
  }
  
  return metrics;
}

/**
 * Update variant weights based on performance (bandit algorithm)
 */
export function updateVariantWeights(): void {
  const performance = getPromptPerformance();
  
  for (const variant of promptVariants) {
    const stats = performance.get(variant.id);
    if (!stats || stats.count < 10) continue;
    
    // Simple UCB-like update
    const explorationBonus = Math.sqrt(2 * Math.log(testResults.length) / stats.count);
    const score = stats.successRate + 0.1 * explorationBonus;
    
    // Update weight (with bounds)
    variant.weight = Math.max(10, Math.min(60, score * 50));
  }
  
  logger.info('Updated prompt variant weights', {
    weights: promptVariants.map(v => ({ id: v.id, weight: v.weight })),
  });
}

// Update weights periodically
setInterval(updateVariantWeights, 3600000); // Every hour
```

---

## 9. Production Checklist

### 9.1 Pre-Deployment Checklist

#### Security
- [ ] Seccomp profile configured and tested
- [ ] Container runs as non-root user
- [ ] Network disabled for sandbox containers
- [ ] Rate limiting enabled
- [ ] Input validation comprehensive
- [ ] File upload restrictions enforced
- [ ] Resource limits configured
- [ ] Secrets stored securely (not in code)
- [ ] HTTPS configured
- [ ] Security headers set

#### Performance
- [ ] Caching implemented for LLM responses
- [ ] Parallel test execution optimized
- [ ] Container cleanup scheduled
- [ ] Database/storage cleanup scheduled
- [ ] Request queuing for LLM calls
- [ ] Response compression enabled

#### Reliability
- [ ] Health check endpoints working
- [ ] Error recovery strategies tested
- [ ] Graceful degradation implemented
- [ ] Fallback results for failures
- [ ] Container orphan cleanup working
- [ ] Log rotation configured

#### Monitoring
- [ ] Structured logging enabled
- [ ] Metrics collection active
- [ ] Alerts configured for errors
- [ ] Uptime monitoring set up
- [ ] Performance tracking active

#### Evaluation
- [ ] Test problem set prepared (100+ problems)
- [ ] Evaluation framework working
- [ ] Baseline metrics established
- [ ] Target accuracy: Easy 95%, Medium 80%, Hard 60%

### 9.2 Deployment Steps

```bash
# 1. Build production images
docker build -t exe-runner-backend:latest -f backend/Dockerfile ./backend
docker build -t exe-runner-frontend:latest -f frontend/Dockerfile ./frontend
docker build -t sandbox:latest -f docker/Dockerfile.sandbox ./docker

# 2. Push to registry
docker push your-registry/exe-runner-backend:latest
docker push your-registry/exe-runner-frontend:latest
docker push your-registry/sandbox:latest

# 3. Deploy with docker-compose
cd deploy
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify deployment
curl http://localhost/api/health

# 5. Run smoke tests
npm run test:smoke

# 6. Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 9.3 Post-Deployment Verification

```bash
# Health check
curl -s http://localhost/api/health | jq .

# Metrics check (with auth)
curl -s -H "X-Metrics-Key: your_key" http://localhost/api/metrics | jq .

# Test analysis
curl -X POST http://localhost/api/analyze \
  -F "executable=@test.exe" \
  -F "inputFormat=Single integer n" \
  -F "constraints=1 ≤ n ≤ 100"
```

---

## Phase 3 Completion Checklist

- [ ] Security hardening complete
  - [ ] Seccomp profile deployed
  - [ ] All containers non-root
  - [ ] Rate limiting active
  - [ ] Input validation comprehensive
- [ ] Resource management optimized
  - [ ] Memory limits enforced
  - [ ] CPU quotas configured
  - [ ] Concurrent execution limited
- [ ] Performance optimized
  - [ ] Caching implemented
  - [ ] Parallel execution working
  - [ ] LLM request optimization
- [ ] Monitoring & logging
  - [ ] Structured logging active
  - [ ] Metrics collection working
  - [ ] Health checks passing
- [ ] Deployment ready
  - [ ] Docker images built
  - [ ] Compose files configured
  - [ ] Environment variables set
- [ ] Evaluation complete
  - [ ] 100+ problems tested
  - [ ] Accuracy targets met
  - [ ] Report generated
- [ ] Documentation updated
  - [ ] API documentation
  - [ ] Deployment guide
  - [ ] Troubleshooting guide

---

## Expected Metrics After Phase 3

| Metric | Target | Notes |
|--------|--------|-------|
| **Inference Accuracy (Easy)** | ≥95% | Array sum, max, min, factorial |
| **Inference Accuracy (Medium)** | ≥80% | Binary search, prefix sums, basic DP |
| **Inference Accuracy (Hard)** | ≥60% | Complex DP, graph algorithms |
| **Response Time** | <60s | End-to-end analysis |
| **Container Security** | 100% | No escapes in testing |
| **Uptime** | 99.9% | After production deployment |
| **LLM Cost per Analysis** | <$0.10 | Using Gemini Flash |

---

**Project Complete!** 🎉

The AI-Based Black-Box Problem Reconstruction System is now ready for production deployment and real-world usage.
