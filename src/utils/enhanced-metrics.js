import { register, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const os = require('os');

// Enhanced metrics service following 2025 standards
class EnhancedMetricsService {
  constructor() {
    // Clear any existing metrics
    register.clear();
    
    // Collect default Node.js metrics (CPU, memory, GC, etc.)
    collectDefaultMetrics({ 
      register,
      prefix: 'mcp_memory_server_',
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // Business Logic Metrics
    this.initBusinessMetrics();
    
    // Technical Performance Metrics
    this.initPerformanceMetrics();
    
    // Security and Observability Metrics
    this.initSecurityMetrics();
    
    // Infrastructure Metrics
    this.initInfrastructureMetrics();
    
    // OpenTelemetry-compatible metrics
    this.initOpenTelemetryMetrics();
    
    // Start collecting enhanced system metrics
    this.startEnhancedSystemMetrics();
  }

  initBusinessMetrics() {
    // Memory operations with detailed labels
    this.memoryOperations = new Counter({
      name: 'mcp_memory_operations_total',
      help: 'Total number of memory operations performed',
      labelNames: ['operation', 'status', 'type', 'user_id', 'source'],
      registers: [register]
    });

    this.memoryOperationDuration = new Histogram({
      name: 'mcp_memory_operation_duration_seconds',
      help: 'Duration of memory operations in seconds',
      labelNames: ['operation', 'type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [register]
    });

    // Embedding metrics with model tracking
    this.embeddingOperations = new Counter({
      name: 'mcp_embedding_operations_total',
      help: 'Total number of embedding operations',
      labelNames: ['model', 'status', 'dimensions', 'cache_hit'],
      registers: [register]
    });

    this.embeddingDuration = new Histogram({
      name: 'mcp_embedding_duration_seconds',
      help: 'Time spent generating embeddings',
      labelNames: ['model', 'dimensions'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register]
    });

    // Search operations with semantic tracking
    this.searchOperations = new Counter({
      name: 'mcp_search_operations_total',
      help: 'Total number of search operations',
      labelNames: ['type', 'status', 'similarity_threshold', 'result_count'],
      registers: [register]
    });

    this.searchDuration = new Histogram({
      name: 'mcp_search_duration_seconds',
      help: 'Duration of search operations',
      labelNames: ['type', 'similarity_threshold'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [register]
    });

    this.searchResultCount = new Histogram({
      name: 'mcp_search_results_count',
      help: 'Number of results returned by search operations',
      labelNames: ['type'],
      buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [register]
    });
  }

  initPerformanceMetrics() {
    // HTTP metrics with enhanced labels
    this.httpRequests = new Counter({
      name: 'mcp_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_agent_type', 'content_type'],
      registers: [register]
    });

    this.httpDuration = new Histogram({
      name: 'mcp_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_class'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [register]
    });

    this.httpRequestSize = new Histogram({
      name: 'mcp_http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [10, 100, 1000, 10000, 100000, 1000000],
      registers: [register]
    });

    this.httpResponseSize = new Histogram({
      name: 'mcp_http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_class'],
      buckets: [10, 100, 1000, 10000, 100000, 1000000],
      registers: [register]
    });

    // MCP Protocol metrics
    this.mcpMessages = new Counter({
      name: 'mcp_protocol_messages_total',
      help: 'Total number of MCP protocol messages',
      labelNames: ['type', 'method', 'status'],
      registers: [register]
    });

    this.mcpMessageDuration = new Histogram({
      name: 'mcp_protocol_message_duration_seconds',
      help: 'Duration of MCP message processing',
      labelNames: ['type', 'method'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [register]
    });
  }

  initSecurityMetrics() {
    // Authentication metrics
    this.authAttempts = new Counter({
      name: 'mcp_auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['method', 'status', 'user_type', 'ip_type'],
      registers: [register]
    });

    this.authDuration = new Histogram({
      name: 'mcp_auth_duration_seconds',
      help: 'Duration of authentication operations',
      labelNames: ['method', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register]
    });

    // Rate limiting metrics
    this.rateLimitHits = new Counter({
      name: 'mcp_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint', 'limit_type', 'user_type'],
      registers: [register]
    });

    // Security events
    this.securityEvents = new Counter({
      name: 'mcp_security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'source'],
      registers: [register]
    });
  }

  initInfrastructureMetrics() {
    // Database metrics with connection pooling
    this.dbConnections = new Gauge({
      name: 'mcp_db_connections_active',
      help: 'Number of active database connections',
      labelNames: ['pool', 'status'],
      registers: [register]
    });

    this.dbQueries = new Counter({
      name: 'mcp_db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status', 'prepared'],
      registers: [register]
    });

    this.dbQueryDuration = new Histogram({
      name: 'mcp_db_query_duration_seconds',
      help: 'Duration of database queries',
      labelNames: ['operation', 'table'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [register]
    });

    this.dbConnectionPool = new Gauge({
      name: 'mcp_db_connection_pool_size',
      help: 'Database connection pool metrics',
      labelNames: ['pool', 'state'],
      registers: [register]
    });

    // Cache metrics with TTL tracking
    this.cacheOperations = new Counter({
      name: 'mcp_cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'cache_type', 'hit'],
      registers: [register]
    });

    this.cacheDuration = new Histogram({
      name: 'mcp_cache_operation_duration_seconds',
      help: 'Duration of cache operations',
      labelNames: ['operation', 'cache_type'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [register]
    });

    this.cacheSize = new Gauge({
      name: 'mcp_cache_size_bytes',
      help: 'Size of cache in bytes',
      labelNames: ['cache_type'],
      registers: [register]
    });

    this.cacheEntries = new Gauge({
      name: 'mcp_cache_entries_count',
      help: 'Number of entries in cache',
      labelNames: ['cache_type'],
      registers: [register]
    });
  }

  initOpenTelemetryMetrics() {
    // OpenTelemetry-compatible span metrics
    this.spanDuration = new Histogram({
      name: 'mcp_span_duration_seconds',
      help: 'Duration of traced spans',
      labelNames: ['span_name', 'span_kind', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [register]
    });

    // Trace metrics
    this.traceCount = new Counter({
      name: 'mcp_traces_total',
      help: 'Total number of traces',
      labelNames: ['service_name', 'operation'],
      registers: [register]
    });

    // Error tracking with OpenTelemetry semantics
    this.errorCount = new Counter({
      name: 'mcp_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'service_name', 'operation', 'severity'],
      registers: [register]
    });
  }

  startEnhancedSystemMetrics() {
    // Collect system metrics every 15 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 15000);

    // Collect business metrics every 30 seconds
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 30000);
  }

  collectSystemMetrics() {
    try {
      // CPU usage
      const cpuUsage = process.cpuUsage();
      if (!this.cpuUsageGauge) {
        this.cpuUsageGauge = new Gauge({
          name: 'mcp_cpu_usage_microseconds_total',
          help: 'Total CPU usage in microseconds',
          labelNames: ['type'],
          registers: [register]
        });
      }
      this.cpuUsageGauge.set({ type: 'user' }, cpuUsage.user);
      this.cpuUsageGauge.set({ type: 'system' }, cpuUsage.system);

      // Event loop lag
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        if (!this.eventLoopLag) {
          this.eventLoopLag = new Gauge({
            name: 'mcp_event_loop_lag_milliseconds',
            help: 'Event loop lag in milliseconds',
            registers: [register]
          });
        }
        this.eventLoopLag.set(lag);
      });

      // Load average (Unix-like systems)
      if (os.loadavg) {
        const loadAvg = os.loadavg();
        if (!this.loadAverage) {
          this.loadAverage = new Gauge({
            name: 'mcp_system_load_average',
            help: 'System load average',
            labelNames: ['period'],
            registers: [register]
          });
        }
        this.loadAverage.set({ period: '1m' }, loadAvg[0]);
        this.loadAverage.set({ period: '5m' }, loadAvg[1]);
        this.loadAverage.set({ period: '15m' }, loadAvg[2]);
      }
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  collectBusinessMetrics() {
    // This would typically query the database for business metrics
    // For now, we'll just update some basic counters
    try {
      // Memory count (would be from database)
      if (!this.memoryCount) {
        this.memoryCount = new Gauge({
          name: 'mcp_memories_total_count',
          help: 'Total number of memories stored',
          labelNames: ['type'],
          registers: [register]
        });
      }
      
      // This would be replaced with actual database queries
      // this.memoryCount.set({ type: 'all' }, await this.getMemoryCount());
    } catch (error) {
      console.error('Error collecting business metrics:', error);
    }
  }

  // Express middleware with enhanced tracking
  middleware() {
    return (req, res, next) => {
      const start = process.hrtime.bigint();
      const startTime = Date.now();

      // Track request size
      const requestSize = parseInt(req.get('content-length') || '0', 10);
      
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - start) / 1000000000; // Convert to seconds
        
        const route = req.route?.path || req.path || 'unknown';
        const method = req.method;
        const statusCode = res.statusCode;
        const statusClass = `${Math.floor(statusCode / 100)}xx`;
        const userAgentType = this.getUserAgentType(req.get('User-Agent'));
        const contentType = res.get('Content-Type') || 'unknown';
        const responseSize = parseInt(res.get('content-length') || '0', 10);

        // Track metrics
        this.httpRequests.inc({
          method,
          route,
          status_code: statusCode,
          user_agent_type: userAgentType,
          content_type: contentType
        });

        this.httpDuration.observe({
          method,
          route,
          status_class: statusClass
        }, duration);

        if (requestSize > 0) {
          this.httpRequestSize.observe({ method, route }, requestSize);
        }

        if (responseSize > 0) {
          this.httpResponseSize.observe({
            method,
            route,
            status_class: statusClass
          }, responseSize);
        }
      });

      next();
    };
  }

  getUserAgentType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'bot';
    }
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet')) return 'tablet';
    if (ua.includes('postman') || ua.includes('insomnia') || ua.includes('curl')) {
      return 'api_client';
    }
    return 'browser';
  }

  // Prometheus endpoint handler
  async endpoint(req, res) {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.send(metrics);
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.status(500).send('Error generating metrics');
    }
  }

  // Enhanced tracking methods

  trackMemoryOperation(operation, success, duration, metadata = {}) {
    this.memoryOperations.inc({
      operation,
      status: success ? 'success' : 'failure',
      type: metadata.type || 'unknown',
      user_id: metadata.userId || 'anonymous',
      source: metadata.source || 'unknown'
    });

    if (duration !== undefined) {
      this.memoryOperationDuration.observe({
        operation,
        type: metadata.type || 'unknown'
      }, duration);
    }
  }

  trackEmbedding(model, dimensions, success, duration, cacheHit = false) {
    this.embeddingOperations.inc({
      model,
      status: success ? 'success' : 'failure',
      dimensions: dimensions.toString(),
      cache_hit: cacheHit ? 'true' : 'false'
    });

    if (duration !== undefined) {
      this.embeddingDuration.observe({
        model,
        dimensions: dimensions.toString()
      }, duration);
    }
  }

  trackSearch(type, success, duration, resultCount, similarityThreshold) {
    this.searchOperations.inc({
      type,
      status: success ? 'success' : 'failure',
      similarity_threshold: similarityThreshold?.toString() || 'unknown',
      result_count: resultCount?.toString() || 'unknown'
    });

    if (duration !== undefined) {
      this.searchDuration.observe({
        type,
        similarity_threshold: similarityThreshold?.toString() || 'unknown'
      }, duration);
    }

    if (resultCount !== undefined) {
      this.searchResultCount.observe({ type }, resultCount);
    }
  }

  trackDbQuery(operation, table, success, duration, prepared = false) {
    this.dbQueries.inc({
      operation,
      table,
      status: success ? 'success' : 'failure',
      prepared: prepared ? 'true' : 'false'
    });

    if (duration !== undefined) {
      this.dbQueryDuration.observe({ operation, table }, duration);
    }
  }

  trackCache(operation, cacheType, hit, duration) {
    this.cacheOperations.inc({
      operation,
      cache_type: cacheType,
      hit: hit ? 'true' : 'false'
    });

    if (duration !== undefined) {
      this.cacheDuration.observe({ operation, cache_type: cacheType }, duration);
    }
  }

  trackAuth(method, success, duration, userType = 'user', ipType = 'unknown') {
    this.authAttempts.inc({
      method,
      status: success ? 'success' : 'failure',
      user_type: userType,
      ip_type: ipType
    });

    if (duration !== undefined) {
      this.authDuration.observe({
        method,
        status: success ? 'success' : 'failure'
      }, duration);
    }
  }

  trackMcpMessage(type, method, success, duration) {
    this.mcpMessages.inc({
      type,
      method,
      status: success ? 'success' : 'failure'
    });

    if (duration !== undefined) {
      this.mcpMessageDuration.observe({ type, method }, duration);
    }
  }

  trackSecurityEvent(eventType, severity, source) {
    this.securityEvents.inc({
      event_type: eventType,
      severity,
      source
    });
  }

  trackError(errorType, serviceName, operation, severity = 'error') {
    this.errorCount.inc({
      error_type: errorType,
      service_name: serviceName,
      operation,
      severity
    });
  }

  // Gauge update methods
  updateDbConnections(pool, activeCount, idleCount, totalCount) {
    this.dbConnections.set({ pool, status: 'active' }, activeCount);
    this.dbConnections.set({ pool, status: 'idle' }, idleCount);
    this.dbConnections.set({ pool, status: 'total' }, totalCount);
  }

  updateCacheSize(cacheType, sizeBytes, entryCount) {
    this.cacheSize.set({ cache_type: cacheType }, sizeBytes);
    this.cacheEntries.set({ cache_type: cacheType }, entryCount);
  }
}

export const enhancedMetrics = new EnhancedMetricsService();
export default enhancedMetrics;