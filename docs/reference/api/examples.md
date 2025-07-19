# API Examples

This guide provides practical examples for using the MCP Memory Server REST API.

## Base Configuration

```javascript
const API_BASE = 'http://localhost:3000/api/v1';
const API_KEY = 'your-api-key'; // Or use JWT token

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY
};
```

## Memory Operations

### Create Memory

```javascript
// Create a learning memory
const response = await fetch(`${API_BASE}/memories`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    type: 'learning',
    content: {
      topic: 'Docker Containers',
      description: 'Container technology for application deployment',
      concepts: ['virtualization', 'isolation', 'portability']
    },
    source: 'documentation',
    tags: ['docker', 'containers', 'devops'],
    confidence: 0.95
  })
});

const memory = await response.json();
console.log('Created memory:', memory.id);
```

### Search Memories

```javascript
// Semantic search
const searchResponse = await fetch(`${API_BASE}/memories/search`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    query: 'container deployment strategies',
    limit: 5,
    threshold: 0.7,
    type: 'learning'
  })
});

const results = await searchResponse.json();
results.forEach(memory => {
  console.log(`${memory.id}: ${memory.similarity.toFixed(3)} - ${memory.content.topic}`);
});
```

### List Memories with Filters

```javascript
// List recent memories with pagination
const listResponse = await fetch(`${API_BASE}/memories?limit=10&offset=0&sort=created_at&order=desc`, {
  headers
});

const memories = await listResponse.json();
console.log(`Found ${memories.length} memories`);

// Filter by type and tags
const filteredResponse = await fetch(`${API_BASE}/memories?type=learning&tags=docker,devops`, {
  headers
});

const filtered = await filteredResponse.json();
```

### Get Memory by ID

```javascript
const memoryId = 'uuid-here';
const getResponse = await fetch(`${API_BASE}/memories/${memoryId}`, {
  headers
});

if (getResponse.ok) {
  const memory = await getResponse.json();
  console.log('Memory details:', memory);
} else {
  console.log('Memory not found');
}
```

### Update Memory

```javascript
const updateResponse = await fetch(`${API_BASE}/memories/${memoryId}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    content: {
      topic: 'Advanced Docker Containers',
      description: 'Updated description with advanced concepts'
    },
    tags: ['docker', 'containers', 'devops', 'advanced'],
    confidence: 0.98
  })
});

const updated = await updateResponse.json();
```

### Delete Memory

```javascript
const deleteResponse = await fetch(`${API_BASE}/memories/${memoryId}`, {
  method: 'DELETE',
  headers
});

if (deleteResponse.ok) {
  console.log('Memory deleted successfully');
}
```

## Batch Operations

### Create Multiple Memories

```javascript
const memories = [
  {
    type: 'learning',
    content: { topic: 'Kubernetes Basics' },
    source: 'tutorial',
    tags: ['kubernetes', 'orchestration']
  },
  {
    type: 'experience',
    content: { event: 'Deployed first microservice' },
    source: 'personal',
    tags: ['microservices', 'deployment']
  }
];

const batchResponse = await fetch(`${API_BASE}/memories/batch`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ memories })
});

const created = await batchResponse.json();
console.log(`Created ${created.length} memories`);
```

## Analytics

### Get Memory Statistics

```javascript
const statsResponse = await fetch(`${API_BASE}/memories/stats`, {
  headers
});

const stats = await statsResponse.json();
console.log('Total memories:', stats.total);
console.log('By type:', stats.by_type);
console.log('Popular tags:', stats.popular_tags);
```

### Export Memories

```javascript
// Export to JSON
const exportResponse = await fetch(`${API_BASE}/memories/export?format=json&type=learning`, {
  headers
});

const exportData = await exportResponse.json();

// Export to CSV
const csvResponse = await fetch(`${API_BASE}/memories/export?format=csv`, {
  headers
});

const csvData = await csvResponse.text();
```

## Authentication Examples

### Using JWT Token

```javascript
// Login to get JWT token
const loginResponse = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'your-password'
  })
});

const { token } = await loginResponse.json();

// Use JWT token for authenticated requests
const authenticatedHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};
```

### API Key Authentication

```javascript
// Use API key in header
const apiKeyHeaders = {
  'Content-Type': 'application/json',
  'X-API-Key': 'your-api-key'
};

// Or in query parameter
const response = await fetch(`${API_BASE}/memories?api_key=your-api-key`);
```

## Error Handling

```javascript
async function createMemoryWithErrorHandling(memoryData) {
  try {
    const response = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(memoryData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create memory:', error.message);
    throw error;
  }
}
```

## Performance Optimization

### Pagination for Large Results

```javascript
async function getAllMemories() {
  const allMemories = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(`${API_BASE}/memories?limit=${limit}&offset=${offset}`, {
      headers
    });
    
    const batch = await response.json();
    allMemories.push(...batch);
    
    if (batch.length < limit) break;
    offset += limit;
  }
  
  return allMemories;
}
```

### Concurrent Requests

```javascript
async function searchMultipleQueries(queries) {
  const searchPromises = queries.map(query =>
    fetch(`${API_BASE}/memories/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, limit: 5 })
    }).then(r => r.json())
  );
  
  const results = await Promise.all(searchPromises);
  return results;
}
```

## Real-time Updates

### Server-Sent Events

```javascript
// Listen for real-time memory updates
const eventSource = new EventSource(`${API_BASE}/memories/events?api_key=${API_KEY}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Memory update:', data);
};

eventSource.addEventListener('memory_created', (event) => {
  const memory = JSON.parse(event.data);
  console.log('New memory created:', memory.id);
});

eventSource.addEventListener('memory_updated', (event) => {
  const memory = JSON.parse(event.data);
  console.log('Memory updated:', memory.id);
});
```

## Integration Examples

### Node.js Client

```javascript
class MemoryClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    };
  }
  
  async create(memory) {
    const response = await fetch(`${this.baseUrl}/memories`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(memory)
    });
    return response.json();
  }
  
  async search(query, options = {}) {
    const response = await fetch(`${this.baseUrl}/memories/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, ...options })
    });
    return response.json();
  }
}

// Usage
const client = new MemoryClient('http://localhost:3000/api/v1', 'your-api-key');
const memory = await client.create({
  type: 'learning',
  content: { topic: 'API Integration' }
});
```

### Python Client

```python
import requests
import json

class MemoryClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        }
    
    def create(self, memory):
        response = requests.post(
            f'{self.base_url}/memories',
            headers=self.headers,
            json=memory
        )
        return response.json()
    
    def search(self, query, **options):
        data = {'query': query, **options}
        response = requests.post(
            f'{self.base_url}/memories/search',
            headers=self.headers,
            json=data
        )
        return response.json()

# Usage
client = MemoryClient('http://localhost:3000/api/v1', 'your-api-key')
memory = client.create({
    'type': 'learning',
    'content': {'topic': 'Python Integration'}
})
```

## Testing API Endpoints

### Using curl

```bash
# Create memory
curl -X POST http://localhost:3000/api/v1/memories \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "type": "learning",
    "content": {"topic": "API Testing"},
    "source": "manual",
    "tags": ["testing", "api"]
  }'

# Search memories
curl -X POST http://localhost:3000/api/v1/memories/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "API testing strategies",
    "limit": 5
  }'

# Get memory by ID
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/v1/memories/uuid-here
```

### Using HTTPie

```bash
# Create memory
http POST localhost:3000/api/v1/memories \
  X-API-Key:your-api-key \
  type=learning \
  content:='{"topic": "HTTPie Testing"}' \
  tags:='["testing", "http"]'

# Search memories
http POST localhost:3000/api/v1/memories/search \
  X-API-Key:your-api-key \
  query="testing tools" \
  limit:=5
```