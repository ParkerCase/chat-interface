// src/hooks/useChatImageSearch.js
import { useState } from "react";
import ChatImageSearchService from "../services/ChatImageSearchService";

/**
 * Custom hook for handling image searches in chat context
 * @returns {Object} Chat image search methods and state
 */
export function useChatImageSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [responseText, setResponseText] = useState("");

  /**
   * Process a natural language image search request
   * @param {string} query - Natural language search query
   * @returns {Promise<Object>} Search results and response
   */
  const processImageSearchRequest = async (query) => {
    try {
      setLoading(true);
      setError(null);

      // Process the request through our service
      const { searchParams, results, response } =
        await ChatImageSearchService.processRequest(query);

      setSearchParams(searchParams);
      setResults(results);
      setResponseText(response);

      return {
        success: true,
        searchParams,
        results,
        response,
      };
    } catch (err) {
      console.error("Error processing image search request:", err);
      setError(err.message);

      const errorResponse = `I'm sorry, I couldn't process that image search request. ${err.message}`;
      setResponseText(errorResponse);

      return {
        success: false,
        error: err.message,
        response: errorResponse,
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if a chat message is an image search request
   * @param {string} message - Chat message to check
   * @returns {boolean} True if the message is likely an image search request
   */
  const isImageSearchRequest = (message) => {
    const normalizedMessage = message.toLowerCase();

    // Image search keywords
    const searchPatterns = [
      /find|search|show|get|display/,
      /image(s)?|picture(s)?|photo(s)?/,
      /tattoo(s)?|tat(s)?/,
      /folder|directory|path/,
      /body part|arm|leg|back|chest|shoulder/,
      /similar|like|resemble/,
    ];

    // Count how many patterns match
    const matchCount = searchPatterns.filter((pattern) =>
      pattern.test(normalizedMessage)
    ).length;

    // If at least 2 patterns match, it's likely an image search request
    return matchCount >= 2;
  };

  return {
    processImageSearchRequest,
    isImageSearchRequest,
    results,
    loading,
    error,
    searchParams,
    responseText,
  };
}

export default useChatImageSearch;
