// Quick embedding status checker
// Run this in browser console to see embedding progress

async function checkEmbeddingStatus() {
  try {
    // Check total documents
    const { data: totalDocs, error: totalError } = await supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('status', 'active');

    if (totalError) throw totalError;

    // Check documents with embeddings
    const { data: withEmbeddings, error: embeddingError } = await supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .not('embedding', 'is', null);

    if (embeddingError) throw embeddingError;

    // Check documents without embeddings
    const { data: withoutEmbeddings, error: noEmbeddingError } = await supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .is('embedding', null);

    if (noEmbeddingError) throw noEmbeddingError;

    const totalCount = totalDocs.length;
    const withEmbeddingCount = withEmbeddings.length;
    const withoutEmbeddingCount = withoutEmbeddings.length;
    const completionRate = ((withEmbeddingCount / totalCount) * 100).toFixed(1);

    console.log('📊 EMBEDDING STATUS REPORT');
    console.log('═══════════════════════════');
    console.log(`📁 Total Documents: ${totalCount.toLocaleString()}`);
    console.log(`✅ With Embeddings: ${withEmbeddingCount.toLocaleString()}`);
    console.log(`⏳ Without Embeddings: ${withoutEmbeddingCount.toLocaleString()}`);
    console.log(`📈 Completion Rate: ${completionRate}%`);
    console.log('═══════════════════════════');

    if (withoutEmbeddingCount > 0) {
      console.log('💡 Run processExistingDocuments() to process remaining documents');
    } else {
      console.log('🎉 All documents have embeddings! RAG system is fully ready.');
    }

    return {
      total: totalCount,
      withEmbeddings: withEmbeddingCount,
      withoutEmbeddings: withoutEmbeddingCount,
      completionRate: parseFloat(completionRate)
    };

  } catch (error) {
    console.error('❌ Error checking embedding status:', error);
    return null;
  }
}

// Make it globally available
if (typeof window !== 'undefined') {
  window.checkEmbeddingStatus = checkEmbeddingStatus;
  console.log('🔍 Embedding status checker loaded!');
  console.log('📋 Run: checkEmbeddingStatus()');
}

export { checkEmbeddingStatus };
