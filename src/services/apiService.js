// src/services/apiService.js
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { supabase } from "../lib/supabase";

// Configuration from environment or defaults
// In your baseUrl configuration:
const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  timeout: 10000, // Reduced from 30000 to 10000 (10 seconds)
  withCredentials: true,
};

const isAuthenticated = () => {
  const token = localStorage.getItem("authToken");
  return !!token && !isTokenExpired(token);
};

// Add this for debugging
const apiClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeout,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true, // This ensures cookies are sent in cross-origin requests
  xsrfCookieName: "XSRF-TOKEN", // Add if your server uses CSRF protection
  xsrfHeaderName: "X-XSRF-TOKEN", // Add if your server uses CSRF protection
});

// Add this function to your utils section
const testConnection = async () => {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/cors-debug`, {
      credentials: "include", // Important for testing credential handling
    });

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Connection test failed:", error);
    return { success: false, error: error.message };
  }
};

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
    // Only add dev-bypass header for certain endpoints
    if (config.url.includes("/auth/") || config.url.includes("/dev")) {
      config.headers["x-dev-bypass"] = "true";
    }

    // Add Authorization header if token exists
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

    // Add this to your error interceptor (inside the existing one)
    if (error.response && error.response.status === 0) {
      // CORS error often returns status 0
      return Promise.reject({
        message:
          "Cross-Origin request blocked. This may be a CORS configuration issue.",
        isCorsError: true,
        originalError: error,
      });
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

// Define all API endpoints by category
// Auth endpoints
const authApi = {
  login: async (email, password) => {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    return { data: await response.json() };
  },
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
  getProviders: async () => {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/auth/providers`);
    if (!response.ok) {
      throw new Error(`Failed to get providers: ${response.status}`);
    }
    return { data: await response.json() };
  },
  isAuthenticated,

  // Get current session
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // Get available auth providers
  getAuthProviders: async () => {
    try {
      // In a real implementation, you would fetch this from Supabase
      return {
        success: true,
        providers: {
          password: { name: "Password", type: "password" },
          google: {
            name: "Google",
            type: "oauth",
            loginUrl: "/api/auth/sso/google",
          },
          microsoft: {
            name: "Microsoft",
            type: "oauth",
            loginUrl: "/api/auth/sso/microsoft",
          },
          saml: {
            name: "Company SSO",
            type: "saml",
            loginUrl: "/api/auth/sso/custom",
          },
        },
        defaultProvider: "password",
      };
    } catch (error) {
      console.error("Error fetching auth providers:", error);
      return { success: false, error: error.message };
    }
  },
};

// CRM endpoints
const crmApi = {
  getProviders: () => apiClient.get("/api/crm/providers"),

  getContacts: (provider, query, limit = 10) =>
    apiClient.get(
      `/api/crm/contacts?provider=${encodeURIComponent(
        provider
      )}&query=${encodeURIComponent(query)}&limit=${limit}`
    ),

  createContact: (contact, provider) =>
    apiClient.post("/api/crm/contacts", { contact, provider }),

  getContactDocuments: (contactId, provider) =>
    apiClient.get(
      `/api/crm/contacts/${contactId}/documents?provider=${encodeURIComponent(
        provider
      )}`
    ),

  linkDocument: (contactId, data) =>
    apiClient.post(`/api/crm/contacts/${contactId}/documents`, data),

  syncEntity: (provider, entity, options) =>
    apiClient.post("/api/crm/sync", { provider, entity, options }),

  getConfiguration: (provider) =>
    apiClient.get(`/api/crm/config?provider=${encodeURIComponent(provider)}`),

  updateConfiguration: (provider, config) =>
    apiClient.post("/api/crm/config", { provider, config }),
};

// Zenoti specific endpoints
// Zenoti specific endpoints - Updated version that works with our improved backend
const zenotiApi = {
  // Centers
  getCenters: () => apiClient.get("/api/zenoti/centers"),
  getCenterDetails: (centerCode) =>
    apiClient.get(`/api/zenoti/centers/${centerCode}`),

  // Client/Guest management
  searchClients: (params) => apiClient.get("/api/zenoti/clients", { params }),
  getClient: (id, centerCode) => {
    const params = centerCode ? { centerCode } : {};
    return apiClient.get(`/api/zenoti/client/${id}`, { params });
  },
  createClient: (clientData, centerCode) =>
    apiClient.post("/api/zenoti/client", { clientData, centerCode }),
  updateClient: (clientId, updateData) =>
    apiClient.put(`/api/zenoti/client/${clientId}`, { updateData }),
  findClientAcrossCenters: (params) =>
    apiClient.get("/api/zenoti/client/find", { params }),
  getClientHistory: (clientId, params = {}) =>
    apiClient.get(`/api/zenoti/client/${clientId}/history`, { params }),

  // Appointment management
  getAppointments: (params) =>
    apiClient.get("/api/zenoti/appointments", { params }),
  getAppointmentsAcrossAllCenters: (params) =>
    apiClient.get("/api/zenoti/appointments", {
      params: { ...params, allCenters: true },
    }),
  getAppointment: (appointmentId) =>
    apiClient.get(`/api/zenoti/appointment/${appointmentId}`),
  createAppointment: (appointmentData, centerCode) =>
    apiClient.post("/api/zenoti/appointment", { appointmentData, centerCode }),
  cancelAppointment: (appointmentId, cancelData = {}) =>
    apiClient.post(
      `/api/zenoti/appointment/${appointmentId}/cancel`,
      cancelData
    ),
  rescheduleAppointment: (appointmentId, rescheduleData) =>
    apiClient.post(
      `/api/zenoti/appointment/${appointmentId}/reschedule`,
      rescheduleData
    ),
  getAvailability: (params) =>
    apiClient.get("/api/zenoti/availability", { params }),
  getAvailabilityAcrossAllCenters: (params) =>
    apiClient.get("/api/zenoti/availability", {
      params: { ...params, allCenters: true },
    }),

  // Catalog management
  getServices: (params = {}) =>
    apiClient.get("/api/zenoti/services", { params }),
  getServicesAcrossAllCenters: (params = {}) =>
    apiClient.get("/api/zenoti/services", {
      params: { ...params, allCenters: true },
    }),
  getServiceDetails: (serviceId, centerCode) => {
    const params = centerCode ? { centerCode } : {};
    return apiClient.get(`/api/zenoti/services/${serviceId}`, { params });
  },

  // Staff management
  getStaff: (params = {}) => apiClient.get("/api/zenoti/staff", { params }),
  getStaffAcrossAllCenters: (params = {}) =>
    apiClient.get("/api/zenoti/staff", {
      params: { ...params, allCenters: true },
    }),
  getStaffDetails: (staffId) => apiClient.get(`/api/zenoti/staff/${staffId}`),

  // Product management
  getProducts: (params = {}) =>
    apiClient.get("/api/zenoti/products", { params }),
  getProductsAcrossAllCenters: (params = {}) =>
    apiClient.get("/api/zenoti/products", {
      params: { ...params, allCenters: true },
    }),

  // Invoice management
  searchInvoices: (params) => apiClient.get("/api/zenoti/invoices", { params }),
  searchInvoicesAcrossAllCenters: (params) =>
    apiClient.get("/api/zenoti/invoices", {
      params: { ...params, allCenters: true },
    }),
  getInvoiceDetails: (invoiceId) =>
    apiClient.get(`/api/zenoti/invoice/${invoiceId}`),

  // Configuration management
  saveConfiguration: (config) =>
    apiClient.post("/api/zenoti/config", { config }),
  testConnection: (config) =>
    apiClient.post("/api/zenoti/test-connection", { config }),
  checkConnectionStatus: () =>
    apiClient.get("/api/zenoti/debug/centers", { timeout: 10000 }),

  // Reports
  getWeeklyBusinessReport: (params) =>
    apiClient.get("/api/zenoti/reports/weekly", { params }),
  getWeeklyBusinessReportAcrossAllCenters: (params) =>
    apiClient.get("/api/zenoti/reports/weekly", {
      params: { ...params, allCenters: true },
    }),
  getClientActivityReport: (params) =>
    apiClient.get("/api/zenoti/reports/client-activity", { params }),
  exportReport: (reportData, format, filename) =>
    apiClient.post("/api/zenoti/reports/export", {
      reportData,
      format,
      filename,
    }),
  getReportFiles: () => apiClient.get("/api/zenoti/reports/list"),
  downloadReport: (filename) =>
    apiClient.get(`/api/zenoti/reports/download/${filename}`, {
      responseType: "blob",
    }),

  // Webhook stats
  getWebhookStats: () => apiClient.get("/api/zenoti/webhooks/stats"),

  // Debug endpoints
  debugCenters: () => apiClient.get("/api/zenoti/debug/centers"),
  testApiKey: () => apiClient.get("/api/zenoti/test-api-key"),
};

// Session management endpoints
const sessionsApi = {
  getSessions: () => apiClient.get("/api/sessions"),

  terminateSession: (sessionId) =>
    apiClient.delete(`/api/sessions/${sessionId}`),

  terminateAllSessions: () => apiClient.delete("/api/sessions"),

  extendSession: (sessionId) =>
    apiClient.put(`/api/sessions/${sessionId}/extend`),
};

// MFA endpoints
const mfaApi = {
  getMethods: () => apiClient.get("/api/mfa"),

  setup: (type, data = {}) =>
    apiClient.post("/api/mfa/setup", { type, ...data }),

  confirm: (methodId, verificationCode) =>
    apiClient.post("/api/mfa/confirm", { methodId, verificationCode }),

  verify: (methodId, verificationCode) =>
    apiClient.post("/api/mfa/verify", { methodId, verificationCode }),

  remove: (methodId) => apiClient.delete(`/api/mfa/${methodId}`),

  challenge: (methodId) => apiClient.post("/api/mfa/challenge", { methodId }),
};

// User profile endpoints
const usersApi = {
  getProfile: () => apiClient.get("/api/users/profile"),

  updateProfile: (profileData) =>
    apiClient.put("/api/users/profile", profileData),

  getAll: () => apiClient.get("/api/users"),

  get: (userId) => apiClient.get(`/api/users/${userId}`),

  create: (userData) => apiClient.post("/api/users", userData),

  update: (userId, userData) => apiClient.put(`/api/users/${userId}`, userData),

  delete: (userId) => apiClient.delete(`/api/users/${userId}`),
};

// Roles endpoints
const rolesApi = {
  getAll: () => apiClient.get("/api/roles"),

  get: (roleId) => apiClient.get(`/api/roles/${roleId}`),

  create: (roleData) => apiClient.post("/api/roles", roleData),

  update: (roleId, roleData) => apiClient.put(`/api/roles/${roleId}`, roleData),

  delete: (roleId) => apiClient.delete(`/api/roles/${roleId}`),

  getPermissions: (roleId) => apiClient.get(`/api/roles/${roleId}/permissions`),

  updatePermissions: (roleId, permissions) =>
    apiClient.put(`/api/roles/${roleId}/permissions`, { permissions }),
};

// Chat endpoints
const chatApi = {
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
};

// Image analysis endpoints
const imageApi = {
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
    apiClient.get(`/api/image/metadata?path=${encodeURIComponent(imagePath)}`),
};

// Search endpoints
const searchApi = {
  basic: (query) => apiClient.get(`/api/search?q=${encodeURIComponent(query)}`),

  advanced: (query, type = "all", limit = 20) =>
    apiClient.post("/api/search/dropbox", { query, type, limit }),

  semantic: (query, options = {}) =>
    apiClient.post("/api/search/semantic", { query, ...options }),
};

// Export endpoints
const exportApi = {
  generate: (format, content, type) =>
    apiClient.post("/api/export", { format, content, type }),
};

// API keys management
const apiKeysApi = {
  getAll: () => apiClient.get("/api/api-keys"),

  create: (name, expiresIn) =>
    apiClient.post("/api/api-keys", { name, expiresIn }),

  revoke: (keyId) => apiClient.delete(`/api/api-keys/${keyId}`),
};

// Theme management
const themesApi = {
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
};

// Analytics endpoints
const analyticsApi = {
  getDashboard: (timeframe = "week", clientId = null) =>
    apiClient.get(
      `/api/analytics/dashboard?timeframe=${timeframe}${
        clientId ? `&clientId=${clientId}` : ""
      }`
    ),

  getSearchAnalytics: (options = {}) => {
    const params = new URLSearchParams();
    if (options.startDate) params.append("startDate", options.startDate);
    if (options.endDate) params.append("endDate", options.endDate);
    if (options.clientId) params.append("clientId", options.clientId);
    if (options.searchType) params.append("searchType", options.searchType);
    if (options.limit) params.append("limit", options.limit);

    return apiClient.get(`/api/analytics/search?${params}`);
  },

  getSystemPerformance: (options = {}) => {
    const params = new URLSearchParams();
    if (options.startDate) params.append("startDate", options.startDate);
    if (options.endDate) params.append("endDate", options.endDate);
    if (options.resolution) params.append("resolution", options.resolution);

    return apiClient.get(`/api/analytics/system?${params}`);
  },

  getUsageReport: (clientId, period = "month") =>
    apiClient.get(`/api/analytics/report/${clientId}?period=${period}`),

  getDashboardPresets: () => apiClient.get("/api/analytics/presets"),

  savePreset: (preset) => apiClient.post("/api/analytics/presets", preset),

  updatePreset: (id, preset) =>
    apiClient.put(`/api/analytics/presets/${id}`, preset),

  deletePreset: (id) => apiClient.delete(`/api/analytics/presets/${id}`),

  exportDashboard: (timeframe, clientId, format = "csv") =>
    apiClient.get(
      `/api/analytics/export/dashboard?timeframe=${timeframe}&clientId=${clientId}&format=${format}`,
      {
        responseType: "blob",
      }
    ),
  getStats: (timeframe = "week") =>
    apiClient.get(`/api/analytics/stats?timeframe=${timeframe}`),

  getUserActivity: (userId, timeframe = "week") =>
    apiClient.get(`/api/analytics/user/${userId}?timeframe=${timeframe}`),

  getSystemMetrics: () => apiClient.get("/api/analytics/system"),
};

// Workflows
const workflowsApi = {
  getAll: () => apiClient.get("/api/workflows"),

  get: (workflowId) => apiClient.get(`/api/workflows/${workflowId}`),

  create: (workflow) => apiClient.post("/api/workflows", workflow),

  update: (workflowId, workflow) =>
    apiClient.put(`/api/workflows/${workflowId}`, workflow),

  delete: (workflowId) => apiClient.delete(`/api/workflows/${workflowId}`),

  trigger: (workflowId, data) =>
    apiClient.post(`/api/workflows/${workflowId}/trigger`, data),

  getStats: () => apiClient.get("/api/workflows/stats"),
};

// Alerts
const alertsApi = {
  getAll: () => apiClient.get("/api/alerts"),

  get: (alertId) => apiClient.get(`/api/alerts/${alertId}`),

  create: (alert) => apiClient.post("/api/alerts", alert),

  update: (alertId, alert) => apiClient.put(`/api/alerts/${alertId}`, alert),

  delete: (alertId) => apiClient.delete(`/api/alerts/${alertId}`),

  dismiss: (alertId) => apiClient.post(`/api/alerts/${alertId}/dismiss`),
};

// Integration endpoints
const integrationsApi = {
  getAll: () => apiClient.get("/api/integrations"),

  configure: (integrationType, config) =>
    apiClient.post(`/api/integrations/${integrationType}/configure`, config),

  test: (integrationType) =>
    apiClient.post(`/api/integrations/${integrationType}/test`),

  sync: (integrationType) =>
    apiClient.post(`/api/integrations/${integrationType}/sync`),
};

// Server status
const statusApi = {
  check: () => apiClient.get("/status/check"),

  getHealth: () => apiClient.get("/status/health"),
};

// Storage API
const storageApi = {
  getFiles: (path) =>
    apiClient.get(`/api/storage/files?path=${encodeURIComponent(path)}`),

  upload: (file, path, onProgress) => {
    return uploadWithProgress("/api/storage/upload", file, {
      data: { path },
      onProgress,
    });
  },

  delete: (path) =>
    apiClient.delete(`/api/storage/files?path=${encodeURIComponent(path)}`),

  createFolder: (path) => apiClient.post("/api/storage/folder", { path }),

  rename: (oldPath, newPath) =>
    apiClient.put("/api/storage/rename", { oldPath, newPath }),

  getMetadata: (path) =>
    apiClient.get(`/api/storage/metadata?path=${encodeURIComponent(path)}`),

  searchFiles: (query, options = {}) => {
    const params = new URLSearchParams({
      q: query,
      ...options,
    });
    return apiClient.get(`/api/storage/search?${params}`);
  },
};

// Permissions API
const permissionsApi = {
  getFilePermissions: (filePath) =>
    apiClient.get(`/api/permissions/file?path=${encodeURIComponent(filePath)}`),

  setFilePermissions: (filePath, permissions) =>
    apiClient.post("/api/permissions/file", {
      path: filePath,
      permissions,
    }),

  checkAccess: (filePath) =>
    apiClient.get(
      `/api/permissions/check?path=${encodeURIComponent(filePath)}`
    ),

  getEffectivePermissions: (filePath) =>
    apiClient.get(
      `/api/permissions/effective?path=${encodeURIComponent(filePath)}`
    ),
};

// Groups API
const groupsApi = {
  getAll: () => apiClient.get("/api/groups"),

  get: (groupId) => apiClient.get(`/api/groups/${groupId}`),

  create: (groupData) => apiClient.post("/api/groups", groupData),

  update: (groupId, groupData) =>
    apiClient.put(`/api/groups/${groupId}`, groupData),

  delete: (groupId) => apiClient.delete(`/api/groups/${groupId}`),

  getMembers: (groupId) => apiClient.get(`/api/groups/${groupId}/members`),

  addMember: (groupId, userId) =>
    apiClient.post(`/api/groups/${groupId}/members`, { userId }),

  removeMember: (groupId, userId) =>
    apiClient.delete(`/api/groups/${groupId}/members/${userId}`),
};

// Create and export the API service
const apiService = {
  auth: authApi,
  crm: crmApi,
  zenoti: zenotiApi,
  sessions: sessionsApi,
  mfa: mfaApi,
  users: usersApi,
  roles: rolesApi,
  chat: chatApi,
  image: imageApi,
  search: searchApi,
  export: exportApi,
  apiKeys: apiKeysApi,
  themes: themesApi,
  analytics: analyticsApi,
  workflows: workflowsApi,
  alerts: alertsApi,
  integrations: integrationsApi,
  status: statusApi,
  storage: storageApi,
  permissions: permissionsApi,
  groups: groupsApi,

  // Utility methods
  utils: {
    uploadWithProgress,
    isTokenExpired,
    setBaseUrl: (url) => {
      API_CONFIG.baseUrl = url;
      apiClient.defaults.baseURL = url;
    },
    getBaseUrl: () => API_CONFIG.baseUrl,

    // Add the test connection function here
    // Replace the existing utils.testConnection with this enhanced version
    testConnection: async () => {
      try {
        // Use fetch API to test CORS with credentials
        const response = await fetch(`${API_CONFIG.baseUrl}/cors-debug`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return {
            success: false,
            status: response.status,
            statusText: response.statusText,
          };
        }

        return await response.json();
      } catch (error) {
        console.error("CORS debug connection test failed:", error);
        return { success: false, error: error.message, type: "network" };
      }
    },
    // Add this to your utils section
    testCookieHandling: async () => {
      try {
        // First set a test cookie
        const setCookieResponse = await fetch(
          `${API_CONFIG.baseUrl}/cors-test-cookie`,
          {
            credentials: "include",
          }
        );

        if (!setCookieResponse.ok) {
          return { success: false, error: "Failed to set test cookie" };
        }

        // Then check if we can read it back
        const checkCookieResponse = await fetch(
          `${API_CONFIG.baseUrl}/cors-debug`,
          {
            credentials: "include",
          }
        );

        if (!checkCookieResponse.ok) {
          return { success: false, error: "Failed to check cookie" };
        }

        const data = await checkCookieResponse.json();
        return {
          success: true,
          cookiePresent:
            data.cookiesReceived &&
            Object.keys(data.cookiesReceived).length > 0,
          data,
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
  },
};

export { testConnection, isAuthenticated };

export { apiService, apiClient };
export default apiService;
export { uploadWithProgress, isTokenExpired };
