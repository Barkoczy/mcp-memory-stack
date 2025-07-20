#!/usr/bin/env node

// Test spawn functionality
import { spawn } from 'child_process';

console.log('Testing spawn...');

const testProcess = spawn('node', ['-e', 'console.error("Hello from stderr"); console.log("Hello from stdout");'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

console.log('Process spawned with PID:', testProcess.pid);

testProcess.stdout.on('data', data => {
  console.log('STDOUT:', data.toString());
});

testProcess.stderr.on('data', data => {
  console.log('STDERR:', data.toString());
});

testProcess.on('exit', (code, signal) => {
  console.log('Process exited with code:', code, 'signal:', signal);
});

setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 3000);