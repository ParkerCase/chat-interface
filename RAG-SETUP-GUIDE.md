# RAG System - Setup & Troubleshooting Guide

## 🔧 **Database Function Fix**

**Problem**: `ERROR: 42P13: cannot change return type of existing function`

**Solution**: Copy and run this complete SQL in your Supabase dashboard:

```sql
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

-- STEP 3: Create index for faster searches
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- STEP 4: Grant permissions
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO anon;
```

## 📊 **Embedding Process - One-Time vs Automatic**

### ✅ **One-Time Setup** (You run once)
```javascript
// Check current status first
checkEmbeddingStatus();

// If needed, process existing documents (ONE TIME ONLY)
processExistingDocuments();
```

**What this does:**
- Processes all 35,000+ existing documents that were uploaded before RAG
- Generates embeddings for documents missing them
- **Only needs to be run ONCE ever**
- Takes time but runs in background

### 🤖 **Automatic Processing** (Built-in forever)
After the one-time setup, the system automatically handles:
- ✅ **New uploads in Settings** → Get embeddings automatically
- ✅ **Files uploaded in chat** → Get embeddings immediately  
- ✅ **Future documents** → Always processed without user action
- ✅ **No maintenance required** → Runs forever automatically

## 🔍 **Monitor Progress**

```javascript
// Check how many documents still need processing
checkEmbeddingStatus();

// Monitor RAG system health
checkRAGHealth();

// Test the system with sample queries
testRAG();

// Start monitoring real usage
startRAGMonitoring();
```

## 📋 **Complete Setup Checklist**

1. **✅ Database Function** - Run the SQL above
2. **✅ Check Status** - `checkEmbeddingStatus()`
3. **✅ Process Existing** - `processExistingDocuments()` (one time)
4. **✅ Test System** - `testRAG()`
5. **✅ Monitor Usage** - `startRAGMonitoring()`

## 🎯 **Expected Results**

After setup, your chatbot will:
- **Search 35,000+ documents** for every question
- **Enhance responses** with your authoritative content
- **Show users** when responses are enhanced
- **Process new uploads** automatically forever
- **Provide research-grade answers** from your knowledge base

## 🚨 **Troubleshooting**

**Database Function Issues:**
- Run the DROP statements first, then CREATE
- Check pgvector extension is enabled
- Verify you have admin permissions

**Embedding Issues:**
- Check OpenAI API key is set correctly
- Monitor browser console for errors during processing
- Use `checkEmbeddingStatus()` to track progress

**RAG Not Working:**
- Run `checkRAGHealth()` to diagnose
- Verify database function exists
- Test with `testRAG()`

---

**Bottom Line**: Run `processExistingDocuments()` **once** to handle your existing 35K documents, then the system automatically handles everything forever! 🚀
