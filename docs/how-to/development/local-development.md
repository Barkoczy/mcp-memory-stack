# Local Development

Guide for setting up and working with MCP Memory Stack in development mode.

## Quick Start

### Docker Development
```bash
# Start the basic stack (PostgreSQL + MCP Memory)
docker-compose up -d

# Start with specific profiles
docker-compose --profile cache up -d        # With Redis caching
docker-compose --profile admin up -d        # With pgAdmin
docker-compose --profile cache --profile admin up -d  # Full stack

# Environment-specific deployments
docker-compose -f docker-compose.dev.yml up -d      # Development
docker-compose -f docker-compose.staging.yml up -d  # Staging
docker-compose -f docker-compose.prod.yml up -d     # Production
```

### Native Development
```bash
# Install dependencies
npm install

# Run in development mode with hot reloading
npm run dev

# Run production mode
npm run start
```

## Development Commands

### Docker Operations
```bash
# View logs
docker-compose logs -f mcp-memory
docker-compose logs -f postgres

# Stop and clean up
docker-compose down
docker-compose down -v  # Also remove volumes

# Rebuild and restart
docker-compose up --build -d

# Scale services
docker-compose up -d --scale mcp-memory=3
```

### Deployment Scripts
```bash
# Quick setup (basic profile)
./setup.sh basic

# Deploy to specific environment
./deploy.sh dev
./deploy.sh staging
./deploy.sh production

# Generate production secrets
./secrets/generate-secrets.sh

# Run health checks
./test-setup.sh
curl http://localhost:3334/health
```

### Database Access
```bash
# Direct PostgreSQL access
docker-compose exec postgres psql -U mcp_user -d mcp_memory

# Via pgAdmin (if admin profile enabled)
# URL: http://localhost:8080
# Email: admin@mcp-memory.local
# Password: from PGLADMIN_PASSWORD in .env
```

## Development Environment Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for native development)
- Git

### Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### Key Environment Variables
```bash
# Core settings
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://mcp_user:password@localhost:5432/mcp_memory
DB_POOL_SIZE=10

# API ports
API_PORT=3333
HEALTH_PORT=3334

# Development features
ENABLE_CORS=true
DEBUG_LOGGING=true
HOT_RELOAD=true
```

## Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/mcp-memory-stack.git
cd mcp-memory-stack

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Verify setup
curl http://localhost:3334/health
```

### 2. Code Changes
```bash
# For Docker development (hot reload enabled)
# Changes are automatically reflected

# For native development
npm run dev  # Starts with nodemon
```

### 3. Testing
```bash
# Run tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Test MCP protocol
./test-mcp-protocol.sh

# Test REST API
curl -X POST http://localhost:3333/api/v1/memories \
  -H "Content-Type: application/json" \
  -d '{"type":"test","content":{"message":"hello"},"source":"dev"}'
```

### 4. Database Operations
```bash
# Reset database
docker-compose down -v
docker-compose up -d

# View database logs
docker-compose logs postgres

# Manual migrations (if needed)
docker-compose exec mcp-memory npm run migrate
```

## Development Features

### Hot Reloading
- **Docker**: Volume mounts for automatic file watching
- **Native**: Nodemon for automatic restarts
- **Configuration**: Changes to config files trigger restart

### Debug Logging
```bash
# Enable debug logging
LOG_LEVEL=debug

# View detailed logs
docker-compose logs -f mcp-memory | grep -i debug
```

### Development Profiles
```bash
# Basic development
docker-compose -f docker-compose.dev.yml up -d

# With additional tools
docker-compose --profile admin --profile cache -f docker-compose.dev.yml up -d
```

## Debugging

### Application Debugging
```bash
# View application logs
docker-compose logs -f mcp-memory

# Debug specific component
DEBUG=memory:* npm run dev
DEBUG=embedding:* npm run dev
DEBUG=database:* npm run dev
```

### Database Debugging
```bash
# Check database connectivity
docker-compose exec postgres pg_isready -U mcp_user

# Query recent memories
docker-compose exec postgres psql -U mcp_user -d mcp_memory \
  -c "SELECT id, type, created_at FROM memories ORDER BY created_at DESC LIMIT 5;"

# Check vector operations
docker-compose exec postgres psql -U mcp_user -d mcp_memory \
  -c "SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL;"
```

### Performance Debugging
```bash
# Monitor resource usage
docker stats

# Check slow queries
docker-compose exec postgres psql -U mcp_user -d mcp_memory \
  -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Common Development Tasks

### Adding New Features
1. **Create feature branch**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Implement changes**
   - Add code in appropriate `src/` directory
   - Add tests in `tests/` directory
   - Update documentation if needed

3. **Test changes**
   ```bash
   npm test
   ./test-setup.sh
   ```

4. **Submit for review**
   ```bash
   git commit -am "Add new feature"
   git push origin feature/new-feature
   ```

### Database Schema Changes
1. **Create migration**
   ```bash
   # Add SQL migration in migrations/
   touch migrations/003_add_new_table.sql
   ```

2. **Test migration**
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

3. **Update models**
   ```bash
   # Update src/services/memory.js or relevant files
   ```

### API Changes
1. **Update schema**
   ```javascript
   // In src/core/rest-api.js
   const newEndpointSchema = { /* ... */ };
   ```

2. **Add tests**
   ```javascript
   // In tests/api.test.js
   describe('New endpoint', () => { /* ... */ });
   ```

3. **Update documentation**
   ```bash
   # Update docs/reference/api/rest-api.md
   ```

## Development Tips

### Performance Optimization
- **Use Redis cache** in development with `--profile cache`
- **Monitor query performance** with `pg_stat_statements`
- **Profile embedding generation** for bottlenecks

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking (if using TypeScript)
npm run type-check
```

### Docker Optimization
```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build

# Clean up development images
docker system prune -f
```

### Debugging Network Issues
```bash
# Check Docker networks
docker network ls

# Inspect network configuration
docker network inspect mcp-memory-stack_default

# Test connectivity between containers
docker-compose exec mcp-memory ping postgres
```

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Change ports in docker-compose.dev.yml
# PostgreSQL: "5433:5432"
# MCP Memory: "3334:3333"
```

**Database connection issues:**
```bash
# Check database status
docker-compose ps postgres

# Verify connection string
echo $DATABASE_URL
```

**Hot reload not working:**
```bash
# Verify volume mounts
docker-compose config

# Check file permissions
ls -la src/
```

**Memory/performance issues:**
```bash
# Monitor resource usage
docker stats

# Adjust resource limits in docker-compose.dev.yml
```

For more troubleshooting, see [Common Issues](../troubleshooting/common-issues.md).

---

This development guide covers the essential workflows for working with MCP Memory Stack. For production deployment, see [Production Setup](../deployment/production-setup.md).