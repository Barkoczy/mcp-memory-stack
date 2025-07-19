import dotenv from 'dotenv';

import { createMCPServer } from './core/mcp-server.js';
import { createRESTAPI } from './core/rest-api.js';
import { initializeDatabase } from './database/connection.js';
import { createHealthServer } from './utils/health-server.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const MODE = NODE_ENV === 'production' ? 'production' : 'development';

// Global error handlers
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    pid: process.pid,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.toString(),
    promise: promise?.toString(),
    pid: process.pid,
  });
  process.exit(1);
});

// Track application startup time
const startupTime = Date.now();

function logStartupInfo() {
  logger.info('🚀 Starting MCP Memory Server', {
    mode: MODE,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    pid: process.pid,
    environment: NODE_ENV,
  });
}

function logStartupSuccess(totalStartupDuration) {
  logger.info('🎉 MCP Memory Server started successfully', {
    totalStartupTime: `${totalStartupDuration}ms`,
    mode: MODE,
    healthPort: process.env.HEALTH_PORT || '3334',
    restPort: process.env.PORT || '3333',
    mcpEnabled: process.env.MCP_MODE !== 'false',
    restEnabled: process.env.REST_API_ENABLED !== 'false',
  });
}

async function initializeDatabaseWithTracking() {
  const dbStartTime = Date.now();
  try {
    await initializeDatabase();
    const dbDuration = Date.now() - dbStartTime;

    logger.info('✅ Database connection established', {
      duration: `${dbDuration}ms`,
    });
  } catch (error) {
    const dbDuration = Date.now() - dbStartTime;
    logger.error('❌ Database initialization failed', {
      duration: `${dbDuration}ms`,
      error: error.message,
    });
    throw error;
  }
}

function startHealthServer() {
  const healthPort = parseInt(process.env.HEALTH_PORT || '3334', 10);
  const healthStartTime = Date.now();

  try {
    createHealthServer(healthPort);
    const healthDuration = Date.now() - healthStartTime;

    logger.info('✅ Health check server listening', {
      port: healthPort,
      duration: `${healthDuration}ms`,
      metricsPath: '/metrics',
    });
  } catch (error) {
    const healthDuration = Date.now() - healthStartTime;
    logger.error('❌ Health server startup failed', {
      port: healthPort,
      duration: `${healthDuration}ms`,
      error: error.message,
    });
    throw error;
  }
}

function startMCPServerIfEnabled() {
  if (process.env.MCP_MODE === 'true' || !process.env.REST_API_ONLY) {
    const mcpStartTime = Date.now();

    try {
      createMCPServer(config[MODE]);
      const mcpDuration = Date.now() - mcpStartTime;

      logger.info('✅ MCP server started', {
        mode: MODE,
        duration: `${mcpDuration}ms`,
        protocol: 'stdio',
      });
    } catch (error) {
      const mcpDuration = Date.now() - mcpStartTime;
      logger.error('❌ MCP server startup failed', {
        duration: `${mcpDuration}ms`,
        error: error.message,
      });
      throw error;
    }
  }
}

function startRESTAPIIfEnabled() {
  if (process.env.REST_API_ENABLED !== 'false') {
    const port = parseInt(process.env.PORT || '3333', 10);
    const restStartTime = Date.now();

    try {
      createRESTAPI(config[MODE], port);
      const restDuration = Date.now() - restStartTime;

      logger.info('✅ REST API server listening', {
        port,
        duration: `${restDuration}ms`,
        mode: MODE,
      });
    } catch (error) {
      const restDuration = Date.now() - restStartTime;
      logger.error('❌ REST API startup failed', {
        port,
        duration: `${restDuration}ms`,
        error: error.message,
      });
      throw error;
    }
  }
}

async function main() {
  try {
    logStartupInfo();

    await initializeDatabaseWithTracking();

    // In stdio mode, only start MCP server without HTTP servers
    if (process.env.MCP_MODE === 'stdio') {
      createMCPServer(config[MODE]);
      logger.info('✅ MCP server started in stdio mode');
      return;
    }

    startHealthServer();
    startMCPServerIfEnabled();
    startRESTAPIIfEnabled();

    const totalStartupDuration = Date.now() - startupTime;
    logStartupSuccess(totalStartupDuration);

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    const failureDuration = Date.now() - startupTime;

    logger.error('❌ Failed to start server', {
      error: error.message,
      stack: error.stack,
      duration: `${failureDuration}ms`,
      mode: MODE,
      nodeVersion: process.version,
    });

    process.exit(1);
  }
}

function shutdown(signal) {
  const shutdownStartTime = Date.now();

  logger.info('🛑 Graceful shutdown initiated', {
    signal,
    pid: process.pid,
    uptime: process.uptime(),
  });

  try {
    // Shutdown sequence with timeout
    const shutdownTimeout = setTimeout(() => {
      logger.error('⏰ Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout

    // Stop accepting new connections
    logger.info('📡 Stopping HTTP servers...');

    // Close database connections
    logger.info('🗄️ Closing database connections...');

    const shutdownDuration = Date.now() - shutdownStartTime;

    clearTimeout(shutdownTimeout);

    logger.info('✅ Graceful shutdown completed', {
      signal,
      duration: `${shutdownDuration}ms`,
      pid: process.pid,
    });

    process.exit(0);
  } catch (error) {
    const shutdownDuration = Date.now() - shutdownStartTime;

    logger.error('❌ Error during shutdown', {
      error: error.message,
      stack: error.stack,
      duration: `${shutdownDuration}ms`,
      signal,
    });

    process.exit(1);
  }
}

// Start the application
main();
