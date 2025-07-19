import { register, Counter, Histogram, Gauge } from 'prom-client';

class MetricsService {
  constructor() {
    // HTTP metrics
    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    // Memory operations metrics
    this.memoryOperations = new Counter({
      name: 'memory_operations_total',
      help: 'Total number of memory operations',
      labelNames: ['operation', 'status'],
    });

    this.memoryOperationDuration = new Histogram({
      name: 'memory_operation_duration_seconds',
      help: 'Duration of memory operations',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    // Embedding metrics
    this.embeddingGenerations = new Counter({
      name: 'embedding_generations_total',
      help: 'Total number of embedding generations',
      labelNames: ['status'],
    });

    this.embeddingDuration = new Histogram({
      name: 'embedding_generation_duration_seconds',
      help: 'Duration of embedding generation',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // Database metrics
    this.dbConnections = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
    });

    this.dbQueries = new Counter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['type', 'status'],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries',
      labelNames: ['type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    // Cache metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
    });

    // System metrics
    this.memoryUsage = new Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Node.js memory usage',
      labelNames: ['type'],
    });

    // Register all metrics
    register.registerMetric(this.httpRequests);
    register.registerMetric(this.httpDuration);
    register.registerMetric(this.memoryOperations);
    register.registerMetric(this.memoryOperationDuration);
    register.registerMetric(this.embeddingGenerations);
    register.registerMetric(this.embeddingDuration);
    register.registerMetric(this.dbConnections);
    register.registerMetric(this.dbQueries);
    register.registerMetric(this.dbQueryDuration);
    register.registerMetric(this.cacheHits);
    register.registerMetric(this.cacheMisses);
    register.registerMetric(this.memoryUsage);

    // Start collecting system metrics
    this.startSystemMetrics();
  }

  startSystemMetrics() {
    // Update memory usage every 10 seconds
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
    }, 10000);
  }

  // Express middleware
  middleware(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;
      const { method } = req;
      const status = res.statusCode;

      metrics.httpRequests.inc({ method, route, status });
      metrics.httpDuration.observe({ method, route, status }, duration);
    });

    next();
  }

  // Endpoint handler
  async endpoint(req, res) {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.send(metrics);
    } catch (error) {
      res.status(500).send('Error generating metrics');
    }
  }

  // Helper methods for tracking operations

  trackMemoryOperation(operation, success, duration) {
    this.memoryOperations.inc({
      operation,
      status: success ? 'success' : 'failure',
    });

    if (duration !== undefined) {
      this.memoryOperationDuration.observe({ operation }, duration);
    }
  }

  trackEmbedding(success, duration) {
    this.embeddingGenerations.inc({
      status: success ? 'success' : 'failure',
    });

    if (duration !== undefined) {
      this.embeddingDuration.observe(duration);
    }
  }

  trackDbQuery(type, success, duration) {
    this.dbQueries.inc({
      type,
      status: success ? 'success' : 'failure',
    });

    if (duration !== undefined) {
      this.dbQueryDuration.observe({ type }, duration);
    }
  }

  trackCache(hit, cacheType = 'memory') {
    if (hit) {
      this.cacheHits.inc({ cache_type: cacheType });
    } else {
      this.cacheMisses.inc({ cache_type: cacheType });
    }
  }

  updateDbConnections(count) {
    this.dbConnections.set(count);
  }
}

export const metrics = new MetricsService();
