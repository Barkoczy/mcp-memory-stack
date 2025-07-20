#!/usr/bin/env node

// Test stdio mode server directly
import { spawn } from 'child_process';

console.log('Testing stdio mode server...');

const serverProcess = spawn('node', ['src/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    MCP_MODE: 'stdio',
    LOG_LEVEL: 'debug',
    DATABASE_URL: 'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory',
  },
});

console.log('Server process started with PID:', serverProcess.pid);

// Capture all output
serverProcess.stdout.on('data', data => {
  console.log('=== STDOUT ===');
  console.log(data.toString());
  console.log('=== END STDOUT ===');
});

serverProcess.stderr.on('data', data => {
  console.log('=== STDERR ===');
  console.log(data.toString());
  console.log('=== END STDERR ===');
});

// Wait 5 seconds then send initialize
setTimeout(() => {
  console.log('Sending initialize request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: true },
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  };
  
  serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
  console.log('Request sent');
}, 5000);

// Wait for response or timeout
setTimeout(() => {
  console.log('Killing server process...');
  serverProcess.kill('SIGTERM');
}, 10000);

serverProcess.on('exit', (code, signal) => {
  console.log('Server process exited with code:', code, 'signal:', signal);
  process.exit(0);
});