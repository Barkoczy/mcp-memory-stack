import { EventEmitter } from 'events';
import type { QueryResult, PoolClient } from 'pg';

import { query, getClient } from '../database/connection.js';
import { CacheService } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import type { EnvironmentConfig } from '../config.js';

import { EmbeddingService } from './embedding.js';

interface MemoryCreateParams {
  type: string;
  content: any;
  source?: string;
  tags?: string[];
  confidence?: number;
  metadata?: Record<string, any>;
}

interface MemorySearchParams {
  query: string;
  type?: string;
  tags?: string[];
  limit?: number;
  threshold?: number;
  includeContent?: boolean;
}

interface MemoryListParams {
  type?: string;
  tags?: string[];
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

interface MemoryUpdateParams {
  content?: any;
  tags?: string[];
  confidence?: number;
  metadata?: Record<string, any>;
}

interface Memory {
  id: string;
  type: string;
  content: any;
  source?: string;
  tags: string[];
  confidence: number;
  metadata: Record<string, any>;
  similarity?: number;
  created_at: Date;
  updated_at: Date;
}

interface MemoryRow {
  id: string;
  type: string;
  content: any;
  source?: string;
  tags: string[];
  confidence: number;
  metadata: Record<string, any>;
  similarity?: number;
  created_at: Date;
  updated_at: Date;
}

interface SearchResponse {
  memories: Memory[];
  query: string;
  total: number;
}

interface ListResponse {
  memories: Memory[];
  total: number;
  limit: number;
  offset: number;
}

interface BatchOperation {
  operation: 'create' | 'update' | 'delete';
  id?: string;
  data?: MemoryCreateParams | MemoryUpdateParams;
}

interface BatchResult {
  success: boolean;
  operation: string;
  result?: Memory | boolean;
  id?: string;
  error?: string;
}

interface QueryData {
  query: string;
  params: any[];
}

interface UpdateData {
  fields: string[];
  values: any[];
  paramIndex: number;
}

interface FilterCriteria {
  type?: string;
  tags?: string[];
}

export class MemoryService extends EventEmitter {
  private config: EnvironmentConfig;
  private embeddingService: EmbeddingService;
  private cache: CacheService;

  constructor(config: EnvironmentConfig) {
    super();
    this.config = config;
    this.embeddingService = new EmbeddingService(config.embedding);
    this.cache = new CacheService(config.cache);
  }

  async create(params: MemoryCreateParams): Promise<Memory> {
    const { type, content, source, tags = [], confidence = 0.5, metadata = {} } = params;

    // Validate inputs
    if (!type || !content) {
      throw new Error('Type and content are required');
    }

    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    // Generate embedding
    const text = this.contentToText(content);
    const embedding = await this.embeddingService.generateEmbedding(text);

    // Insert into database
    // Format embedding as PostgreSQL vector
    const vectorString = `[${embedding.join(',')}]`;

    const result: QueryResult<MemoryRow> = await query(
      `
      INSERT INTO memories (type, content, source, embedding, tags, confidence, metadata)
      VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
      RETURNING *
    `,
      [type, JSON.stringify(content), source, vectorString, tags, confidence, metadata]
    );

    const memory = result.rows[0];

    // Emit event for streaming
    this.emit('created', memory);

    // Clear relevant caches
    await this.cache.invalidatePattern('list:*');

    logger.info('Memory created', { id: memory.id, type });

    return this.formatMemory(memory);
  }

  async search(params: MemorySearchParams): Promise<SearchResponse> {
    const {
      query: searchQuery,
      type,
      tags,
      limit = 10,
      threshold = 0.7,
      includeContent = true,
    } = params;

    if (!searchQuery) {
      throw new Error('Query is required');
    }

    // Check cache
    const cacheKey = `search:${JSON.stringify(params)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as SearchResponse;
    }

    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery);
    const queryVectorString = `[${queryEmbedding.join(',')}]`;

    // Build query
    let sqlQuery = `
      SELECT 
        id, type, source, tags, confidence, metadata, created_at, updated_at,
        ${includeContent ? 'content,' : ''}
        1 - (embedding <=> $1::vector) as similarity
      FROM memories
      WHERE 1=1
    `;

    const queryParams: any[] = [queryVectorString];
    let paramIndex = 2;

    if (type) {
      sqlQuery += ` AND type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      sqlQuery += ` AND tags && $${paramIndex}::varchar[]`;
      queryParams.push(tags);
      paramIndex++;
    }

    sqlQuery += `
      AND 1 - (embedding <=> $1::vector) >= $${paramIndex}
      ORDER BY similarity DESC
      LIMIT $${paramIndex + 1}
    `;

    queryParams.push(threshold, limit);

    const result: QueryResult<MemoryRow> = await query(sqlQuery, queryParams);

    const memories = result.rows.map(row => this.formatMemory(row));

    // Format search response
    const response: SearchResponse = {
      memories,
      query: searchQuery,
      total: memories.length,
    };

    // Cache results
    await this.cache.set(cacheKey, response, 300); // 5 minutes

    logger.debug('Search completed', {
      query: searchQuery.substring(0, 50),
      results: memories.length,
    });

    return response;
  }

  list(params: MemoryListParams = {}): Promise<ListResponse> {
    return this.listMemories(params);
  }

  async listMemories(params: MemoryListParams): Promise<ListResponse> {
    const cacheKey = `list:${JSON.stringify(params)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as ListResponse;
    }

    const queryData = this.buildListQuery(params);
    const result: QueryResult<MemoryRow> = await query(queryData.query, queryData.params);
    const countData = this.buildCountQuery(params);
    const countResult: QueryResult<{ count: string }> = await query(
      countData.query,
      countData.params
    );

    const total = parseInt(countResult.rows[0].count);
    const response = this.formatListResponse(result.rows, params, total);

    await this.cache.set(cacheKey, response, 60);
    return response;
  }

  buildListQuery(params: MemoryListParams): QueryData {
    const {
      type,
      tags,
      since,
      until,
      limit = 20,
      offset = 0,
      orderBy = 'created_at',
      order = 'DESC',
    } = params;

    let sqlQuery = 'SELECT * FROM memories WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (type) {
      sqlQuery += ` AND type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      sqlQuery += ` AND tags && $${paramIndex}::varchar[]`;
      queryParams.push(tags);
      paramIndex++;
    }

    if (since) {
      sqlQuery += ` AND created_at >= $${paramIndex}`;
      queryParams.push(since);
      paramIndex++;
    }

    if (until) {
      sqlQuery += ` AND created_at <= $${paramIndex}`;
      queryParams.push(until);
      paramIndex++;
    }

    this.validateOrderBy(orderBy);
    sqlQuery += ` ORDER BY ${orderBy} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    return { query: sqlQuery, params: queryParams };
  }

  buildCountQuery(params: MemoryListParams): QueryData {
    const { type, tags } = params;
    let countQuery = 'SELECT COUNT(*) FROM memories WHERE 1=1';
    const countParams: any[] = [];

    if (type) {
      countQuery += ' AND type = $1';
      countParams.push(type);
    }
    if (tags && tags.length > 0) {
      countQuery += ` AND tags && $${countParams.length + 1}::varchar[]`;
      countParams.push(tags);
    }

    return { query: countQuery, params: countParams };
  }

  formatListResponse(rows: MemoryRow[], params: MemoryListParams, total: number): ListResponse {
    const { limit = 20, offset = 0 } = params;
    return {
      memories: rows.map(row => this.formatMemory(row)),
      total,
      limit,
      offset,
    };
  }

  validateOrderBy(orderBy: string): void {
    const validOrderColumns = ['created_at', 'updated_at', 'confidence', 'type'];
    if (!validOrderColumns.includes(orderBy)) {
      throw new Error('Invalid orderBy column');
    }
  }

  async getById(id: string): Promise<Memory | null> {
    const result: QueryResult<MemoryRow> = await query('SELECT * FROM memories WHERE id = $1', [
      id,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatMemory(result.rows[0]);
  }

  async update(id: string, updates: MemoryUpdateParams): Promise<Memory | null> {
    const memory = await this.getById(id);
    if (!memory) {
      return null;
    }

    const updateData = await this.buildUpdateData(updates);
    if (updateData.fields.length === 0) {
      return memory;
    }

    const result = await this.executeUpdate(id, updateData);
    await this.cache.invalidatePattern('*');

    return this.formatMemory(result.rows[0]);
  }

  async buildUpdateData(updates: MemoryUpdateParams): Promise<UpdateData> {
    const { content, tags, confidence, metadata } = updates;
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      paramIndex = await this.addContentUpdate(updateFields, updateValues, paramIndex, content);
    }

    if (tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      updateValues.push(tags);
      paramIndex++;
    }

    if (confidence !== undefined) {
      this.validateConfidence(confidence);
      updateFields.push(`confidence = $${paramIndex}`);
      updateValues.push(confidence);
      paramIndex++;
    }

    if (metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      updateValues.push(metadata);
      paramIndex++;
    }

    return { fields: updateFields, values: updateValues, paramIndex };
  }

  async addContentUpdate(
    updateFields: string[],
    updateValues: any[],
    paramIndex: number,
    content: any
  ): Promise<number> {
    updateFields.push(`content = $${paramIndex}`);
    updateValues.push(JSON.stringify(content));
    paramIndex++;

    const text = this.contentToText(content);
    const embedding = await this.embeddingService.generateEmbedding(text);
    const vectorString = `[${embedding.join(',')}]`;
    updateFields.push(`embedding = $${paramIndex}::vector`);
    updateValues.push(vectorString);
    paramIndex++;

    return paramIndex;
  }

  validateConfidence(confidence: number): void {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  executeUpdate(id: string, updateData: UpdateData): Promise<QueryResult<MemoryRow>> {
    updateData.values.push(id);
    const sqlQuery = `
      UPDATE memories 
      SET ${updateData.fields.join(', ')}
      WHERE id = $${updateData.paramIndex}
      RETURNING *
    `;

    return query(sqlQuery, updateData.values);
  }

  async delete(id: string): Promise<boolean> {
    const result: QueryResult<{ id: string }> = await query(
      'DELETE FROM memories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return false;
    }

    // Clear caches
    await this.cache.invalidatePattern('*');

    return true;
  }

  async batch(operations: BatchOperation[]): Promise<BatchResult[]> {
    const client: PoolClient = await getClient();
    const results: BatchResult[] = [];

    try {
      await client.query('BEGIN');

      for (const op of operations) {
        try {
          let result: Memory | boolean | null;

          switch (op.operation) {
            case 'create':
              if (!op.data) {
                throw new Error('Data required for create operation');
              }
              result = await this.create(op.data as MemoryCreateParams);
              results.push({ success: true, operation: 'create', result });
              break;

            case 'update':
              if (!op.id || !op.data) {
                throw new Error('ID and data required for update operation');
              }
              result = await this.update(op.id, op.data as MemoryUpdateParams);
              results.push({
                success: result !== null,
                operation: 'update',
                result,
              });
              break;

            case 'delete':
              if (!op.id) {
                throw new Error('ID required for delete operation');
              }
              result = await this.delete(op.id);
              results.push({
                success: result,
                operation: 'delete',
                id: op.id,
              });
              break;

            default:
              results.push({
                success: false,
                operation: op.operation,
                error: 'Unknown operation',
              });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            success: false,
            operation: op.operation,
            error: errorMessage,
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return results;
  }

  createStream(filter: FilterCriteria = {}): EventEmitter {
    const stream = new EventEmitter();

    // Subscribe to memory events
    this.on('created', (memory: Memory) => {
      if (this.matchesFilter(memory, filter)) {
        stream.emit('data', memory);
      }
    });

    return stream;
  }

  async checkReady(): Promise<boolean> {
    // Check database connection
    await query('SELECT 1');

    // Check embedding service
    await this.embeddingService.checkReady();

    return true;
  }

  // Helper methods

  contentToText(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    return JSON.stringify(content);
  }

  formatMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      source: row.source,
      tags: row.tags || [],
      confidence: row.confidence,
      metadata: row.metadata || {},
      similarity: row.similarity,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  matchesFilter(memory: Memory, filter: FilterCriteria): boolean {
    if (filter.type && memory.type !== filter.type) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const hasTags = filter.tags.some(tag => memory.tags.includes(tag));
      if (!hasTags) return false;
    }

    return true;
  }
}
