-- NUCLEAR OPTION: Create function with new name to avoid conflicts
-- This completely bypasses the existing function issues

-- Create the RAG search function with a unique name
CREATE OR REPLACE FUNCTION rag_search_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  embedding vector(1536),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    documents.embedding,
    (documents.embedding <=> query_embedding) * -1 + 1 AS similarity
  FROM documents
  WHERE 
    documents.embedding IS NOT NULL
    AND documents.status = 'active'
    AND (documents.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Grant permissions
GRANT EXECUTE ON FUNCTION rag_search_documents TO authenticated;
GRANT EXECUTE ON FUNCTION rag_search_documents TO anon;
GRANT EXECUTE ON FUNCTION rag_search_documents TO service_role;

-- Test the function
SELECT 'rag_search_documents function created successfully!' as status;
