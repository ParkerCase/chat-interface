// src/hooks/useImageSimilaritySearch.js
import { useState } from "react";
import { useSupabase } from "./useSupabase";
import axios from "axios";

/**
 * Hook for searching similar images using vector embeddings
 * @returns {Object} Search methods and state
 */
export function useImageSimilaritySearch() {
  const supabase = useSupabase();
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
   * @returns {Promise<Array>} Similar images
   */
  const searchSimilarImages = async (imageFile, options = {}) => {
    const { limit = 20, threshold = 0.5 } = options;

    try {
      setLoading(true);
      setError(null);
      setProcessingProgress(10);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("image", imageFile);

      // Generate embedding using our backend API
      setProcessingProgress(20);
      const embeddingResponse = await axios.post(
        "/api/embedding/generate",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (!embeddingResponse.data.success) {
        throw new Error(
          "Failed to generate embedding: " + embeddingResponse.data.error
        );
      }

      setProcessingProgress(60);
      const embedding = embeddingResponse.data.embedding;

      // Then call the Supabase function for vector search
      const { data, error } = await supabase.rpc("search_images_by_embedding", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) throw error;

      // Process results
      setProcessingProgress(90);
      const processedResults = (data || []).map((item) => ({
        id: item.id,
        path: item.image_path,
        filename: item.image_path.split("/").pop(),
        type: item.embedding_type,
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
   * @returns {Promise<Array>} Similar images
   */
  const searchSimilarByPath = async (imagePath, options = {}) => {
    const { limit = 20, threshold = 0.5 } = options;

    try {
      setLoading(true);
      setError(null);
      setProcessingProgress(10);

      // First, get the embedding of the reference image
      const { data: embeddingData, error: embeddingError } = await supabase
        .from("image_embeddings")
        .select("embedding_data")
        .eq("image_path", imagePath)
        .eq("embedding_type", "full")
        .limit(1)
        .single();

      if (embeddingError) throw embeddingError;

      setProcessingProgress(40);

      if (
        !embeddingData ||
        !embeddingData.embedding_data ||
        !embeddingData.embedding_data.embedding
      ) {
        throw new Error("No embedding found for this image");
      }

      const embedding = embeddingData.embedding_data.embedding;
      setProcessingProgress(60);

      // Then call the Supabase function for vector search
      const { data, error } = await supabase.rpc("search_images_by_embedding", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) throw error;

      // Process results
      setProcessingProgress(90);
      const processedResults = (data || []).map((item) => ({
        id: item.id,
        path: item.image_path,
        filename: item.image_path.split("/").pop(),
        type: item.embedding_type,
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

      // Create FormData
      const formData = new FormData();
      formData.append("image", imageFile);

      // Add options
      if (options.generateFull !== undefined) {
        formData.append("generateFull", options.generateFull.toString());
      }
      if (options.generatePartial !== undefined) {
        formData.append("generatePartial", options.generatePartial.toString());
      }
      if (options.analyze !== undefined) {
        formData.append("analyze", options.analyze.toString());
      }
      if (options.store !== undefined) {
        formData.append("store", options.store.toString());
      }
      if (options.imagePath) {
        formData.append("imagePath", options.imagePath);
      }

      // Process the image using our backend endpoint
      setProcessingProgress(30);
      const response = await axios.post("/api/embedding/process", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 70) / progressEvent.total
          );
          setProcessingProgress(30 + percentCompleted);
        },
      });

      if (!response.data.success) {
        throw new Error("Failed to process image: " + response.data.error);
      }

      setProcessingProgress(100);
      return response.data;
    } catch (err) {
      console.error("Error processing new image:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
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
