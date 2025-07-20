interface ServerConfig {
  name: string;
  version: string;
  description: string;
}

interface DatabaseConfig {
  connectionString: string | undefined;
  poolSize: number;
  idleTimeout: number;
  connectionTimeout: number;
  statementTimeout: number;
  ssl: boolean | { rejectUnauthorized: boolean };
}

interface CacheConfig {
  enabled: boolean;
  redis: string | null | undefined;
  ttl: number;
  maxSize: number;
}

interface EmbeddingConfig {
  model: string;
  dimension: number;
  batchSize: number;
  cache: boolean;
}

interface ApiConfig {
  rateLimit: number | boolean;
  compression: boolean;
  cors: boolean;
  maxRequestSize: string;
  timeout: number;
  port?: number;
}

interface SecurityConfig {
  apiKey: boolean;
  jwt: boolean;
  encryption: boolean;
}

interface MonitoringConfig {
  metrics: boolean;
  healthCheck: boolean;
  logging: string;
}

interface EnvironmentConfig {
  server: ServerConfig;
  db: DatabaseConfig;
  cache: CacheConfig;
  embedding: EmbeddingConfig;
  api: ApiConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

interface Config {
  production: EnvironmentConfig;
  development: EnvironmentConfig;
}

export const config: Config = {
  production: {
    server: {
      name: 'mcp-memory',
      version: '2.0.0',
      description: 'High-performance MCP Memory Server with semantic search',
    },
    db: {
      connectionString: process.env.DATABASE_URL,
      poolSize: 50,
      idleTimeout: 30000,
      connectionTimeout: 5000,
      statementTimeout: 30000,
      ssl: { rejectUnauthorized: true },
    },
    cache: {
      enabled: true,
      redis: process.env.REDIS_URL,
      ttl: 3600,
      maxSize: 10000,
    },
    embedding: {
      model: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-mpnet-base-v2',
      dimension: 768,
      batchSize: 64,
      cache: true,
    },
    api: {
      rateLimit: 100,
      compression: true,
      cors: false,
      maxRequestSize: '10mb',
      timeout: 30000,
    },
    security: {
      apiKey: process.env.API_KEY_REQUIRED === 'true',
      jwt: process.env.JWT_ENABLED === 'true',
      encryption: true,
    },
    monitoring: {
      metrics: true,
      healthCheck: true,
      logging: 'info',
    },
  },

  development: {
    server: {
      name: 'mcp-memory-dev',
      version: '2.0.0-dev',
      description: 'MCP Memory Server (Development)',
    },
    db: {
      connectionString:
        process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_memory',
      poolSize: 10,
      idleTimeout: 60000,
      connectionTimeout: 10000,
      statementTimeout: 60000,
      ssl: false,
    },
    cache: {
      enabled: false,
      redis: null,
      ttl: 60,
      maxSize: 1000,
    },
    embedding: {
      model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
      dimension: 384,
      batchSize: 16,
      cache: false,
    },
    api: {
      rateLimit: false,
      compression: false,
      cors: true,
      maxRequestSize: '50mb',
      timeout: 60000,
    },
    security: {
      apiKey: false,
      jwt: false,
      encryption: false,
    },
    monitoring: {
      metrics: false,
      healthCheck: true,
      logging: 'debug',
    },
  },
};

export type {
  Config,
  EnvironmentConfig,
  ServerConfig,
  DatabaseConfig,
  CacheConfig,
  EmbeddingConfig,
  ApiConfig,
  SecurityConfig,
  MonitoringConfig,
};
