#!/usr/bin/env node

// Debug script to test MCP server startup directly
import { spawn } from 'child_process';

console.log('Starting MCP server debug...');

const mcpProcess = spawn('node', ['src/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    MCP_MODE: 'stdio',
    REST_API_ENABLED: 'false',
    LOG_LEVEL: 'debug',
    DATABASE_URL: 'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory',
  },
});

console.log('Process spawned with PID:', mcpProcess.pid);

// Capture all stdout
mcpProcess.stdout.on('data', data => {
  console.log('STDOUT:', data.toString());
});

// Capture all stderr
mcpProcess.stderr.on('data', data => {
  console.log('STDERR:', data.toString());
});

// Handle process events
mcpProcess.on('error', error => {
  console.log('Process error:', error);
});

mcpProcess.on('exit', (code, signal) => {
  console.log('Process exited with code:', code, 'signal:', signal);
});

// Wait 5 seconds then send initialize request
setTimeout(() => {
  console.log('Sending initialize request...');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: true },
      clientInfo: { name: 'debug-client', version: '1.0.0' }
    }
  };
  
  try {
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    console.log('Request sent to stdin');
  } catch (error) {
    console.log('Error writing to stdin:', error);
  }
}, 5000);

// Kill process after 10 seconds
setTimeout(() => {
  console.log('Terminating process...');
  mcpProcess.kill('SIGTERM');
}, 10000);