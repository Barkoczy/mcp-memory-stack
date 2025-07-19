// Simple mock embedding service for tests - no ML dependencies
export class EmbeddingService {
  constructor(config) {
    this.config = config;
    this.embedder = true; // Mark as ready
  }

  initialize() {
    return this.embedder;
  }

  generateEmbedding(text) {
    // Return a mock embedding vector of the expected dimensions
    // Use a simple hash-like function for deterministic results
    const dimension = this.config.dimension || 384;
    const embedding = new Array(dimension);

    for (let i = 0; i < dimension; i++) {
      embedding[i] = Math.sin(text.length + i) * 0.5;
    }

    return embedding;
  }

  checkReady() {
    return true;
  }

  generateBatchEmbeddings(texts) {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  generateSemanticEmbedding(_content) {
    const text = typeof _content === 'object' ? JSON.stringify(_content) : String(_content);
    return this.generateEmbedding(text);
  }

  generateHybridEmbedding(_content) {
    return this.generateSemanticEmbedding(_content);
  }

  extractKeywords(_content) {
    return ['mock', 'keyword'];
  }
}
