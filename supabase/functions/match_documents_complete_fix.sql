-- COMPLETE FIX: Remove all match_documents functions and create clean version
-- Run this entire script in your Supabase SQL Editor

-- STEP 1: Find all existing match_documents functions
-- Run this first to see what we're dealing with
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'match_documents';

-- STEP 2: Drop ALL possible variations of match_documents function
-- This covers all common signatures that might exist

-- Drop by specific signatures (most common variations)
DROP FUNCTION IF EXISTS match_documents(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_documents(vector, float, int);
DROP FUNCTION IF EXISTS match_documents(vector(1536), double precision, integer);
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, int);
DROP FUNCTION IF EXISTS match_documents(vector(1536), float, integer);
DROP FUNCTION IF EXISTS match_documents(vector(1536), double precision, int);

-- Drop with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS match_documents CASCADE;

-- Alternative: Drop all functions with this name (nuclear option)
-- Uncomment the next 4 lines if the above doesn't work:
-- DO $$
-- BEGIN
--     EXECUTE 'DROP FUNCTION IF EXISTS ' || string_agg(oid::regprocedure, ', ') 
--     FROM pg_proc WHERE proname = 'match_documents';
-- END $$;

-- STEP 3: Create the clean new function
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

-- STEP 4: Create index for performance
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- STEP 5: Grant permissions
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO anon;
GRANT EXECUTE ON FUNCTION match_documents TO service_role;

-- STEP 6: Test the function (should return some results or empty set)
-- Uncomment to test:
-- SELECT COUNT(*) as test_result FROM match_documents(array_fill(0.1, ARRAY[1536])::vector, 0.1, 1);

-- Success message
SELECT 'match_documents function created successfully!' as status;
