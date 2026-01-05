-- Initialize pgvector extension and create test tables
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a test table with 384-dimensional vectors (common for sentence transformers)
CREATE TABLE IF NOT EXISTS test_embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    category VARCHAR(50),
    embedding vector(384),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data with random vectors for testing
INSERT INTO test_embeddings (content, category, embedding) VALUES
('Machine learning is a subset of artificial intelligence', 'tech', 
 array_fill(0.1::real, ARRAY[384])::vector),
('PostgreSQL is a powerful open source database', 'tech',
 array_fill(0.2::real, ARRAY[384])::vector),
('Vector similarity search enables semantic search', 'tech',
 array_fill(0.15::real, ARRAY[384])::vector),
('Python is a popular programming language', 'tech',
 array_fill(0.12::real, ARRAY[384])::vector),
('The weather is nice today', 'general',
 array_fill(0.8::real, ARRAY[384])::vector);

-- Create HNSW index for better performance
CREATE INDEX IF NOT EXISTS test_embeddings_hnsw_idx 
ON test_embeddings USING hnsw (embedding vector_cosine_ops);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE vectordb TO nodered;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nodered;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nodered;

-- Show what we created
SELECT 'Database initialized successfully!' AS status;
SELECT 'Sample records: ' || COUNT(*) AS info FROM test_embeddings;
