import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const colors: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

const reset = '\x1b[0m';

function shouldLog(level: LogLevel): boolean {
  const configLevel = config.logLevel as LogLevel;
  return levels[level] >= levels[configLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, meta?: any): string {
  const timestamp = formatTimestamp();
  const color = colors[level];
  const levelStr = level.toUpperCase().padEnd(5);
  
  let output = `${color}[${timestamp}] ${levelStr}${reset}: ${message}`;
  
  if (meta) {
    output += ` ${JSON.stringify(meta)}`;
  }
  
  return output;
}

export const logger = {
  debug(message: string, meta?: any): void {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },
  
  info(message: string, meta?: any): void {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },
  
  warn(message: string, meta?: any): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  
  error(message: string, meta?: any): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },
};

export function createJobLogger(jobId: string) {
  return {
    debug: (msg: string, meta?: any) => logger.debug(`[${jobId.slice(0, 8)}] ${msg}`, meta),
    info: (msg: string, meta?: any) => logger.info(`[${jobId.slice(0, 8)}] ${msg}`, meta),
    warn: (msg: string, meta?: any) => logger.warn(`[${jobId.slice(0, 8)}] ${msg}`, meta),
    error: (msg: string, meta?: any) => logger.error(`[${jobId.slice(0, 8)}] ${msg}`, meta),
  };
}

export default logger;
