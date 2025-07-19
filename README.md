# 🧠 MCP Memory Stack

High-performance memory management system implementing the Model Context
Protocol (MCP) with both REST API and native MCP protocol support.

## 🚀 Quick Start

### Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/mcp-memory-stack.git
cd mcp-memory-stack

# 2. Start with Docker Compose
docker-compose up -d

# 3. Verify it's working
curl http://localhost:3334/health
```

### Production Setup

```bash
# 1. Generate production secrets
chmod +x secrets/generate-secrets.sh
./secrets/generate-secrets.sh

# 2. Deploy production stack
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify deployment
curl http://localhost:3334/health
```

## 📋 What's Included

- **🧠 MCP Memory Server** - Native MCP protocol + REST API
- **🗄️ PostgreSQL + pgvector** - Vector database for semantic search
- **🔍 Semantic Search** - BERT embeddings for intelligent memory retrieval
- **🔒 Production Security** - Authentication, rate limiting, encryption
- **📊 Monitoring** - Health checks, metrics, logging
- **🐳 Docker Ready** - Containerized deployment with multi-stage builds

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Clients    │    │   Web Apps      │    │   Monitoring    │
│   (MCP Proto)   │    │   (REST API)    │    │   (Health)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ JSON-RPC             │ HTTP/HTTPS          │ HTTP
          │ stdin/stdout         │                      │
          │                      │                      │
    ┌─────▼──────────────────────▼──────────────────────▼─────┐
    │                MCP Memory Stack                         │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
    │  │MCP Protocol │  │  REST API   │  │   Health    │     │
    │  │   Server    │  │   Server    │  │   Server    │     │
    │  │   (stdio)   │  │   (3333)    │  │   (3334)    │     │
    │  └─────────────┘  └─────────────┘  └─────────────┘     │
    │           │                │                │           │
    │           └────────────────┼────────────────┘           │
    │                            │                            │
    │  ┌─────────────────────────▼─────────────────────┐      │
    │  │           Memory Service Layer              │      │
    │  │  • Semantic search  • CRUD operations      │      │
    │  │  • Embeddings      • Caching              │      │
    │  └─────────────────────┬───────────────────────┘      │
    └────────────────────────┼──────────────────────────────┘
                             │
    ┌────────────────────────▼──────────────────────────────┐
    │              PostgreSQL + pgvector                    │
    │  Vector similarity search • ACID compliance          │
    └───────────────────────────────────────────────────────┘
```

## 📖 Documentation

Our documentation follows the [Diátaxis framework](https://diataxis.fr/) for
different user needs:

### 🎓 [Tutorials](docs/tutorials/) - _Learn step-by-step_

- [Getting Started](docs/tutorials/01-getting-started.md) - Your first steps
- [Creating Memories](docs/tutorials/02-first-memory.md) - Basic operations
- [Advanced Usage](docs/tutorials/03-advanced-usage.md) - Search and filtering

### 🛠️ [How-to Guides](docs/how-to/) - _Solve specific problems_

- **Deployment**: [Docker](docs/how-to/deployment/docker-deployment.md) |
  [Production](docs/how-to/deployment/production-setup.md) |
  [Kubernetes](docs/how-to/deployment/kubernetes-deployment.md)
- **Configuration**:
  [Environment](docs/how-to/configuration/environment-setup.md) |
  [Security](docs/how-to/configuration/security-config.md) |
  [Performance](docs/how-to/configuration/performance-tuning.md)
- **Troubleshooting**:
  [Common Issues](docs/how-to/troubleshooting/common-issues.md) |
  [Debugging](docs/how-to/troubleshooting/debugging-guide.md)

### 📖 [Reference](docs/reference/) - _Look up technical details_

- **APIs**: [REST API](docs/reference/api/rest-api.md) |
  [MCP Protocol](docs/reference/api/mcp-protocol.md) |
  [Webhooks](docs/reference/api/webhooks.md)
- **Configuration**:
  [Environment Variables](docs/reference/configuration/environment-variables.md)
  | [Config Files](docs/reference/configuration/config-files.md)
- **Architecture**:
  [System Overview](docs/reference/architecture/system-overview.md) |
  [Database Schema](docs/reference/architecture/database-schema.md)

### 💡 [Explanations](docs/explanation/) - _Understand concepts_

- **Concepts**: [MCP Protocol](docs/explanation/concepts/mcp-protocol.md) |
  [Vector Search](docs/explanation/concepts/vector-search.md) |
  [Memory Management](docs/explanation/concepts/memory-management.md)
- **Architecture**:
  [Design Decisions](docs/explanation/architecture/design-decisions.md) |
  [Performance Analysis](docs/explanation/architecture/performance-analysis.md)
- **Comparisons**:
  [vs Alternatives](docs/explanation/comparisons/vs-alternatives.md) |
  [Migration Guides](docs/explanation/comparisons/migration-guides.md)

## 🔌 API Examples

### REST API

```bash
# Create a memory
curl -X POST http://localhost:3333/api/v1/memories \
  -H "Content-Type: application/json" \
  -d '{
    "type": "learning",
    "content": {
      "topic": "Docker optimization",
      "details": "Use multi-stage builds for smaller images"
    },
    "source": "documentation",
    "tags": ["docker", "optimization"],
    "confidence": 0.95
  }'

# Search memories
curl "http://localhost:3333/api/v1/memories/search?query=docker%20optimization&limit=5"

# List memories
curl "http://localhost:3333/api/v1/memories?type=learning&limit=10"
```

### MCP Protocol

```json
// Tool call via MCP protocol
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "memory_create",
    "arguments": {
      "type": "experience",
      "content": {
        "situation": "Database optimization",
        "action": "Added index on frequently queried column",
        "result": "50% faster queries"
      },
      "source": "production",
      "confidence": 0.9
    }
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Core settings
NODE_ENV=production|development    # Runtime mode
LOG_LEVEL=info                     # Logging level

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_POOL_SIZE=20                    # Connection pool size

# API
API_PORT=3333                      # REST API port
HEALTH_PORT=3334                   # Health check port

# Security (optional)
JWT_SECRET=your-secret-key         # JWT authentication
API_KEYS=key1,key2,key3           # API key authentication

# Performance (optional)
REDIS_URL=redis://localhost:6379  # Cache server
EMBEDDING_MODEL=all-MiniLM-L6-v2  # Embedding model
```

### Docker Compose Profiles

```bash
# Basic setup (default)
docker-compose up -d

# With Redis caching
docker-compose --profile cache up -d

# With pgAdmin database management
docker-compose --profile admin up -d

# Production with monitoring
docker-compose --profile monitoring up -d

# Everything
docker-compose --profile cache --profile admin --profile monitoring up -d
```

## 🚀 Production Features

### 🔒 Security

- **Authentication**: JWT tokens and API keys
- **Network Security**: TLS encryption, firewall rules
- **Container Security**: Non-root users, dropped capabilities
- **Input Validation**: Comprehensive request validation
- **Secrets Management**: Docker secrets, environment isolation

### 📊 Monitoring & Observability

- **Health Checks**: Application and dependency health monitoring
- **Metrics**: Prometheus metrics collection
- **Logging**: Structured JSON logging with multiple levels
- **Performance**: Request tracing and performance monitoring

### ⚡ Performance

- **Vector Search**: Optimized pgvector indexing for semantic search
- **Caching**: Multi-layer caching with Redis support
- **Connection Pooling**: Efficient database connection management
- **Batch Operations**: Bulk memory operations for high throughput

### 🔄 Deployment

- **Multi-Environment**: Separate configs for dev/staging/production
- **Container Optimization**: Multi-stage builds, security hardening
- **Scaling**: Horizontal scaling with shared database
- **Health Monitoring**: Kubernetes/Docker health check integration

## 🎯 Use Cases

### AI Assistant Memory

```javascript
// Store conversation context
await createMemory({
  type: 'conversation',
  content: {
    user_query: 'How to optimize Docker builds?',
    assistant_response: 'Use multi-stage builds...',
    context: 'Docker optimization discussion',
  },
  source: 'chat_session',
  tags: ['docker', 'optimization', 'build'],
});
```

### Knowledge Management

```javascript
// Store and retrieve documentation
await createMemory({
  type: 'documentation',
  content: {
    title: 'API Rate Limiting',
    summary: 'Implementation guide for rate limiting',
    key_points: [
      'Use sliding window',
      'Redis for state',
      'Graceful degradation',
    ],
  },
  source: 'internal_docs',
  tags: ['api', 'rate-limiting', 'redis'],
});
```

### Learning Systems

```javascript
// Store learning experiences
await createMemory({
  type: 'learning',
  content: {
    concept: 'Vector databases',
    understanding: 'Specialized for similarity search',
    applications: ['RAG', 'recommendation systems', 'semantic search'],
  },
  source: 'training',
  confidence: 0.85,
});
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
mcp-memory-stack/
├── src/                    # Source code
│   ├── core/              # Protocol handlers
│   ├── services/          # Business logic
│   ├── database/          # Data layer
│   └── utils/             # Utilities
├── docs/                  # Documentation
│   ├── tutorials/         # Learning guides
│   ├── how-to/           # Problem-solving guides
│   ├── reference/        # Technical specs
│   └── explanation/      # Concepts
├── scripts/              # Utility scripts
├── secrets/              # Secret generation
└── monitoring/           # Monitoring configs
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**:
  [GitHub Issues](https://github.com/your-org/mcp-memory-stack/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/your-org/mcp-memory-stack/discussions)
- **Enterprise**: [Contact Us](mailto:enterprise@mcp-memory.com)

## ⭐ Acknowledgments

- [sdimitrov/mcp-memory](https://github.com/sdimitrov/mcp-memory) - Original
  inspiration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol
  specification
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search

---

**Built for the future of AI memory systems** 🚀
