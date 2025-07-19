# System Overview

High-level architecture and component overview of MCP Memory Stack.

## Technology Stack

### Core Components
- **Runtime**: Node.js 20+ with ES modules
- **Database**: PostgreSQL 14+ with pgvector extension  
- **Embeddings**: Transformers.js (BERT model: all-MiniLM-L6-v2)
- **Communication**: JSON-RPC 2.0 via stdio + REST API
- **Container**: Docker with multi-stage builds

### Dependencies
- **Core**: `pg` (PostgreSQL driver), `@xenova/transformers`, `express`
- **Security**: `jsonwebtoken`, `bcrypt`, `helmet`
- **Monitoring**: `prometheus-client`, `winston`
- **Development**: `nodemon`, `jest`

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Clients    │    │   REST Clients  │    │  Health Checks  │
│   (MCP Proto)   │    │   (HTTP API)    │    │   (Monitoring)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ JSON-RPC 2.0         │ HTTP/HTTPS          │ HTTP
          │ (stdin/stdout)       │                      │
          │                      │                      │
    ┌─────▼──────────────────────▼──────────────────────▼─────┐
    │                MCP Memory Server                        │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
    │  │MCP Protocol │  │  REST API   │  │Health Server│     │
    │  │   Handler   │  │   Wrapper   │  │   (3334)    │     │
    │  │             │  │   (3333)    │  │             │     │
    │  └─────────────┘  └─────────────┘  └─────────────┘     │
    │                         │                              │
    │  ┌─────────────┐       │       ┌─────────────┐        │
    │  │   Memory    │◄──────┼──────►│ Embedding   │        │
    │  │  Service    │       │       │  Service    │        │
    │  └─────────────┘       │       └─────────────┘        │
    │           │             │                │             │
    │           │             │                │             │
    │  ┌────────▼─────────────▼────────────────▼──────┐     │
    │  │            Database Pool Manager              │     │
    │  └───────────────────────┬───────────────────────┘     │
    └──────────────────────────┼─────────────────────────────┘
                               │
    ┌──────────────────────────▼─────────────────────────────┐
    │                PostgreSQL + pgvector                   │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
    │  │   memories  │  │    users    │  │   sessions  │    │
    │  │   (vectors) │  │  (auth)     │  │   (cache)   │    │
    │  └─────────────┘  └─────────────┘  └─────────────┘    │
    └────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Protocol Layer

#### MCP Protocol Handler (`src/core/mcp-server.js`)
- **Purpose**: Native MCP protocol implementation
- **Transport**: stdin/stdout JSON-RPC 2.0
- **Features**: Tool registration, request handling, error management
- **Clients**: AI assistants, Claude Desktop, cursor

#### REST API Wrapper (`src/core/rest-api.js`)
- **Purpose**: HTTP wrapper for MCP functionality
- **Protocol**: REST over HTTP/HTTPS
- **Features**: Authentication, rate limiting, CORS
- **Clients**: Web applications, integrations

#### Health Server (`src/utils/health.js`)
- **Purpose**: Service monitoring and health checks
- **Protocol**: HTTP
- **Features**: Database connectivity, service status
- **Clients**: Load balancers, monitoring systems

### 2. Business Logic Layer

#### Memory Service (`src/services/memory.js`)
- **Purpose**: Core memory operations (CRUD)
- **Features**: Vector embedding, similarity search, filtering
- **Dependencies**: Database, Embedding Service

#### Embedding Service (`src/services/embedding.js`)
- **Purpose**: Text-to-vector conversion
- **Model**: sentence-transformers/all-MiniLM-L6-v2 (384d)
- **Features**: Batch processing, caching, model management

#### Search Service (`src/services/search.js`)
- **Purpose**: Advanced search capabilities
- **Features**: Semantic search, hybrid search, aggregations
- **Performance**: Vector indexing, query optimization

### 3. Data Layer

#### Database Pool (`src/database/connection.js`)
- **Purpose**: PostgreSQL connection management
- **Features**: Connection pooling, health checks, reconnection
- **Configuration**: Environment-based (prod/dev)

#### Query Manager (`src/database/queries.js`)
- **Purpose**: Optimized database queries
- **Features**: Parameterized queries, transaction support
- **Security**: SQL injection prevention

### 4. Utility Layer

#### Logger (`src/utils/logger.js`)
- **Purpose**: Structured logging
- **Levels**: error, warn, info, debug
- **Outputs**: Console, file, structured JSON

#### Cache (`src/utils/cache.js`)
- **Purpose**: Performance optimization
- **Types**: In-memory LRU, Redis (optional)
- **Use Cases**: Embeddings, frequent queries

#### Metrics (`src/utils/metrics.js`)
- **Purpose**: Performance monitoring
- **Format**: Prometheus metrics
- **Metrics**: Request latency, error rates, resource usage

## Data Flow

### Memory Creation Flow
```
1. Client Request → 2. Protocol Handler → 3. Memory Service
                                              ↓
8. Response ← 7. Protocol Handler ← 6. Memory Service
                                              ↓
                    4. Embedding Service → 5. Database
```

### Search Flow
```
1. Search Request → 2. Protocol Handler → 3. Search Service
                                              ↓
                                         4. Generate Query Embedding
                                              ↓
                                         5. Vector Similarity Search
                                              ↓
8. Results ← 7. Protocol Handler ← 6. Search Service
```

## Deployment Architecture

### Container Structure
```
┌─────────────────────────────────────┐
│          Application Container       │
│  ┌─────────────┐  ┌─────────────┐   │
│  │  App Layer  │  │ Health Check│   │
│  │   (3333)    │  │   (3334)    │   │
│  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│         Database Container          │
│  ┌─────────────────────────────┐    │
│  │      PostgreSQL 15          │    │
│  │      + pgvector             │    │
│  │      (Port 5432)            │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Network Configuration
```
┌─────────────────┐
│   Load Balancer │ (443/80)
└─────────┬───────┘
          │
┌─────────▼───────┐
│  Application    │ (3333/3334)
│   Containers    │
└─────────┬───────┘
          │
┌─────────▼───────┐
│    Database     │ (5432)
│   (Internal)    │
└─────────────────┘
```

## Security Architecture

### Security Layers
1. **Network**: Firewall, VPN, TLS termination
2. **Application**: Authentication, authorization, rate limiting
3. **Database**: Connection encryption, user isolation
4. **Container**: Non-root user, read-only filesystem

### Authentication Flow
```
1. Client → 2. API Gateway → 3. Auth Service → 4. Application
                ↓                   ↓
            Rate Limiting       Token Validation
```

## Performance Characteristics

### Latency Targets
- **Memory Creation**: < 100ms (excluding embedding generation)
- **Search Operations**: < 50ms (for < 10K memories)
- **Health Checks**: < 10ms

### Throughput Capacity
- **Memory Operations**: 1000+ operations/second
- **Search Queries**: 2000+ queries/second
- **Concurrent Connections**: 500+ connections

### Scaling Patterns
- **Vertical**: Increase CPU/RAM for embedding workloads
- **Horizontal**: Multiple app instances with shared database
- **Database**: Read replicas for search-heavy workloads

## Configuration Management

### Environment-Based Configuration
```javascript
const config = {
  production: {
    db: { poolSize: 50, ssl: true },
    cache: { enabled: true, redis: true },
    embedding: { model: 'large', batchSize: 64 }
  },
  development: {
    db: { poolSize: 10, ssl: false },
    cache: { enabled: false },
    embedding: { model: 'small', batchSize: 16 }
  }
};
```

### Runtime Configuration
- **Environment Variables**: Database URLs, API keys
- **Config Files**: Feature flags, model settings
- **Secrets**: Database passwords, JWT secrets

## Monitoring & Observability

### Health Monitoring
- **Application Health**: Service status, dependency checks
- **Database Health**: Connection count, query performance
- **System Health**: Memory, CPU, disk usage

### Metrics Collection
- **Application Metrics**: Request rates, error rates, latency
- **Business Metrics**: Memory creation rate, search accuracy
- **System Metrics**: Resource utilization, performance

### Logging Strategy
- **Structured Logging**: JSON format for parsing
- **Log Levels**: Error, warn, info, debug
- **Log Aggregation**: Centralized logging system

## Design Principles

### 1. Modularity
- Clear separation of concerns
- Independent, testable components
- Minimal coupling between layers

### 2. Performance
- Lazy loading for expensive operations
- Connection pooling and caching
- Optimized database queries

### 3. Reliability
- Graceful error handling
- Health checks and monitoring
- Fault tolerance patterns

### 4. Security
- Defense in depth
- Principle of least privilege
- Input validation and sanitization

### 5. Maintainability
- Clear documentation
- Comprehensive testing
- Consistent coding standards

---

This system overview provides the foundation for understanding how all components work together to deliver a high-performance memory management system.