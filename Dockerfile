# Multi-stage build for production-optimized MCP Memory Server
# Updated for 2025 TypeScript build system with tsup

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
COPY tsup.config.ts ./

# Install dependencies with production optimizations
RUN npm ci --no-audit --no-fund

# Copy source code
COPY src/ ./src/
COPY config/ ./config/
COPY migrations/ ./migrations/

# Build TypeScript to JavaScript using tsup
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
RUN addgroup -S mcpapp && \
    adduser -u 1001 -S mcpapp -G mcpapp

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=mcpapp:mcpapp /app/node_modules ./node_modules
COPY --from=builder --chown=mcpapp:mcpapp /app/dist ./dist
COPY --from=builder --chown=mcpapp:mcpapp /app/config ./config
COPY --from=builder --chown=mcpapp:mcpapp /app/migrations ./migrations
COPY --from=builder --chown=mcpapp:mcpapp /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/cache /app/models /app/tmp && \
    chown -R mcpapp:mcpapp /app

# Remove dev dependencies to minimize image size
RUN npm prune --omit=dev && \
    npm cache clean --force

# Switch to non-root user
USER mcpapp

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps" \
    PORT=3333 \
    HEALTH_PORT=3334 \
    LOG_LEVEL=info

# Expose ports
EXPOSE 3333 3334

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3334/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using built ESM output
CMD ["node", "dist/index.mjs"]

# Add labels for better container management
LABEL \
    maintainer="platform-team@company.com" \
    version="1.0.0" \
    description="MCP Memory Stack - Enterprise TypeScript API Server" \
    org.opencontainers.image.title="MCP Memory Server" \
    org.opencontainers.image.description="Enterprise MCP Memory Management Server with TypeScript build" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.vendor="Company Platform Team" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.documentation="https://docs.company.com/mcp-memory-stack" \
    org.opencontainers.image.source="https://github.com/company/mcp-memory-stack"