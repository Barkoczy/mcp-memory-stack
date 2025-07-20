// Jest setup file to load test environment variables
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import dotenv from 'dotenv';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({
  path: resolve(__dirname, '../.env.test'),
  override: true,
});

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

// Set a fallback DATABASE_URL if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory_test';
}
