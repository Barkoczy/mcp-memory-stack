# Multi-stage build for production-optimized Fastify service
# Stage 1: Build dependencies and compile TypeScript
FROM node:20.11.0-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with production optimizations
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production runtime
FROM node:20.11.0-alpine AS runtime

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    dumb-init \
    tzdata \
    curl \
    && apk upgrade --no-cache

# Create non-root user for security
RUN addgroup -g 1000 -S fastify && \
    adduser -u 1000 -S fastify -G fastify

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=fastify:fastify /app/node_modules ./node_modules
COPY --from=builder --chown=fastify:fastify /app/dist ./dist
COPY --from=builder --chown=fastify:fastify /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/cache /app/config && \
    chown -R fastify:fastify /app

# Switch to non-root user
USER fastify

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps" \
    PORT=3333 \
    METRICS_PORT=9090 \
    LOG_LEVEL=info \
    HEALTH_CHECK_TIMEOUT=5000

# Expose ports
EXPOSE 3333 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Add labels for better container management
LABEL \
    maintainer="platform-team@company.com" \
    version="1.0.0" \
    description="MCP Memory Stack Fastify API Gateway Service" \
    org.opencontainers.image.title="MCP Fastify Service" \
    org.opencontainers.image.description="Enterprise Fastify API Gateway for MCP Memory Stack" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.vendor="Company Platform Team" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.documentation="https://docs.company.com/mcp-memory-stack" \
    org.opencontainers.image.source="https://github.com/company/mcp-memory-stack"