import { EventEmitter } from 'events';

/**
 * Simple MCP client for testing
 */
export class MCPClient extends EventEmitter {
  constructor(process) {
    super();
    this.process = process;
    this.requestId = 0;
    this.pendingRequests = new Map();

    // Handle responses from server
    this.process.stdout.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter(line => line.trim());

      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse MCP response:', line);
        }
      });
    });

    // Handle errors
    this.process.stderr.on('data', data => {
      console.error('MCP Server Error:', data.toString());
    });
  }

  handleResponse(response) {
    if (response.id && this.pendingRequests.has(response.id)) {
      const { resolve } = this.pendingRequests.get(response.id);
      this.pendingRequests.delete(response.id);
      resolve(response);
    } else {
      this.emit('notification', response);
    }
  }

  sendRequest(request) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const requestWithId = { ...request, id };

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject });

      // Send request
      this.process.stdin.write(`${JSON.stringify(requestWithId)}\n`);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  sendRaw(data) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject });

      // Send raw data
      this.process.stdin.write(`${data}\n`);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  close() {
    // Clear pending requests
    this.pendingRequests.clear();

    // Close stdin to signal shutdown
    this.process.stdin.end();

    // Wait for process to exit
    return new Promise(resolve => {
      this.process.on('exit', resolve);
    });
  }
}

/**
 * Create MCP client instance
 */
export function createMCPClient(process) {
  return new MCPClient(process);
}
