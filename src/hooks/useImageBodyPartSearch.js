// src/hooks/useImageBodyPartSearch.js
import { useState } from "react";
import { useSupabase } from "./useSupabase";

/**
 * Hook for searching images by body part
 * @returns {Object} Search methods and state
 */
export function useImageBodyPartSearch() {
  const supabase = useSupabase();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  /**
   * Search for images by body part
   * @param {string} bodyPart - Body part to search for
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Array>} Search results
   */
  const searchByBodyPart = async (bodyPart, options = {}) => {
    const { limit = 20, page = 0 } = options;
    const offset = page * limit;

    try {
      setLoading(true);
      setError(null);

      console.log(
        `Searching for body part: ${bodyPart}, limit: ${limit}, offset: ${offset}`
      );

      // Call the Supabase RPC function for body part search
      const { data, error } = await supabase.rpc("find_images_by_body_part", {
        body_part: bodyPart.toLowerCase(),
        match_limit: limit,
        offset_value: offset,
      });

      if (error) {
        console.error("Error in find_images_by_body_part:", error);
        throw error;
      }

      // Get the total count for pagination
      const { data: countData, error: countError } = await supabase.rpc(
        "count_images_by_body_part",
        { body_part: bodyPart.toLowerCase() }
      );

      if (countError) {
        console.warn("Error getting count:", countError);
        // Non-critical error, continue with results
      }

      // Process results to extract relevant data
      const processedResults = (data || []).map((item) => ({
        id: item.id || `body-part-${Math.random()}`,
        path: item.path,
        filename: item.path.split("/").pop(),
        bodyPart: bodyPart.toLowerCase(),
        confidence: item.confidence || 0.8,
        analysis: item.analysis,
      }));

      setResults(processedResults);
      setTotalCount(countData || processedResults.length);

      return processedResults;
    } catch (err) {
      console.error("Error searching by body part:", err);

      // Try fallback direct query if RPC fails
      try {
        console.log("Attempting fallback query for body part search");

        const {
          data,
          error: queryError,
          count,
        } = await supabase
          .from("enhanced_image_analysis")
          .select("id, path, analysis", { count: "exact" })
          .or(
            `analysis->>body_parts.ilike.%${bodyPart.toLowerCase()}%,analysis->>'body_parts' is not null`
          )
          .range(offset, offset + limit - 1);

        if (queryError) throw queryError;

        const processedResults = (data || []).map((item) => ({
          id: item.id,
          path: item.path,
          filename: item.path.split("/").pop(),
          bodyPart: bodyPart.toLowerCase(),
          confidence: 0.8, // Default confidence for fallback
          analysis: item.analysis,
        }));

        setResults(processedResults);
        setTotalCount(count || 0);

        return processedResults;
      } catch (fallbackErr) {
        console.error("Fallback query also failed:", fallbackErr);
        setError(err.message);
        return [];
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load available body parts from the database
   * @returns {Promise<Array>} List of body parts
   */
  const loadAvailableBodyParts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the Supabase RPC function to get available body parts
      const { data, error } = await supabase.rpc("get_available_body_parts");

      if (error) {
        console.error("Error in get_available_body_parts:", error);
        throw error;
      }

      return (
        data || [
          "arm",
          "leg",
          "back",
          "chest",
          "neck",
          "face",
          "hand",
          "foot",
          "ankle",
          "shoulder",
          "ribs",
          "hip",
          "thigh",
          "calf",
          "forearm",
        ]
      );
    } catch (err) {
      console.error("Error loading available body parts:", err);

      // Return default list on error
      return [
        "arm",
        "leg",
        "back",
        "chest",
        "neck",
        "face",
        "hand",
        "foot",
        "ankle",
        "shoulder",
      ];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get counts of images by body part
   * @returns {Promise<Object>} Counts by body part
   */
  const getBodyPartCounts = async () => {
    try {
      setLoading(true);

      // Call the Supabase RPC function to get body part counts
      const { data, error } = await supabase.rpc("count_images_by_body_parts");

      if (error) {
        console.error("Error in count_images_by_body_parts:", error);
        throw error;
      }

      // Convert the array to an object for easier lookup
      const countsObject = {};
      (data || []).forEach((item) => {
        countsObject[item.body_part] = item.count;
      });

      return countsObject;
    } catch (err) {
      console.error("Error getting body part counts:", err);
      return {};
    } finally {
      setLoading(false);
    }
  };

  return {
    searchByBodyPart,
    loadAvailableBodyParts,
    getBodyPartCounts,
    results,
    loading,
    error,
    totalCount,
  };
}
