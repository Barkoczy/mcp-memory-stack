import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/fastify/database/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_memory',
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  introspect: {
    casing: 'camel',
  },
});