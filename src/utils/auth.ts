import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

import { logger } from './logger.js';
import type { EnvironmentConfig } from '../config.js';

interface AuthenticatedRequest extends Request {
  apiKey?: string;
  user?: jwt.JwtPayload | string;
}

interface SecurityConfig {
  apiKey: boolean;
  jwt: boolean;
}

interface AuthConfig {
  security: SecurityConfig;
}

export function authenticate(config: AuthConfig) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // API Key authentication
      if (config.security.apiKey) {
        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
          res.status(401).json({ error: 'API key required' });
          return;
        }

        // Validate API key
        const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

        if (!validKeys.includes(apiKey)) {
          logger.warn('Invalid API key attempt', {
            ip: req.ip,
            key: `${apiKey.substring(0, 8)}...`,
          });
          res.status(401).json({ error: 'Invalid API key' });
          return;
        }

        req.apiKey = apiKey;
      }

      // JWT authentication
      if (config.security.jwt) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({ error: 'JWT token required' });
          return;
        }

        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
          req.user = decoded;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('Invalid JWT attempt', {
            ip: req.ip,
            error: errorMessage,
          });
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}

// Generate API key
export function generateApiKey(prefix: string = 'mcp'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);

  return `${prefix}_${timestamp}${randomPart}${randomPart2}`;
}

// Hash API key for storage
export async function hashApiKey(apiKey: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}