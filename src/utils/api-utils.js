// src/utils/api-utils.js
// Constants and API utility functions

// Configuration - Using environment variables with fallbacks
export const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  endpoints: {
    chat: "/api/chat",
    search: "/api/search/image",
    visualSearch: "/search/visual",
    analyzePath: "/api/analyze/path",
    status: "/status/check",
  },
};

// Enhanced utility function for API calls with timeout and retry
export const fetchWithTimeout = async (url, options, timeout = 60000) => {
  // Use a longer timeout for image-related endpoints
  if (url.includes("/image") || url.includes("/search/visual")) {
    timeout = 300000; // 5 minutes for image processing
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. The server is taking too long to respond."
      );
    }

    throw error;
  }
};
