import http from 'http';

// Simple health check server that runs alongside the MCP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const port = process.env.HEALTH_PORT || 3334;
server.listen(port, () => {
  console.log(`Health server listening on port ${port}`);
});

export default server;
