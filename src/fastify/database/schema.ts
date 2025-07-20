import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  vector,
  timestamp,
  text,
  real,
  index,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Main memories table with vector embeddings
export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 255 }).notNull(),
    content: jsonb('content').notNull(),
    source: varchar('source', { length: 255 }),
    embedding: vector('embedding', { dimensions: 384 }), // Xenova/all-MiniLM-L6-v2 dimensions
    tags: jsonb('tags').$type<string[]>().default([]),
    confidence: real('confidence').default(0.5).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    typeIdx: index('idx_memories_type').on(table.type),
    tagsIdx: index('idx_memories_tags').using('gin', table.tags),
    createdAtIdx: index('idx_memories_created_at').on(table.createdAt.desc()),
    contentIdx: index('idx_memories_content').using('gin', table.content),
    embeddingIdx: index('idx_memories_embedding').using(
      'ivfflat',
      table.embedding.op('vector_cosine_ops')
    ),
  })
);

// Memory relationships/links table for graph structure
export const memoryLinks = pgTable(
  'memory_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    relationship: varchar('relationship', { length: 50 }).notNull(),
    strength: real('strength').default(0.5).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    sourceIdx: index('idx_memory_links_source').on(table.sourceId),
    targetIdx: index('idx_memory_links_target').on(table.targetId),
    uniqueRelation: unique('unique_source_target_relationship').on(
      table.sourceId,
      table.targetId,
      table.relationship
    ),
  })
);

// User sessions for authentication tracking
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    sessionToken: text('session_token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastAccessAt: timestamp('last_access_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    sessionTokenIdx: index('idx_user_sessions_token').on(table.sessionToken),
    userIdIdx: index('idx_user_sessions_user_id').on(table.userId),
    expiresAtIdx: index('idx_user_sessions_expires_at').on(table.expiresAt),
  })
);

// API keys management
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: text('key_hash').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    permissions: jsonb('permissions').$type<string[]>().default([]),
    rateLimit: jsonb('rate_limit')
      .$type<{
        requests: number;
        window: number; // seconds
      }>()
      .default({ requests: 1000, window: 3600 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    isActive: jsonb('is_active').$type<boolean>().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    keyHashIdx: index('idx_api_keys_hash').on(table.keyHash),
    userIdIdx: index('idx_api_keys_user_id').on(table.userId),
    nameIdx: index('idx_api_keys_name').on(table.name),
    activeIdx: index('idx_api_keys_active').on(table.isActive),
  })
);

// Audit log for enterprise compliance
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
    changes: jsonb('changes').$type<Record<string, unknown>>().default({}),
    metadata: jsonb('metadata')
      .$type<{
        ip?: string;
        userAgent?: string;
        requestId?: string;
        sessionId?: string;
      }>()
      .default({}),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    entityTypeIdx: index('idx_audit_log_entity_type').on(table.entityType),
    entityIdIdx: index('idx_audit_log_entity_id').on(table.entityId),
    actionIdx: index('idx_audit_log_action').on(table.action),
    userIdIdx: index('idx_audit_log_user_id').on(table.userId),
    timestampIdx: index('idx_audit_log_timestamp').on(table.timestamp.desc()),
  })
);

// Performance metrics storage
export const performanceMetrics = pgTable(
  'performance_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    metricName: varchar('metric_name', { length: 100 }).notNull(),
    metricType: varchar('metric_type', { length: 50 }).notNull(), // counter, gauge, histogram
    value: real('value').notNull(),
    labels: jsonb('labels').$type<Record<string, string>>().default({}),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    metricNameIdx: index('idx_performance_metrics_name').on(table.metricName),
    timestampIdx: index('idx_performance_metrics_timestamp').on(table.timestamp.desc()),
    metricTypeIdx: index('idx_performance_metrics_type').on(table.metricType),
  })
);

// Define relationships
export const memoriesRelations = relations(memories, ({ many }) => ({
  sourceLinks: many(memoryLinks, { relationName: 'source' }),
  targetLinks: many(memoryLinks, { relationName: 'target' }),
}));

export const memoryLinksRelations = relations(memoryLinks, ({ one }) => ({
  source: one(memories, {
    fields: [memoryLinks.sourceId],
    references: [memories.id],
    relationName: 'source',
  }),
  target: one(memories, {
    fields: [memoryLinks.targetId],
    references: [memories.id],
    relationName: 'target',
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ many }) => ({
  auditLogs: many(auditLog),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [auditLog.apiKeyId],
    references: [apiKeys.id],
  }),
}));

// Type exports for strict TypeScript
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type MemoryLink = typeof memoryLinks.$inferSelect;
export type NewMemoryLink = typeof memoryLinks.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;

// Schema exports for migration
export const schema = {
  memories,
  memoryLinks,
  userSessions,
  apiKeys,
  auditLog,
  performanceMetrics,
  memoriesRelations,
  memoryLinksRelations,
  apiKeysRelations,
  auditLogRelations,
};
