// src/hooks/useImageKeywordSearch.js
import { useState } from "react";
import { supabase } from "../lib/supabase";
/**
 * Hook for searching images by keyword in analysis data
 * @returns {Object} Search methods and state
 */
export function useImageKeywordSearch() {
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

      // Split keywords for better search
      const keywords = keyword
        .toLowerCase()
        .split(/\s+/)
        .filter((k) => k.length > 1);

      console.log(
        `Searching for keywords: ${keywords.join(
          ", "
        )}, limit: ${limit}, offset: ${offset}`
      );

      // Call the Supabase RPC function for keyword search
      const { data, error } = await supabase.rpc("search_images_by_keywords", {
        search_terms: keywords,
        match_limit: limit,
        offset_value: offset,
      });

      if (error) {
        console.error("Error in search_images_by_keywords:", error);
        throw error;
      }

      // Get the total count for pagination
      const { data: countData, error: countError } = await supabase.rpc(
        "count_images_by_keywords",
        { search_terms: keywords }
      );

      if (countError) {
        console.warn("Error getting count:", countError);
        // Non-critical error, continue with results
      }

      // Process results to extract relevant data
      const processedResults = (data || []).map((item) => ({
        id: item.id || `keyword-${Math.random()}`,
        path: item.path,
        filename: item.path.split("/").pop(),
        matchScore: item.match_score || 0.8,
        keywords: keywords,
        analysis: item.analysis,
      }));

      setResults(processedResults);
      setTotalCount(countData || processedResults.length);

      return processedResults;
    } catch (err) {
      console.error("Error searching by keyword:", err);

      // Try fallback direct query if RPC fails
      try {
        console.log("Attempting fallback query for keyword search");

        let query = supabase
          .from("enhanced_image_analysis")
          .select("id, path, analysis", { count: "exact" });

        // Apply text search
        if (keyword && keyword.trim()) {
          query = query.textSearch("analysis", keyword, {
            type: "websearch",
            config: "english",
          });
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        // Execute query
        const { data, error: queryError, count } = await query;

        if (queryError) throw queryError;

        const processedResults = (data || []).map((item) => ({
          id: item.id,
          path: item.path,
          filename: item.path.split("/").pop(),
          keywords: keyword.split(/\s+/),
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
   * Get popular keywords from the database
   * @param {number} limit - Maximum number of keywords to return
   * @returns {Promise<Array>} List of popular keywords
   */
  const getPopularKeywords = async (limit = 10) => {
    try {
      setLoading(true);

      // Call the Supabase RPC function to get popular keywords
      const { data, error } = await supabase.rpc("get_popular_keywords", {
        limit_count: limit,
      });

      if (error) {
        console.error("Error in get_popular_keywords:", error);
        throw error;
      }

      return (
        data || [
          "faded",
          "color",
          "black",
          "arm",
          "leg",
          "back",
          "flower",
          "tribal",
          "script",
          "portrait",
        ]
      );
    } catch (err) {
      console.error("Error getting popular keywords:", err);
      return ["tattoo", "faded", "color", "black", "arm", "leg"];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search for images by multiple keywords with more control
   * @param {Object} options - Search options
   * @param {Array} options.keywords - List of keywords to search for
   * @param {Array} options.bodyParts - List of body parts to filter by
   * @param {boolean} options.withTattoo - Filter to only include tattoo images
   * @param {boolean} options.withoutTattoo - Filter to only include non-tattoo images
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Array>} Search results
   */
  const advancedSearch = async (options = {}) => {
    const {
      keywords = [],
      bodyParts = [],
      withTattoo,
      withoutTattoo,
      limit = 20,
      page = 0,
    } = options;

    const offset = page * limit;

    try {
      setLoading(true);
      setError(null);

      console.log("Advanced search with options:", options);

      // Call the Supabase RPC function for advanced search
      const { data, error } = await supabase.rpc("advanced_image_search", {
        search_keywords: keywords,
        body_parts: bodyParts,
        with_tattoo: withTattoo,
        without_tattoo: withoutTattoo,
        match_limit: limit,
        offset_value: offset,
      });

      if (error) {
        console.error("Error in advanced_image_search:", error);
        throw error;
      }

      // Process results
      const processedResults = (data || []).map((item) => ({
        id: item.id || `advanced-${Math.random()}`,
        path: item.path,
        filename: item.path.split("/").pop(),
        matchScore: item.match_score || 0.8,
        keywords: keywords,
        bodyParts: bodyParts,
        analysis: item.analysis,
      }));

      setResults(processedResults);
      setTotalCount(processedResults.length); // Using result length as count

      return processedResults;
    } catch (err) {
      console.error("Error in advanced search:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    searchByKeyword,
    getPopularKeywords,
    advancedSearch,
    results,
    loading,
    error,
    totalCount,
  };
}
