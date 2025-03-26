// zenotiApiClient.js - Simplified version that won't trigger CORS issues
import axios from "axios";

const zenotiApiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    // No other headers - they're causing CORS issues
  },
  withCredentials: false, // This is still important to keep
});

// Add a timestamp parameter to GET requests (safer than headers)
zenotiApiClient.interceptors.request.use((config) => {
  if (config.method === "get") {
    config.params = config.params || {};
    // Add timestamp for cache busting
    config.params["_nocache"] = new Date().getTime();
  }
  return config;
});

// Add logging of responses
zenotiApiClient.interceptors.response.use(
  (response) => {
    console.log(`Zenoti API Success (${response.config.url}):`, {
      status: response.status,
    });
    return response;
  },
  (error) => {
    console.error(`Zenoti API Error (${error.config?.url}):`, {
      message: error.message,
    });
    return Promise.reject(error);
  }
);

export default zenotiApiClient;
