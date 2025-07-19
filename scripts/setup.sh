#!/bin/bash

# setup.sh - Easy setup for MCP Memory Stack
# Usage: ./setup.sh [basic|cache|admin|full]

set -e

echo "🚀 MCP Memory Stack Setup"
echo "========================="

# Set profile based on argument
PROFILE=${1:-basic}

case $PROFILE in
    basic)
        echo "📦 Setting up basic stack (PostgreSQL + MCP Memory)"
        COMPOSE_PROFILES=""
        ;;
    cache)
        echo "📦 Setting up with Redis cache"
        COMPOSE_PROFILES="--profile cache"
        ;;
    admin)
        echo "📦 Setting up with pgAdmin"
        COMPOSE_PROFILES="--profile admin"
        ;;
    full)
        echo "📦 Setting up full stack (PostgreSQL + MCP Memory + Redis + pgAdmin)"
        COMPOSE_PROFILES="--profile cache --profile admin"
        ;;
    *)
        echo "❌ Invalid profile. Use: basic, cache, admin, or full"
        exit 1
        ;;
esac

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Clone repository if needed
if [ ! -d "mcp-memory" ]; then
    echo "📥 Cloning sdimitrov/mcp-memory repository..."
    git clone https://github.com/sdimitrov/mcp-memory.git
    cd mcp-memory
else
    echo "📁 Using existing mcp-memory directory..."
    cd mcp-memory
fi

# Copy configuration files
echo "⚙️ Setting up configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created .env file (please review and modify as needed)"
else
    echo "⚠️  .env file already exists, skipping..."
fi

# Create necessary directories
mkdir -p models logs

echo "🏗️ Building and starting services..."
echo "Profile: $PROFILE"

# Build and start services
docker-compose $COMPOSE_PROFILES up --build -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

# Check PostgreSQL
if docker-compose exec postgres pg_isready -U mcp_user -d mcp_memory > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not responding"
fi

# Check MCP Memory Server
if curl -s http://localhost:3333/mcp/v1/health > /dev/null 2>&1; then
    echo "✅ MCP Memory Server is ready"
else
    echo "⚠️  MCP Memory Server may still be starting..."
fi

echo ""
echo "🎉 Setup complete!"
echo "==================="
echo ""
echo "📋 Service URLs:"
echo "   🧠 MCP Memory Server: http://localhost:3333"
echo "   🐘 PostgreSQL: localhost:5432"

if [[ $PROFILE == "admin" || $PROFILE == "full" ]]; then
    echo "   🔧 pgAdmin: http://localhost:8080"
fi

if [[ $PROFILE == "cache" || $PROFILE == "full" ]]; then
    echo "   🔴 Redis: localhost:6379"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Review and customize .env file"
echo "   2. Configure MCP client (Cursor/Claude) to use: http://localhost:3333"
echo "   3. Test with: curl http://localhost:3333/mcp/v1/health"
echo ""
echo "🔧 Management commands:"
echo "   Stop:    docker-compose down"
echo "   Logs:    docker-compose logs -f"
echo "   Status:  docker-compose ps"
echo ""

# Show logs for a few seconds
echo "📄 Recent logs:"
echo "==============="
docker-compose logs --tail=20
