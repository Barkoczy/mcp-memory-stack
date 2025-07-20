import { eq, desc, and, or, ilike, sql, inArray, gt, lt, gte, lte } from 'drizzle-orm';
import { getDatabase, executeRawQuery } from '../database/connection.js';
import {
  memories,
  memoryLinks,
  auditLog,
  type Memory,
  type NewMemory,
  type MemoryLink,
  type NewMemoryLink,
} from '../database/schema.js';
import { logger } from '../utils/logger.js';
import type { PgColumn } from 'drizzle-orm/pg-core';

// Service interfaces with strict typing
export interface SearchFilters {
  readonly type?: string;
  readonly tags?: readonly string[];
  readonly confidence?: {
    readonly min?: number;
    readonly max?: number;
  };
  readonly dateRange?: {
    readonly from?: Date;
    readonly to?: Date;
  };
  readonly metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'created_at' | 'updated_at' | 'confidence' | 'similarity';
  readonly sortOrder?: 'asc' | 'desc';
  readonly includeLinks?: boolean;
  readonly similarityThreshold?: number;
}

export interface SimilaritySearchOptions extends SearchOptions {
  readonly embedding: readonly number[];
  readonly threshold?: number;
}

export interface SearchResult {
  readonly memory: Memory;
  readonly similarity?: number;
  readonly links?: readonly MemoryLink[];
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly pagination: {
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
  };
}

export interface MemoryStats {
  readonly totalCount: number;
  readonly typeDistribution: Record<string, number>;
  readonly averageConfidence: number;
  readonly recentActivity: {
    readonly day: number;
    readonly week: number;
    readonly month: number;
  };
}

/**
 * Enterprise Memory Service with Drizzle ORM
 * Provides high-performance, type-safe memory operations
 */
export class MemoryService {
  private readonly db = getDatabase();

  /**
   * Create a new memory entry with audit logging
   */
  async createMemory(
    memoryData: NewMemory,
    options: {
      readonly userId?: string;
      readonly apiKeyId?: string;
      readonly metadata?: Record<string, unknown>;
    } = {}
  ): Promise<Memory> {
    const start = Date.now();

    try {
      const [newMemory] = await this.db
        .insert(memories)
        .values({
          ...memoryData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Log audit trail
      await this.logAudit('create', newMemory.id, options);

      const duration = Date.now() - start;
      logger.info('Memory created successfully', {
        memoryId: newMemory.id,
        type: newMemory.type,
        duration,
      });

      return newMemory;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Failed to create memory', {
        error: error instanceof Error ? error.message : error,
        duration,
        type: memoryData.type,
      });
      throw error;
    }
  }

  /**
   * Get memory by ID with optional link inclusion
   */
  async getMemoryById(
    id: string,
    options: { readonly includeLinks?: boolean } = {}
  ): Promise<Memory | null> {
    try {
      const [memory] = await this.db.select().from(memories).where(eq(memories.id, id)).limit(1);

      if (!memory) {
        return null;
      }

      if (options.includeLinks) {
        const links = await this.getMemoryLinks(id);
        return { ...memory, links } as Memory & { links: readonly MemoryLink[] };
      }

      return memory;
    } catch (error) {
      logger.error('Failed to get memory by ID', {
        memoryId: id,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Update memory with change tracking
   */
  async updateMemory(
    id: string,
    updates: Partial<NewMemory>,
    options: {
      readonly userId?: string;
      readonly apiKeyId?: string;
      readonly metadata?: Record<string, unknown>;
    } = {}
  ): Promise<Memory | null> {
    const start = Date.now();

    try {
      // Get original for audit trail
      const original = await this.getMemoryById(id);
      if (!original) {
        return null;
      }

      const [updatedMemory] = await this.db
        .update(memories)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(memories.id, id))
        .returning();

      // Log changes for audit
      await this.logAudit('update', id, options, { original, updated: updates });

      const duration = Date.now() - start;
      logger.info('Memory updated successfully', {
        memoryId: id,
        duration,
        changedFields: Object.keys(updates),
      });

      return updatedMemory;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Failed to update memory', {
        memoryId: id,
        error: error instanceof Error ? error.message : error,
        duration,
      });
      throw error;
    }
  }

  /**
   * Delete memory with cascade handling
   */
  async deleteMemory(
    id: string,
    options: {
      readonly userId?: string;
      readonly apiKeyId?: string;
      readonly metadata?: Record<string, unknown>;
    } = {}
  ): Promise<boolean> {
    const start = Date.now();

    try {
      // Get memory for audit before deletion
      const memory = await this.getMemoryById(id);
      if (!memory) {
        return false;
      }

      // Delete will cascade to memory_links due to foreign key constraints
      const result = await this.db.delete(memories).where(eq(memories.id, id));

      // Log deletion
      await this.logAudit('delete', id, options, { deleted: memory });

      const duration = Date.now() - start;
      logger.info('Memory deleted successfully', {
        memoryId: id,
        duration,
      });

      return result.rowCount > 0;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Failed to delete memory', {
        memoryId: id,
        error: error instanceof Error ? error.message : error,
        duration,
      });
      throw error;
    }
  }

  /**
   * Search memories with advanced filtering
   */
  async searchMemories(
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<PaginatedResult<SearchResult>> {
    const start = Date.now();

    try {
      const {
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeLinks = false,
      } = options;

      // Build dynamic where clause
      const conditions = this.buildSearchConditions(filters);

      // Build order clause
      const orderColumn = this.getOrderColumn(sortBy);
      const orderDirection = sortOrder === 'asc' ? orderColumn : desc(orderColumn);

      // Execute search query
      const searchResults = await this.db
        .select()
        .from(memories)
        .where(and(...conditions))
        .orderBy(orderDirection)
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(memories)
        .where(and(...conditions));

      // Include links if requested
      const resultsWithLinks = await Promise.all(
        searchResults.map(async memory => {
          const result: SearchResult = { memory };

          if (includeLinks) {
            result.links = await this.getMemoryLinks(memory.id);
          }

          return result;
        })
      );

      const duration = Date.now() - start;
      logger.debug('Memory search completed', {
        resultsCount: searchResults.length,
        totalCount: count,
        duration,
        filters: Object.keys(filters),
      });

      return {
        data: resultsWithLinks,
        pagination: {
          total: count,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Memory search failed', {
        error: error instanceof Error ? error.message : error,
        duration,
        filters,
      });
      throw error;
    }
  }

  /**
   * Semantic similarity search using vector embeddings
   */
  async similaritySearch(options: SimilaritySearchOptions): Promise<PaginatedResult<SearchResult>> {
    const start = Date.now();

    try {
      const { embedding, threshold = 0.7, limit = 20, offset = 0, includeLinks = false } = options;

      // Convert embedding array to PostgreSQL vector format
      const embeddingVector = `[${embedding.join(',')}]`;

      // Execute similarity search using cosine distance
      const similarityResults = await executeRawQuery<{
        id: string;
        type: string;
        content: unknown;
        source: string | null;
        embedding: number[];
        tags: string[];
        confidence: number;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
        similarity: number;
      }>(
        `
        SELECT 
          *,
          1 - (embedding <=> $1::vector) AS similarity
        FROM memories 
        WHERE 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3 OFFSET $4
      `,
        [embeddingVector, threshold, limit, offset]
      );

      // Get total count for similar results
      const [countResult] = await executeRawQuery<{ count: number }>(
        `
        SELECT COUNT(*)::int as count
        FROM memories 
        WHERE 1 - (embedding <=> $1::vector) > $2
      `,
        [embeddingVector, threshold]
      );

      // Transform results and include links if requested
      const results = await Promise.all(
        similarityResults.map(async row => {
          const memory: Memory = {
            id: row.id,
            type: row.type,
            content: row.content,
            source: row.source,
            embedding: row.embedding,
            tags: row.tags,
            confidence: row.confidence,
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          };

          const result: SearchResult = {
            memory,
            similarity: row.similarity,
          };

          if (includeLinks) {
            result.links = await this.getMemoryLinks(memory.id);
          }

          return result;
        })
      );

      const duration = Date.now() - start;
      logger.info('Similarity search completed', {
        resultsCount: results.length,
        threshold,
        duration,
        avgSimilarity: results.reduce((sum, r) => sum + (r.similarity || 0), 0) / results.length,
      });

      return {
        data: results,
        pagination: {
          total: countResult?.count || 0,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          totalPages: Math.ceil((countResult?.count || 0) / limit),
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Similarity search failed', {
        error: error instanceof Error ? error.message : error,
        duration,
        threshold,
      });
      throw error;
    }
  }

  /**
   * Get memory statistics for dashboard
   */
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      // Total count
      const [{ totalCount }] = await this.db
        .select({ totalCount: sql<number>`count(*)::int` })
        .from(memories);

      // Type distribution
      const typeStats = await this.db
        .select({
          type: memories.type,
          count: sql<number>`count(*)::int`,
        })
        .from(memories)
        .groupBy(memories.type);

      const typeDistribution = typeStats.reduce(
        (acc, { type, count }) => ({ ...acc, [type]: count }),
        {} as Record<string, number>
      );

      // Average confidence
      const [{ avgConfidence }] = await this.db
        .select({ avgConfidence: sql<number>`avg(confidence)::float` })
        .from(memories);

      // Recent activity counts
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [dayCount] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(memories)
        .where(gte(memories.createdAt, dayAgo));

      const [weekCount] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(memories)
        .where(gte(memories.createdAt, weekAgo));

      const [monthCount] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(memories)
        .where(gte(memories.createdAt, monthAgo));

      return {
        totalCount,
        typeDistribution,
        averageConfidence: avgConfidence || 0,
        recentActivity: {
          day: dayCount?.count || 0,
          week: weekCount?.count || 0,
          month: monthCount?.count || 0,
        },
      };
    } catch (error) {
      logger.error('Failed to get memory statistics', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Create a link between two memories
   */
  async createMemoryLink(linkData: NewMemoryLink): Promise<MemoryLink> {
    try {
      const [newLink] = await this.db
        .insert(memoryLinks)
        .values({
          ...linkData,
          createdAt: new Date(),
        })
        .returning();

      logger.info('Memory link created', {
        linkId: newLink.id,
        sourceId: newLink.sourceId,
        targetId: newLink.targetId,
        relationship: newLink.relationship,
      });

      return newLink;
    } catch (error) {
      logger.error('Failed to create memory link', {
        error: error instanceof Error ? error.message : error,
        sourceId: linkData.sourceId,
        targetId: linkData.targetId,
      });
      throw error;
    }
  }

  /**
   * Get all links for a memory
   */
  private async getMemoryLinks(memoryId: string): Promise<readonly MemoryLink[]> {
    try {
      const links = await this.db
        .select()
        .from(memoryLinks)
        .where(or(eq(memoryLinks.sourceId, memoryId), eq(memoryLinks.targetId, memoryId)));

      return links;
    } catch (error) {
      logger.error('Failed to get memory links', {
        memoryId,
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  /**
   * Build search conditions from filters
   */
  private buildSearchConditions(filters: SearchFilters) {
    const conditions: (
      | typeof eq
      | typeof and
      | typeof or
      | typeof ilike
      | typeof gte
      | typeof lte
    )[] = [];

    if (filters.type) {
      conditions.push(eq(memories.type, filters.type));
    }

    if (filters.tags && filters.tags.length > 0) {
      // Use PostgreSQL array overlap operator
      conditions.push(sql`${memories.tags} && ${filters.tags}`);
    }

    if (filters.confidence) {
      if (filters.confidence.min !== undefined) {
        conditions.push(gte(memories.confidence, filters.confidence.min));
      }
      if (filters.confidence.max !== undefined) {
        conditions.push(lte(memories.confidence, filters.confidence.max));
      }
    }

    if (filters.dateRange) {
      if (filters.dateRange.from) {
        conditions.push(gte(memories.createdAt, filters.dateRange.from));
      }
      if (filters.dateRange.to) {
        conditions.push(lte(memories.createdAt, filters.dateRange.to));
      }
    }

    if (filters.metadata) {
      // JSON containment search
      conditions.push(sql`${memories.metadata} @> ${JSON.stringify(filters.metadata)}`);
    }

    return conditions.length > 0 ? conditions : [sql`true`];
  }

  /**
   * Get order column for sorting
   */
  private getOrderColumn(sortBy: string): PgColumn {
    switch (sortBy) {
      case 'updated_at':
        return memories.updatedAt;
      case 'confidence':
        return memories.confidence;
      case 'created_at':
      default:
        return memories.createdAt;
    }
  }

  /**
   * Log audit trail for enterprise compliance
   */
  private async logAudit(
    action: string,
    entityId: string,
    options: {
      readonly userId?: string;
      readonly apiKeyId?: string;
      readonly metadata?: Record<string, unknown>;
    },
    changes?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        entityType: 'memory',
        entityId,
        action,
        userId: options.userId,
        apiKeyId: options.apiKeyId,
        changes: changes || {},
        metadata: options.metadata || {},
        timestamp: new Date(),
      });
    } catch (error) {
      // Log audit failures but don't throw to avoid breaking main operations
      logger.error('Failed to log audit trail', {
        action,
        entityId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}
