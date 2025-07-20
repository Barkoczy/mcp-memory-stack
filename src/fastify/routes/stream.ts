import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListMemoryQuerySchema,
  ErrorResponseSchema,
  type ListMemoryQuery,
} from '../types/schemas.js';

export async function registerStreamRoutes(fastify: FastifyInstance): Promise<void> {
  // Server-Sent Events stream for real-time memory updates
  fastify.get<{
    Querystring: ListMemoryQuery;
  }>(
    '/memories/stream',
    {
      schema: {
        description: 'Stream memories in real-time using Server-Sent Events',
        tags: ['Memory', 'Streaming'],
        querystring: ListMemoryQuerySchema,
        response: {
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListMemoryQuery }>, reply: FastifyReply) => {
      try {
        fastify.log.info({ query: request.query }, 'Starting memory stream');

        // Set SSE headers
        reply.header('Content-Type', 'text/event-stream');
        reply.header('Cache-Control', 'no-cache');
        reply.header('Connection', 'keep-alive');
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Headers', 'Cache-Control');

        // Send initial connection event
        reply.raw.write('event: connected\n');
        reply.raw.write(
          `data: ${JSON.stringify({
            message: 'Stream connected',
            timestamp: new Date().toISOString(),
          })}\n\n`
        );

        // TODO: Implement actual streaming logic
        // For now, send periodic heartbeat
        const heartbeatInterval = setInterval(() => {
          if (reply.raw.destroyed) {
            clearInterval(heartbeatInterval);
            return;
          }

          reply.raw.write('event: heartbeat\n');
          reply.raw.write(
            `data: ${JSON.stringify({
              timestamp: new Date().toISOString(),
            })}\n\n`
          );
        }, 30000); // 30 seconds

        // Handle client disconnect
        request.raw.on('close', () => {
          clearInterval(heartbeatInterval);
          fastify.log.info('Memory stream client disconnected');
        });

        request.raw.on('error', error => {
          clearInterval(heartbeatInterval);
          fastify.log.error(error, 'Memory stream error');
        });

        // Keep connection alive
        return reply.raw;
      } catch (error) {
        fastify.log.error(error, 'Failed to start memory stream');
        throw fastify.httpErrors.internalServerError('Stream initialization failed');
      }
    }
  );

  // WebSocket stream for real-time bidirectional communication
  fastify.register(async function (fastify) {
    // Note: For WebSocket support, we would need @fastify/websocket
    // For now, we'll use a placeholder route that suggests WebSocket capability

    fastify.get(
      '/memories/ws',
      {
        schema: {
          description: 'WebSocket endpoint for real-time bidirectional memory operations',
          tags: ['Memory', 'WebSocket'],
          response: {
            426: Type.Object({
              error: Type.String(),
              message: Type.String(),
              upgrade: Type.String(),
            }),
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.status(426).send({
          error: 'Upgrade Required',
          message: 'This endpoint requires WebSocket connection',
          upgrade: 'websocket',
        });
      }
    );
  });

  // Bulk stream export
  fastify.get<{
    Querystring: ListMemoryQuery & {
      format?: 'json' | 'jsonl' | 'csv';
    };
  }>(
    '/memories/export',
    {
      schema: {
        description: 'Export memories in bulk as a downloadable stream',
        tags: ['Memory', 'Export'],
        querystring: Type.Intersect([
          ListMemoryQuerySchema,
          Type.Object({
            format: Type.Optional(
              Type.Union([Type.Literal('json'), Type.Literal('jsonl'), Type.Literal('csv')], {
                default: 'json',
              })
            ),
          }),
        ]),
        response: {
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply: FastifyReply) => {
      try {
        const format = request.query.format ?? 'json';
        fastify.log.info({ query: request.query, format }, 'Starting bulk export');

        // Set appropriate headers for download
        reply.header('Content-Disposition', `attachment; filename="memories.${format}"`);

        switch (format) {
          case 'json':
            reply.header('Content-Type', 'application/json');
            break;
          case 'jsonl':
            reply.header('Content-Type', 'application/x-ndjson');
            break;
          case 'csv':
            reply.header('Content-Type', 'text/csv');
            break;
        }

        // TODO: Implement actual export logic
        // For now, return empty export
        if (format === 'json') {
          reply.raw.write('{"memories": []}');
        } else if (format === 'csv') {
          reply.raw.write('id,content,created_at,updated_at\n');
        }

        reply.raw.end();
        return reply.raw;
      } catch (error) {
        fastify.log.error(error, 'Bulk export failed');
        throw fastify.httpErrors.internalServerError('Export failed');
      }
    }
  );
}
