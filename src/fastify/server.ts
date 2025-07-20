import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import fastifySensible from '@fastify/sensible';

import type { AppConfig } from '../shared/types/index.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMemoryRoutes } from './routes/memory.js';
import { registerBatchRoutes } from './routes/batch.js';
import { registerStreamRoutes } from './routes/stream.js';

interface FastifyApp extends FastifyInstance {
  readonly config: AppConfig;
}

export async function createFastifyServer(config: AppConfig): Promise<FastifyApp> {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      serializers: {
        req: (request: FastifyRequest) => ({
          method: request.method,
          url: request.url,
          headers: request.headers,
        }),
        res: (reply: FastifyReply) => ({
          statusCode: reply.statusCode,
        }),
      },
    },
    requestTimeout: 30000,
    keepAliveTimeout: 5000,
    connectionTimeout: 10000,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Decorate with config
  app.decorate('config', config);

  // Register core plugins
  await app.register(fastifySensible);

  // Security plugins
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    global: true,
  });

  // CORS
  if (config.api.cors) {
    await app.register(fastifyCors, {
      origin: process.env.NODE_ENV === 'production' ? false : true,
      credentials: true,
    });
  }

  // Compression
  if (config.api.compression) {
    await app.register(fastifyCompress, {
      global: true,
      encodings: ['gzip', 'deflate'],
    });
  }

  // Rate limiting
  if (config.api.rateLimit) {
    await app.register(fastifyRateLimit, {
      max: config.api.rateLimit,
      timeWindow: '1 minute',
      errorResponseBuilder: (request: FastifyRequest, context: { max: number; after: string }) => ({
        error: 'Rate limit exceeded',
        message: `Too Many Requests. Rate limit: ${context.max} requests per minute`,
        retryAfter: context.after,
      }),
    });
  }

  // Swagger documentation
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'MCP Memory Server API',
        description: 'High-performance semantic memory server with vector search capabilities',
        version: config.server.version,
      },
      servers: [
        {
          url: `http://${config.server.host}:${config.server.port}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
  });

  // Register routes
  await app.register(registerHealthRoutes);
  await app.register(registerMemoryRoutes, { prefix: '/api/v1' });
  await app.register(registerBatchRoutes, { prefix: '/api/v1' });
  await app.register(registerStreamRoutes, { prefix: '/api/v1' });

  // Global error handler
  app.setErrorHandler(async (error, request: FastifyRequest, reply: FastifyReply) => {
    app.log.error(error, 'Unhandled error occurred');

    const isDevelopment = process.env.NODE_ENV === 'development';

    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.name || 'Bad Request',
        message: error.message,
        ...(isDevelopment && { stack: error.stack }),
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      ...(isDevelopment && { stack: error.stack }),
    });
  });

  // Not found handler
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app as FastifyApp;
}

export async function startServer(app: FastifyApp): Promise<void> {
  try {
    const { host, port } = app.config.server;

    await app.listen({
      port,
      host,
    });

    app.log.info(`🚀 Fastify server listening on http://${host}:${port}`);
    app.log.info(`📚 API Documentation: http://${host}:${port}/docs`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      app.log.info(`Received ${signal}, shutting down gracefully`);

      try {
        await app.close();
        app.log.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        app.log.error(error, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
}
