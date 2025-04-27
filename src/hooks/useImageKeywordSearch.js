// src/hooks/useImageKeywordSearch.js
import { useState } from "react";
import { useSupabase } from "./useSupabase";

/**
 * Hook for searching images by keyword in analysis data
 * @returns {Object} Search methods and state
 */
export function useImageKeywordSearch() {
  const supabase = useSupabase();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  /**
   * Search for images by keyword in their analysis data
   * @param {string} keyword - Search term
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Array>} Search results
   */
  const searchByKeyword = async (keyword, options = {}) => {
    const { limit = 20, page = 0 } = options;
    const offset = page * limit;

    try {
      setLoading(true);
      setError(null);

      // Direct Supabase query approach
      const { data, error, count } = await supabase
        .from("enhanced_image_analysis")
        .select("id, path, analysis", { count: "exact" })
        .textSearch("analysis", keyword)
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
      console.error("Error searching by keyword:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Alternative method using Supabase RPC function if available
   */
  const searchByKeywordRPC = async (keyword, options = {}) => {
    const { limit = 20 } = options;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc("search_images_by_keyword", {
        search_keyword: keyword,
        limit_count: limit,
      });

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
      console.error("Error searching by keyword (RPC):", err);

      // Fallback to direct query if RPC fails
      if (
        err.message.includes("function") ||
        err.message.includes("not found")
      ) {
        return searchByKeyword(keyword, options);
      }

      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    searchByKeyword,
    searchByKeywordRPC,
    results,
    loading,
    error,
    totalCount,
  };
}
