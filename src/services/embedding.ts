import { logger } from '../utils/logger.js';

// Conditionally import transformers only in non-test environments
let pipeline: any;
if (process.env.NODE_ENV !== 'test') {
  const { pipeline: pipelineImport } = await import('@xenova/transformers');
  pipeline = pipelineImport;
}

interface EmbeddingConfig {
  model: string;
  dimension: number;
  batchSize: number;
  cache: boolean;
}

interface EmbeddingOutput {
  data: Float32Array | number[];
}

interface MockEmbedder {
  call: (text: string) => EmbeddingOutput;
}

interface RealEmbedder {
  (text: string): Promise<EmbeddingOutput>;
}

type Embedder = MockEmbedder | RealEmbedder;

interface ContentObject {
  title?: string;
  description?: string;
  topic?: string;
  summary?: string;
  text?: string;
  [key: string]: any;
}

interface HybridWeights {
  semantic: number;
  keyword: number;
}

export class EmbeddingService {
  private config: EmbeddingConfig;
  private embedder: Embedder | null;
  private initPromise: Promise<Embedder> | null;
  private modelCache: Map<string, number[]>;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.embedder = null;
    this.initPromise = null;
    this.modelCache = new Map();
  }

  async initialize(): Promise<Embedder> {
    if (this.embedder) {
      return this.embedder;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initializeModel();
    this.embedder = await this.initPromise;

    return this.embedder;
  }

  async _initializeModel(): Promise<Embedder> {
    try {
      // In test environment, return a mock embedder
      if (process.env.NODE_ENV === 'test') {
        logger.info('Using mock embedding model for tests');
        return {
          // Mock embedder function
          call: (_text: string): EmbeddingOutput => ({
            data: new Array(this.config.dimension || 384).fill(0.1),
          }),
        };
      }

      logger.info(`Initializing embedding model: ${this.config.model}`);

      const embedder = await pipeline('feature-extraction', this.config.model, {
        quantized: false,
        cache_dir: './models',
      });

      logger.info('Embedding model initialized successfully');
      return embedder;
    } catch (error) {
      logger.error('Failed to initialize embedding model:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required for embedding generation');
    }

    // Check cache if enabled
    if (this.config.cache) {
      const cached = this.modelCache.get(text);
      if (cached) {
        return cached;
      }
    }

    // Initialize model if needed
    const embedder = await this.initialize();

    try {
      // Generate embedding
      let output: EmbeddingOutput;
      if (process.env.NODE_ENV === 'test') {
        output = (embedder as MockEmbedder).call(text);
      } else {
        output = await (embedder as RealEmbedder)(text);
      }

      // Convert to array
      const embedding = Array.from(output.data);

      // Validate dimension
      if (embedding.length !== this.config.dimension) {
        logger.warn(
          `Embedding dimension mismatch: expected ${this.config.dimension}, got ${embedding.length}`
        );
      }

      // Cache if enabled
      if (this.config.cache) {
        this.modelCache.set(text, embedding);

        // Implement simple LRU
        if (this.modelCache.size > 10000) {
          const firstKey = this.modelCache.keys().next().value;
          if (firstKey !== undefined) {
            this.modelCache.delete(firstKey);
          }
        }
      }

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const _embedder = await this.initialize();
    const results: (number[] | null)[] = [];

    // Process in batches
    const batchSize = this.config.batchSize || 32;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const outputs = await Promise.all(batch.map(text => this.generateEmbedding(text)));

        results.push(...outputs);
      } catch (error) {
        logger.error(`Failed to process batch ${i / batchSize + 1}:`, error);
        // Continue with next batch
        results.push(...new Array(batch.length).fill(null));
      }
    }

    return results;
  }

  async checkReady(): Promise<boolean> {
    if (!this.embedder) {
      await this.initialize();
    }

    // Test with simple embedding
    const test = await this.generateEmbedding('test');
    if (!test || test.length === 0) {
      throw new Error('Embedding service not ready');
    }

    return true;
  }

  // Helper methods for different embedding strategies

  generateSemanticEmbedding(content: ContentObject | string): Promise<number[]> {
    // For complex objects, create a semantic representation
    let text: string;

    if (typeof content === 'object') {
      // Extract key information
      const parts: string[] = [];

      if (content.title) parts.push(`Title: ${content.title}`);
      if (content.description) parts.push(`Description: ${content.description}`);
      if (content.topic) parts.push(`Topic: ${content.topic}`);
      if (content.summary) parts.push(`Summary: ${content.summary}`);
      if (content.text) parts.push(content.text);

      // Add other fields as key-value pairs
      Object.entries(content).forEach(([key, value]) => {
        if (!['title', 'description', 'topic', 'summary', 'text'].includes(key)) {
          parts.push(`${key}: ${JSON.stringify(value)}`);
        }
      });

      text = parts.join(' ');
    } else {
      text = String(content);
    }

    return this.generateEmbedding(text);
  }

  async generateHybridEmbedding(
    content: ContentObject | string,
    weights: HybridWeights = { semantic: 0.7, keyword: 0.3 }
  ): Promise<number[]> {
    // Generate both semantic and keyword-based embeddings
    const semanticEmbedding = await this.generateSemanticEmbedding(content);

    // For keyword embedding, extract key terms
    const keywords = this.extractKeywords(content);
    const keywordEmbedding = await this.generateEmbedding(keywords.join(' '));

    // Combine embeddings with weights
    const hybridEmbedding = semanticEmbedding.map(
      (val, i) => val * weights.semantic + keywordEmbedding[i] * weights.keyword
    );

    return hybridEmbedding;
  }

  extractKeywords(content: ContentObject | string): string[] {
    // Simple keyword extraction
    const text = typeof content === 'object' ? JSON.stringify(content) : String(content);

    // Remove common words and extract important terms
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count word frequency
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }
}
