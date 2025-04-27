// src/hooks/useImageNoTattooSearch.js
import { useState } from "react";
import { useSupabase } from "./useSupabase";

/**
 * Hook for finding images without tattoos
 * @returns {Object} Search methods and state
 */
export function useImageNoTattooSearch() {
  const supabase = useSupabase();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  /**
   * Search for images without tattoos
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Array>} Search results
   */
  const searchImagesWithoutTattoos = async (options = {}) => {
    const { limit = 20, page = 0 } = options;
    const offset = page * limit;

    try {
      setLoading(true);
      setError(null);

      // Direct Supabase query approach
      const { data, error, count } = await supabase
        .from("enhanced_image_analysis")
        .select("id, path, analysis", { count: "exact" })
        .eq("analysis->insights->isLikelyTattoo", false)
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Process results to extract relevant data
      const processedResults = data.map((item) => ({
        ...item,
        filename: item.path.split("/").pop(),
        insights: item.analysis?.insights || {},
      }));

      setResults(processedResults);
      setTotalCount(count || 0);

      return processedResults;
    } catch (err) {
      console.error("Error searching for non-tattoo images:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Alternative method using Supabase RPC function if available
   */
  const searchImagesWithoutTattoosRPC = async (options = {}) => {
    const { limit = 20 } = options;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc(
        "find_images_without_tattoos",
        { limit_count: limit }
      );

      if (error) throw error;

      const processedResults = data.map((item) => ({
        ...item,
        filename: item.path.split("/").pop(),
        insights: item.analysis?.insights || {},
      }));

      setResults(processedResults);
      setTotalCount(processedResults.length);

      return processedResults;
    } catch (err) {
      console.error("Error searching for non-tattoo images (RPC):", err);

      // Fallback to direct query if RPC fails
      if (
        err.message.includes("function") ||
        err.message.includes("not found")
      ) {
        return searchImagesWithoutTattoos(options);
      }

      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get statistics about tattoo vs non-tattoo images
   * @returns {Promise<Object>} Statistics
   */
  const getTattooStats = async () => {
    try {
      setLoading(true);

      // Query for tattoo images count
      const { count: tattooCount, error: tattooError } = await supabase
        .from("enhanced_image_analysis")
        .select("id", { count: "exact", head: true })
        .eq("analysis->insights->isLikelyTattoo", true);

      if (tattooError) throw tattooError;

      // Query for non-tattoo images count
      const { count: nonTattooCount, error: nonTattooError } = await supabase
        .from("enhanced_image_analysis")
        .select("id", { count: "exact", head: true })
        .eq("analysis->insights->isLikelyTattoo", false);

      if (nonTattooError) throw nonTattooError;

      // Total analyzed images
      const totalAnalyzed = tattooCount + nonTattooCount;

      return {
        tattooCount,
        nonTattooCount,
        totalAnalyzed,
        tattooPercentage:
          totalAnalyzed > 0 ? (tattooCount / totalAnalyzed) * 100 : 0,
        nonTattooPercentage:
          totalAnalyzed > 0 ? (nonTattooCount / totalAnalyzed) * 100 : 0,
      };
    } catch (err) {
      console.error("Error getting tattoo stats:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    searchImagesWithoutTattoos,
    searchImagesWithoutTattoosRPC,
    getTattooStats,
    results,
    loading,
    error,
    totalCount,
  };
}
