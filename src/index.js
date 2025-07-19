import dotenv from 'dotenv';
import { createMCPServer } from './core/mcp-server.js';
import { createRESTAPI } from './core/rest-api.js';
import { initializeDatabase } from './database/connection.js';
import { createHealthServer } from './utils/health-server.js';
import { config } from './config.js';
// Enhanced logging and metrics (2025 standards)
import enhancedLogger, { gracefulShutdown as shutdownLogger } from './utils/advanced-logger.js';
import { enhancedMetrics } from './utils/enhanced-metrics.js';

// Load environment variables
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const MODE = NODE_ENV === 'production' ? 'production' : 'development';

// Global error handlers with enhanced logging
process.on('uncaughtException', (error) => {
  enhancedLogger.fatal('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    pid: process.pid
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  enhancedLogger.fatal('Unhandled Rejection', {
    reason: reason?.toString(),
    promise: promise?.toString(),
    pid: process.pid
  });
  process.exit(1);
});

// Track application startup time
const startupTimer = enhancedLogger.performance.start('application_startup');

async function main() {
  try {
    // Start application with correlation ID for distributed tracing
    const correlationId = `startup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await enhancedLogger.withCorrelationId(correlationId, async () => {
      enhancedLogger.info('🚀 Starting MCP Memory Server', {
        mode: MODE,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        environment: NODE_ENV,
        correlationId
      });

      // Track security event for service startup
      enhancedLogger.security.authSuccess('system', 'startup', {
        mode: MODE,
        correlationId
      });

      // Initialize database with metrics tracking
      const dbTimer = enhancedLogger.performance.start('database_initialization');
      try {
        await initializeDatabase();
        const dbDuration = dbTimer.end({ 
          operation: 'database_init',
          status: 'success' 
        });
        
        enhancedMetrics.trackDbQuery('init', 'connection', true, dbDuration / 1000);
        enhancedLogger.info('✅ Database connection established', {
          duration: dbDuration,
          correlationId
        });
      } catch (error) {
        const dbDuration = dbTimer.end({ 
          operation: 'database_init',
          status: 'failure' 
        });
        
        enhancedMetrics.trackDbQuery('init', 'connection', false, dbDuration / 1000);
        enhancedMetrics.trackError('database_init', 'mcp-memory-server', 'startup', 'critical');
        throw error;
      }

      // Start health check server with metrics endpoint
      const healthPort = parseInt(process.env.HEALTH_PORT || '3334', 10);
      const healthTimer = enhancedLogger.performance.start('health_server_startup');
      
      try {
        createHealthServer(healthPort, enhancedMetrics);
        const healthDuration = healthTimer.end({
          operation: 'health_server_startup',
          status: 'success',
          port: healthPort
        });
        
        enhancedLogger.info('✅ Health check server listening', {
          port: healthPort,
          duration: healthDuration,
          metricsPath: '/metrics',
          correlationId
        });
      } catch (error) {
        healthTimer.end({
          operation: 'health_server_startup',
          status: 'failure',
          port: healthPort
        });
        enhancedMetrics.trackError('health_server_init', 'mcp-memory-server', 'startup', 'critical');
        throw error;
      }

      // Start MCP server if running in MCP mode
      if (process.env.MCP_MODE === 'true' || !process.env.REST_API_ONLY) {
        const mcpTimer = enhancedLogger.performance.start('mcp_server_startup');
        
        try {
          createMCPServer(config[MODE], enhancedLogger, enhancedMetrics);
          const mcpDuration = mcpTimer.end({
            operation: 'mcp_server_startup',
            status: 'success'
          });
          
          enhancedLogger.info('✅ MCP server started', {
            mode: MODE,
            duration: mcpDuration,
            protocol: 'stdio',
            correlationId
          });
        } catch (error) {
          mcpTimer.end({
            operation: 'mcp_server_startup',
            status: 'failure'
          });
          enhancedMetrics.trackError('mcp_server_init', 'mcp-memory-server', 'startup', 'critical');
          throw error;
        }
      }

      // Start REST API if enabled
      if (process.env.REST_API_ENABLED !== 'false') {
        const port = parseInt(process.env.PORT || '3333', 10);
        const restTimer = enhancedLogger.performance.start('rest_api_startup');
        
        try {
          createRESTAPI(config[MODE], port, enhancedLogger, enhancedMetrics);
          const restDuration = restTimer.end({
            operation: 'rest_api_startup',
            status: 'success',
            port
          });
          
          enhancedLogger.info('✅ REST API server listening', {
            port,
            duration: restDuration,
            mode: MODE,
            correlationId
          });
        } catch (error) {
          restTimer.end({
            operation: 'rest_api_startup',
            status: 'failure',
            port
          });
          enhancedMetrics.trackError('rest_api_init', 'mcp-memory-server', 'startup', 'critical');
          throw error;
        }
      }

      // Complete startup tracking
      const totalStartupDuration = startupTimer.end({
        operation: 'full_startup',
        status: 'success',
        mode: MODE
      });

      enhancedLogger.info('🎉 MCP Memory Server started successfully', {
        totalStartupTime: totalStartupDuration,
        mode: MODE,
        healthPort,
        restPort: process.env.PORT || '3333',
        mcpEnabled: process.env.MCP_MODE !== 'false',
        restEnabled: process.env.REST_API_ENABLED !== 'false',
        correlationId
      });

      // Track successful startup metric
      enhancedMetrics.trackMemoryOperation('startup', true, totalStartupDuration / 1000, {
        type: 'system',
        source: 'application'
      });
    });

    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Setup health monitoring
    setupHealthMonitoring();

  } catch (error) {
    const failureDuration = startupTimer.end({
      operation: 'full_startup',
      status: 'failure',
      mode: MODE
    });

    enhancedLogger.fatal('❌ Failed to start server', {
      error: error.message,
      stack: error.stack,
      duration: failureDuration,
      mode: MODE,
      nodeVersion: process.version
    });

    enhancedMetrics.trackError('startup_failure', 'mcp-memory-server', 'main', 'critical');
    enhancedMetrics.trackMemoryOperation('startup', false, failureDuration / 1000, {
      type: 'system',
      source: 'application',
      error: error.message
    });

    await gracefulShutdown();
    process.exit(1);
  }
}

async function shutdown(signal) {
  const shutdownTimer = enhancedLogger.performance.start('graceful_shutdown');
  
  enhancedLogger.info('🛑 Graceful shutdown initiated', {
    signal,
    pid: process.pid,
    uptime: process.uptime()
  });

  try {
    // Shutdown sequence with timeout
    const shutdownTimeout = setTimeout(() => {
      enhancedLogger.error('⏰ Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout

    // Stop accepting new connections
    enhancedLogger.info('📡 Stopping HTTP servers...');

    // Close database connections
    enhancedLogger.info('🗄️ Closing database connections...');

    // Flush metrics and logs
    enhancedLogger.info('📊 Flushing metrics and logs...');
    await shutdownLogger();

    const shutdownDuration = shutdownTimer.end({
      operation: 'graceful_shutdown',
      status: 'success',
      signal
    });

    clearTimeout(shutdownTimeout);

    enhancedLogger.info('✅ Graceful shutdown completed', {
      signal,
      duration: shutdownDuration,
      pid: process.pid
    });

    process.exit(0);
  } catch (error) {
    const shutdownDuration = shutdownTimer.end({
      operation: 'graceful_shutdown',
      status: 'failure',
      signal
    });

    enhancedLogger.error('❌ Error during shutdown', {
      error: error.message,
      stack: error.stack,
      duration: shutdownDuration,
      signal
    });

    process.exit(1);
  }
}

function setupHealthMonitoring() {
  // Monitor memory usage every 30 seconds
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    enhancedLogger.debug('📊 System health check', {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      pid: process.pid
    });

    // Alert if memory usage is high
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (heapUsedPercent > 85) {
      enhancedLogger.warn('⚠️ High memory usage detected', {
        heapUsedPercent,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      });
    }
  }, 30000);

  // Monitor event loop lag
  let previousTime = process.hrtime.bigint();
  setInterval(() => {
    const currentTime = process.hrtime.bigint();
    const lag = Number(currentTime - previousTime - 1000000000n) / 1000000; // Expected 1s, convert to ms
    previousTime = currentTime;

    if (lag > 100) { // More than 100ms lag
      enhancedLogger.warn('⚠️ High event loop lag detected', {
        lag,
        unit: 'milliseconds'
      });
    }
  }, 1000);
}

// Enhanced graceful shutdown
async function gracefulShutdown() {
  try {
    await shutdownLogger();
  } catch (error) {
    console.error('Error during logger shutdown:', error);
  }
}

// Start the application
main();
