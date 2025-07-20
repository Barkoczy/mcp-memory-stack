import http from 'http';
import type { IncomingMessage, ServerResponse, Server } from 'http';

import { logger } from './logger.js';

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
}

interface ErrorResponse {
  error: string;
}

export function createHealthServer(port: number = 3334): Server {
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '2.0.0',
        uptime: process.uptime(),
      };
      res.end(JSON.stringify(healthStatus));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      const errorResponse: ErrorResponse = { error: 'Not found' };
      res.end(JSON.stringify(errorResponse));
    }
  });

  server.listen(port, () => {
    logger.info(`Health check server listening on port ${port}`);
  });

  return server;
}