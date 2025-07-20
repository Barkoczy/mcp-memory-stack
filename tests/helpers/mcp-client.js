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
    this.isReady = false;
    this.readyPromise = null;

    console.log('DEBUG: MCP Client created with process:', !!process);
    console.log('DEBUG: Process PID:', process?.pid);

    this._setupReadyDetection();
    this._setupDataHandlers();
  }

  _setupReadyDetection() {
    this.readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('DEBUG: Ready detection timeout');
        reject(new Error('MCP server failed to start within 25 seconds'));
      }, 25000);

      const readyDetected = false;

      // Add process event handlers
      this.process.on('error', error => {
        console.log('DEBUG: Process error:', error);
        if (!readyDetected) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.process.on('exit', (code, signal) => {
        console.log('DEBUG: Process exited with code:', code, 'signal:', signal);
        if (!readyDetected) {
          clearTimeout(timeout);
          reject(new Error(`Process exited unexpectedly with code ${code}, signal ${signal}`));
        }
      });

      // Store the resolve function so we can call it from the stderr handler
      this.readyResolve = resolve;
      this.readyDetected = readyDetected;

      // Wait long enough for server to fully start and initialize
      setTimeout(() => {
        if (!this.readyDetected && !this.process.killed && this.readyResolve) {
          console.log('DEBUG: Server assumed ready after 15 seconds');
          this.readyDetected = true;
          this.isReady = true;
          clearTimeout(timeout);
          this.readyResolve();
          this.readyResolve = null;
        }
      }, 15000);
    });
  }

  _setupDataHandlers() {
    // Handle responses from server
    this.process.stdout.on('data', data => {
      const dataStr = data.toString();
      console.log('DEBUG: Received stdout data:', dataStr);

      const lines = dataStr.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse MCP response:', line);
        }
      });
    });

    // Handle errors and logging from server
    this.process.stderr.on('data', data => {
      const errorStr = data.toString();
      console.log('DEBUG: Received stderr data:', errorStr);

      // Check for readiness signal
      if (
        (errorStr.includes('MCP server started in stdio mode') ||
          errorStr.includes('✅ MCP server started in stdio mode')) &&
        this.readyResolve &&
        !this.readyDetected
      ) {
        console.log(
          'DEBUG: Server ready detected from startup log, waiting extra 3 seconds for readline interface'
        );
        this.readyDetected = true;
        // Add extra delay to ensure readline interface is fully ready for input
        setTimeout(() => {
          this.isReady = true;
          this.readyResolve();
          this.readyResolve = null;
        }, 3000);
      }
      // Don't treat all stderr as errors, it might just be logging
    });
  }

  async waitForReady() {
    if (this.isReady) return;
    await this.readyPromise;
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
      // Use provided ID if present, otherwise generate new one
      const id = request.id !== undefined ? request.id : ++this.requestId;
      const requestWithId = { ...request, id };

      console.log('DEBUG: Sending request:', JSON.stringify(requestWithId));

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject });

      // Send request
      this.process.stdin.write(`${JSON.stringify(requestWithId)}\n`);
      console.log('DEBUG: Request written to stdin');

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          console.log('DEBUG: Request timeout for ID:', id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  sendRaw(data) {
    return new Promise((resolve, reject) => {
      try {
        // Try to parse the raw data to extract or add ID
        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          // If it's not valid JSON, reject immediately
          return reject(new Error('Raw data must be valid JSON'));
        }

        // Use existing ID or generate new one
        const id = parsedData.id !== undefined ? parsedData.id : ++this.requestId;
        parsedData.id = id;

        // Store pending request
        this.pendingRequests.set(id, { resolve, reject });

        // Send updated data
        this.process.stdin.write(`${JSON.stringify(parsedData)}\n`);

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  close() {
    // Clear pending requests
    this.pendingRequests.clear();

    // Close stdin to signal shutdown
    if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
      this.process.stdin.end();
    }

    // Kill the process if it doesn't exit gracefully
    if (this.process && !this.process.killed) {
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }, 1000);
    }

    // Wait for process to exit
    return new Promise(resolve => {
      if (this.process) {
        this.process.on('exit', resolve);
        // Backup timeout
        setTimeout(resolve, 2000);
      } else {
        resolve();
      }
    });
  }
}

/**
 * Create MCP client instance
 */
export function createMCPClient(process) {
  return new MCPClient(process);
}
