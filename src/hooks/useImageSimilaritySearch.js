// src/hooks/useImageSimilaritySearch.js
import { useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Hook for searching similar images using vector embeddings
 * @returns {Object} Search methods and state
 */
export function useImageSimilaritySearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);

  /**
   * Search for similar images using an uploaded file
   * @param {File} imageFile - Image file to find similar images for
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.threshold - Similarity threshold (0-1)
   * @param {string} options.embeddingType - Type of embedding to use ('full' or 'partial')
   * @returns {Promise<Array>} Similar images
   */
  const searchSimilarImages = async (imageFile, options = {}) => {
    const { limit = 20, threshold = 0.65, embeddingType = "full" } = options;

    try {
      setLoading(true);
      setError(null);
      setProcessingProgress(10);

      // Read file as base64
      const base64Image = await readFileAsBase64(imageFile);
      const base64Data = base64Image.split(",")[1]; // Remove the data:image/jpeg;base64, part

      setProcessingProgress(30);

      console.log(`Using embedding type for search: ${embeddingType}`);

      // Call Supabase RPC function for embedding generation and search
      const { data, error } = await supabase.rpc(
        "generate_embedding_and_search_from_base64",
        {
          image_base64: base64Data,
          match_threshold: threshold,
          match_count: limit,
          embedding_type: embeddingType,
        }
      );

      if (error) {
        console.error("Supabase RPC error:", error);
        throw error;
      }

      setProcessingProgress(80);

      // Process results
      const processedResults = (data || []).map((item) => ({
        id: item.id,
        path: item.image_path,
        filename: item.image_path.split("/").pop(),
        type: embeddingType,
        similarity: item.similarity,
      }));

      setResults(processedResults);
      setProcessingProgress(100);

      return processedResults;
    } catch (err) {
      console.error("Error searching similar images:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search for similar images using the path of an existing image
   * @param {string} imagePath - Path of the reference image
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.threshold - Similarity threshold (0-1)
   * @param {string} options.embeddingType - Type of embedding to use ('full' or 'partial')
   * @returns {Promise<Array>} Similar images
   */
  const searchSimilarByPath = async (imagePath, options = {}) => {
    const { limit = 20, threshold = 0.65, embeddingType = "full" } = options;

    try {
      setLoading(true);
      setError(null);
      setProcessingProgress(10);

      // First, get the embedding of the reference image
      const { data: embeddingData, error: embeddingError } = await supabase
        .from("image_embeddings")
        .select("embedding_data")
        .eq("image_path", imagePath)
        .eq("embedding_type", embeddingType)
        .limit(1)
        .single();

      if (embeddingError) {
        console.error("Error fetching embedding:", embeddingError);
        throw embeddingError;
      }

      setProcessingProgress(40);

      if (!embeddingData?.embedding_data?.embedding) {
        throw new Error(`No ${embeddingType} embedding found for this image`);
      }

      const embedding = embeddingData.embedding_data.embedding;
      setProcessingProgress(60);

      // Then call the Supabase function for vector search
      const { data, error } = await supabase.rpc("search_images_by_embedding", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        embedding_type: embeddingType,
      });

      if (error) {
        console.error("Search by embedding error:", error);
        throw error;
      }

      // Process results
      setProcessingProgress(90);
      const processedResults = (data || []).map((item) => ({
        id: item.id,
        path: item.image_path,
        filename: item.image_path.split("/").pop(),
        type: item.embedding_type || embeddingType,
        similarity: item.similarity,
      }));

      // Filter out the reference image itself
      const filteredResults = processedResults.filter(
        (item) => item.path !== imagePath
      );

      setResults(filteredResults);
      setProcessingProgress(100);

      return filteredResults;
    } catch (err) {
      console.error("Error searching similar images by path:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Process a new image for analysis and embedding
   * @param {File} imageFile - Image file to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  const processNewImage = async (imageFile, options = {}) => {
    try {
      setLoading(true);
      setError(null);
      setProcessingProgress(10);

      // Read file as base64
      const base64Image = await readFileAsBase64(imageFile);
      const base64Data = base64Image.split(",")[1]; // Remove the data:image/jpeg;base64, part

      setProcessingProgress(30);

      // Prepare options for the Supabase function
      const functionOptions = {
        image_base64: base64Data,
        generate_full: options.generateFull !== false,
        generate_partial: options.generatePartial === true,
        analyze: options.analyze !== false,
        store: options.store === true,
        image_path: options.imagePath || null,
      };

      // Process the image using Supabase RPC
      const { data, error } = await supabase.rpc(
        "process_image_complete",
        functionOptions
      );

      if (error) {
        console.error("Image processing error:", error);
        throw error;
      }

      setProcessingProgress(100);
      return data;
    } catch (err) {
      console.error("Error processing new image:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Utility function to read a file as base64
   * @param {File} file - File to read
   * @returns {Promise<string>} Base64 string
   */
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(new Error("Failed to read file"));
      };
      reader.readAsDataURL(file);
    });
  };

  return {
    searchSimilarImages,
    searchSimilarByPath,
    processNewImage,
    results,
    loading,
    error,
    processingProgress,
  };
}
