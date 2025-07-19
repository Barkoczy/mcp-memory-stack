import readline from 'readline';

import { MemoryService } from '../services/memory.js';
import { logger } from '../utils/logger.js';

export function createMCPServer(config) {
  const memoryService = new MemoryService(config);

  // Setup stdio transport
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // MCP protocol handler
  rl.on('line', async line => {
    let request;
    try {
      request = JSON.parse(line);
      const response = await handleMCPRequest(request, memoryService, config);
      console.log(JSON.stringify(response));
    } catch (error) {
      logger.error('MCP request failed:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
      };
      if (request?.id) errorResponse.id = request.id;
      console.log(JSON.stringify(errorResponse));
    }
  });

  // Keep process alive
  rl.on('close', () => {
    logger.info('MCP interface closed, keeping process alive');
  });

  process.stdin.on('end', () => {
    logger.info('stdin ended, keeping process alive');
  });

  logger.info('MCP server started');
  return { memoryService };
}

function handleMCPRequest(request, memoryService, config) {
  const { method, params, id } = request;

  switch (method) {
    case 'initialize':
      return handleInitialize(id, config);

    case 'tools/list':
    case 'listTools':
      return handleToolsList(id);

    case 'tools/call':
    case 'callTool':
      return handleToolCall(params, id, memoryService);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

function handleInitialize(id, config) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      name: config.server.name,
      version: config.server.version,
      description: config.server.description,
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        sampling: false,
      },
    },
  };
}

function handleToolsList(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      tools: [
        {
          name: 'memory_create',
          description: 'Create a new memory with automatic embedding generation',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Memory type (e.g., learning, experience, fact)',
              },
              content: {
                type: 'object',
                description: 'Memory content as JSON object',
              },
              source: {
                type: 'string',
                description: 'Source of the memory',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags for categorization',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Confidence score (0-1)',
              },
            },
            required: ['type', 'content'],
          },
        },
        {
          name: 'memory_search',
          description: 'Search memories using semantic similarity',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              type: {
                type: 'string',
                description: 'Filter by memory type',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                description: 'Maximum results to return',
              },
              threshold: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Similarity threshold',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'memory_list',
          description: 'List memories with optional filters',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Filter by memory type',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              since: {
                type: 'string',
                format: 'date-time',
                description: 'Filter by creation date',
              },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                description: 'Maximum results',
              },
              offset: {
                type: 'integer',
                minimum: 0,
                description: 'Pagination offset',
              },
            },
          },
        },
      ],
    },
  };
}

function handleToolCall(params, id, memoryService) {
  const toolName = params.name || params.tool;
  const toolParams = params.arguments || params.params || {};

  switch (toolName) {
    case 'memory_create':
      return handleMemoryCreate(toolParams, id, memoryService);

    case 'memory_search':
      return handleMemorySearch(toolParams, id, memoryService);

    case 'memory_list':
      return handleMemoryList(toolParams, id, memoryService);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function handleMemoryCreate(toolParams, id, memoryService) {
  const created = await memoryService.create(toolParams);
  return {
    jsonrpc: '2.0',
    id,
    result: {
      toolResult: created,
    },
  };
}

async function handleMemorySearch(toolParams, id, memoryService) {
  const searchResults = await memoryService.search(toolParams);
  return {
    jsonrpc: '2.0',
    id,
    result: {
      toolResult: searchResults,
    },
  };
}

async function handleMemoryList(toolParams, id, memoryService) {
  const listResults = await memoryService.list(toolParams);
  return {
    jsonrpc: '2.0',
    id,
    result: {
      toolResult: listResults,
    },
  };
}
