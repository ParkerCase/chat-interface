import axios from "axios";
import { jwtDecode } from "jwt-decode";

// Configuration from environment or defaults
const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  timeout: 30000,
  withCredentials: true,
};

// Create axios instance with base config
const apiClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeout,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: API_CONFIG.withCredentials,
});

// Track if we're currently refreshing the token
let isRefreshing = false;
// Queue of requests to retry after token refresh
let refreshQueue = [];

// Execute queued requests after successful token refresh
const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
};

// Add request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Set auth token if available
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // For file uploads, don't set Content-Type (browser will set with boundary)
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    // Add request ID for tracking
    config.headers["X-Request-ID"] = Math.random().toString(36).substr(2, 9);

    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for token refresh and error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No response means network error
    if (!error.response) {
      return Promise.reject({
        message: "Network error. Please check your connection.",
        isNetworkError: true,
        originalError: error,
      });
    }

    // Don't retry already retried requests or refresh token requests
    if (
      originalRequest._retry ||
      originalRequest.url?.includes("/api/auth/refresh")
    ) {
      // If refresh failed, clear auth state and reject
      if (originalRequest.url?.includes("/api/auth/refresh")) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("sessionId");
        processQueue(error);
      }
      return Promise.reject(error);
    }

    // Handle 401 (Unauthorized) - likely expired token
    if (error.response.status === 401) {
      const isTokenExpired =
        error.response.data?.code === "TOKEN_EXPIRED" ||
        error.response.data?.error?.includes("expired");

      if (isTokenExpired) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem("refreshToken");
        const sessionId = localStorage.getItem("sessionId");

        if (!refreshToken) {
          // No refresh token, clear auth
          localStorage.removeItem("authToken");
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
            .catch((err) => Promise.reject(err));
        }

        // Start token refresh
        isRefreshing = true;

        try {
          // Attempt to refresh the token
          const response = await axios.post(
            `${API_CONFIG.baseUrl}/api/auth/refresh`,
            { refreshToken, sessionId },
            {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          if (response.data.success) {
            // Save the new tokens
            const {
              token: accessToken,
              refreshToken: newRefreshToken,
              sessionId: newSessionId,
            } = response.data;

            localStorage.setItem("authToken", accessToken);
            if (newRefreshToken)
              localStorage.setItem("refreshToken", newRefreshToken);
            if (newSessionId) localStorage.setItem("sessionId", newSessionId);

            // Update axios default headers
            apiClient.defaults.headers.common[
              "Authorization"
            ] = `Bearer ${accessToken}`;

            // Process any queued requests
            processQueue(null, accessToken);
            isRefreshing = false;

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return axios(originalRequest);
          } else {
            throw new Error(response.data.error || "Failed to refresh token");
          }
        } catch (refreshError) {
          // Handle refresh failure
          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("sessionId");

          processQueue(refreshError);
          isRefreshing = false;

          return Promise.reject(refreshError);
        }
      }
    }

    // Handle 403 (Forbidden) - permission denied
    if (error.response.status === 403) {
      error.isPermissionError = true;
      console.warn("Permission denied:", error.response.data);
    }

    // Handle 429 (Too Many Requests) - rate limiting
    if (error.response.status === 429) {
      error.isRateLimitError = true;
      const retryAfter = error.response.headers["retry-after"];
      error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : 60;
    }

    return Promise.reject(error);
  }
);

// Upload with progress tracking helper
const uploadWithProgress = (endpoint, file, options = {}) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    // Add file to FormData
    formData.append(options.fieldName || "file", file);

    // Add additional fields
    if (options.data) {
      Object.entries(options.data).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    // Create request
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_CONFIG.baseUrl}${endpoint}`);

    // Add headers
    const token = localStorage.getItem("authToken");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    // Track upload progress
    if (options.onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          options.onProgress(progress);
        }
      });
    }

    // Handle response
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(errorData);
        } catch (e) {
          reject({ error: `Server error: ${xhr.status}` });
        }
      }
    };

    // Handle network errors
    xhr.onerror = () => {
      reject({ error: "Network error" });
    };

    // Start upload
    xhr.send(formData);
  });
};

// Utility functions
const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const decoded = jwtDecode(token);
    // Add a buffer of 30 seconds to account for clock differences
    return decoded.exp * 1000 < Date.now() + 30000;
  } catch (error) {
    console.error("Token decode error:", error);
    return true;
  }
};

// API service with endpoint methods
const apiService = {
  // Auth endpoints
  auth: {
    login: (email, password) =>
      apiClient.post("/api/auth/login", { email, password }),

    register: (userData) => apiClient.post("/api/auth/register", userData),

    verifyPasscode: (passcode) =>
      apiClient.post("/api/auth/passcode", { passcode }),

    logout: () =>
      apiClient.post("/api/auth/logout", {
        refreshToken: localStorage.getItem("refreshToken"),
      }),

    refreshToken: (refreshToken, sessionId) =>
      apiClient.post("/api/auth/refresh", { refreshToken, sessionId }),

    requestPasswordReset: (email) =>
      apiClient.post("/api/auth/password/reset-request", { email }),

    resetPassword: (token, password) =>
      apiClient.post("/api/auth/password/reset", { token, password }),

    changePassword: (currentPassword, newPassword) =>
      apiClient.post("/api/auth/password/change", {
        currentPassword,
        newPassword,
      }),

    verifyEmail: (token) => apiClient.post("/api/auth/verify-email", { token }),

    exchangeToken: (code) => apiClient.post("/api/auth/exchange", { code }),
  },

  // Session management endpoints
  sessions: {
    getSessions: () => apiClient.get("/api/sessions"),

    terminateSession: (sessionId) =>
      apiClient.delete(`/api/sessions/${sessionId}`),

    terminateAllSessions: () => apiClient.delete("/api/sessions"),

    extendSession: (sessionId) =>
      apiClient.put(`/api/sessions/${sessionId}/extend`),
  },

  // MFA endpoints
  mfa: {
    getMethods: () => apiClient.get("/api/mfa"),

    setup: (type, data = {}) =>
      apiClient.post("/api/mfa/setup", { type, ...data }),

    confirm: (methodId, verificationCode) =>
      apiClient.post("/api/mfa/confirm", { methodId, verificationCode }),

    verify: (methodId, verificationCode) =>
      apiClient.post("/api/mfa/verify", { methodId, verificationCode }),

    remove: (methodId) => apiClient.delete(`/api/mfa/${methodId}`),

    challenge: (methodId) => apiClient.post("/api/mfa/challenge", { methodId }),
  },

  // User profile endpoints
  users: {
    getProfile: () => apiClient.get("/api/users/profile"),

    updateProfile: (profileData) =>
      apiClient.put("/api/users/profile", profileData),
  },

  // Chat endpoints
  chat: {
    sendMessage: (message, userId) => {
      const formData = new FormData();
      formData.append("message", message);
      formData.append("userId", userId);
      return apiClient.post("/api/chat", formData);
    },

    uploadImage: (file, userId, message, onProgress) => {
      return uploadWithProgress("/api/chat", file, {
        data: { userId, message: message || "Analyze this image" },
        onProgress,
      });
    },

    analyzeImagePath: (imagePath, message, userId) =>
      apiClient.post("/api/analyze/path", { imagePath, message, userId }),

    visualSearch: (file, mode = "tensor", onProgress) => {
      return uploadWithProgress("/search/visual", file, {
        data: { mode },
        onProgress,
      });
    },
  },

  // Image analysis endpoints
  image: {
    analyze: (imagePath) => apiClient.post("/api/analyze-image", { imagePath }),

    analyzeSearchResult: (imagePath) =>
      apiClient.post("/api/analyze-search-result", { imagePath }),

    processImage: (file, options = {}, onProgress) => {
      const formData = new FormData();
      formData.append("image", file);

      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          formData.append(
            key,
            typeof value === "object" ? JSON.stringify(value) : value
          );
        });
      }

      return uploadWithProgress("/api/image/process", formData, { onProgress });
    },

    getImageMetadata: (imagePath) =>
      apiClient.get(
        `/api/image/metadata?path=${encodeURIComponent(imagePath)}`
      ),
  },

  // Search endpoints
  search: {
    basic: (query) =>
      apiClient.get(`/api/search?q=${encodeURIComponent(query)}`),

    advanced: (query, type = "all", limit = 20) =>
      apiClient.post("/api/search/dropbox", { query, type, limit }),

    semantic: (query, options = {}) =>
      apiClient.post("/api/search/semantic", { query, ...options }),
  },

  // Export endpoints
  export: {
    generate: (format, content, type) =>
      apiClient.post("/api/export", { format, content, type }),
  },

  // API keys management
  apiKeys: {
    getAll: () => apiClient.get("/api/api-keys"),

    create: (name, expiresIn) =>
      apiClient.post("/api/api-keys", { name, expiresIn }),

    revoke: (keyId) => apiClient.delete(`/api/api-keys/${keyId}`),
  },

  // Theme management
  themes: {
    getAll: () => apiClient.get("/api/themes"),

    get: (themeId) => apiClient.get(`/api/themes/${themeId}`),

    getCSS: (themeId) => apiClient.get(`/api/themes/${themeId}/css`),

    create: (theme) => apiClient.post("/api/themes", theme),

    update: (themeId, theme) => apiClient.put(`/api/themes/${themeId}`, theme),

    delete: (themeId) => apiClient.delete(`/api/themes/${themeId}`),

    setPreference: (themeId) =>
      apiClient.post("/api/themes/preference", { themeId }),

    getPreference: () => apiClient.get("/api/themes/preference"),

    import: (file) => {
      const formData = new FormData();
      formData.append("theme", file);
      return apiClient.post("/api/themes/import", formData);
    },

    export: (themeId, format = "json") =>
      `${API_CONFIG.baseUrl}/api/themes/${themeId}/export?format=${format}`,
  },

  // Analytics endpoints (Professional and Enterprise tiers)
  analytics: {
    getStats: (timeframe = "week") =>
      apiClient.get(`/api/analytics/stats?timeframe=${timeframe}`),

    getUserActivity: (userId, timeframe = "week") =>
      apiClient.get(`/api/analytics/user/${userId}?timeframe=${timeframe}`),

    getSystemMetrics: () => apiClient.get("/api/analytics/system"),

    getUsageReports: () => apiClient.get("/api/analytics/usage"),
  },

  // Workflows (Enterprise tier)
  workflows: {
    getAll: () => apiClient.get("/api/workflows"),

    get: (workflowId) => apiClient.get(`/api/workflows/${workflowId}`),

    create: (workflow) => apiClient.post("/api/workflows", workflow),

    update: (workflowId, workflow) =>
      apiClient.put(`/api/workflows/${workflowId}`, workflow),

    delete: (workflowId) => apiClient.delete(`/api/workflows/${workflowId}`),

    trigger: (workflowId, data) =>
      apiClient.post(`/api/workflows/${workflowId}/trigger`, data),
  },

  // Alerts (Enterprise tier)
  alerts: {
    getAll: () => apiClient.get("/api/alerts"),

    get: (alertId) => apiClient.get(`/api/alerts/${alertId}`),

    create: (alert) => apiClient.post("/api/alerts", alert),

    update: (alertId, alert) => apiClient.put(`/api/alerts/${alertId}`, alert),

    delete: (alertId) => apiClient.delete(`/api/alerts/${alertId}`),

    dismiss: (alertId) => apiClient.post(`/api/alerts/${alertId}/dismiss`),
  },

  // Integration endpoints (Professional and Enterprise tiers)
  integrations: {
    getAll: () => apiClient.get("/api/integrations"),

    configure: (integrationType, config) =>
      apiClient.post(`/api/integrations/${integrationType}/configure`, config),

    test: (integrationType) =>
      apiClient.post(`/api/integrations/${integrationType}/test`),

    sync: (integrationType) =>
      apiClient.post(`/api/integrations/${integrationType}/sync`),
  },

  // Server status
  status: {
    check: () => apiClient.get("/status/check"),
  },

  // Utility methods
  utils: {
    uploadWithProgress,
    isTokenExpired,
    setBaseUrl: (url) => {
      API_CONFIG.baseUrl = url;
      apiClient.defaults.baseURL = url;
    },
    getBaseUrl: () => API_CONFIG.baseUrl,
  },
};

export default apiService;
export { apiClient, uploadWithProgress, isTokenExpired };
