// src/utils/ragService.js
import { supabase } from "../lib/supabase";

class RAGService {
  constructor() {
    this.openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;
    this.embeddingModel = "text-embedding-3-small";
    this.maxContextLength = 8000; // Leave room for the user query and response
    this.maxDocuments = 10; // Max documents to retrieve
    this.similarityThreshold = 0.5; // Minimum similarity score
  }

  /**
   * Generate embedding for a text query using OpenAI
   */
  async generateEmbedding(text) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  /**
   * Search documents using vector similarity
   */
  async searchDocuments(queryEmbedding, maxResults = this.maxDocuments) {
    try {
      // Use the existing match_documents function from your schema
      const { data: documents, error } = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: this.similarityThreshold,
        match_count: maxResults,
        filter_criteria: { status: "active" }, // Only active documents
      });

      if (error) {
        console.error("Document search error:", error);
        return [];
      }

      return documents || [];
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }

  /**
   * Format retrieved documents for inclusion in OpenAI prompt
   */
  formatDocumentsForPrompt(documents) {
    if (!documents || documents.length === 0) {
      return "";
    }

    let formattedDocs = "\n\n--- KNOWLEDGE BASE CONTEXT ---\n";
    let totalLength = 0;
    const maxLength = this.maxContextLength;

    for (const doc of documents) {
      const docContent = `
Document: ${doc.metadata?.name || doc.id}
Type: ${doc.document_type || 'Unknown'}
Source: ${doc.metadata?.source_type || 'Upload'}
Relevance: ${(doc.similarity * 100).toFixed(1)}%
Content: ${doc.content}
---`;

      // Check if adding this document would exceed our context limit
      if (totalLength + docContent.length > maxLength) {
        break;
      }

      formattedDocs += docContent;
      totalLength += docContent.length;
    }

    formattedDocs += "\n--- END KNOWLEDGE BASE CONTEXT ---\n\n";
    return formattedDocs;
  }

  /**
   * Create enhanced prompt with document context
   */
  createEnhancedPrompt(userQuery, documents) {
    const documentContext = this.formatDocumentsForPrompt(documents);
    
    const systemPrompt = `You are a professional AI assistant with access to a comprehensive knowledge base. Use the provided context documents to give accurate, detailed, and research-grade responses. 

INSTRUCTIONS:
- Prioritize information from the knowledge base context when available
- Cite specific documents when referencing information (use document names/types)
- If the context doesn't contain relevant information, clearly state this and provide general guidance
- Maintain a professional, research-oriented tone
- Provide comprehensive answers that demonstrate deep analysis
- When multiple documents are relevant, synthesize information across them

${documentContext}

USER QUERY: ${userQuery}

Please provide a comprehensive, professional response based on the available knowledge base context:`;

    return systemPrompt;
  }

  /**
   * Main RAG function - retrieves documents and creates enhanced prompt
   */
  async enhanceQuery(userQuery) {
    try {
      console.log("RAG: Enhancing query:", userQuery);
      
      // Generate embedding for the user query
      const queryEmbedding = await this.generateEmbedding(userQuery);
      console.log("RAG: Generated embedding");

      // Search for relevant documents
      const relevantDocs = await this.searchDocuments(queryEmbedding);
      console.log(`RAG: Found ${relevantDocs.length} relevant documents`);

      // Log document details for debugging
      if (relevantDocs.length > 0) {
        console.log("RAG: Top documents:", relevantDocs.map(doc => ({
          id: doc.id,
          type: doc.document_type,
          similarity: doc.similarity,
          name: doc.metadata?.name || "Unnamed"
        })));
      }

      // Create enhanced prompt with document context
      const enhancedPrompt = this.createEnhancedPrompt(userQuery, relevantDocs);
      
      return {
        enhancedPrompt,
        documentsFound: relevantDocs.length,
        documents: relevantDocs,
        hasContext: relevantDocs.length > 0
      };
    } catch (error) {
      console.error("RAG enhancement error:", error);
      
      // Fallback to original query if RAG fails
      return {
        enhancedPrompt: userQuery,
        documentsFound: 0,
        documents: [],
        hasContext: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure a document has an embedding
   */
  async ensureDocumentEmbedding(documentId, content) {
    try {
      // Check if document already has an embedding
      const { data: existingDoc, error: fetchError } = await supabase
        .from("documents")
        .select("embedding")
        .eq("id", documentId)
        .single();

      if (fetchError) {
        console.error("Error fetching document:", fetchError);
        return false;
      }

      // If embedding already exists, skip
      if (existingDoc.embedding) {
        console.log(`Document ${documentId} already has embedding`);
        return true;
      }

      // Generate embedding for the document content
      console.log(`Generating embedding for document ${documentId}`);
      const embedding = await this.generateEmbedding(content);

      // Update the document with the embedding
      const { error: updateError } = await supabase
        .from("documents")
        .update({ embedding })
        .eq("id", documentId);

      if (updateError) {
        console.error("Error updating document embedding:", updateError);
        return false;
      }

      console.log(`Successfully added embedding to document ${documentId}`);
      return true;
    } catch (error) {
      console.error("Error ensuring document embedding:", error);
      return false;
    }
  }

  /**
   * Batch process documents without embeddings
   */
  async processDocumentsWithoutEmbeddings(batchSize = 10) {
    try {
      console.log("RAG: Processing documents without embeddings...");
      
      // Get documents without embeddings
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, content")
        .is("embedding", null)
        .eq("status", "active")
        .limit(batchSize);

      if (error) {
        console.error("Error fetching documents without embeddings:", error);
        return { processed: 0, errors: 1 };
      }

      if (!documents || documents.length === 0) {
        console.log("RAG: All documents have embeddings");
        return { processed: 0, errors: 0 };
      }

      console.log(`RAG: Processing ${documents.length} documents...`);
      let processed = 0;
      let errors = 0;

      // Process documents in smaller batches to avoid rate limits
      for (const doc of documents) {
        try {
          await this.ensureDocumentEmbedding(doc.id, doc.content);
          processed++;
          
          // Small delay to avoid hitting OpenAI rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error processing document ${doc.id}:`, error);
          errors++;
        }
      }

      console.log(`RAG: Processed ${processed} documents, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      console.error("Error in batch processing:", error);
      return { processed: 0, errors: 1 };
    }
  }
}

// Create and export singleton instance
const ragService = new RAGService();
export default ragService;