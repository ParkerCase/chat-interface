// src/hooks/useImagePathSearch.js
import { useState } from "react";
import { supabase } from "../lib/supabase";
/**
 * Hook for searching images by path/folder
 * @returns {Object} Search methods and state
 */
export function useImagePathSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  /**
   * Search for images by path pattern
   * @param {string} pathPattern - Search pattern for path
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.page - Page number for pagination
   * @returns {Promise<Array>} Search results
   */
  const searchByPath = async (pathPattern, options = {}) => {
    const { limit = 20, page = 0 } = options;
    const offset = page * limit;

    try {
      setLoading(true);
      setError(null);

      // Use image_embeddings table which has the path information
      const { data, error, count } = await supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, created_at", {
          count: "exact",
        })
        .ilike("image_path", `%${pathPattern}%`)
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Remove duplicates by path (keep only one embedding per image)
      const uniquePaths = {};
      const uniqueData = data.filter((item) => {
        if (!uniquePaths[item.image_path]) {
          uniquePaths[item.image_path] = true;
          return true;
        }
        return false;
      });

      // Process results to extract relevant data
      const processedResults = uniqueData.map((item) => ({
        id: item.id,
        path: item.image_path,
        filename: item.image_path.split("/").pop(),
        type: item.embedding_type,
        created: item.created_at,
      }));

      setResults(processedResults);
      setTotalCount(count || 0);

      return processedResults;
    } catch (err) {
      console.error("Error searching by path:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get folder hierarchy from the database
   * @returns {Promise<Array>} Folder structure
   */
  const getFolderHierarchy = async () => {
    try {
      setLoading(true);
      setError(null);

      // Extract unique folders from image paths
      const { data, error } = await supabase
        .from("image_embeddings")
        .select("image_path");

      if (error) throw error;

      // Build folder hierarchy
      const folders = {};

      data.forEach((item) => {
        if (!item.image_path) return;

        // Split path into segments
        const segments = item.image_path.split("/").filter(Boolean);

        // Skip the last segment (filename)
        segments.pop();

        // Build path hierarchy
        let currentPath = "";
        segments.forEach((segment) => {
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${segment}` : segment;

          if (!folders[currentPath]) {
            folders[currentPath] = {
              path: currentPath,
              name: segment,
              parent: parentPath || null,
              count: 0,
            };
          }

          folders[currentPath].count++;
        });
      });

      // Convert to array and sort
      const folderArray = Object.values(folders).sort((a, b) =>
        a.path.localeCompare(b.path)
      );

      return folderArray;
    } catch (err) {
      console.error("Error getting folder hierarchy:", err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    searchByPath,
    getFolderHierarchy,
    results,
    loading,
    error,
    totalCount,
  };
}
