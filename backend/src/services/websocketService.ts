import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';

interface Client {
  ws: WebSocket;
  jobId: string | null;
}

const clients = new Map<string, Client>();
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(server: Server): void {
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

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(clientId: string, message: { type: string; jobId?: string }): void {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'subscribe':
      if (message.jobId) {
        client.jobId = message.jobId;
        logger.info(`Client ${clientId} subscribed to job ${message.jobId}`);
        // Send acknowledgment
        client.ws.send(
          JSON.stringify({
            type: 'subscribed',
            jobId: message.jobId,
          })
        );
      }
      break;

    case 'unsubscribe':
      client.jobId = null;
      logger.info(`Client ${clientId} unsubscribed`);
      break;

    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

/**
 * Broadcast job status update to subscribed clients
 */
export function broadcastJobUpdate(jobId: string, update: Record<string, unknown>): void {
  const message = JSON.stringify({
    type: 'job_update',
    jobId,
    ...update,
  });

  for (const [, client] of clients.entries()) {
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
  details?: Record<string, unknown>
): void {
  broadcastJobUpdate(jobId, {
    type: 'stage_update',
    stage,
    progress,
    details,
    timestamp: Date.now(),
  });

  logger.debug(`[${jobId}] Stage update: ${stage} (${progress}%)`);
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
    hypotheses: hypotheses.slice(0, 5), // Only send top 5
  });
}

/**
 * Send pattern detection update
 */
export function sendPatternUpdate(
  jobId: string,
  patterns: Array<{ type: string; confidence: number; algorithm: string }>
): void {
  broadcastJobUpdate(jobId, {
    type: 'pattern_update',
    patterns,
  });
}

/**
 * Send completion notification
 */
export function sendCompletion(jobId: string, result: Record<string, unknown>): void {
  broadcastJobUpdate(jobId, {
    type: 'complete',
    result,
  });

  logger.info(`[${jobId}] Pipeline complete, notified clients`);
}

/**
 * Send error notification
 */
export function sendError(jobId: string, error: string): void {
  broadcastJobUpdate(jobId, {
    type: 'error',
    error,
  });

  logger.error(`[${jobId}] Error sent to clients: ${error}`);
}

/**
 * Send progress log message
 */
export function sendLogMessage(jobId: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  broadcastJobUpdate(jobId, {
    type: 'log',
    level,
    message,
    timestamp: Date.now(),
  });
}

/**
 * Generate unique client ID
 */
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get count of connected clients
 */
export function getConnectedClientCount(): number {
  return clients.size;
}

/**
 * Get count of clients subscribed to a specific job
 */
export function getJobSubscriberCount(jobId: string): number {
  let count = 0;
  for (const [, client] of clients.entries()) {
    if (client.jobId === jobId && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  return count;
}

/**
 * Close all WebSocket connections (for graceful shutdown)
 */
export function closeAllConnections(): void {
  for (const [clientId, client] of clients.entries()) {
    try {
      client.ws.close(1000, 'Server shutting down');
    } catch (error) {
      logger.error(`Error closing connection for ${clientId}:`, error);
    }
  }
  clients.clear();

  if (wss) {
    wss.close();
    logger.info('WebSocket server closed');
  }
}
