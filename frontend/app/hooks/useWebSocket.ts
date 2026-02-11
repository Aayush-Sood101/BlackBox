'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  jobId?: string;
  stage?: string;
  progress?: number;
  details?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  hypotheses?: Array<{ name: string; confidence: number }>;
  patterns?: Array<{ type: string; confidence: number; algorithm: string }>;
  testIndex?: number;
  totalTests?: number;
  message?: string;
  level?: 'info' | 'warn' | 'error';
  timestamp?: number;
}

interface UseWebSocketOptions {
  url: string;
  jobId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onStageChange?: (stage: string, progress?: number) => void;
  onHypothesesUpdate?: (hypotheses: Array<{ name: string; confidence: number }>) => void;
  onPatternsUpdate?: (patterns: Array<{ type: string; confidence: number; algorithm: string }>) => void;
  onTestUpdate?: (testIndex: number, totalTests: number) => void;
  onLogMessage?: (message: string, level: string) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    jobId,
    onMessage,
    onStageChange,
    onHypothesesUpdate,
    onPatternsUpdate,
    onTestUpdate,
    onLogMessage,
    onComplete,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionAttempts(0);
        console.log('WebSocket connected');

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
            case 'job_update':
            case 'stage_update':
              if (message.stage) {
                onStageChange?.(message.stage, message.progress);
              }
              break;

            case 'hypothesis_update':
              if (message.hypotheses) {
                onHypothesesUpdate?.(message.hypotheses);
              }
              break;

            case 'pattern_update':
              if (message.patterns) {
                onPatternsUpdate?.(message.patterns);
              }
              break;

            case 'test_update':
              if (message.testIndex !== undefined && message.totalTests !== undefined) {
                onTestUpdate?.(message.testIndex, message.totalTests);
              }
              break;

            case 'log':
              if (message.message) {
                onLogMessage?.(message.message, message.level || 'info');
              }
              break;

            case 'complete':
              onComplete?.(message.result);
              break;

            case 'error':
              if (message.error) {
                onError?.(message.error);
              }
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');

        if (autoReconnect && connectionAttempts < 5) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionAttempts((prev) => prev + 1);
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [
    url,
    jobId,
    onMessage,
    onStageChange,
    onHypothesesUpdate,
    onPatternsUpdate,
    onTestUpdate,
    onLogMessage,
    onComplete,
    onError,
    autoReconnect,
    reconnectDelay,
    connectionAttempts,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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

  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe' }));
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
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

  // Keep-alive ping
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendPing();
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected, sendPing]);

  return {
    isConnected,
    lastMessage,
    connectionAttempts,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

/**
 * Hook for managing analysis progress state
 */
export function useAnalysisProgress() {
  const [stage, setStage] = useState<string>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [hypotheses, setHypotheses] = useState<Array<{ name: string; confidence: number }>>([]);
  const [patterns, setPatterns] = useState<Array<{ type: string; confidence: number; algorithm: string }>>([]);
  const [logs, setLogs] = useState<Array<{ message: string; level: string; timestamp: number }>>([]);
  const [testProgress, setTestProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const handleStageChange = useCallback((newStage: string, newProgress?: number) => {
    setStage(newStage);
    if (newProgress !== undefined) {
      setProgress(newProgress);
    }
    if (newStage === 'error') {
      setError('Analysis failed');
    }
  }, []);

  const handleHypothesesUpdate = useCallback(
    (newHypotheses: Array<{ name: string; confidence: number }>) => {
      setHypotheses(newHypotheses);
    },
    []
  );

  const handlePatternsUpdate = useCallback(
    (newPatterns: Array<{ type: string; confidence: number; algorithm: string }>) => {
      setPatterns(newPatterns);
    },
    []
  );

  const handleTestUpdate = useCallback((current: number, total: number) => {
    setTestProgress({ current, total });
  }, []);

  const handleLogMessage = useCallback((message: string, level: string) => {
    setLogs((prev) => [
      ...prev.slice(-49), // Keep last 50 logs
      { message, level, timestamp: Date.now() },
    ]);
  }, []);

  const handleComplete = useCallback((completionResult: unknown) => {
    setStage('complete');
    setProgress(100);
    setResult(completionResult);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setStage('error');
    setError(errorMessage);
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setProgress(0);
    setHypotheses([]);
    setPatterns([]);
    setLogs([]);
    setTestProgress({ current: 0, total: 0 });
    setError(null);
    setResult(null);
  }, []);

  return {
    stage,
    progress,
    hypotheses,
    patterns,
    logs,
    testProgress,
    error,
    result,
    handlers: {
      onStageChange: handleStageChange,
      onHypothesesUpdate: handleHypothesesUpdate,
      onPatternsUpdate: handlePatternsUpdate,
      onTestUpdate: handleTestUpdate,
      onLogMessage: handleLogMessage,
      onComplete: handleComplete,
      onError: handleError,
    },
    reset,
  };
}
