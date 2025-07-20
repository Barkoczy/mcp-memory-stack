import jwt from 'jsonwebtoken';

import { logger } from './logger.js';

export function authenticate(config) {
  return (req, res, next) => {
    try {
      // API Key authentication
      if (config.security.apiKey) {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
          return res.status(401).json({ error: 'API key required' });
        }

        // Validate API key
        const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

        if (!validKeys.includes(apiKey)) {
          logger.warn('Invalid API key attempt', {
            ip: req.ip,
            key: `${apiKey.substring(0, 8)}...`,
          });
          return res.status(401).json({ error: 'Invalid API key' });
        }

        req.apiKey = apiKey;
      }

      // JWT authentication
      if (config.security.jwt) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'JWT token required' });
        }

        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
          req.user = decoded;
        } catch (error) {
          logger.warn('Invalid JWT attempt', {
            ip: req.ip,
            error: error.message,
          });
          return res.status(401).json({ error: 'Invalid token' });
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
export function generateApiKey(prefix = 'mcp') {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);

  return `${prefix}_${timestamp}${randomPart}${randomPart2}`;
}

// Hash API key for storage
export async function hashApiKey(apiKey) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
