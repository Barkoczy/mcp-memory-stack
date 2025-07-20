#!/usr/bin/env node

// Test database connection directly
import dotenv from 'dotenv';
import { initializeDatabase } from './src/database/connection.js';

dotenv.config();

const testDb = async () => {
  try {
    console.error('Testing database connection...');
    console.error('DATABASE_URL:', process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory');
    
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory';
    
    await initializeDatabase();
    console.error('Database connection successful!');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Stack:', error.stack);
  }
};

testDb();