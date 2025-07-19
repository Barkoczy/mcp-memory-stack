-- PostgreSQL initialization script for MCP Memory Server
-- This script sets up the database with pgvector extension and creates the memories table

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the memories table with vector embeddings support
CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS memories_type_idx ON memories (type);
CREATE INDEX IF NOT EXISTS memories_tags_idx ON memories USING GIN (tags);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON memories (created_at);
CREATE INDEX IF NOT EXISTS memories_metadata_idx ON memories USING GIN (metadata);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
CREATE TRIGGER update_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for similarity search
CREATE OR REPLACE FUNCTION search_memories_by_similarity(
    query_embedding vector(384),
    similarity_threshold float DEFAULT 0.7,
    limit_count int DEFAULT 10
)
RETURNS TABLE (
    id int,
    content text,
    similarity float,
    metadata jsonb,
    tags text[],
    type varchar(50),
    created_at timestamp with time zone
)
LANGUAGE sql
AS $$
    SELECT 
        m.id,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity,
        m.metadata,
        m.tags,
        m.type,
        m.created_at
    FROM memories m
    WHERE (1 - (m.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT limit_count;
$$;

-- Insert some sample data for testing
INSERT INTO memories (content, type, tags, metadata) VALUES 
('This is a sample memory for testing the MCP memory server', 'test', ARRAY['sample', 'test'], '{"source": "init", "importance": "low"}'),
('Database initialization completed successfully', 'system', ARRAY['database', 'init'], '{"source": "init", "importance": "high"}'),
('pgvector extension is now available for semantic search', 'system', ARRAY['database', 'vector', 'search'], '{"source": "init", "importance": "high"}')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO mcp_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'MCP Memory Database initialized successfully with pgvector extension';
END $$;