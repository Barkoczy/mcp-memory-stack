import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Logger {
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

  log(level, message, meta = {}) {
    if (this.levels[level] > this.levels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
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

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  getColor(level) {
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
    };
    return colors[level] || '';
  }

  resetColor() {
    return '\x1b[0m';
  }

  sendMCPLog(level, message, context) {
    const logMessage = {
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
