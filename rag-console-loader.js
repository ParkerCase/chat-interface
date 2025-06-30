// RAG System Quick Loader
// Copy and paste this ENTIRE script into your browser console to load all RAG functions

console.log('🚀 Loading RAG System Functions...');

// Load required dependencies
if (typeof window.supabase === 'undefined') {
  console.error('❌ Supabase not found. Make sure you\'re on the app page.');
  throw new Error('Supabase not available');
}

// 1. Load RAG Health Checker
window.checkRAGHealth = async function() {
  console.log('🏥 RAG System Health Check...');
  
  const checks = [];
  
  // Check Supabase connection
  try {
    const { data, error } = await window.supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .limit(1);
      
    if (error) {
      checks.push(`❌ Database: ${error.message}`);
    } else {
      checks.push('✅ Database: Connected');
    }
  } catch (error) {
    checks.push(`❌ Database: ${error.message}`);
  }
  
  // Check database function
  try {
    const { data, error } = await window.supabase.rpc('rag_search_documents', {
      query_embedding: Array(1536).fill(0.1),
      match_threshold: 0.1,
      match_count: 1
    });
    
    if (error) {
      checks.push(`❌ RAG Function: ${error.message}`);
    } else {
      checks.push('✅ RAG Function: Working');
    }
  } catch (error) {
    checks.push(`❌ RAG Function: ${error.message}`);
  }
  
  // Check OpenAI API key
  if (typeof process !== 'undefined' && process.env?.REACT_APP_OPENAI_API_KEY) {
    checks.push('✅ OpenAI API Key: Present');
  } else {
    checks.push('❌ OpenAI API Key: Missing or not accessible');
  }
  
  console.log('🔍 RAG Health Check Results:');
  checks.forEach(check => console.log(`  ${check}`));
  
  return checks;
};

// 2. Load Embedding Status Checker
window.checkEmbeddingStatus = async function() {
  try {
    console.log('📊 Checking embedding status...');
    
    // Check total documents
    const { data: totalDocs, error: totalError, count: totalCount } = await window.supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('status', 'active');

    if (totalError) throw totalError;

    // Check documents with embeddings
    const { data: withEmbeddings, error: embeddingError, count: withEmbeddingCount } = await window.supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .not('embedding', 'is', null);

    if (embeddingError) throw embeddingError;

    // Check documents without embeddings
    const { data: withoutEmbeddings, error: noEmbeddingError, count: withoutEmbeddingCount } = await window.supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .is('embedding', null);

    if (noEmbeddingError) throw noEmbeddingError;

    const completionRate = totalCount > 0 ? ((withEmbeddingCount / totalCount) * 100).toFixed(1) : 0;

    console.log('📊 EMBEDDING STATUS REPORT');
    console.log('═══════════════════════════');
    console.log(`📁 Total Documents: ${totalCount?.toLocaleString() || 0}`);
    console.log(`✅ With Embeddings: ${withEmbeddingCount?.toLocaleString() || 0}`);
    console.log(`⏳ Without Embeddings: ${withoutEmbeddingCount?.toLocaleString() || 0}`);
    console.log(`📈 Completion Rate: ${completionRate}%`);
    console.log('═══════════════════════════');

    if (withoutEmbeddingCount > 0) {
      console.log('💡 Run processExistingDocuments() to process remaining documents');
    } else {
      console.log('🎉 All documents have embeddings! RAG system is fully ready.');
    }

    return {
      total: totalCount || 0,
      withEmbeddings: withEmbeddingCount || 0,
      withoutEmbeddings: withoutEmbeddingCount || 0,
      completionRate: parseFloat(completionRate)
    };

  } catch (error) {
    console.error('❌ Error checking embedding status:', error);
    return null;
  }
};

// 3. Load Document Processor
window.processExistingDocuments = async function() {
  console.log('🚀 Starting to process existing documents...');
  
  // Check for OpenAI API key first
  const OPENAI_API_KEY = process.env?.REACT_APP_OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found. Set REACT_APP_OPENAI_API_KEY in your environment.');
    return;
  }
  
  async function generateEmbedding(text) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text.substring(0, 8000),
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
  
  try {
    // Get documents without embeddings
    const { data: documents, error } = await window.supabase
      .from('documents')
      .select('id, content, metadata')
      .is('embedding', null)
      .eq('status', 'active')
      .not('content', 'is', null)
      .limit(100); // Process in smaller batches for testing

    if (error) {
      console.error('❌ Error fetching documents:', error);
      return;
    }

    console.log(`📊 Found ${documents.length} documents to process`);

    if (documents.length === 0) {
      console.log('✅ All documents already have embeddings!');
      return;
    }

    let processed = 0;
    let failed = 0;
    const BATCH_SIZE = 3;

    // Process in small batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);

      await Promise.all(batch.map(async (doc, index) => {
        try {
          console.log(`  ⏳ Processing ${i + index + 1}/${documents.length}: ${doc.id}`);
          
          const embedding = await generateEmbedding(doc.content);
          
          const { error: updateError } = await window.supabase
            .from('documents')
            .update({ embedding })
            .eq('id', doc.id);

          if (updateError) {
            console.error(`  ❌ Failed to update ${doc.id}:`, updateError);
            failed++;
          } else {
            console.log(`  ✅ Successfully processed ${doc.id}`);
            processed++;
          }
        } catch (error) {
          console.error(`  ❌ Error processing ${doc.id}:`, error.message);
          failed++;
        }
      }));

      // Small delay between batches
      if (i + BATCH_SIZE < documents.length) {
        console.log('⏸️  Waiting 2s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 Processing completed!');
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
};

// 4. Load Test RAG Function
window.testRAG = async function() {
  console.log('🧪 Testing RAG system...');
  
  const testQueries = [
    "What is tattoo removal?",
    "How does laser removal work?"
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    try {
      // Generate test embedding
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          model: 'text-embedding-ada-002'
        })
      });

      if (!embeddingResponse.ok) {
        throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Search for similar documents
      const { data: docs, error } = await window.supabase.rpc('rag_search_documents', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5
      });

      if (error) {
        console.error(`❌ Search failed:`, error);
      } else {
        console.log(`📋 Found ${docs.length} relevant documents`);
        if (docs.length > 0) {
          docs.forEach((doc, i) => {
            console.log(`  ${i+1}. ${doc.id} (similarity: ${doc.similarity.toFixed(3)})`);
          });
        }
      }
    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 RAG testing completed!');
};

// 5. Load Monitoring Functions
window.startRAGMonitoring = function() {
  console.log('🔍 RAG monitoring started! Watch the console during chat usage.');
  
  window.addEventListener('rag:start', () => console.log('🚀 RAG: Query started'));
  window.addEventListener('rag:complete', (e) => console.log(`✅ RAG: Query completed with ${e.detail?.documentsFound || 0} docs`));
  window.addEventListener('rag:error', (e) => console.log('❌ RAG: Query failed -', e.detail?.error));
};

console.log('✅ RAG System Functions Loaded!');
console.log('📋 Available commands:');
console.log('  checkRAGHealth() - Check system health');
console.log('  checkEmbeddingStatus() - Check embedding progress');
console.log('  processExistingDocuments() - Process documents (one-time)');
console.log('  testRAG() - Test RAG searches');
console.log('  startRAGMonitoring() - Monitor real usage');
console.log('\n🚀 Try running: checkRAGHealth()');
