import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { MemoryService } from '../services/memory.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../utils/auth.js';
import { metrics } from '../utils/metrics.js';

export function createRESTAPI(config, port = 3333) {
  const app = express();
  const memoryService = new MemoryService(config);

  setupMiddleware(app, config);
  setupHealthRoutes(app, config, memoryService);
  setupAPIRoutes(app, memoryService, config);
  setupErrorHandling(app);

  return startServer(app, port, memoryService);
}

function setupMiddleware(app, config) {
  app.use(helmet());
  app.use(express.json({ limit: config.api.maxRequestSize }));

  if (config.api.compression) {
    app.use(compression());
  }

  if (config.api.cors) {
    app.use(cors());
  }

  if (config.api.rateLimit) {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: config.api.rateLimit,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', limiter);
  }

  if (config.security.apiKey || config.security.jwt) {
    app.use('/api/v1/memories', authenticate(config));
  }

  if (config.monitoring.metrics) {
    app.use(metrics.middleware);
  }
}

function setupHealthRoutes(app, config, memoryService) {
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      version: config.server.version,
      uptime: process.uptime(),
    });
  });

  app.get('/ready', async (req, res) => {
    try {
      await memoryService.checkReady();
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });
}

function setupAPIRoutes(app, memoryService, config) {
  const router = express.Router();

  setupMemoryRoutes(router, memoryService);
  setupBatchRoutes(router, memoryService);
  setupStreamRoutes(router, memoryService);

  if (config.monitoring.metrics) {
    app.get('/metrics', metrics.endpoint);
  }

  app.use('/api/v1', router);
}

function setupMemoryRoutes(router, memoryService) {
  router.post('/memories', async (req, res) => {
    try {
      const memory = await memoryService.create(req.body);
      res.status(201).json(memory);
    } catch (error) {
      logger.error('Create memory failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/memories/search', async (req, res) => {
    try {
      const results = await memoryService.search(req.query);
      res.json(results);
    } catch (error) {
      logger.error('Search failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/memories', async (req, res) => {
    try {
      const results = await memoryService.list(req.query);
      res.json(results);
    } catch (error) {
      logger.error('List failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  setupMemoryCRUDRoutes(router, memoryService);
}

function setupMemoryCRUDRoutes(router, memoryService) {
  router.get('/memories/:id', async (req, res) => {
    try {
      const memory = await memoryService.getById(req.params.id);
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(memory);
    } catch (error) {
      logger.error('Get memory failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/memories/:id', async (req, res) => {
    try {
      const memory = await memoryService.update(req.params.id, req.body);
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(memory);
    } catch (error) {
      logger.error('Update memory failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/memories/:id', async (req, res) => {
    try {
      const deleted = await memoryService.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.status(204).send();
    } catch (error) {
      logger.error('Delete memory failed:', error);
      res.status(400).json({ error: error.message });
    }
  });
}

function setupBatchRoutes(router, memoryService) {
  router.post('/memories/batch', async (req, res) => {
    try {
      const results = await memoryService.batch(req.body);
      res.json(results);
    } catch (error) {
      logger.error('Batch operation failed:', error);
      res.status(400).json({ error: error.message });
    }
  });
}

function setupStreamRoutes(router, memoryService) {
  router.get('/memories/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = memoryService.createStream(req.query);

    stream.on('data', memory => {
      res.write(`data: ${JSON.stringify(memory)}\\n\\n`);
    });

    stream.on('error', error => {
      res.write(`event: error\\ndata: ${JSON.stringify({ error: error.message })}\\n\\n`);
    });

    req.on('close', () => {
      stream.destroy();
    });
  });
}

function setupErrorHandling(app) {
  app.use((err, req, res, _next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });
}

function startServer(app, port, memoryService) {
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
