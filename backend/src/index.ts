import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './utils/logger';
import apiRoutes from './routes/api';
import { checkDockerHealth } from './services/dockerService';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.resolve(config.upload.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info(`Created upload directory: ${uploadDir}`);
}

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'exeRunner API',
    version: '1.0.0',
    description: 'AI-Based Black-Box Problem Reconstruction System',
    endpoints: {
      health: 'GET /api/health',
      status: 'GET /api/status',
      analyze: 'POST /api/analyze',
      demo: 'POST /api/demo',
    },
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: `File too large. Maximum size is ${config.upload.maxFileSize / 1024 / 1024}MB`,
    });
  }
  
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
async function startServer() {
  // Check Docker availability
  const dockerStatus = await checkDockerHealth();
  if (dockerStatus.healthy) {
    logger.info(`Docker is available (version ${dockerStatus.version})`);
  } else {
    logger.warn(`Docker is not available: ${dockerStatus.error}`);
    logger.warn('Running in limited mode - only mock/demo endpoints will work');
  }

  // Check Gemini API key
  if (!config.gemini.apiKey || config.gemini.apiKey === 'your_gemini_api_key_here') {
    logger.warn('Gemini API key not configured. Set GEMINI_API_KEY in .env');
    logger.warn('Running in limited mode - only mock endpoints will work');
  }

  app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`API available at http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
