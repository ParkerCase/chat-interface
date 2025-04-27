// src/services/ChatImageSearchService.js
import supabase from "../hooks/useSupabase";

/**
 * Service to handle image search requests from chat
 */
class ChatImageSearchService {
  /**
   * Process a natural language image search request
   * @param {string} query - Natural language query
   * @returns {Promise<Object>} Search results and response info
   */
  async processRequest(query) {
    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();

    // Extract search type and parameters from natural language
    const searchParams = this.parseQuery(normalizedQuery);

    // Execute appropriate search
    const results = await this.executeSearch(searchParams);

    // Generate natural language response
    const response = this.generateResponse(searchParams, results);

    return {
      searchParams,
      results,
      response,
    };
  }

  /**
   * Parse natural language query into structured search parameters
   * @param {string} query - Natural language query
   * @returns {Object} Structured search parameters
   */
  parseQuery(query) {
    // Default search params
    const params = {
      type: "keyword",
      keyword: "",
      bodyPart: null,
      path: null,
      noTattoo: false,
      similarityPath: null,
      limit: 12,
    };

    // Extract search type
    if (
      query.includes("similar") ||
      query.includes("like") ||
      query.includes("resembles")
    ) {
      params.type = "similarity";

      // Try to find a path reference
      const pathMatch =
        query.match(/similar to ([\w\/.-]+)/i) ||
        query.match(/like ([\w\/.-]+)/i);
      if (pathMatch && pathMatch[1]) {
        params.similarityPath = pathMatch[1];
      }
    } else if (
      query.includes("body part") ||
      query.match(
        /\b(arm|leg|back|chest|face|neck|shoulder|hand|foot|ankle|thigh|calf|forearm|wrist)\b/i
      )
    ) {
      params.type = "bodyPart";

      // Find body part mentioned
      const bodyPartMatch = query.match(
        /\b(arm|leg|back|chest|face|neck|shoulder|hand|foot|ankle|thigh|calf|forearm|wrist)\b/i
      );

      if (bodyPartMatch && bodyPartMatch[1]) {
        params.bodyPart = bodyPartMatch[1].toLowerCase();
      }
    } else if (
      query.includes("no tattoo") ||
      query.includes("without tattoo") ||
      query.includes("non-tattoo") ||
      query.includes("clean skin")
    ) {
      params.type = "noTattoo";
      params.noTattoo = true;
    } else if (
      query.includes("folder") ||
      query.includes("directory") ||
      query.includes("path") ||
      query.match(/in ([\w\/.-]+)/i)
    ) {
      params.type = "path";

      // Try to find a path reference
      const pathMatch =
        query.match(/in ([\w\/.-]+)/i) ||
        query.match(/folder ([\w\/.-]+)/i) ||
        query.match(/path ([\w\/.-]+)/i);

      if (pathMatch && pathMatch[1]) {
        params.path = pathMatch[1];
      }
    } else {
      // Default to keyword search
      params.type = "keyword";
      params.keyword = query
        .replace(
          /show|find|search|me|for|images|with|tattoo[s]?|containing/gi,
          ""
        )
        .trim();
    }

    // Extract limit if specified
    const limitMatch = query.match(/\b(limit|show|find|get) (\d+)\b/);
    if (limitMatch && limitMatch[2]) {
      const requestedLimit = parseInt(limitMatch[2]);
      params.limit =
        requestedLimit > 0 && requestedLimit <= 50 ? requestedLimit : 12;
    }

    return params;
  }

  /**
   * Execute the appropriate search based on parsed parameters
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Search results
   */
  async executeSearch(params) {
    try {
      let results = [];

      switch (params.type) {
        case "keyword":
          results = await this.searchByKeyword(params.keyword, params.limit);
          break;
        case "bodyPart":
          results = await this.searchByBodyPart(params.bodyPart, params.limit);
          break;
        case "path":
          results = await this.searchByPath(params.path, params.limit);
          break;
        case "noTattoo":
          results = await this.searchNoTattoo(params.limit);
          break;
        case "similarity":
          if (params.similarityPath) {
            results = await this.searchSimilarByPath(
              params.similarityPath,
              params.limit
            );
          }
          break;
        default:
          results = await this.searchByKeyword(params.keyword, params.limit);
      }

      return results;
    } catch (error) {
      console.error("Error executing search:", error);
      return [];
    }
  }

  /**
   * Search images by keyword
   * @param {string} keyword - Keyword to search for
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Search results
   */
  async searchByKeyword(keyword, limit = 12) {
    try {
      const { data, error } = await supabase
        .from("enhanced_image_analysis")
        .select("id, path, analysis")
        .textSearch("analysis", keyword)
        .limit(limit);

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        filename: item.path.split("/").pop(),
        insights: item.analysis?.insights || {},
      }));
    } catch (error) {
      console.error("Error searching by keyword:", error);
      return [];
    }
  }

  /**
   * Search images by body part
   * @param {string} bodyPart - Body part to search for
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Search results
   */
  async searchByBodyPart(bodyPart, limit = 12) {
    try {
      const { data, error } = await supabase
        .from("enhanced_image_analysis")
        .select("id, path, analysis")
        .eq("analysis->insights->bodyPart", bodyPart)
        .limit(limit);

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        filename: item.path.split("/").pop(),
        bodyPart: item.analysis?.insights?.bodyPart,
        insights: item.analysis?.insights || {},
      }));
    } catch (error) {
      console.error("Error searching by body part:", error);
      return [];
    }
  }

  /**
   * Search images by path
   * @param {string} pathPattern - Path pattern to search for
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Search results
   */
  async searchByPath(pathPattern, limit = 12) {
    try {
      const { data, error } = await supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, created_at")
        .ilike("image_path", `%${pathPattern}%`)
        .limit(limit);

      if (error) throw error;

      // Remove duplicates by path
      const uniquePaths = {};
      const uniqueData = data.filter((item) => {
        if (!uniquePaths[item.image_path]) {
          uniquePaths[item.image_path] = true;
          return true;
        }
        return false;
      });

      return uniqueData.map((item) => ({
        id: item.id,
        path: item.image_path,
        filename: item.image_path.split("/").pop(),
        type: item.embedding_type,
        created: item.created_at,
      }));
    } catch (error) {
      console.error("Error searching by path:", error);
      return [];
    }
  }

  /**
   * Search for images without tattoos
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Search results
   */
  async searchNoTattoo(limit = 12) {
    try {
      const { data, error } = await supabase
        .from("enhanced_image_analysis")
        .select("id, path, analysis")
        .eq("analysis->insights->isLikelyTattoo", false)
        .limit(limit);

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        filename: item.path.split("/").pop(),
        insights: item.analysis?.insights || {},
      }));
    } catch (error) {
      console.error("Error searching for non-tattoo images:", error);
      return [];
    }
  }

  /**
   * Search for similar images by path
   * @param {string} imagePath - Path to reference image
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Search results
   */
  async searchSimilarByPath(imagePath, limit = 12) {
    try {
      // First get the embedding
      const { data: embeddingData, error: embeddingError } = await supabase
        .from("image_embeddings")
        .select("embedding_data")
        .eq("image_path", imagePath)
        .eq("embedding_type", "full")
        .limit(1)
        .single();

      if (embeddingError) throw embeddingError;

      if (
        !embeddingData ||
        !embeddingData.embedding_data ||
        !embeddingData.embedding_data.embedding
      ) {
        throw new Error("No embedding found for this image");
      }

      const embedding = embeddingData.embedding_data.embedding;

      // Then search for similar images
      const { data, error } = await supabase.rpc("search_images_by_embedding", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit,
      });

      if (error) throw error;

      return (data || [])
        .filter((item) => item.image_path !== imagePath) // Remove reference image
        .map((item) => ({
          id: item.id,
          path: item.image_path,
          filename: item.image_path.split("/").pop(),
          type: item.embedding_type,
          similarity: item.similarity,
        }));
    } catch (error) {
      console.error("Error searching similar images:", error);
      return [];
    }
  }

  /**
   * Generate a natural language response for the search results
   * @param {Object} searchParams - Search parameters
   * @param {Array} results - Search results
   * @returns {string} Natural language response
   */
  generateResponse(searchParams, results) {
    if (results.length === 0) {
      // Handle no results
      switch (searchParams.type) {
        case "keyword":
          return `I couldn't find any images matching "${searchParams.keyword}". Try different keywords or check for typos.`;
        case "bodyPart":
          return `I couldn't find any images with tattoos on the ${searchParams.bodyPart}. Try searching for a different body part.`;
        case "path":
          return `I couldn't find any images in the path containing "${searchParams.path}". Try a different folder name.`;
        case "noTattoo":
          return `I couldn't find any images without tattoos in our database.`;
        case "similarity":
          return `I couldn't find any images similar to the one you specified. The reference image might not have an embedding.`;
        default:
          return `I couldn't find any matching images. Try refining your search.`;
      }
    }

    // Generate response based on search type
    switch (searchParams.type) {
      case "keyword":
        return `I found ${results.length} image${
          results.length === 1 ? "" : "s"
        } matching "${searchParams.keyword}".`;

      case "bodyPart":
        return `Here ${results.length === 1 ? "is" : "are"} ${
          results.length
        } image${results.length === 1 ? "" : "s"} with tattoos on the ${
          searchParams.bodyPart
        }.`;

      case "path":
        return `I found ${results.length} image${
          results.length === 1 ? "" : "s"
        } in the path containing "${searchParams.path}".`;

      case "noTattoo":
        return `Here ${results.length === 1 ? "is" : "are"} ${
          results.length
        } image${results.length === 1 ? "" : "s"} without tattoos.`;

      case "similarity":
        return `I found ${results.length} image${
          results.length === 1 ? "" : "s"
        } similar to the one you specified.`;

      default:
        return `Here ${results.length === 1 ? "is" : "are"} ${
          results.length
        } matching image${results.length === 1 ? "" : "s"}.`;
    }
  }
}

export default new ChatImageSearchService();
