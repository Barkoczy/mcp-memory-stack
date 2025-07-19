# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Core Development

```bash
# Start development server with hot reload
npm run dev

# Run production server
npm run prod

# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report

# Test MCP protocol specifically
npm run test:mcp
npm run test:protocol
```

### Code Quality

```bash
# Lint and fix code issues
npm run lint

# Check linting without fixes
npm run lint:check

# Format code with prettier
npm run format

# Check formatting without changes
npm run format:check

# Type checking (TypeScript definitions)
npm run type:check

# Run all code quality checks
npm run code:check

# Fix all auto-fixable issues
npm run code:fix
```

### Docker Operations

```bash
# Build Docker image
npm run docker:build

# Start development environment
npm run docker:dev

# Start production environment
npm run docker:prod

# Different compose profiles available:
docker-compose --profile cache up -d        # With Redis caching
docker-compose --profile admin up -d        # With pgAdmin
docker-compose --profile monitoring up -d   # With Prometheus/Grafana
```

### Database and Setup

```bash
# Initialize database and setup environment
npm run setup

# Setup test environment
npm run test:setup

# Health check the running system
npm run health:check
```

## Architecture Overview

### Core Components

- **src/index.js**: Main application entry point that orchestrates all servers
- **src/core/mcp-server.js**: Native MCP protocol implementation via
  stdin/stdout JSON-RPC
- **src/core/rest-api.js**: HTTP REST API wrapper for web integrations
- **src/services/memory.js**: Core business logic for memory CRUD operations
  with semantic search
- **src/services/embedding.js**: Text-to-vector conversion using Transformers.js
- **src/database/connection.js**: PostgreSQL connection pooling and management
- **src/utils/**: Shared utilities (logging, caching, auth, metrics, health)

### Server Architecture

The application runs **three concurrent servers**:

1. **MCP Protocol Server**: JSON-RPC 2.0 via stdin/stdout for AI clients
2. **REST API Server**: HTTP server on port 3333 for web integrations
3. **Health Check Server**: HTTP server on port 3334 for monitoring

### Database Schema

- **PostgreSQL 14+ with pgvector extension** for vector similarity search
- **memories table**: Stores content, embeddings (384-dim vectors), metadata,
  tags
- **Vector indexing**: Uses pgvector's cosine similarity for semantic search

### Configuration System

- **Environment-based**: `config.js` has separate production/development configs
- **Runtime modes**: Controlled by `NODE_ENV` and various feature flags
- **Key settings**: Database pools, embedding models, security, caching,
  monitoring

## Key Development Patterns

### Memory Operations

- All content is automatically converted to embeddings using
  sentence-transformers
- Search uses vector similarity with configurable thresholds (default 0.7)
- Supports filtering by type, tags, date ranges, confidence scores
- Implements caching for expensive embedding operations

### Protocol Dual-Mode

- **MCP Mode**: For AI assistants like Claude Desktop - uses stdio transport
- **REST Mode**: For web applications - standard HTTP with authentication
- Both modes share the same underlying MemoryService business logic

### Error Handling

- Comprehensive error handling with structured logging
- MCP protocol errors follow JSON-RPC 2.0 error format
- REST API returns standard HTTP status codes
- Database transaction rollback on batch operation failures

### Testing Strategy

- **Unit tests**: Individual service and utility testing
- **Integration tests**: Database and API endpoint testing
- **E2E tests**: Full MCP protocol communication testing
- **Test helpers**: MCP client simulator for protocol testing

## Environment Configuration

### Development

- Database: Local PostgreSQL with relaxed settings
- Embedding: Lightweight Xenova/all-MiniLM-L6-v2 model (384 dimensions)
- Security: Authentication disabled, CORS enabled
- Caching: Disabled for easier debugging

### Production

- Database: Connection pooling (50 connections), SSL required
- Embedding: Full sentence-transformers model (768 dimensions)
- Security: JWT/API key authentication, rate limiting
- Caching: Redis-based with extended TTLs
- Monitoring: Prometheus metrics, structured JSON logging

## Common File Locations

- **Tests**: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- **Config**: Database init in `config/database/init.sql`, migrations in
  `migrations/`
- **Scripts**: Utility scripts in `scripts/` for deployment, health checks,
  testing
- **Documentation**: Comprehensive docs in `docs/` following Diátaxis framework
- **Docker**: Multiple compose files for different environments and profiles
