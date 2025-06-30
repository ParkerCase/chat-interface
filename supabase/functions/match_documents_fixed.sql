-- STEP 1: Drop existing function if it exists
DROP FUNCTION IF EXISTS match_documents(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_documents(vector, float, int);

-- STEP 2: Create the new function with correct signature
CREATE OR REPLACE FUNCTION match_documents(
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

-- STEP 3: Create index for faster searches (if not exists)
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- STEP 4: Grant permissions
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO anon;

-- STEP 5: Test the function (optional)
-- SELECT * FROM match_documents(array_fill(0.1, ARRAY[1536])::vector, 0.5, 5);
