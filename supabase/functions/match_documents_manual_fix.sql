-- ALTERNATIVE METHOD: Manual cleanup of match_documents functions
-- Use this if the complete fix script doesn't work

-- STEP 1: First, let's see exactly what functions exist
SELECT 
    proname as function_name,
    pronargs as arg_count,
    pg_get_function_identity_arguments(oid) as arguments,
    oid
FROM pg_proc 
WHERE proname = 'match_documents'
ORDER BY oid;

-- STEP 2: Based on the results above, manually drop each function
-- Replace the signatures below with what you see in STEP 1 results

-- Example drops (adjust based on your STEP 1 results):
-- DROP FUNCTION match_documents(vector, double precision, integer);
-- DROP FUNCTION match_documents(vector, real, integer);
-- DROP FUNCTION match_documents(vector, numeric, integer);

-- STEP 3: If you get the exact function signatures from STEP 1, drop them like this:
-- DROP FUNCTION match_documents(exact_signature_from_step_1);
-- DROP FUNCTION match_documents(another_exact_signature_from_step_1);

-- STEP 4: Verify all are gone
SELECT COUNT(*) as remaining_functions 
FROM pg_proc 
WHERE proname = 'match_documents';
-- This should return 0

-- STEP 5: Now create the new function
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

-- STEP 6: Create index and permissions
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO anon;
GRANT EXECUTE ON FUNCTION match_documents TO service_role;

SELECT 'Setup complete!' as status;
