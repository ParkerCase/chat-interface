// Utility to process all existing documents and generate embeddings
// Run this script once to backfill embeddings for existing documents

import { supabase } from '../lib/supabase.js';

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text.substring(0, 8000), // Limit to 8000 chars
      model: 'text-embedding-ada-002'
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function processExistingDocuments() {
  console.log('🚀 Starting backfill process for existing documents...');
  
  try {
    // Get all documents without embeddings
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, content, metadata')
      .is('embedding', null)
      .eq('status', 'active')
      .not('content', 'is', null);

    if (error) {
      console.error('❌ Error fetching documents:', error);
      return;
    }

    console.log(`📊 Found ${documents.length} documents without embeddings`);

    if (documents.length === 0) {
      console.log('✅ All documents already have embeddings!');
      return;
    }

    let processed = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);

      await Promise.all(batch.map(async (doc, index) => {
        try {
          console.log(`  ⏳ Processing document ${i + index + 1}/${documents.length}: ${doc.id}`);
          
          // Generate embedding
          const embedding = await generateEmbedding(doc.content);
          
          // Update document
          const { error: updateError } = await supabase
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

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < documents.length) {
        console.log(`⏸️  Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    console.log('\n🎉 Backfill process completed!');
    console.log(`✅ Successfully processed: ${processed} documents`);
    console.log(`❌ Failed: ${failed} documents`);
    console.log(`📊 Total: ${processed + failed} documents`);

  } catch (error) {
    console.error('💥 Fatal error during backfill:', error);
  }
}

// Export for use in browser console or as module
if (typeof window !== 'undefined') {
  window.processExistingDocuments = processExistingDocuments;
} else {
  // Node.js usage
  processExistingDocuments().then(() => {
    console.log('Backfill process finished');
    process.exit(0);
  }).catch(error => {
    console.error('Backfill process failed:', error);
    process.exit(1);
  });
}

export { processExistingDocuments };
