import { Type, Static } from '@sinclair/typebox';

export const MemorySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  content: Type.String({ minLength: 1 }),
  embedding: Type.Optional(Type.Array(Type.Number())),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  tags: Type.Optional(Type.Array(Type.String())),
  type: Type.Optional(Type.String()),
  created_at: Type.String({ format: 'date-time' }),
  updated_at: Type.String({ format: 'date-time' }),
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
});

export const CreateMemorySchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 10000 }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }), { maxItems: 20 })),
  type: Type.Optional(Type.String({ maxLength: 100 })),
});

export const UpdateMemorySchema = Type.Object({
  content: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }), { maxItems: 20 })),
  type: Type.Optional(Type.String({ maxLength: 100 })),
});

export const SearchMemoryQuerySchema = Type.Object({
  query: Type.Optional(Type.String({ minLength: 1 })),
  type: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  threshold: Type.Optional(Type.Number({ minimum: 0, maximum: 1, default: 0.7 })),
  created_after: Type.Optional(Type.String({ format: 'date-time' })),
  created_before: Type.Optional(Type.String({ format: 'date-time' })),
});

export const ListMemoryQuerySchema = Type.Object({
  type: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  created_after: Type.Optional(Type.String({ format: 'date-time' })),
  created_before: Type.Optional(Type.String({ format: 'date-time' })),
});

export const BatchMemorySchema = Type.Object({
  operation: Type.Union([Type.Literal('create'), Type.Literal('update'), Type.Literal('delete')]),
  memories: Type.Array(Type.Unknown(), { minItems: 1, maxItems: 100 }),
});

export const HealthStatusSchema = Type.Object({
  status: Type.Union([Type.Literal('healthy'), Type.Literal('unhealthy')]),
  version: Type.String(),
  timestamp: Type.String({ format: 'date-time' }),
  uptime: Type.Number({ minimum: 0 }),
  checks: Type.Optional(
    Type.Record(Type.String(), Type.Union([Type.Literal('healthy'), Type.Literal('unhealthy')]))
  ),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const MemoryParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

// Type inference
export type Memory = Static<typeof MemorySchema>;
export type CreateMemory = Static<typeof CreateMemorySchema>;
export type UpdateMemory = Static<typeof UpdateMemorySchema>;
export type SearchMemoryQuery = Static<typeof SearchMemoryQuerySchema>;
export type ListMemoryQuery = Static<typeof ListMemoryQuerySchema>;
export type BatchMemory = Static<typeof BatchMemorySchema>;
export type HealthStatus = Static<typeof HealthStatusSchema>;
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
export type MemoryParams = Static<typeof MemoryParamsSchema>;
