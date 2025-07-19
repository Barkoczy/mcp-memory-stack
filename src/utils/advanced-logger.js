import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

import DailyRotateFile from 'winston-daily-rotate-file';
import winston from 'winston';

const require = createRequire(import.meta.url);

// Create logs directory if it doesn't exist
const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// OpenTelemetry aligned log levels for 2025
const levels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// Colors for different log levels
const colors = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'blue',
  trace: 'magenta',
};

winston.addColors(colors);

// Custom format for structured JSON logging (2025 standard)
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: () => new Date().toISOString(), // ISO 8601 UTC format
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label'],
  }),
  winston.format.json()
);

// Development console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: () => new Date().toISOString(),
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  })
);

// Production file transport with daily rotation
const createFileTransport = (filename, level = 'info') => {
  return new DailyRotateFile({
    filename: path.join(logsDir, filename),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d', // Keep logs for 30 days in production
    level,
    format: structuredFormat,
    auditFile: path.join(logsDir, '.audit.json'),
    createSymlink: true,
    symlinkName: filename.replace('-%DATE%', '-current'),
  });
};

// Error-specific transport for critical issues
const errorTransport = createFileTransport('error-%DATE%.log', 'error');

// Combined transport for all logs
const combinedTransport = createFileTransport('combined-%DATE%.log', 'info');

// Application-specific transport
const appTransport = createFileTransport('app-%DATE%.log', 'debug');

// Access log transport for HTTP requests
const accessTransport = createFileTransport('access-%DATE%.log', 'info');

// Security log transport for authentication/authorization events
const securityTransport = createFileTransport('security-%DATE%.log', 'warn');

// Performance metrics transport
const metricsTransport = createFileTransport('metrics-%DATE%.log', 'info');

// Console transport for development
const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat,
});

// Create the main logger
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: structuredFormat,
  defaultMeta: {
    service: 'mcp-memory-server',
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    hostname: process.env.HOSTNAME || require('os').hostname(),
    pid: process.pid,
  },
  transports: [consoleTransport, combinedTransport, errorTransport, appTransport],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: structuredFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: structuredFormat,
    }),
  ],
  exitOnError: false,
});

// Child loggers for specific components
const createChildLogger = (component, metadata = {}) => {
  return logger.child({
    component,
    ...metadata,
  });
};

// Specialized loggers
const httpLogger = createChildLogger('http', { type: 'access' });
const dbLogger = createChildLogger('database', { type: 'database' });
const mcpLogger = createChildLogger('mcp', { type: 'protocol' });
const securityLogger = createChildLogger('security', { type: 'security' });
const metricsLogger = createChildLogger('metrics', { type: 'metrics' });

// Add transport-specific methods
httpLogger.add(accessTransport);
securityLogger.add(securityTransport);
metricsLogger.add(metricsTransport);

// Correlation ID support for distributed tracing
let correlationIdStore;

// Initialize async local storage for correlation IDs
try {
  const { AsyncLocalStorage } = await import('async_hooks');
  correlationIdStore = new AsyncLocalStorage();
} catch (error) {
  logger.warn('AsyncLocalStorage not available, correlation IDs will be limited');
}

// Enhanced logging methods with correlation ID support
const enhancedLogger = {
  ...logger,

  // Wrap method to add correlation ID automatically
  withCorrelationId: (correlationId, fn) => {
    if (correlationIdStore) {
      return correlationIdStore.run({ correlationId }, fn);
    } else {
      return fn();
    }
  },

  // Get current correlation ID
  getCorrelationId: () => {
    if (correlationIdStore) {
      const store = correlationIdStore.getStore();
      return store?.correlationId;
    }
    return null;
  },

  // Enhanced logging methods that include correlation ID
  logWithContext: (level, message, meta = {}) => {
    const correlationId = enhancedLogger.getCorrelationId();
    const enrichedMeta = {
      ...meta,
      ...(correlationId && { correlationId }),
      timestamp: new Date().toISOString(),
    };

    logger[level](message, enrichedMeta);
  },
};

// Override standard methods to include context
['fatal', 'error', 'warn', 'info', 'debug', 'trace'].forEach(level => {
  enhancedLogger[level] = (message, meta = {}) => {
    enhancedLogger.logWithContext(level, message, meta);
  };
});

// Performance logging utility
enhancedLogger.performance = {
  start: operation => {
    const startTime = process.hrtime.bigint();
    return {
      end: (additionalMeta = {}) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        metricsLogger.info('Performance metric', {
          operation,
          duration,
          unit: 'ms',
          ...additionalMeta,
        });

        return duration;
      },
    };
  },
};

// Security logging utilities
enhancedLogger.security = {
  authSuccess: (userId, method, meta = {}) => {
    securityLogger.info('Authentication successful', {
      event: 'auth_success',
      userId,
      method,
      ...meta,
    });
  },

  authFailure: (reason, method, meta = {}) => {
    securityLogger.warn('Authentication failed', {
      event: 'auth_failure',
      reason,
      method,
      ...meta,
    });
  },

  accessDenied: (resource, userId, meta = {}) => {
    securityLogger.warn('Access denied', {
      event: 'access_denied',
      resource,
      userId,
      ...meta,
    });
  },

  suspiciousActivity: (activity, meta = {}) => {
    securityLogger.error('Suspicious activity detected', {
      event: 'suspicious_activity',
      activity,
      ...meta,
    });
  },
};

// HTTP request logging utility
enhancedLogger.http = {
  request: (req, res, duration) => {
    const { statusCode } = res;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    httpLogger[level]('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      referrer: req.get('Referrer'),
    });
  },
};

// Graceful shutdown handler
const gracefulShutdown = () => {
  logger.info('Shutting down logger...');

  // Wait for all transports to finish writing
  return new Promise(resolve => {
    logger.on('finish', resolve);
    logger.end();
  });
};

// Export everything
export default enhancedLogger;
export {
  logger,
  httpLogger,
  dbLogger,
  mcpLogger,
  securityLogger,
  metricsLogger,
  gracefulShutdown,
  correlationIdStore,
};
