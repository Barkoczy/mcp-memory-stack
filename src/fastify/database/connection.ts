import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

// Database configuration interface
interface DatabaseConfig {
  connectionString: string;
  poolSize: number;
  idleTimeout: number;
  connectionTimeout: number;
  statementTimeout: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

// Global connection pool
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize database connection with enterprise configuration
 */
export async function initializeDatabase(): Promise<void> {
  const config = getDatabaseConfig();

  try {
    // Create connection pool
    pool = new Pool({
      connectionString: config.connectionString,
      max: config.poolSize,
      idleTimeoutMillis: config.idleTimeout,
      connectionTimeoutMillis: config.connectionTimeout,
      statement_timeout: config.statementTimeout,
      ssl: config.ssl,
      application_name: 'mcp-memory-fastify',
    });

    // Initialize Drizzle with schema
    db = drizzle(pool, {
      schema,
      logger:
        process.env.NODE_ENV === 'development'
          ? {
              logQuery: (query, params) => {
                logger.debug('Database query', {
                  query: query.substring(0, 200),
                  params: params?.slice(0, 5), // Limit params for security
                });
              },
            }
          : false,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    // Initialize schema extensions
    await initializeExtensions();

    logger.info('Database connection established successfully', {
      poolSize: config.poolSize,
      database: getDatabaseName(config.connectionString),
    });
  } catch (error) {
    logger.error('Failed to initialize database', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Initialize PostgreSQL extensions required for vector operations
 */
async function initializeExtensions(): Promise<void> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Enable vector extension for embeddings
    await client.query('CREATE EXTENSION IF NOT EXISTS "vector"');

    // Enable UUID extension for primary keys
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Enable pg_stat_statements for performance monitoring
    await client.query('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"');

    // Enable pg_trgm for text search optimization
    await client.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

    await client.query('COMMIT');

    logger.info('Database extensions initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize database extensions', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get the configured Drizzle database instance
 */
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Get the raw PostgreSQL pool for advanced operations
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Execute a raw SQL query with connection pooling
 */
export async function executeRawQuery<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const currentPool = getPool();
  const start = Date.now();

  try {
    const result = await currentPool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Raw query executed', {
      duration,
      rowCount: result.rowCount,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    });

    return result.rows as T[];
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Raw query failed', {
      duration,
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Get a database client for transactions
 */
export async function getClient() {
  const currentPool = getPool();
  return currentPool.connect();
}

/**
 * Close all database connections gracefully
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    logger.info('Database connections closed successfully');
  }
}

/**
 * Get database configuration based on environment
 */
function getDatabaseConfig(): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    connectionString:
      process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_memory',
    poolSize: isProduction ? 50 : 10,
    idleTimeout: isProduction ? 30000 : 60000,
    connectionTimeout: isProduction ? 5000 : 10000,
    statementTimeout: isProduction ? 30000 : 60000,
    ssl: isProduction ? { rejectUnauthorized: true } : false,
  };
}

/**
 * Extract database name from connection string for logging
 */
function getDatabaseName(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return url.pathname.substring(1); // Remove leading '/'
  } catch {
    return 'unknown';
  }
}

/**
 * Health check for database connectivity
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: {
    connected: boolean;
    poolStats?: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
    latency?: number;
  };
}> {
  try {
    const start = Date.now();

    if (!pool) {
      return {
        status: 'unhealthy',
        details: { connected: false },
      };
    }

    // Test basic connectivity
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    const latency = Date.now() - start;

    return {
      status: 'healthy',
      details: {
        connected: true,
        poolStats: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
        latency,
      },
    };
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : error,
    });

    return {
      status: 'unhealthy',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Performance metrics for monitoring
 */
export async function getDatabaseMetrics(): Promise<{
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  queries?: {
    total: number;
    avgTime: number;
  };
}> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  try {
    // Get connection pool metrics
    const connectionMetrics = {
      total: pool.totalCount,
      active: pool.totalCount - pool.idleCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };

    // Get query statistics if pg_stat_statements is available
    let queryMetrics;
    try {
      const [stats] = await executeRawQuery<{
        calls: string;
        mean_exec_time: string;
      }>(`
        SELECT 
          sum(calls)::text as calls,
          avg(mean_exec_time)::text as mean_exec_time
        FROM pg_stat_statements 
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      `);

      if (stats) {
        queryMetrics = {
          total: parseInt(stats.calls, 10),
          avgTime: parseFloat(stats.mean_exec_time),
        };
      }
    } catch {
      // pg_stat_statements not available or no data
    }

    return {
      connections: connectionMetrics,
      queries: queryMetrics,
    };
  } catch (error) {
    logger.error('Failed to get database metrics', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}
