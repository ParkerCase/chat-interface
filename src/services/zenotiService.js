// src/services/zenotiService.js - Updated with proper API handling
import { apiClient } from "./apiService";

/**
 * Service to handle all Zenoti-related API calls
 */
const zenotiService = {
  // Connection & Configuration
  checkConnectionStatus: async () => {
    try {
      const response = await apiClient.get("/api/zenoti/status");
      return response;
    } catch (error) {
      console.error("Error checking Zenoti connection:", error);
      return {
        data: {
          success: false,
          status: "error",
          message: "Connection error: " + (error.message || "Unknown error"),
        },
      };
    }
  },

  saveConfiguration: async (config) => {
    try {
      return await apiClient.post("/api/zenoti/config", { config });
    } catch (error) {
      console.error("Error saving Zenoti config:", error);
      throw error;
    }
  },

  testConnection: async (config) => {
    try {
      return await apiClient.post("/api/zenoti/test-connection", { config });
    } catch (error) {
      console.error("Error testing Zenoti connection:", error);
      throw error;
    }
  },

  // Centers
  getCenters: async () => {
    try {
      console.log("Fetching Zenoti centers");
      const response = await apiClient.get("/api/zenoti/centers");
      console.log("Centers response:", response);
      return response;
    } catch (error) {
      console.error("Error getting Zenoti centers:", error);
      // Return a formatted error response instead of throwing
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch centers",
          centers: [], // Include empty centers array for graceful handling
        },
      };
    }
  },

  // Clients/Contacts
  searchClients: async (params = {}) => {
    try {
      console.log("Searching Zenoti clients with params:", params);
      const response = await apiClient.get("/api/zenoti/clients", { params });
      return response;
    } catch (error) {
      console.error("Error searching Zenoti clients:", error);
      // Return a formatted error response instead of throwing
      return {
        data: {
          success: false,
          error: error.message || "Failed to search clients",
          clients: [],
        },
      };
    }
  },

  searchClientsAcrossAllCenters: async (params) => {
    try {
      // Add allCenters flag to params
      const updatedParams = { ...params, allCenters: true };
      return await apiClient.get("/api/zenoti/clients", {
        params: updatedParams,
      });
    } catch (error) {
      console.error("Error searching clients across centers:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to search clients across centers",
          clients: [],
        },
      };
    }
  },

  // Fixed: Using proper endpoint path
  getClient: async (clientId, centerCode = null) => {
    try {
      const params = centerCode ? { centerCode } : {};
      return await apiClient.get(`/api/zenoti/client/${clientId}`, { params });
    } catch (error) {
      console.error("Error getting Zenoti client details:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get client details",
        },
      };
    }
  },

  createClient: async (clientData, centerCode) => {
    try {
      return await apiClient.post("/api/zenoti/client", {
        clientData,
        centerCode,
      });
    } catch (error) {
      console.error("Error creating Zenoti client:", error);
      throw error;
    }
  },

  updateClient: async (clientId, updateData) => {
    try {
      return await apiClient.put(`/api/zenoti/client/${clientId}`, {
        updateData,
      });
    } catch (error) {
      console.error("Error updating Zenoti client:", error);
      throw error;
    }
  },

  // Find client across centers
  findClientAcrossCenters: async (searchParams) => {
    try {
      return await apiClient.get("/api/zenoti/client/find", {
        params: searchParams,
      });
    } catch (error) {
      console.error("Error finding client across centers:", error);
      throw error;
    }
  },

  // Client history
  getClientHistory: async (clientId, params = {}) => {
    try {
      return await apiClient.get(`/api/zenoti/client/${clientId}/history`, {
        params,
      });
    } catch (error) {
      console.error("Error getting client history:", error);
      throw error;
    }
  },

  // FIXED: Appointments - Ensure proper parameters are sent
  getAppointments: async (params = {}) => {
    try {
      console.log("Getting Zenoti appointments with params:", params);

      // Validate required parameters
      if (!params.startDate && !params.endDate) {
        const today = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(today.getDate() + 14);

        params.startDate = today.toISOString().split("T")[0];
        params.endDate = twoWeeksLater.toISOString().split("T")[0];

        console.log("Added default date range:", params);
      }

      const response = await apiClient.get("/api/zenoti/appointments", {
        params,
      });

      return response;
    } catch (error) {
      console.error("Error getting Zenoti appointments:", error);

      // Return a formatted error response instead of throwing
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch appointments",
          appointments: [],
        },
      };
    }
  },

  getAppointmentDetails: async (appointmentId, centerCode = null) => {
    try {
      const params = centerCode ? { centerCode } : {};
      return await apiClient.get(`/api/zenoti/appointment/${appointmentId}`, {
        params,
      });
    } catch (error) {
      console.error("Error getting appointment details:", error);
      throw error;
    }
  },

  // Book appointment - fixed with proper parameter structure
  bookAppointment: async (appointmentData, centerCode) => {
    try {
      return await apiClient.post("/api/zenoti/appointment", {
        appointmentData,
        centerCode,
      });
    } catch (error) {
      console.error("Error booking appointment:", error);
      throw error;
    }
  },

  // Cancel appointment
  cancelAppointment: async (appointmentId, cancelData = {}) => {
    try {
      return await apiClient.post(
        `/api/zenoti/appointment/${appointmentId}/cancel`,
        cancelData
      );
    } catch (error) {
      console.error("Error canceling appointment:", error);
      throw error;
    }
  },

  // Reschedule appointment
  rescheduleAppointment: async (appointmentId, rescheduleData) => {
    try {
      return await apiClient.post(
        `/api/zenoti/appointment/${appointmentId}/reschedule`,
        rescheduleData
      );
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      throw error;
    }
  },

  // Get availability
  getAvailability: async (params) => {
    try {
      return await apiClient.get("/api/zenoti/availability", { params });
    } catch (error) {
      console.error("Error getting availability:", error);
      throw error;
    }
  },

  // Services
  getServices: async (params = {}) => {
    try {
      return await apiClient.get("/api/zenoti/services", { params });
    } catch (error) {
      console.error("Error getting services:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get services",
          services: [],
        },
      };
    }
  },

  getServicesAcrossAllCenters: async (params = {}) => {
    try {
      // Add allCenters flag to params
      const updatedParams = { ...params, allCenters: true };
      return await apiClient.get("/api/zenoti/services", {
        params: updatedParams,
      });
    } catch (error) {
      console.error("Error getting services across all centers:", error);
      throw error;
    }
  },

  // Staff
  getStaff: async (params = {}) => {
    try {
      return await apiClient.get("/api/zenoti/staff", { params });
    } catch (error) {
      console.error("Error getting staff:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get staff",
          staff: [],
        },
      };
    }
  },

  getStaffAcrossAllCenters: async (params = {}) => {
    try {
      // Add allCenters flag to params
      const updatedParams = { ...params, allCenters: true };
      return await apiClient.get("/api/zenoti/staff", {
        params: updatedParams,
      });
    } catch (error) {
      console.error("Error getting staff across all centers:", error);
      throw error;
    }
  },

  // Reports - FIXED: Add proper weekly report implementation
  generateWeeklyReport: async (params) => {
    try {
      console.log("Generating weekly report with params:", params);
      // Validate required parameters
      if (!params.weekStartDate) {
        throw new Error("Week start date is required");
      }

      return await apiClient.get("/api/zenoti/reports/weekly", { params });
    } catch (error) {
      console.error("Error generating weekly report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to generate weekly report",
          report: null,
        },
      };
    }
  },

  generateClientActivityReport: async (params) => {
    try {
      return await apiClient.get("/api/zenoti/reports/client-activity", {
        params,
      });
    } catch (error) {
      console.error("Error generating client activity report:", error);
      throw error;
    }
  },

  // Added: New export report functionality
  exportReport: async (reportData, format, filename) => {
    try {
      return await apiClient.post("/api/zenoti/reports/export", {
        reportData,
        format,
        filename,
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      throw error;
    }
  },

  getReportFiles: async () => {
    try {
      return await apiClient.get("/api/zenoti/reports/list");
    } catch (error) {
      console.error("Error getting report files:", error);
      throw error;
    }
  },

  downloadReport: async (filename) => {
    try {
      return await apiClient.get(`/api/zenoti/reports/download/${filename}`, {
        responseType: "blob",
      });
    } catch (error) {
      console.error("Error downloading report:", error);
      throw error;
    }
  },
};

export default zenotiService;
