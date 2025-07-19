import { createClient } from 'redis';
import { logger } from './logger.js';

export class CacheService {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.localCache = new Map();
    this.connected = false;

    if (config.enabled && config.redis) {
      this.initRedis();
    }
  }

  async initRedis() {
    try {
      this.client = createClient({
        url: this.config.redis,
        socket: {
          reconnectStrategy: retries => {
            if (retries > 10) {
              logger.error('Redis connection failed after 10 retries');
              return false;
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', err => {
        logger.error('Redis error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.connected = false;
    }
  }

  async get(key) {
    if (!this.config.enabled) {
      return null;
    }

    // Try Redis first
    if (this.connected && this.client) {
      try {
        const value = await this.client.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        logger.error('Redis get error:', error);
      }
    }

    // Fallback to local cache
    const cached = this.localCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Clean up expired entry
    if (cached) {
      this.localCache.delete(key);
    }

    return null;
  }

  async set(key, value, ttl = null) {
    if (!this.config.enabled) {
      return;
    }

    const ttlSeconds = ttl || this.config.ttl || 3600;

    // Set in Redis if connected
    if (this.connected && this.client) {
      try {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      } catch (error) {
        logger.error('Redis set error:', error);
      }
    }

    // Always set in local cache as backup
    this.localCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });

    // Implement simple LRU for local cache
    if (this.localCache.size > (this.config.maxSize || 1000)) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
  }

  async delete(key) {
    if (this.connected && this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        logger.error('Redis delete error:', error);
      }
    }

    this.localCache.delete(key);
  }

  async invalidatePattern(pattern) {
    // Clear local cache entries matching pattern
    for (const key of this.localCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.localCache.delete(key);
      }
    }

    // Clear Redis entries if connected
    if (this.connected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error) {
        logger.error('Redis pattern delete error:', error);
      }
    }
  }

  matchPattern(str, pattern) {
    // Simple pattern matching
    if (pattern === '*') return true;

    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = escapedPattern.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');

    // eslint-disable-next-line security/detect-non-literal-regexp
    return new RegExp(`^${regex}$`, 'u').test(str);
  }

  async flush() {
    this.localCache.clear();

    if (this.connected && this.client) {
      try {
        await this.client.flushDb();
      } catch (error) {
        logger.error('Redis flush error:', error);
      }
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

// Simple LRU cache implementation for embeddings
export class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  set(key, value) {
    // Remove if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Remove oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}
