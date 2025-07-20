import pg from 'pg';
import type { Pool, PoolClient, QueryResult } from 'pg';

import { logger } from '../utils/logger.js';
import type { EnvironmentConfig } from '../config.js';

const { Pool: PostgresPool } = pg;

let pool: Pool | null = null;

export async function initializeDatabase(): Promise<void> {
  const config = await getConfig();

  try {
    pool = new PostgresPool({
      connectionString: config.db.connectionString,
      max: config.db.poolSize,
      idleTimeoutMillis: config.db.idleTimeout,
      connectionTimeoutMillis: config.db.connectionTimeout,
      statement_timeout: config.db.statementTimeout,
      ssl: config.db.ssl,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    // Initialize schema
    await initializeSchema();

    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

async function initializeSchema(): Promise<void> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Enable extensions
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "vector";
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create memories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(255) NOT NULL,
        content JSONB NOT NULL,
        source VARCHAR(255),
        embedding vector(${getEmbeddingDimension()}),
        tags VARCHAR(255)[],
        confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_content ON memories USING GIN(content);
    `);

    // Create vector index for similarity search
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_embedding 
      ON memories USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);

    // Create update trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
      CREATE TRIGGER update_memories_updated_at
      BEFORE UPDATE ON memories
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
    `);

    // Create memory relationships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        target_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        relationship VARCHAR(50) NOT NULL,
        strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_id, target_id, relationship)
      );
      
      CREATE INDEX IF NOT EXISTS idx_memory_links_source ON memory_links(source_id);
      CREATE INDEX IF NOT EXISTS idx_memory_links_target ON memory_links(target_id);
    `);

    await client.query('COMMIT');
    logger.info('Database schema initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const poolInstance = getPool();
  const start = Date.now();

  try {
    const result = await poolInstance.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100),
      duration,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Query failed', { query: text, error: errorMessage });
    throw error;
  }
}

export function getClient(): Promise<PoolClient> {
  const poolInstance = getPool();
  return poolInstance.connect();
}

async function getConfig(): Promise<EnvironmentConfig> {
  // Import config dynamically to avoid circular dependency
  const { config } = await import('../config.js');
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return config[mode];
}

function getEmbeddingDimension(): number {
  const model = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
  // Map models to their dimensions
  const dimensions: Record<string, number> = {
    'Xenova/all-MiniLM-L6-v2': 384,
    'sentence-transformers/all-mpnet-base-v2': 768,
    'sentence-transformers/all-MiniLM-L12-v2': 384,
  };
  return dimensions[model] || 384;
}
