import { EventEmitter } from 'events';
import { query, getClient } from '../database/connection.js';
import { CacheService } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import { EmbeddingService } from './embedding.js';

export class MemoryService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.embeddingService = new EmbeddingService(config.embedding);
    this.cache = new CacheService(config.cache);
  }

  async create(params) {
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

    const result = await query(
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

  async search(params) {
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
      return cached;
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

    const queryParams = [queryVectorString];
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

    const result = await query(sqlQuery, queryParams);

    const memories = result.rows.map(row => this.formatMemory(row));

    // Cache results
    await this.cache.set(cacheKey, memories, 300); // 5 minutes

    logger.debug('Search completed', {
      query: searchQuery.substring(0, 50),
      results: memories.length,
    });

    return memories;
  }

  list(params = {}) {
    return this.listMemories(params);
  }

  async listMemories(params) {
    const cacheKey = `list:${JSON.stringify(params)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryData = this.buildListQuery(params);
    const result = await query(queryData.query, queryData.params);
    const countData = this.buildCountQuery(params);
    const countResult = await query(countData.query, countData.params);

    const total = parseInt(countResult.rows[0].count);
    const response = this.formatListResponse(result.rows, params, total);

    await this.cache.set(cacheKey, response, 60);
    return response;
  }

  buildListQuery(params) {
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
    const queryParams = [];
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

  buildCountQuery(params) {
    const { type, tags } = params;
    let countQuery = 'SELECT COUNT(*) FROM memories WHERE 1=1';
    const countParams = [];

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

  formatListResponse(rows, params, total) {
    const { limit = 20, offset = 0 } = params;
    return {
      memories: rows.map(row => this.formatMemory(row)),
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) },
    };
  }

  validateOrderBy(orderBy) {
    const validOrderColumns = ['created_at', 'updated_at', 'confidence', 'type'];
    if (!validOrderColumns.includes(orderBy)) {
      throw new Error('Invalid orderBy column');
    }
  }

  async getById(id) {
    const result = await query('SELECT * FROM memories WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatMemory(result.rows[0]);
  }

  async update(id, updates) {
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

  async buildUpdateData(updates) {
    const { content, tags, confidence, metadata } = updates;
    const updateFields = [];
    const updateValues = [];
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

  async addContentUpdate(updateFields, updateValues, paramIndex, content) {
    updateFields.push(`content = $${paramIndex}`);
    updateValues.push(JSON.stringify(content));
    paramIndex++;

    const text = this.contentToText(content);
    const embedding = await this.embeddingService.generateEmbedding(text);
    updateFields.push(`embedding = $${paramIndex}`);
    updateValues.push(embedding);
    paramIndex++;

    return paramIndex;
  }

  validateConfidence(confidence) {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  executeUpdate(id, updateData) {
    updateData.values.push(id);
    const sqlQuery = `
      UPDATE memories 
      SET ${updateData.fields.join(', ')}
      WHERE id = $${updateData.paramIndex}
      RETURNING *
    `;

    return query(sqlQuery, updateData.values);
  }

  async delete(id) {
    const result = await query('DELETE FROM memories WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return false;
    }

    // Clear caches
    await this.cache.invalidatePattern('*');

    return true;
  }

  async batch(operations) {
    const client = await getClient();
    const results = [];

    try {
      await client.query('BEGIN');

      for (const op of operations) {
        try {
          let result;

          switch (op.operation) {
            case 'create':
              result = await this.create(op.data);
              results.push({ success: true, operation: 'create', result });
              break;

            case 'update':
              result = await this.update(op.id, op.data);
              results.push({
                success: result !== null,
                operation: 'update',
                result,
              });
              break;

            case 'delete':
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
          results.push({
            success: false,
            operation: op.operation,
            error: error.message,
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

  createStream(filter = {}) {
    const stream = new EventEmitter();

    // Subscribe to memory events
    this.on('created', memory => {
      if (this.matchesFilter(memory, filter)) {
        stream.emit('data', memory);
      }
    });

    return stream;
  }

  async checkReady() {
    // Check database connection
    await query('SELECT 1');

    // Check embedding service
    await this.embeddingService.checkReady();

    return true;
  }

  // Helper methods

  contentToText(content) {
    if (typeof content === 'string') {
      return content;
    }
    return JSON.stringify(content);
  }

  formatMemory(row) {
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

  matchesFilter(memory, filter) {
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
