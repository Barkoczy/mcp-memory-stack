// Simple mock embedding service for tests - no ML dependencies
export class EmbeddingService {
  constructor(config) {
    this.config = config;
    this.embedder = true; // Mark as ready
  }

  async initialize() {
    return this.embedder;
  }

  async generateEmbedding(text) {
    // Return a mock embedding vector of the expected dimensions
    // Use a simple hash-like function for deterministic results
    const dimension = this.config.dimension || 384;
    const embedding = new Array(dimension);
    
    for (let i = 0; i < dimension; i++) {
      embedding[i] = Math.sin(text.length + i) * 0.5;
    }
    
    return embedding;
  }

  async checkReady() {
    return true;
  }

  async generateBatchEmbeddings(texts) {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  async generateSemanticEmbedding(content) {
    const text = typeof content === 'object' ? JSON.stringify(content) : String(content);
    return this.generateEmbedding(text);
  }

  async generateHybridEmbedding(content) {
    return this.generateSemanticEmbedding(content);
  }

  extractKeywords(content) {
    return ['mock', 'keyword'];
  }
}