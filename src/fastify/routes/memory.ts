import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  MemorySchema,
  CreateMemorySchema,
  UpdateMemorySchema,
  SearchMemoryQuerySchema,
  ListMemoryQuerySchema,
  MemoryParamsSchema,
  ErrorResponseSchema,
  type CreateMemory,
  type UpdateMemory,
  type SearchMemoryQuery,
  type ListMemoryQuery,
  type MemoryParams,
} from '../types/schemas.js';

export async function registerMemoryRoutes(fastify: FastifyInstance): Promise<void> {
  // Create memory
  fastify.post<{
    Body: CreateMemory;
  }>('/memories', {
    schema: {
      description: 'Create a new memory',
      tags: ['Memory'],
      body: CreateMemorySchema,
      response: {
        201: MemorySchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateMemory }>, reply: FastifyReply) => {
    try {
      fastify.log.info({ body: request.body }, 'Creating memory');
      
      // TODO: Implement memory creation logic
      // For now, return mock response
      const memory = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        content: request.body.content,
        metadata: request.body.metadata,
        tags: request.body.tags,
        type: request.body.type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return reply.status(201).send(memory);
    } catch (error) {
      fastify.log.error(error, 'Failed to create memory');
      throw fastify.httpErrors.badRequest('Failed to create memory');
    }
  });

  // Search memories
  fastify.get<{
    Querystring: SearchMemoryQuery;
  }>('/memories/search', {
    schema: {
      description: 'Search memories using semantic similarity',
      tags: ['Memory'],
      querystring: SearchMemoryQuerySchema,
      response: {
        200: Type.Object({
          memories: Type.Array(MemorySchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Querystring: SearchMemoryQuery }>, reply: FastifyReply) => {
    try {
      fastify.log.info({ query: request.query }, 'Searching memories');
      
      // TODO: Implement memory search logic
      // For now, return mock response
      return reply.status(200).send({
        memories: [],
        total: 0,
        limit: request.query.limit ?? 10,
        offset: request.query.offset ?? 0,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to search memories');
      throw fastify.httpErrors.badRequest('Search failed');
    }
  });

  // List memories
  fastify.get<{
    Querystring: ListMemoryQuery;
  }>('/memories', {
    schema: {
      description: 'List all memories with optional filtering',
      tags: ['Memory'],
      querystring: ListMemoryQuerySchema,
      response: {
        200: Type.Object({
          memories: Type.Array(MemorySchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Querystring: ListMemoryQuery }>, reply: FastifyReply) => {
    try {
      fastify.log.info({ query: request.query }, 'Listing memories');
      
      // TODO: Implement memory listing logic
      // For now, return mock response
      return reply.status(200).send({
        memories: [],
        total: 0,
        limit: request.query.limit ?? 10,
        offset: request.query.offset ?? 0,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to list memories');
      throw fastify.httpErrors.badRequest('Listing failed');
    }
  });

  // Get memory by ID
  fastify.get<{
    Params: MemoryParams;
  }>('/memories/:id', {
    schema: {
      description: 'Get a specific memory by ID',
      tags: ['Memory'],
      params: MemoryParamsSchema,
      response: {
        200: MemorySchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Params: MemoryParams }>, reply: FastifyReply) => {
    try {
      fastify.log.info({ id: request.params.id }, 'Getting memory by ID');
      
      // TODO: Implement memory retrieval logic
      // For now, return 404
      throw fastify.httpErrors.notFound('Memory not found');
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      fastify.log.error(error, 'Failed to get memory');
      throw fastify.httpErrors.internalServerError('Failed to retrieve memory');
    }
  });

  // Update memory
  fastify.put<{
    Params: MemoryParams;
    Body: UpdateMemory;
  }>('/memories/:id', {
    schema: {
      description: 'Update an existing memory',
      tags: ['Memory'],
      params: MemoryParamsSchema,
      body: UpdateMemorySchema,
      response: {
        200: MemorySchema,
        404: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Params: MemoryParams; Body: UpdateMemory }>, reply: FastifyReply) => {
    try {
      fastify.log.info({ id: request.params.id, body: request.body }, 'Updating memory');
      
      // TODO: Implement memory update logic
      // For now, return 404
      throw fastify.httpErrors.notFound('Memory not found');
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      fastify.log.error(error, 'Failed to update memory');
      throw fastify.httpErrors.badRequest('Failed to update memory');
    }
  });

  // Delete memory
  fastify.delete<{
    Params: MemoryParams;
  }>('/memories/:id', {
    schema: {
      description: 'Delete a memory',
      tags: ['Memory'],
      params: MemoryParamsSchema,
      response: {
        204: Type.Null(),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Params: MemoryParams }>, reply: FastifyReply) => {
    try {
      fastify.log.info({ id: request.params.id }, 'Deleting memory');
      
      // TODO: Implement memory deletion logic
      // For now, return 404
      throw fastify.httpErrors.notFound('Memory not found');
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      fastify.log.error(error, 'Failed to delete memory');
      throw fastify.httpErrors.internalServerError('Failed to delete memory');
    }
  });
}