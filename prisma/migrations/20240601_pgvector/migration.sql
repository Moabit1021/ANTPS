-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding vector column to SourceEmbedding table
-- This column is managed outside of Prisma schema
ALTER TABLE "SourceEmbedding" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS "source_embedding_vector_idx" ON "SourceEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
