import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';

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

interface LogMetadata {
  service: string;
  version: string;
  environment: string;
  hostname: string;
  pid: number;
  component?: string;
  type?: string;
  correlationId?: string;
  timestamp?: string;
  [key: string]: any;
}

interface CorrelationStore {
  correlationId: string;
}

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
const createFileTransport = (filename: string, level: string = 'info'): DailyRotateFile => {
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
  } as LogMetadata,
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
const createChildLogger = (component: string, metadata: Record<string, any> = {}): winston.Logger => {
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
let correlationIdStore: any;

// Initialize async local storage for correlation IDs
try {
  const { AsyncLocalStorage } = await import('async_hooks');
  correlationIdStore = new AsyncLocalStorage();
} catch (error) {
  logger.warn('AsyncLocalStorage not available, correlation IDs will be limited');
}

interface EnhancedLogger extends winston.Logger {
  withCorrelationId: <T>(correlationId: string, fn: () => T) => T;
  getCorrelationId: () => string | null;
  logWithContext: (level: string, message: string, meta?: Record<string, any>) => void;
  fatal: (message: string, meta?: Record<string, any>) => void;
  trace: (message: string, meta?: Record<string, any>) => void;
}

// Enhanced logging methods with correlation ID support
const enhancedLogger: EnhancedLogger = {
  ...logger,

  // Wrap method to add correlation ID automatically
  withCorrelationId: <T>(correlationId: string, fn: () => T): T => {
    if (correlationIdStore) {
      return correlationIdStore.run({ correlationId }, fn);
    } else {
      return fn();
    }
  },

  // Get current correlation ID
  getCorrelationId: (): string | null => {
    if (correlationIdStore) {
      const store: CorrelationStore | undefined = correlationIdStore.getStore();
      return store?.correlationId || null;
    }
    return null;
  },

  // Enhanced logging methods that include correlation ID
  logWithContext: (level: string, message: string, meta: Record<string, any> = {}): void => {
    const correlationId = enhancedLogger.getCorrelationId();
    const enrichedMeta = {
      ...meta,
      ...(correlationId && { correlationId }),
      timestamp: new Date().toISOString(),
    };

    (logger as any)[level](message, enrichedMeta);
  },

  fatal: (message: string, meta: Record<string, any> = {}): void => {
    enhancedLogger.logWithContext('fatal', message, meta);
  },

  trace: (message: string, meta: Record<string, any> = {}): void => {
    enhancedLogger.logWithContext('trace', message, meta);
  },
} as EnhancedLogger;

// Override standard methods to include context
(['error', 'warn', 'info', 'debug'] as const).forEach(level => {
  (enhancedLogger as any)[level] = (message: string, meta: Record<string, any> = {}) => {
    enhancedLogger.logWithContext(level, message, meta);
  };
});

// HTTP request logging utility - standalone function to avoid TypeScript conflicts
const logHttpRequest = (req: Request, res: Response, duration: number): void => {
  const { statusCode } = res;
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  (httpLogger as any)[level]('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode,
    duration,
    userAgent: req.get('User-Agent'),
    ip: req.ip || (req.connection as any)?.remoteAddress,
    referrer: req.get('Referrer'),
  });
};

// Graceful shutdown handler
const gracefulShutdown = (): Promise<void> => {
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
  logHttpRequest,
  gracefulShutdown,
  correlationIdStore,
};