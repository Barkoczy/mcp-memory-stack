import { spawn } from 'child_process';

import { createMCPClient } from '../helpers/mcp-client.js';

describe('MCP Protocol E2E Tests', () => {
  let mcpProcess;
  let mcpClient;

  beforeAll(async () => {
    // Start MCP server process
    mcpProcess = spawn('node', ['src/index.js'], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MCP_MODE: 'stdio',
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory',
      },
    });

    // Create MCP client
    mcpClient = createMCPClient(mcpProcess);

    // Wait for server to be ready
    await mcpClient.waitForReady();
  }, 30000); // 30 second timeout for server startup

  afterAll(async () => {
    // Cleanup
    if (mcpClient) {
      await mcpClient.close();
    }
    if (mcpProcess) {
      mcpProcess.kill();
    }
  });

  describe('MCP Protocol Handshake', () => {
    it('should initialize server with capabilities', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
          },
          serverInfo: {
            name: expect.any(String),
            version: expect.any(String),
          },
        },
      });
    });

    it('should list available tools', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'memory_create',
              description: expect.any(String),
              inputSchema: expect.any(Object),
            }),
            expect.objectContaining({
              name: 'memory_search',
              description: expect.any(String),
              inputSchema: expect.any(Object),
            }),
            expect.objectContaining({
              name: 'memory_list',
              description: expect.any(String),
              inputSchema: expect.any(Object),
            }),
          ]),
        },
      });
    });
  });

  describe('Memory Tools', () => {
    let _createdMemoryId;

    it('should create memory using memory_create tool', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'memory_create',
          arguments: {
            type: 'learning',
            content: {
              topic: 'MCP Protocol Testing',
              details: 'End-to-end testing of MCP protocol implementation',
            },
            source: 'e2e-test',
            tags: ['mcp', 'testing', 'protocol'],
            confidence: 0.95,
          },
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: {
          toolResult: expect.objectContaining({
            id: expect.any(String),
            type: 'learning',
            content: expect.objectContaining({
              topic: 'MCP Protocol Testing',
            }),
            created_at: expect.any(String),
          }),
        },
      });

      _createdMemoryId = response.result.toolResult.id;
    });

    it('should search memories using memory_search tool', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'memory_search',
          arguments: {
            query: 'MCP protocol testing',
            limit: 5,
            threshold: 0.7,
          },
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: {
          toolResult: expect.objectContaining({
            memories: expect.any(Array),
            total: expect.any(Number),
            query: 'MCP protocol testing',
          }),
        },
      });

      // Should find our created memory
      const { memories } = response.result.toolResult;
      expect(memories.some(m => m.content.topic === 'MCP Protocol Testing')).toBe(true);
    });

    it('should list memories using memory_list tool', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'memory_list',
          arguments: {
            type: 'learning',
            limit: 10,
          },
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        result: {
          toolResult: expect.objectContaining({
            memories: expect.any(Array),
            total: expect.any(Number),
          }),
        },
      });

      // All memories should be of type 'learning'
      const { memories } = response.result.toolResult;
      memories.forEach(memory => {
        expect(memory.type).toBe('learning');
      });
    });

    it('should filter memories by tags', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'memory_search',
          arguments: {
            query: 'testing',
            tags: ['mcp', 'testing'],
          },
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 6,
        result: {
          toolResult: expect.objectContaining({
            memories: expect.any(Array),
          }),
        },
      });

      // All results should have at least one of the specified tags
      const { memories } = response.result.toolResult;
      memories.forEach(memory => {
        const hasRequiredTag = memory.tags.some(tag => ['mcp', 'testing'].includes(tag));
        expect(hasRequiredTag).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool calls', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 7,
        error: {
          code: expect.any(Number),
          message: expect.any(String),
        },
      });
    });

    it('should handle invalid tool arguments', async () => {
      const response = await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'memory_create',
          arguments: {
            // Missing required fields
            content: { topic: 'test' },
          },
        },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 8,
        error: {
          code: expect.any(Number),
          message: expect.any(String),
        },
      });
    });

    it('should handle malformed JSON-RPC requests', async () => {
      const response = await mcpClient.sendRaw('{"invalid": "json-rpc"}');

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32600, // Invalid Request
          message: expect.any(String),
        },
      });
    });
  });

  describe('Performance', () => {
    it('should handle concurrent tool calls', async () => {
      const requests = Array(5)
        .fill()
        .map((_, i) =>
          mcpClient.sendRequest({
            jsonrpc: '2.0',
            id: 100 + i,
            method: 'tools/call',
            params: {
              name: 'memory_list',
              arguments: { limit: 5 },
            },
          })
        );

      const responses = await Promise.all(requests);

      responses.forEach((response, i) => {
        expect(response).toMatchObject({
          jsonrpc: '2.0',
          id: 100 + i,
          result: {
            toolResult: expect.any(Object),
          },
        });
      });
    });

    it('should respond to tools quickly', async () => {
      const startTime = Date.now();

      await mcpClient.sendRequest({
        jsonrpc: '2.0',
        id: 200,
        method: 'tools/list',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond in < 1 second
    });
  });
});
