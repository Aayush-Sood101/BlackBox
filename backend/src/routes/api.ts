import { Router, Request, Response } from 'express';
import multer from 'multer';
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

/**
 * Detect the type of executable from magic bytes and return validation info
 */
function validateExecutable(buffer: Buffer): { valid: boolean; type: string; message: string } {
  if (buffer.length < 4) {
    return { valid: false, type: 'unknown', message: 'File too small to be an executable' };
  }

  // Windows PE: MZ magic (0x4D 0x5A)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { valid: true, type: 'windows-pe', message: 'Valid Windows PE executable' };
  }

  // macOS Mach-O: Various magic values
  if (
    (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
    (buffer[0] === 0xCE && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
    (buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE) ||
    (buffer[0] === 0xBE && buffer[1] === 0xBA && buffer[2] === 0xFE && buffer[3] === 0xCA)
  ) {
    return { 
      valid: false, 
      type: 'macos-macho', 
      message: 'This is a macOS executable (Mach-O). Please compile your code for Windows using MinGW (x86_64-w64-mingw32-g++) or compile on a Windows machine.' 
    };
  }

  // Linux ELF: 0x7F 'E' 'L' 'F'
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return { 
      valid: false, 
      type: 'linux-elf', 
      message: 'This is a Linux executable (ELF). Please compile your code for Windows using MinGW.' 
    };
  }

  return { 
    valid: false, 
    type: 'unknown', 
    message: `Unrecognized file format (magic bytes: ${buffer.slice(0, 4).toString('hex')}). Please upload a Windows .exe file.` 
  };
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  // Accept all files - validation is done after upload by checking PE header
  // This handles macOS which often hides/strips .exe extensions
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
      // Validate file exists
      if (!req.file) {
        res.status(400).json({ error: 'No executable file uploaded' });
        return;
      }

      // Log file details for debugging
      logger.info('File upload received', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        firstBytes: req.file.buffer?.slice(0, 10).toString('hex'),
      });

      // Validate file is a Windows PE executable (check magic bytes)
      // This is more reliable than checking extension, especially on macOS
      const validation = validateExecutable(req.file.buffer);
      if (!validation.valid) {
        logger.warn('Executable validation failed', {
          type: validation.type,
          message: validation.message,
          filename: req.file.originalname,
        });
        res.status(400).json({ error: validation.message });
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
