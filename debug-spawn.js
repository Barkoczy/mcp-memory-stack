#!/usr/bin/env node

// Debug script to test process spawning
import { spawn } from 'child_process';

console.log('Starting debug spawn test...');

const debugProcess = spawn('node', ['src/index.js'], {
  stdio: 'pipe',
  env: {
    ...process.env,
    NODE_ENV: 'development',  // Changed from 'test' to 'development'
    MCP_MODE: 'stdio',
    DATABASE_URL: 'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory',
    LOG_LEVEL: 'debug',
  },
});

console.log('Process spawned with PID:', debugProcess.pid);

let hasStdout = false;
let hasStderr = false;

debugProcess.stdout.on('data', data => {
  hasStdout = true;
  console.log('STDOUT:', data.toString());
});

debugProcess.stderr.on('data', data => {
  hasStderr = true;
  console.log('STDERR:', data.toString());
});

debugProcess.on('spawn', () => {
  console.log('Process spawn event fired');
});

debugProcess.on('error', (error) => {
  console.error('Process error:', error);
});

debugProcess.on('exit', (code, signal) => {
  console.log('Process exited with code:', code, 'signal:', signal);
  console.log('Had stdout:', hasStdout);
  console.log('Had stderr:', hasStderr);
});

// Send a test request after 5 seconds
setTimeout(() => {
  console.log('Sending test request...');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {}
    }
  };
  debugProcess.stdin.write(`${JSON.stringify(request)}\n`);
}, 5000);

// Clean up after 10 seconds
setTimeout(() => {
  console.log('Cleaning up...');
  debugProcess.kill('SIGTERM');
  process.exit(0);
}, 10000);