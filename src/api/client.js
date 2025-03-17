// src/api/client.js
import axios from "axios";

const BASE_URL = "https://147.182.247.128:4001"; // Your existing backend URL

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add error handling for self-signed certificate
const https = require("https");
client.defaults.httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Note: Only use this in development
});

export const api = {
  chat: async (message) => {
    try {
      const response = await client.post("/chat", { message });
      return response.data;
    } catch (error) {
      console.error("Chat request failed:", error);
      throw error;
    }
  },

  upload: async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await client.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  },

  search: async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await client.post("/search/visual", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Search failed:", error);
      throw error;
    }
  },

  checkConnection: async () => {
    try {
      const response = await client.get("/status/check");
      return response.data;
    } catch (error) {
      console.error("Connection check failed:", error);
      throw error;
    }
  },
};
