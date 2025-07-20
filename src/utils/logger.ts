import { createWriteStream, WriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogLevels {
  [key: string]: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: any;
}

interface MCPLogMessage {
  jsonrpc: string;
  method: string;
  params: {
    level: LogLevel;
    message: string;
    timestamp: string;
    context: Record<string, any>;
  };
}

class Logger {
  private level: string;
  private levels: LogLevels;
  private fileStream?: WriteStream;

  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    // Create log stream for file logging in production
    if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
      this.fileStream = createWriteStream(join(__dirname, '../../logs', process.env.LOG_FILE), {
        flags: 'a',
      });
    }
  }

  log(level: LogLevel, message: string, meta: Record<string, any> = {}): void {
    if (this.levels[level] > this.levels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // Console output (use stderr to avoid interfering with MCP protocol)
    const color = this.getColor(level);
    console.error(
      `${color}[${timestamp}] [${level.toUpperCase()}]${this.resetColor()} ${message}`,
      Object.keys(meta).length > 0 ? meta : ''
    );

    // File output for production
    if (this.fileStream) {
      this.fileStream.write(`${JSON.stringify(logEntry)}\n`);
    }

    // MCP protocol logging (disabled to avoid interfering with MCP responses)
    // if (process.env.MCP_MODE === 'true') {
    //   this.sendMCPLog(level, message, meta);
    // }
  }

  error(message: string, meta?: Record<string, any>): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  private getColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
    };
    return colors[level] || '';
  }

  private resetColor(): string {
    return '\x1b[0m';
  }

  private sendMCPLog(level: LogLevel, message: string, context: Record<string, any>): void {
    const logMessage: MCPLogMessage = {
      jsonrpc: '2.0',
      method: 'log',
      params: {
        level,
        message,
        timestamp: new Date().toISOString(),
        context,
      },
    };
    console.log(JSON.stringify(logMessage));
  }
}

export const logger = new Logger();
