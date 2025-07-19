#!/usr/bin/env node

// Test script for MCP protocol
import { spawn } from 'child_process';

// Start MCP server process
const mcpProcess = spawn('node', ['src/index.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    MCP_MODE: 'true',
    REST_API_ENABLED: 'false',
    DATABASE_URL: 'postgresql://mcp_dev_user:dev_password_123@localhost:5432/mcp_memory_dev',
    LOG_LEVEL: 'debug',
  },
});

// Handle stdout
mcpProcess.stdout.on('data', data => {
  const response = data.toString().trim();
  if (response) {
    console.log('Response:', response);
    try {
      const parsed = JSON.parse(response);
      console.log('Parsed:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      // Not JSON, just log it
    }
  }
});

// Handle stderr
mcpProcess.stderr.on('data', data => {
  console.error('Error:', data.toString());
});

// Send initialize request
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
    },
  };

  console.log('Sending initialize request...');
  mcpProcess.stdin.write(`${JSON.stringify(initRequest)}\n`);
}, 1000);

// Send tools/list request
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  };

  console.log('\nSending tools/list request...');
  mcpProcess.stdin.write(`${JSON.stringify(toolsRequest)}\n`);
}, 2000);

// Send memory_create tool call
setTimeout(() => {
  const createRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'memory_create',
      arguments: {
        type: 'test',
        content: {
          text: 'Testing MCP protocol',
          timestamp: new Date().toISOString(),
        },
        source: 'mcp-test',
        tags: ['mcp', 'test'],
        confidence: 0.9,
      },
    },
  };

  console.log('\nSending memory_create tool call...');
  mcpProcess.stdin.write(`${JSON.stringify(createRequest)}\n`);
}, 3000);

// Exit after tests
setTimeout(() => {
  console.log('\nTests completed.');
  mcpProcess.kill();
  process.exit(0);
}, 5000);
