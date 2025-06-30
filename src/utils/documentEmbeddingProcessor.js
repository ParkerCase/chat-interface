// src/utils/documentEmbeddingProcessor.js
import { supabase } from "../lib/supabase";
import ragService from "./ragService";

class DocumentEmbeddingProcessor {
  constructor() {
    this.isProcessing = false;
    this.processingQueue = [];
    this.batchSize = 5; // Process 5 documents at a time to avoid rate limits
    this.delay = 200; // 200ms delay between requests
  }

  /**
   * Add a document to the processing queue
   */
  queueDocument(documentId, content) {
    this.processingQueue.push({ documentId, content });
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the queue of documents
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Starting to process ${this.processingQueue.length} documents for embeddings...`);

    try {
      while (this.processingQueue.length > 0) {
        // Take a batch from the queue
        const batch = this.processingQueue.splice(0, this.batchSize);
        
        // Process each document in the batch
        await Promise.all(
          batch.map(async (doc) => {
            try {
              await ragService.ensureDocumentEmbedding(doc.documentId, doc.content);
              console.log(`✓ Processed embedding for document ${doc.documentId}`);
            } catch (error) {
              console.error(`✗ Failed to process document ${doc.documentId}:`, error);
            }
          })
        );

        // Add delay between batches to respect rate limits
        if (this.processingQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      }

      console.log("✓ Completed processing all queued documents");
    } catch (error) {
      console.error("Error processing document queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process all documents without embeddings in the database
   */
  async processAllMissingEmbeddings() {
    console.log("Scanning for documents without embeddings...");
    
    try {
      // Get documents without embeddings
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, content")
        .is("embedding", null)
        .eq("status", "active")
        .limit(100); // Process in chunks

      if (error) {
        console.error("Error fetching documents without embeddings:", error);
        return { processed: 0, errors: 1 };
      }

      if (!documents || documents.length === 0) {
        console.log("✓ All documents have embeddings");
        return { processed: 0, errors: 0 };
      }

      console.log(`Found ${documents.length} documents without embeddings`);

      // Add all documents to the processing queue
      documents.forEach(doc => {
        this.queueDocument(doc.id, doc.content);
      });

      return { queued: documents.length };
    } catch (error) {
      console.error("Error in processAllMissingEmbeddings:", error);
      return { processed: 0, errors: 1 };
    }
  }

  /**
   * Process a single document immediately (for newly uploaded documents)
   */
  async processDocumentImmediately(documentId, content) {
    try {
      console.log(`Processing embedding for new document ${documentId}...`);
      await ragService.ensureDocumentEmbedding(documentId, content);
      console.log(`✓ Embedding processed for document ${documentId}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to process embedding for document ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Get processing status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      batchSize: this.batchSize
    };
  }

  /**
   * Hook to be called when documents are uploaded via settings
   */
  async onDocumentUploaded(documentData) {
    const { id, content, name } = documentData;
    
    if (!id || !content) {
      console.warn("Document uploaded without ID or content, skipping embedding generation");
      return;
    }

    console.log(`New document uploaded: ${name || id}, queuing for embedding generation...`);
    
    // For newly uploaded documents, process immediately to ensure they're 
    // available for RAG as soon as possible
    this.queueDocument(id, content);
  }

  /**
   * Initialize the processor and check for any documents missing embeddings
   */
  async initialize() {
    console.log("Initializing Document Embedding Processor...");
    
    // Check for any documents that don't have embeddings yet
    const result = await this.processAllMissingEmbeddings();
    
    if (result.queued > 0) {
      console.log(`Queued ${result.queued} documents for embedding processing`);
    }

    return result;
  }
}

// Create and export singleton instance
const documentEmbeddingProcessor = new DocumentEmbeddingProcessor();

// Auto-initialize on import
documentEmbeddingProcessor.initialize().catch(error => {
  console.error("Failed to initialize document embedding processor:", error);
});

export default documentEmbeddingProcessor;