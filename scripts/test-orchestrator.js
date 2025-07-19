#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

class TestOrchestrator {
  constructor() {
    this.logDir = path.join(process.cwd(), 'test-logs');
    this.logFile = path.join(this.logDir, `test-run-${Date.now()}.log`);
    this.containerLogs = {};
    this.testResults = {
      startTime: Date.now(),
      endTime: null,
      duration: null,
      passed: false,
      errors: [],
      warnings: [],
      containers: [],
      testSuites: {}
    };
    this.containers = [];
    this.isCleaningUp = false;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    console.log(logEntry);
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  async executeCommand(command, options = {}) {
    this.log(`Executing: ${command}`);
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        ...options 
      });
      this.log(`Command completed successfully`);
      return { success: true, output: result };
    } catch (error) {
      this.log(`Command failed: ${error.message}`, 'ERROR');
      this.testResults.errors.push({
        command,
        error: error.message,
        stderr: error.stderr?.toString() || '',
        timestamp: Date.now()
      });
      return { success: false, error: error.message, stderr: error.stderr?.toString() };
    }
  }

  async getRunningContainers() {
    try {
      const result = await this.executeCommand('docker ps --format "{{.Names}}"');
      if (result.success) {
        return result.output.split('\n').filter(name => name.trim());
      }
    } catch (error) {
      this.log(`Failed to get running containers: ${error.message}`, 'ERROR');
    }
    return [];
  }

  async collectContainerLogs(containerName) {
    this.log(`Collecting logs from container: ${containerName}`);
    try {
      const result = await this.executeCommand(`docker logs ${containerName}`);
      if (result.success) {
        this.containerLogs[containerName] = result.output;
        this.analyzeContainerLogs(containerName, result.output);
      } else {
        this.containerLogs[containerName] = result.stderr || 'Failed to collect logs';
      }
    } catch (error) {
      this.log(`Failed to collect logs from ${containerName}: ${error.message}`, 'ERROR');
      this.containerLogs[containerName] = `Error: ${error.message}`;
    }
  }

  analyzeContainerLogs(containerName, logs) {
    const lines = logs.split('\n');
    let errors = 0;
    let warnings = 0;

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('error') && !lowerLine.includes('no error')) {
        errors++;
        this.testResults.errors.push({
          container: containerName,
          line: index + 1,
          message: line.trim(),
          type: 'container_error'
        });
      }
      
      if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
        warnings++;
        this.testResults.warnings.push({
          container: containerName,
          line: index + 1,
          message: line.trim(),
          type: 'container_warning'
        });
      }
      
      if (lowerLine.includes('fatal') || lowerLine.includes('critical')) {
        this.testResults.errors.push({
          container: containerName,
          line: index + 1,
          message: line.trim(),
          type: 'critical_error'
        });
      }
    });

    this.log(`Container ${containerName}: ${errors} errors, ${warnings} warnings found`);
  }

  async stopAllContainers() {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;

    this.log('Stopping and removing all test containers...');
    
    try {
      const containers = await this.getRunningContainers();
      const mcpContainers = containers.filter(name => 
        name.includes('mcp') || 
        name.includes('postgres') || 
        name.includes('redis') || 
        name.includes('pgadmin')
      );

      for (const container of mcpContainers) {
        await this.collectContainerLogs(container);
        await this.executeCommand(`docker stop ${container}`, { timeout: 30000 });
        await this.executeCommand(`docker rm ${container}`);
      }

      await this.executeCommand('docker-compose down --volumes --remove-orphans');
      await this.executeCommand('docker network prune -f');
      
      this.log('All containers stopped and cleaned up');
    } catch (error) {
      this.log(`Error during cleanup: ${error.message}`, 'ERROR');
    }
  }

  async runTestSuite(suiteName, command) {
    this.log(`Starting test suite: ${suiteName}`);
    const startTime = performance.now();
    
    const result = await this.executeCommand(command);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.testResults.testSuites[suiteName] = {
      passed: result.success,
      duration: Math.round(duration),
      output: result.output || '',
      error: result.error || ''
    };
    
    if (result.success) {
      this.log(`✅ Test suite ${suiteName} passed (${Math.round(duration)}ms)`);
    } else {
      this.log(`❌ Test suite ${suiteName} failed (${Math.round(duration)}ms)`, 'ERROR');
    }
    
    return result.success;
  }

  async setupEnvironment() {
    this.log('Setting up test environment...');
    
    await this.executeCommand('docker system prune -f');
    
    // Clean up any existing containers
    await this.executeCommand('docker-compose down --volumes --remove-orphans');
    
    this.log('Environment setup completed');
  }

  async startContainers() {
    this.log('Starting Docker containers...');
    
    // First try to pull images
    await this.executeCommand('docker-compose pull', { timeout: 60000 });
    
    const composeResult = await this.executeCommand(
      'docker-compose up -d',
      { timeout: 120000 }
    );
    
    if (!composeResult.success) {
      throw new Error('Failed to start containers');
    }
    
    this.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Try health check multiple times
    let healthPassed = false;
    for (let i = 0; i < 3; i++) {
      const healthResult = await this.executeCommand('npm run health:check');
      if (healthResult.success) {
        healthPassed = true;
        break;
      }
      this.log(`Health check attempt ${i + 1} failed, retrying...`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (!healthPassed) {
      this.log('Health check failed after multiple attempts, but continuing with tests...', 'WARN');
    }
    
    this.containers = await this.getRunningContainers();
    this.testResults.containers = this.containers;
    this.log(`Started containers: ${this.containers.join(', ')}`);
  }

  async runAllTests() {
    this.log('Running comprehensive test suite...');
    
    const testSuites = [
      { name: 'unit', command: 'npm run test:unit' },
      { name: 'integration', command: 'npm run test:integration' },
      { name: 'e2e', command: 'npm run test:e2e' },
      { name: 'mcp-protocol', command: 'npm run test:protocol' },
      { name: 'coverage', command: 'npm run test:coverage' }
    ];
    
    let allPassed = true;
    
    for (const suite of testSuites) {
      const passed = await this.runTestSuite(suite.name, suite.command);
      if (!passed) {
        allPassed = false;
      }
    }
    
    return allPassed;
  }

  async runCodeQuality() {
    this.log('Running code quality checks...');
    
    const checks = [
      { name: 'lint', command: 'npm run lint:check' },
      { name: 'format', command: 'npm run format:check' },
      { name: 'type-check', command: 'npm run type:check' }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      const passed = await this.runTestSuite(`quality-${check.name}`, check.command);
      if (!passed) {
        allPassed = false;
      }
    }
    
    return allPassed;
  }

  generateReport() {
    this.testResults.endTime = Date.now();
    this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
    
    const totalErrors = this.testResults.errors.length;
    const totalWarnings = this.testResults.warnings.length;
    const passedSuites = Object.values(this.testResults.testSuites).filter(s => s.passed).length;
    const totalSuites = Object.keys(this.testResults.testSuites).length;
    
    this.testResults.passed = totalErrors === 0 && passedSuites === totalSuites;
    
    const report = {
      summary: {
        status: this.testResults.passed ? 'PASSED' : 'FAILED',
        duration: `${Math.round(this.testResults.duration / 1000)}s`,
        testSuites: `${passedSuites}/${totalSuites} passed`,
        errors: totalErrors,
        warnings: totalWarnings,
        containers: this.containers.length
      },
      details: this.testResults,
      containerLogs: this.containerLogs
    };
    
    const reportPath = path.join(this.logDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log('='.repeat(80));
    this.log('TEST ORCHESTRATOR REPORT');
    this.log('='.repeat(80));
    this.log(`Status: ${report.summary.status}`);
    this.log(`Duration: ${report.summary.duration}`);
    this.log(`Test Suites: ${report.summary.testSuites}`);
    this.log(`Errors: ${report.summary.errors}`);
    this.log(`Warnings: ${report.summary.warnings}`);
    this.log(`Containers: ${report.summary.containers}`);
    this.log(`Report saved to: ${reportPath}`);
    this.log(`Logs saved to: ${this.logFile}`);
    
    if (totalErrors > 0) {
      this.log('\nERRORS FOUND:');
      this.testResults.errors.forEach((error, index) => {
        this.log(`${index + 1}. ${error.message || error.error}`);
      });
    }
    
    if (totalWarnings > 0) {
      this.log('\nWARNINGS FOUND:');
      this.testResults.warnings.slice(0, 10).forEach((warning, index) => {
        this.log(`${index + 1}. ${warning.message}`);
      });
      if (totalWarnings > 10) {
        this.log(`... and ${totalWarnings - 10} more warnings`);
      }
    }
    
    this.log('='.repeat(80));
    
    return report;
  }

  async run() {
    try {
      this.log('🚀 Starting Test Orchestrator');
      
      process.on('SIGINT', async () => {
        this.log('Received SIGINT, cleaning up...', 'WARN');
        await this.stopAllContainers();
        process.exit(1);
      });
      
      process.on('SIGTERM', async () => {
        this.log('Received SIGTERM, cleaning up...', 'WARN');
        await this.stopAllContainers();
        process.exit(1);
      });
      
      await this.setupEnvironment();
      await this.startContainers();
      
      const testsPass = await this.runAllTests();
      const qualityPass = await this.runCodeQuality();
      
      for (const container of this.containers) {
        await this.collectContainerLogs(container);
      }
      
      const report = this.generateReport();
      
      await this.stopAllContainers();
      
      if (report.summary.status === 'PASSED') {
        this.log('🎉 All tests passed successfully!');
        process.exit(0);
      } else {
        this.log('❌ Tests failed. Check the report for details.');
        process.exit(1);
      }
      
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'ERROR');
      await this.stopAllContainers();
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = new TestOrchestrator();
  orchestrator.run();
}

export default TestOrchestrator;