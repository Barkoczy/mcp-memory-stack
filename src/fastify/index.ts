import dotenv from 'dotenv';
import { createFastifyServer, startServer } from './server.js';
import type { AppConfig } from '../shared/types/index.js';

// Load environment variables
dotenv.config();

// Configuration with strict typing
const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT ?? '3333', 10),
    host: process.env.HOST ?? '0.0.0.0',
    version: process.env.npm_package_version ?? '2.0.0',
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'mcp_memory',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN ?? '5', 10),
      max: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    },
  },
  api: {
    maxRequestSize: process.env.API_MAX_REQUEST_SIZE ?? '10mb',
    compression: process.env.API_COMPRESSION !== 'false',
    cors: process.env.API_CORS !== 'false',
    rateLimit: process.env.API_RATE_LIMIT 
      ? parseInt(process.env.API_RATE_LIMIT, 10) 
      : (process.env.NODE_ENV === 'production' ? 100 : false),
  },
  security: {
    apiKey: process.env.API_KEY,
    jwt: process.env.JWT_SECRET ? {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    } : undefined,
  },
  monitoring: {
    metrics: process.env.METRICS_ENABLED === 'true',
  },
};

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting MCP Memory Server (Fastify)...');
    console.log(`📊 Environment: ${process.env.NODE_ENV ?? 'development'}`);
    console.log(`🔧 TypeScript Strict Mode: enabled`);
    
    const app = await createFastifyServer(config);
    await startServer(app);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('Application startup failed:', error);
  process.exit(1);
});