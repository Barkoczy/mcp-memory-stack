#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class QuickTestRunner {
  constructor() {
    this.logDir = path.join(process.cwd(), 'test-logs');
    this.startTime = Date.now();
    this.results = {
      containers: [],
      tests: {},
      errors: [],
      warnings: []
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    console.log(logEntry);
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  async exec(command, timeout = 30000) {
    this.log(`Executing: ${command}`);
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout,
        stdio: 'pipe',
        cwd: process.cwd()
      });
      this.log(`✅ Command succeeded`);
      return { success: true, output: result };
    } catch (error) {
      this.log(`❌ Command failed: ${error.message}`, 'ERROR');
      this.results.errors.push({
        command,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async checkDockerStatus() {
    this.log('🐳 Checking Docker status...');
    const result = await this.exec('docker info');
    if (!result.success) {
      throw new Error('Docker is not running');
    }
  }

  async startSimpleContainers() {
    this.log('🚀 Starting containers without build...');
    
    // Stop existing containers
    await this.exec('docker-compose down --volumes', 10000);
    
    // Start only essential services
    const result = await this.exec('docker-compose up -d postgres', 60000);
    if (!result.success) {
      throw new Error('Failed to start PostgreSQL');
    }
    
    // Wait for PostgreSQL
    this.log('⏳ Waiting for PostgreSQL...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check PostgreSQL health
    for (let i = 0; i < 5; i++) {
      const healthCheck = await this.exec('docker-compose exec -T postgres pg_isready -U mcp_user -d mcp_memory', 5000);
      if (healthCheck.success) {
        this.log('✅ PostgreSQL is ready');
        break;
      }
      this.log(`PostgreSQL not ready, attempt ${i + 1}/5`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async runBasicTests() {
    this.log('🧪 Running basic tests...');
    
    const testSuites = [
      { name: 'syntax-check', command: 'node -c src/index.js' },
      { name: 'docker-health', command: 'docker-compose exec -T postgres pg_isready -U mcp_user -d mcp_memory' },
      { name: 'vector-extension', command: 'docker-compose exec -T postgres psql -U mcp_user -d mcp_memory -c "SELECT extname FROM pg_extension WHERE extname = \'vector\';"' }
    ];
    
    for (const suite of testSuites) {
      this.log(`Running ${suite.name} tests...`);
      const result = await this.exec(suite.command, 30000);
      this.results.tests[suite.name] = {
        passed: result.success,
        output: result.output || result.error || ''
      };
    }
  }

  async collectLogs() {
    this.log('📋 Collecting container logs...');
    
    const containers = await this.exec('docker ps --format "{{.Names}}"');
    if (containers.success) {
      const containerNames = containers.output.split('\n').filter(name => name.trim());
      
      for (const container of containerNames) {
        if (container.includes('postgres') || container.includes('mcp')) {
          const logs = await this.exec(`docker logs ${container}`);
          if (logs.success) {
            this.results.containers.push({
              name: container,
              logs: logs.output,
              hasErrors: logs.output.toLowerCase().includes('error'),
              hasWarnings: logs.output.toLowerCase().includes('warn')
            });
          }
        }
      }
    }
  }

  async cleanup() {
    this.log('🧹 Cleaning up...');
    await this.exec('docker-compose down --volumes', 30000);
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const passedTests = Object.values(this.results.tests).filter(t => t.passed).length;
    const totalTests = Object.keys(this.results.tests).length;
    const hasErrors = this.results.errors.length > 0;
    
    this.log('='.repeat(60));
    this.log('📊 QUICK TEST REPORT');
    this.log('='.repeat(60));
    this.log(`Duration: ${Math.round(duration / 1000)}s`);
    this.log(`Tests: ${passedTests}/${totalTests} passed`);
    this.log(`Errors: ${this.results.errors.length}`);
    this.log(`Containers: ${this.results.containers.length}`);
    
    if (hasErrors) {
      this.log('\n❌ ERRORS FOUND:');
      this.results.errors.forEach((error, i) => {
        this.log(`${i + 1}. ${error.command}: ${error.error}`);
      });
    }
    
    this.log('\n🧪 TEST RESULTS:');
    Object.entries(this.results.tests).forEach(([name, result]) => {
      const status = result.passed ? '✅' : '❌';
      this.log(`${status} ${name}`);
    });
    
    if (!hasErrors && passedTests === totalTests) {
      this.log('\n🎉 All tests passed!');
      return true;
    } else {
      this.log('\n⚠️  Some tests failed or errors found');
      return false;
    }
  }

  async run() {
    try {
      this.log('🚀 Starting Quick Test Runner');
      
      await this.checkDockerStatus();
      await this.startSimpleContainers();
      await this.runBasicTests();
      await this.collectLogs();
      
      const success = this.generateReport();
      
      await this.cleanup();
      
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      this.log(`💥 Fatal error: ${error.message}`, 'ERROR');
      await this.cleanup();
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new QuickTestRunner();
  runner.run();
}

export default QuickTestRunner;