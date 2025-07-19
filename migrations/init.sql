-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing table if it exists
DROP TABLE IF EXISTS memories;

-- Create memories table
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    content JSONB NOT NULL,
    source TEXT NOT NULL,
    embedding vector(384) NOT NULL, -- BERT model outputs 384-dimensional vectors
    tags TEXT[] DEFAULT '{}',
    confidence DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for vector similarity search
CREATE INDEX ON memories USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
