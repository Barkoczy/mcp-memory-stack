# Reference Documentation

Technical specifications, API documentation, and comprehensive reference materials for MCP Memory Stack.

## 📖 API References

### Core APIs
- **[REST API](api/rest-api.md)** - Complete HTTP API specification
- **[MCP Protocol](api/mcp-protocol.md)** - Native MCP protocol implementation
- **[Webhooks](api/webhooks.md)** - Event notification system

### Configuration References
- **[Environment Variables](configuration/environment-variables.md)** - All environment settings
- **[Config Files](configuration/config-files.md)** - Configuration file formats

### Architecture References
- **[System Overview](architecture/system-overview.md)** - High-level system architecture
- **[Database Schema](architecture/database-schema.md)** - Complete database specification
- **[Component Details](architecture/components.md)** - Individual component specifications
- **[Project Status Report](project-status.md)** - Production readiness assessment

## 🔍 Quick Reference

### REST API Endpoints
```
POST   /api/v1/memories           # Create memory
GET    /api/v1/memories           # List memories  
GET    /api/v1/memories/search    # Search memories
GET    /api/v1/memories/:id       # Get memory
PUT    /api/v1/memories/:id       # Update memory
DELETE /api/v1/memories/:id       # Delete memory
```

### MCP Tools
- `memory_create` - Create new memory with embedding
- `memory_search` - Semantic search with filters
- `memory_list` - List memories with pagination

### Environment Variables
```bash
NODE_ENV=production|development    # Runtime mode
DATABASE_URL=postgresql://...      # Database connection
REDIS_URL=redis://...             # Cache connection (optional)
API_PORT=3333                     # REST API port
HEALTH_PORT=3334                  # Health check port
```

## 📋 Reference Categories

### API Documentation
Detailed specifications for all APIs and protocols:
- **REST API** - HTTP endpoints, request/response formats, authentication
- **MCP Protocol** - Native protocol implementation, tools, capabilities
- **Webhooks** - Event system, payload formats, security

### Configuration
Complete configuration references:
- **Environment Variables** - All supported environment settings
- **Config Files** - YAML/JSON configuration file schemas
- **Runtime Options** - Command-line arguments and startup options

### Architecture
Technical system specifications:
- **System Overview** - Component interaction diagrams
- **Database Schema** - Tables, indexes, relationships
- **Components** - Individual service specifications

## 🎯 Reference Usage Patterns

### For Developers
1. **[REST API](api/rest-api.md)** - Integration with HTTP clients
2. **[Database Schema](architecture/database-schema.md)** - Direct database access
3. **[Component Details](architecture/components.md)** - Custom implementations

### For System Administrators
1. **[Environment Variables](configuration/environment-variables.md)** - Deployment configuration
2. **[System Overview](architecture/system-overview.md)** - Infrastructure planning
3. **[Config Files](configuration/config-files.md)** - Advanced configuration

### For AI/MCP Developers
1. **[MCP Protocol](api/mcp-protocol.md)** - Native protocol integration
2. **[REST API](api/rest-api.md)** - HTTP wrapper usage
3. **[Webhooks](api/webhooks.md)** - Event-driven integration

## 📚 Reference Standards

All reference documentation follows these standards:

### API Documentation
- **OpenAPI 3.0** specification format
- **Complete examples** for all endpoints
- **Error codes** and troubleshooting
- **Rate limiting** and pagination details

### Schema Documentation
- **JSON Schema** for all data structures
- **Field descriptions** with constraints
- **Example values** and formats
- **Version compatibility** information

### Architecture Documentation
- **C4 model** for architecture diagrams
- **Component interfaces** clearly defined
- **Data flow** documentation
- **Security boundaries** identified

## 🔗 External References

### Standards Compliance
- **[MCP Specification](https://spec.modelcontextprotocol.io/)** - Official MCP protocol
- **[OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.3)** - API documentation standard
- **[JSON Schema](https://json-schema.org/)** - Data validation schema
- **[RFC 7519](https://tools.ietf.org/html/rfc7519)** - JWT token format

### Dependencies
- **[PostgreSQL](https://www.postgresql.org/docs/)** - Database documentation
- **[pgvector](https://github.com/pgvector/pgvector)** - Vector extension docs
- **[Node.js](https://nodejs.org/en/docs/)** - Runtime documentation
- **[Docker](https://docs.docker.com/)** - Container documentation

## 💡 Using Reference Documentation

1. **Bookmark frequently used sections** - API endpoints, environment variables
2. **Use browser search** - Ctrl+F to find specific parameters
3. **Copy-paste examples** - All examples are tested and working
4. **Check version compatibility** - Ensure you're using the correct version
5. **Cross-reference related sections** - Links connect related information

---

*Reference documentation is information-oriented and provides comprehensive technical details. Use this when you need to look up specific information.*