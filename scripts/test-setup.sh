#!/bin/bash

echo "🧪 Testing MCP Memory Stack Setup..."
echo "=================================="

# Test 1: Check if containers are running
echo "1. Checking container status..."
if docker-compose ps | grep -q "healthy"; then
    echo "✅ Containers are running and healthy"
else
    echo "❌ Containers are not healthy"
    exit 1
fi

# Test 2: Test health endpoint
echo "2. Testing health endpoint..."
if curl -s http://localhost:3334/health | grep -q "ok"; then
    echo "✅ Health endpoint is responding"
else
    echo "❌ Health endpoint is not responding"
    exit 1
fi

# Test 3: Check database connection
echo "3. Testing database connection..."
if docker-compose exec -T postgres pg_isready -U mcp_user -d mcp_memory > /dev/null 2>&1; then
    echo "✅ Database is accessible"
else
    echo "❌ Database is not accessible"
    exit 1
fi

# Test 4: Check if pgvector extension is installed
echo "4. Testing pgvector extension..."
if docker-compose exec -T postgres psql -U mcp_user -d mcp_memory -c "SELECT extname FROM pg_extension WHERE extname = 'vector';" | grep -q "vector"; then
    echo "✅ pgvector extension is installed"
else
    echo "❌ pgvector extension is not installed"
    exit 1
fi

echo ""
echo "🎉 All tests passed! MCP Memory Stack is ready to use."
echo ""
echo "📋 Quick commands:"
echo "  - View logs: docker-compose logs -f mcp-memory"
echo "  - Stop stack: docker-compose down"
echo "  - Health check: curl http://localhost:3334/health"
echo "  - MCP server: Available on port 3333"
