import readline from 'readline';

import { MemoryService } from '../services/memory.js';
import { logger } from '../utils/logger.js';
import type { EnvironmentConfig } from '../config.js';

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id?: string | number | null;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    sampling: boolean;
  };
  serverInfo: {
    name: string;
    version: string;
    description: string;
  };
}

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface ToolCallParams {
  name?: string;
  tool?: string;
  arguments?: any;
  params?: any;
}

interface MCPServer {
  memoryService: MemoryService;
}

export function createMCPServer(config: EnvironmentConfig): MCPServer {
  const memoryService = new MemoryService(config);

  // Setup stdio transport
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // MCP protocol handler
  rl.on('line', async (line: string) => {
    let request: JsonRpcRequest | undefined;
    try {
      request = JSON.parse(line);
      if (request) {
        const response = await handleMCPRequest(request, memoryService, config);
        console.log(JSON.stringify(response));
      }
    } catch (error) {
      logger.error('MCP request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: request?.id || null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: errorMessage,
        },
      };
      console.log(JSON.stringify(errorResponse));
    }
  });

  // Keep readline interface alive
  rl.on('close', () => {
    logger.info('MCP interface closed, keeping process alive');
  });

  // Handle stdin end without closing the interface
  process.stdin.on('end', () => {
    logger.info('stdin ended, keeping process alive');
  });

  // In child processes, stdin might close prematurely
  // Set stdin to non-blocking mode to prevent immediate closure
  if (process.stdin.isTTY === false) {
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
  }

  logger.info('MCP server started');
  return { memoryService };
}

function validateJsonRpcRequest(request: JsonRpcRequest): JsonRpcResponse | null {
  const { jsonrpc, method, id } = request;

  if (!jsonrpc || jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600, // Invalid Request
        message: 'Invalid JSON-RPC request: missing or invalid jsonrpc version',
      },
    };
  }

  if (!method) {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600, // Invalid Request
        message: 'Invalid JSON-RPC request: missing method',
      },
    };
  }

  return null; // Valid request
}

function handleValidationError(error: Error, id?: string | number | null): JsonRpcResponse {
  if (error.message.includes('validation') || error.message.includes('required')) {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32602, // Invalid params
        message: `Invalid parameters: ${error.message}`,
      },
    };
  }
  throw error; // Re-throw non-validation errors
}

async function handleMCPRequest(
  request: JsonRpcRequest,
  memoryService: MemoryService,
  config: EnvironmentConfig
): Promise<JsonRpcResponse> {
  const { method, params, id } = request;

  // Validate JSON-RPC structure
  const validationError = validateJsonRpcRequest(request);
  if (validationError) {
    return validationError;
  }

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id || null, config);

      case 'tools/list':
      case 'listTools':
        return handleToolsList(id || null);

      case 'tools/call':
      case 'callTool':
        return await handleToolCall(params, id || null, memoryService);

      default:
        return {
          jsonrpc: '2.0',
          id: id || null,
          error: {
            code: -32601, // Method not found
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return handleValidationError(error as Error, id);
  }
}

function handleInitialize(id: string | number | null, config?: EnvironmentConfig): JsonRpcResponse {
  const result: InitializeResult = {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
      sampling: false,
    },
    serverInfo: {
      name: config?.server?.name || 'MCP Memory Server',
      version: config?.server?.version || '2.0.0',
      description: config?.server?.description || 'Memory management with semantic search',
    },
  };

  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function handleToolsList(id: string | number | null): JsonRpcResponse {
  const tools: ToolSchema[] = [
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
  ];

  return {
    jsonrpc: '2.0',
    id,
    result: {
      tools,
    },
  };
}

async function handleToolCall(
  params: ToolCallParams,
  id: string | number | null,
  memoryService: MemoryService
): Promise<JsonRpcResponse> {
  const toolName = params?.name || params?.tool;
  const toolParams = params?.arguments || params?.params || {};

  if (!toolName) {
    throw new Error('Tool name is required for validation');
  }

  switch (toolName) {
    case 'memory_create':
      return await handleMemoryCreate(toolParams, id, memoryService);

    case 'memory_search':
      return await handleMemorySearch(toolParams, id, memoryService);

    case 'memory_list':
      return await handleMemoryList(toolParams, id, memoryService);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function handleMemoryCreate(
  toolParams: any,
  id: string | number | null,
  memoryService: MemoryService
): Promise<JsonRpcResponse> {
  // Validate required parameters
  if (!toolParams.type) {
    throw new Error('type is required for validation');
  }
  if (!toolParams.content) {
    throw new Error('content is required for validation');
  }

  const created = await memoryService.create(toolParams);
  return {
    jsonrpc: '2.0',
    id,
    result: {
      toolResult: created,
    },
  };
}

async function handleMemorySearch(
  toolParams: any,
  id: string | number | null,
  memoryService: MemoryService
): Promise<JsonRpcResponse> {
  const searchResults = await memoryService.search(toolParams);
  return {
    jsonrpc: '2.0',
    id,
    result: {
      toolResult: searchResults,
    },
  };
}

async function handleMemoryList(
  toolParams: any,
  id: string | number | null,
  memoryService: MemoryService
): Promise<JsonRpcResponse> {
  const listResults = await memoryService.list(toolParams);
  return {
    jsonrpc: '2.0',
    id,
    result: {
      toolResult: listResults,
    },
  };
}
