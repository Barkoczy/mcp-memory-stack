# Production-optimized Dockerfile for MCP Memory Server
# Multi-stage build for minimal image size and security

# Stage 1: Dependencies and Build
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY src ./src
COPY migrations ./migrations
COPY config ./config
COPY scripts ./scripts

# Create necessary directories
RUN mkdir -p models logs tmp

# Stage 2: Production
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

# Copy only production files from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations
COPY --from=builder --chown=appuser:appgroup /app/config ./config
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/models ./models
COPY --from=builder --chown=appuser:appgroup /app/logs ./logs
COPY --from=builder --chown=appuser:appgroup /app/tmp ./tmp

# Set proper permissions
RUN chmod -R 750 /app && \
    chmod -R 770 /app/logs /app/tmp /app/models

# Remove dev dependencies in production stage
RUN npm prune --omit=dev && \
    npm cache clean --force

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