// src/services/api.js
import axios from "axios";
import { jwtDecode } from "jwt-decode";

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Track if we're currently refreshing the token
let isRefreshing = false;
// Queue of requests to retry after token refresh
let refreshQueue = [];

// Process the queue of failed requests
const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  // Reset queue
  refreshQueue = [];
};

// Add request interceptor to set auth token
api.interceptors.request.use(
  (config) => {
    // Set auth token if available
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // For file uploads, don't set Content-Type header (browser will set it with boundary)
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle common errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error doesn't have response, it's a network error
    if (!error.response) {
      return Promise.reject({
        message: "Network error. Please check your connection.",
        isNetworkError: true,
        originalError: error,
      });
    }

    // Don't retry failed refresh token requests to avoid infinite loops
    if (originalRequest.url?.includes("/api/auth/refresh")) {
      // If refresh failed, clear auth state and reject
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("sessionId");

      // Process any queued requests with error
      processQueue(error);

      return Promise.reject(error);
    }

    // Handle 401 Unauthorized (expired token)
    if (error.response.status === 401 && !originalRequest._retry) {
      // Check if error indicates expired token
      const isExpired =
        error.response.data?.code === "TOKEN_EXPIRED" ||
        error.response.data?.error?.includes("expired");

      if (isExpired) {
        // Mark request as retried to prevent infinite loops
        originalRequest._retry = true;

        // Get refresh token
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
          // No refresh token available, clear auth state
          localStorage.removeItem("authToken");
          window.location.href = "/login?expired=true";
          return Promise.reject(error);
        }

        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return axios(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        // Start token refresh
        isRefreshing = true;

        try {
          // Get session ID if available
          const sessionId = localStorage.getItem("sessionId");

          // Call refresh endpoint
          const response = await axios.post(
            `${
              process.env.REACT_APP_API_URL || "http://147.182.247.128:4000"
            }/api/auth/refresh`,
            { refreshToken, sessionId },
            {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          if (response.data.success) {
            // Update tokens in storage
            localStorage.setItem("authToken", response.data.accessToken);
            localStorage.setItem(
              "refreshToken",
              response.data.refreshToken || refreshToken
            );
            if (response.data.sessionId) {
              localStorage.setItem("sessionId", response.data.sessionId);
            }

            // Update request Authorization header
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
            api.defaults.headers.common[
              "Authorization"
            ] = `Bearer ${response.data.accessToken}`;

            // Process queue with new token
            processQueue(null, response.data.accessToken);

            // Reset refreshing flag
            isRefreshing = false;

            // Retry original request
            return axios(originalRequest);
          } else {
            throw new Error(response.data.error || "Failed to refresh token");
          }
        } catch (refreshError) {
          // Clear auth state
          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("sessionId");

          // Process queue with error
          processQueue(refreshError);

          // Reset refreshing flag
          isRefreshing = false;

          // Redirect to login
          window.location.href = "/login?expired=true";

          return Promise.reject(refreshError);
        }
      }
    }

    // Handle 403 Forbidden
    if (error.response.status === 403) {
      console.warn("Permission denied:", error.response.data);
      // You could trigger a global event for permission errors
      // window.dispatchEvent(new CustomEvent('permissionDenied', { detail: error.response.data }));
    }

    // Handle 404 Not Found
    if (error.response.status === 404) {
      console.warn("Resource not found:", originalRequest.url);
      // You could trigger a global event for not found errors
      // window.dispatchEvent(new CustomEvent('resourceNotFound', { detail: originalRequest.url }));
    }

    // Handle 500 Server Error
    if (error.response.status >= 500) {
      console.error("Server error:", error.response.data);
      // You could trigger a global event for server errors
      // window.dispatchEvent(new CustomEvent('serverError', { detail: error.response.data }));
    }

    return Promise.reject(error);
  }
);

// Utility functions
const apiUtils = {
  /**
   * Check if token is expired
   * @param {String} token - JWT token
   * @returns {Boolean} Is token expired
   */
  isTokenExpired: (token) => {
    if (!token) return true;

    try {
      const decoded = jwtDecode(token);
      return decoded.exp * 1000 < Date.now();
    } catch (error) {
      console.error("Token decode error:", error);
      return true;
    }
  },

  /**
   * Get time until token expires in milliseconds
   * @param {String} token - JWT token
   * @returns {Number} Milliseconds until expiry
   */
  getTokenExpiryTime: (token) => {
    if (!token) return 0;

    try {
      const decoded = jwtDecode(token);
      return Math.max(0, decoded.exp * 1000 - Date.now());
    } catch (error) {
      console.error("Token decode error:", error);
      return 0;
    }
  },

  /**
   * Upload file with progress tracking
   * @param {String} url - API endpoint
   * @param {File} file - File to upload
   * @param {Object} options - Additional options
   * @returns {Promise} Upload promise
   */
  uploadWithProgress: (url, file, options = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      // Add file to form data
      formData.append(options.fieldName || "file", file);

      // Add additional form fields
      if (options.formData) {
        Object.entries(options.formData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      // Set up request
      xhr.open("POST", `${api.defaults.baseURL}${url}`);

      // Add auth header if available
      const token = localStorage.getItem("authToken");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      // Add custom headers
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
      }

      // Set up progress handler
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && options.onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          options.onProgress(progress);
        }
      });

      // Set up completion handler
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            resolve(xhr.responseText);
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(errorResponse);
          } catch (e) {
            reject({ error: `Server error: ${xhr.status}` });
          }
        }
      };

      // Set up error handler
      xhr.onerror = () => {
        reject({ error: "Network error" });
      };

      // Start upload
      xhr.send(formData);
    });
  },
};

export { apiUtils };
export default api;
