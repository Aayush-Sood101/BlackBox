import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { checkDockerHealth, ensureSandboxImage } from '../services/dockerService';
import {
  runAnalysisPipeline,
  createJob,
  cleanupJob,
  onProgress,
  offProgress,
} from '../services/pipelineService';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.exe') {
      return cb(new Error('Only .exe files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  const dockerHealth = await checkDockerHealth();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    docker: dockerHealth,
    config: {
      maxFileSize: config.upload.maxFileSize,
      dockerTimeout: config.docker.timeout,
    },
  });
});

/**
 * Upload and analyze executable
 */
router.post(
  '/analyze',
  upload.single('executable'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate file
      if (!req.file) {
        res.status(400).json({ error: 'No executable file uploaded' });
        return;
      }

      // Validate required fields
      const { inputFormat, constraints } = req.body;
      if (!inputFormat) {
        res.status(400).json({ error: 'Input format is required' });
        return;
      }

      logger.info('Received analysis request', {
        filename: req.file.originalname,
        size: req.file.size,
      });

      // Check if using mock mode
      const useMock = req.body.useMock === 'true' || req.body.useMock === true;

      // Create job
      const { jobId, executablePath } = await createJob(
        req.file.buffer,
        req.file.originalname
      );

      // Run analysis pipeline
      const result = await runAnalysisPipeline({
        executablePath,
        inputFormat,
        constraints: constraints || '',
        useMock,
      });

      // Cleanup job directory
      await cleanupJob(jobId);

      if (result.success) {
        res.json({
          success: true,
          jobId: result.jobId,
          inference: result.inference,
          stats: result.executionStats,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('Analysis endpoint error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

/**
 * Demo endpoint for testing without actual executable
 */
router.post('/demo', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inputFormat, constraints } = req.body;

    if (!inputFormat) {
      res.status(400).json({ error: 'Input format is required' });
      return;
    }

    logger.info('Received demo request', { inputFormat });

    // Run analysis with mock mode
    const result = await runAnalysisPipeline({
      executablePath: '/mock/path',
      inputFormat,
      constraints: constraints || '',
      useMock: true,
    });

    if (result.success) {
      res.json({
        success: true,
        jobId: result.jobId,
        inference: result.inference,
        observations: result.observations,
        stats: result.executionStats,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Demo endpoint error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * Get system status
 */
router.get('/status', async (req: Request, res: Response) => {
  const dockerHealth = await checkDockerHealth();
  const sandboxReady = await ensureSandboxImage();

  res.json({
    status: dockerHealth.healthy && sandboxReady ? 'ready' : 'degraded',
    components: {
      docker: dockerHealth.healthy ? 'healthy' : 'unhealthy',
      sandbox: sandboxReady ? 'ready' : 'not_built',
      llm: config.gemini.apiKey ? 'configured' : 'missing_api_key',
    },
    dockerVersion: dockerHealth.version,
    timestamp: new Date().toISOString(),
  });
});

export default router;
