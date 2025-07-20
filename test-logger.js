#!/usr/bin/env node

// Test logger directly
process.env.LOG_LEVEL = 'debug';
process.env.NODE_ENV = 'test';
process.env.MCP_MODE = 'stdio';

import { logger } from './src/utils/logger.js';

console.error('Testing logger...');
console.error('LOG_LEVEL:', process.env.LOG_LEVEL);
console.error('NODE_ENV:', process.env.NODE_ENV);

logger.info('Test info message');
logger.error('Test error message');
logger.debug('Test debug message');

console.error('Direct console.error works');
console.log('Direct console.log works');