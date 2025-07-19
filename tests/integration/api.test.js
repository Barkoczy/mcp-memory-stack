// Integration API tests
import request from 'supertest';

import { createRESTAPI } from '../../src/core/rest-api.js';
import { initializeDatabase } from '../../src/database/connection.js';

describe('REST API Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Initialize database first
    process.env.DATABASE_URL = 'postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_memory_test';
    await initializeDatabase();
    
    // Create test app instance
    const { app: testApp, server: testServer } = await createRESTAPI({
      mode: 'test',
      cache: {
        enabled: false,
      },
      db: {
        connectionString: process.env.DATABASE_URL,
        poolSize: 1,
      },
      api: {
        port: 0, // Random port for testing
        cors: true,
        rateLimit: false,
        maxRequestSize: '10mb',
        compression: false,
      },
      security: {
        apiKey: null,
        jwt: null,
      },
      monitoring: {
        metrics: false,
      },
      embedding: {
        model: 'Xenova/all-MiniLM-L6-v2',
        dimension: 384,
        maxTokens: 512,
        cacheSize: 100,
        pooling: 'mean',
        normalize: true,
        cache: false,
      },
      server: {
        version: '2.0.0',
      },
    });
    app = testApp;
    server = testServer;
  });

  afterAll(async () => {
    // Cleanup
    if (server) {
      await server.close();
    }
  });

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
      });
    });

    it('GET /health/deep should check dependencies', async () => {
      const response = await request(app).get('/health/deep').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        checks: {
          database: expect.any(String),
          embedding: expect.any(String),
        },
      });
    });
  });

  describe('Memory API', () => {
    let createdMemoryId;

    it('POST /api/v1/memories should create memory', async () => {
      const memoryData = {
        type: 'learning',
        content: {
          topic: 'Integration Testing',
          details: 'Testing API endpoints with supertest',
        },
        source: 'test',
        tags: ['testing', 'api'],
        confidence: 0.9,
      };

      const response = await request(app).post('/api/v1/memories').send(memoryData);
      
      if (response.status !== 201) {
        console.log('Error response:', response.status, response.body);
      }
      
      expect(response.status).toBe(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        type: 'learning',
        content: memoryData.content,
        created_at: expect.any(String),
      });

      createdMemoryId = response.body.id;
    });

    it('GET /api/v1/memories should list memories', async () => {
      const response = await request(app).get('/api/v1/memories').expect(200);

      expect(response.body).toMatchObject({
        memories: expect.any(Array),
        total: expect.any(Number),
        limit: expect.any(Number),
        offset: expect.any(Number),
      });

      expect(response.body.memories.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/memories/:id should retrieve specific memory', async () => {
      if (!createdMemoryId) {
        throw new Error('No memory created in previous test');
      }

      const response = await request(app).get(`/api/v1/memories/${createdMemoryId}`).expect(200);

      expect(response.body).toMatchObject({
        id: createdMemoryId,
        type: 'learning',
        content: {
          topic: 'Integration Testing',
        },
      });
    });

    it('GET /api/v1/memories/search should perform semantic search', async () => {
      const response = await request(app)
        .get('/api/v1/memories/search')
        .query({
          query: 'testing API',
          limit: 5,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        memories: expect.any(Array),
        query: 'testing API',
        total: expect.any(Number),
      });

      // Should find our created memory
      expect(response.body.memories.some(m => m.content.topic === 'Integration Testing')).toBe(
        true
      );
    });

    it('GET /api/v1/memories should filter by type', async () => {
      const response = await request(app)
        .get('/api/v1/memories')
        .query({ type: 'learning' })
        .expect(200);

      expect(response.body.memories).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'learning' })])
      );
    });

    it('GET /api/v1/memories should filter by tags', async () => {
      const response = await request(app)
        .get('/api/v1/memories')
        .query({ tags: 'testing,api' })
        .expect(200);

      expect(response.body.memories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tags: expect.arrayContaining(['testing', 'api']),
          }),
        ])
      );
    });

    it('PUT /api/v1/memories/:id should update memory', async () => {
      if (!createdMemoryId) {
        throw new Error('No memory created in previous test');
      }

      const updateData = {
        content: {
          topic: 'Updated Integration Testing',
          details: 'Updated details for testing',
        },
        tags: ['testing', 'api', 'updated'],
      };

      const response = await request(app)
        .put(`/api/v1/memories/${createdMemoryId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdMemoryId,
        content: updateData.content,
        tags: updateData.tags,
      });
    });

    it('DELETE /api/v1/memories/:id should delete memory', async () => {
      if (!createdMemoryId) {
        throw new Error('No memory created in previous test');
      }

      await request(app).delete(`/api/v1/memories/${createdMemoryId}`).expect(204);

      // Verify deletion
      await request(app).get(`/api/v1/memories/${createdMemoryId}`).expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid memory data', async () => {
      const invalidData = {
        // Missing required fields
        content: { topic: 'test' },
      };

      const response = await request(app).post('/api/v1/memories').send(invalidData).expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('validation'),
      });
    });

    it('should return 404 for non-existent memory', async () => {
      await request(app).get('/api/v1/memories/non-existent-id').expect(404);
    });

    it('should return 404 for unknown endpoints', async () => {
      await request(app).get('/api/v1/unknown-endpoint').expect(404);
    });
  });

  describe('Security', () => {
    it('should set security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': expect.any(String),
      });
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/v1/memories')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should respond to health check quickly', async () => {
      const startTime = Date.now();

      await request(app).get('/health').expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond in < 100ms
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10)
        .fill()
        .map(() => request(app).get('/health').expect(200));

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });
});
