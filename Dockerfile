# Production-optimized Dockerfile for MCP Memory Server
# Multi-stage build for minimal image size and security

# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Create necessary directories
RUN mkdir -p models logs tmp

# Stage 3: Production
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    tini \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/models ./models
COPY --from=builder --chown=appuser:appgroup /app/logs ./logs
COPY --from=builder --chown=appuser:appgroup /app/tmp ./tmp

# Set permissions
RUN chmod -R 750 /app && \
    chmod -R 770 /app/logs /app/tmp /app/models

USER appuser

# Expose ports
EXPOSE 3333 3334

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3334/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the server
CMD ["node", "src/index.js"]