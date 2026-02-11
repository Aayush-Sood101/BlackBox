import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
  },
  
  docker: {
    sandboxImage: process.env.SANDBOX_IMAGE || 'sandbox:latest',
    // Wine on Apple Silicon (emulated x86_64) needs more time to start
    timeout: parseInt(process.env.DOCKER_TIMEOUT || '30000', 10),
    memoryLimit: parseInt(process.env.DOCKER_MEMORY_LIMIT || '268435456', 10),
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
