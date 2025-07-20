import express, { Application, Request, Response, NextFunction, Router } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'http';

import { MemoryService } from '../services/memory.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../utils/auth.js';
import { metrics } from '../utils/metrics.js';
import type { EnvironmentConfig } from '../config.js';

interface RESTAPIServer {
  app: Application;
  server: Server;
  memoryService: MemoryService;
}

interface HealthResponse {
  status: string;
  version?: string;
  timestamp: string;
  uptime?: number;
  checks?: Record<string, string>;
  error?: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

export function createRESTAPI(
  config: EnvironmentConfig,
  port: number | null = null
): RESTAPIServer {
  const app = express();
  const memoryService = new MemoryService(config);

  setupMiddleware(app, config);
  setupHealthRoutes(app, config, memoryService);
  setupAPIRoutes(app, memoryService, config);
  setupErrorHandling(app);

  // Use port from config if not explicitly provided
  const actualPort = port !== null ? port : config.api?.port || 3333;
  return startServer(app, actualPort, memoryService);
}

function setupMiddleware(app: Application, config: EnvironmentConfig): void {
  app.use(
    helmet({
      frameguard: { action: 'deny' },
    })
  );
  app.use(express.json({ limit: config.api.maxRequestSize }));

  if (config.api.compression) {
    app.use(compression());
  }

  if (config.api.cors) {
    app.use(cors());
  }

  if (config.api.rateLimit && typeof config.api.rateLimit === 'number') {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: config.api.rateLimit,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', limiter);
  }

  if (config.security?.apiKey || config.security?.jwt) {
    app.use('/api/v1/memories', authenticate(config));
  }

  if (config.monitoring?.metrics) {
    app.use(metrics.middleware);
  }
}

function setupHealthRoutes(
  app: Application,
  config: EnvironmentConfig,
  memoryService: MemoryService
): void {
  app.get('/health', (req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'healthy',
      version: config.server?.version || '2.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    res.json(response);
  });

  app.get('/health/deep', async (req: Request, res: Response) => {
    try {
      const checks = {
        database: 'healthy',
        embedding: 'healthy',
      };

      // Try to check database if memoryService has checkReady method
      try {
        if (memoryService.checkReady) {
          await memoryService.checkReady();
        }
      } catch (error) {
        checks.database = 'unhealthy';
      }

      const response: HealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks,
      };
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response: HealthResponse = {
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
      res.status(503).json(response);
    }
  });

  app.get('/ready', async (req: Request, res: Response) => {
    try {
      await memoryService.checkReady();
      res.json({ status: 'ready' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(503).json({ status: 'not ready', error: errorMessage });
    }
  });
}

function setupAPIRoutes(
  app: Application,
  memoryService: MemoryService,
  config: EnvironmentConfig
): void {
  const router = express.Router();

  setupMemoryRoutes(router, memoryService);
  setupBatchRoutes(router, memoryService);
  setupStreamRoutes(router, memoryService);

  if (config.monitoring?.metrics) {
    app.get('/metrics', metrics.endpoint);
  }

  app.use('/api/v1', router);
}

function setupMemoryRoutes(router: Router, memoryService: MemoryService): void {
  router.post('/memories', async (req: Request, res: Response) => {
    try {
      const memory = await memoryService.create(req.body);
      res.status(201).json(memory);
    } catch (error) {
      logger.error('Create memory failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response: ErrorResponse = {
        error: errorMessage,
        message: `Memory validation failed: ${errorMessage}`,
      };
      res.status(400).json(response);
    }
  });

  router.get('/memories/search', async (req: Request, res: Response) => {
    try {
      // Parse tags from comma-separated string to array
      const params: any = { ...req.query };
      if (params.tags && typeof params.tags === 'string') {
        params.tags = params.tags.split(',').map((tag: string) => tag.trim());
      }

      const results = await memoryService.search(params);
      res.json(results);
    } catch (error) {
      logger.error('Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });

  router.get('/memories', async (req: Request, res: Response) => {
    try {
      // Parse tags from comma-separated string to array
      const params: any = { ...req.query };
      if (params.tags && typeof params.tags === 'string') {
        params.tags = params.tags.split(',').map((tag: string) => tag.trim());
      }

      const results = await memoryService.list(params);
      res.json(results);
    } catch (error) {
      logger.error('List failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });

  setupMemoryCRUDRoutes(router, memoryService);
}

function setupMemoryCRUDRoutes(router: Router, memoryService: MemoryService): void {
  router.get('/memories/:id', async (req: Request, res: Response) => {
    try {
      const memory = await memoryService.getById(req.params.id);
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(memory);
    } catch (error) {
      logger.error('Get memory failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });

  router.put('/memories/:id', async (req: Request, res: Response) => {
    try {
      const memory = await memoryService.update(req.params.id, req.body);
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(memory);
    } catch (error) {
      logger.error('Update memory failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });

  router.delete('/memories/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await memoryService.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.status(204).send();
    } catch (error) {
      logger.error('Delete memory failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });
}

function setupBatchRoutes(router: Router, memoryService: MemoryService): void {
  router.post('/memories/batch', async (req: Request, res: Response) => {
    try {
      const results = await memoryService.batch(req.body);
      res.json(results);
    } catch (error) {
      logger.error('Batch operation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });
}

function setupStreamRoutes(router: Router, memoryService: MemoryService): void {
  router.get('/memories/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = memoryService.createStream(req.query);

    stream.on('data', (memory: any) => {
      res.write(`data: ${JSON.stringify(memory)}\n\n`);
    });

    stream.on('error', (error: Error) => {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    });

    req.on('close', () => {
      stream.destroy();
    });
  });
}

function setupErrorHandling(app: Application): void {
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    const response: ErrorResponse = {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    };
    res.status(500).json(response);
  });
}

function startServer(app: Application, port: number, memoryService: MemoryService): RESTAPIServer {
  const server = app.listen(port, () => {
    logger.info(`REST API server listening on port ${port}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
    });
  });

  return { app, server, memoryService };
}
