#!/usr/bin/env node

// Test stdin pipe behavior
import { spawn } from 'child_process';

console.log('Testing stdin pipe behavior...');

const testProcess = spawn('node', ['-e', `
console.error("Child: Script starting");
process.stdin.on('data', (data) => {
  console.error("Child: Received data:", data.toString().trim());
  console.log("Response to:", data.toString().trim());
});
process.stdin.on('end', () => {
  console.error("Child: stdin ended");
});
process.stdin.on('close', () => {
  console.error("Child: stdin closed");
});
console.error("Child: Ready for input");
`], {
  stdio: 'pipe',
});

console.log('Child process spawned with PID:', testProcess.pid);

testProcess.stdout.on('data', data => {
  console.log('STDOUT:', data.toString());
});

testProcess.stderr.on('data', data => {
  console.log('STDERR:', data.toString());
});

// Wait 2 seconds then send data
setTimeout(() => {
  console.log('Sending test data...');
  testProcess.stdin.write('Hello World\\n');
}, 2000);

// Wait 5 seconds then close
setTimeout(() => {
  console.log('Closing stdin...');
  testProcess.stdin.end();
}, 5000);

// Wait 8 seconds then kill
setTimeout(() => {
  console.log('Killing process...');
  testProcess.kill('SIGTERM');
}, 8000);

testProcess.on('exit', (code, signal) => {
  console.log('Process exited with code:', code, 'signal:', signal);
});