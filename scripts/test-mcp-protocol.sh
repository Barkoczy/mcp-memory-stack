#!/bin/bash

# Test MCP protocol by sending JSON-RPC messages

echo "Testing MCP Protocol Implementation"
echo "=================================="

# Test 1: Initialize
echo -e "\n1. Testing initialize method:"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}' | \
docker exec -i mcp-memory-dev sh -c "cd /app && MCP_MODE=true REST_API_ENABLED=false HEALTH_PORT=4444 node src/index.js 2>/dev/null" | \
head -n 1 | python3 -m json.tool

# Test 2: List tools
echo -e "\n2. Testing tools/list method:"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | \
docker exec -i mcp-memory-dev sh -c "cd /app && MCP_MODE=true REST_API_ENABLED=false HEALTH_PORT=4445 node src/index.js 2>/dev/null" | \
head -n 1 | python3 -m json.tool

# Test 3: Create memory
echo -e "\n3. Testing memory_create tool:"
cat <<EOF | docker exec -i mcp-memory-dev sh -c "cd /app && MCP_MODE=true REST_API_ENABLED=false HEALTH_PORT=4446 node src/index.js 2>/dev/null" | head -n 1 | python3 -m json.tool
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"memory_create","arguments":{"type":"mcp-test","content":{"text":"Testing MCP protocol implementation","verified":true},"source":"test-script","tags":["mcp","protocol","test"],"confidence":0.95}}}
EOF

echo -e "\nMCP Protocol tests completed!"