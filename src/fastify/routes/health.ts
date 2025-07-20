import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HealthStatusSchema, ErrorResponseSchema } from '../types/schemas.js';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  // Basic health check
  fastify.get('/health', {
    schema: {
      description: 'Basic health check endpoint',
      tags: ['Health'],
      response: {
        200: HealthStatusSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const healthStatus = {
      status: 'healthy' as const,
      version: fastify.config.server.version,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    return reply.status(200).send(healthStatus);
  });

  // Deep health check with dependencies
  fastify.get('/health/deep', {
    schema: {
      description: 'Comprehensive health check including dependencies',
      tags: ['Health'],
      response: {
        200: HealthStatusSchema,
        503: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const checks: Record<string, 'healthy' | 'unhealthy'> = {
        database: 'healthy',
        embedding: 'healthy',
      };

      // TODO: Add actual health checks for dependencies
      // For now, return healthy status
      
      const healthStatus = {
        status: 'healthy' as const,
        version: fastify.config.server.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
      };

      return reply.status(200).send(healthStatus);
    } catch (error) {
      fastify.log.error(error, 'Health check failed');
      
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Readiness probe
  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe for orchestration systems',
      tags: ['Health'],
      response: {
        200: Type.Object({
          status: Type.Literal('ready'),
          timestamp: Type.String({ format: 'date-time' }),
        }),
        503: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO: Check if all dependencies are ready
      // For now, assume ready
      
      return reply.status(200).send({
        status: 'ready' as const,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error, 'Readiness check failed');
      
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Service not ready',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Liveness probe
  fastify.get('/live', {
    schema: {
      description: 'Liveness probe for orchestration systems',
      tags: ['Health'],
      response: {
        200: Type.Object({
          status: Type.Literal('alive'),
          timestamp: Type.String({ format: 'date-time' }),
        }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'alive' as const,
      timestamp: new Date().toISOString(),
    });
  });
}