// src/services/zenotiService.js - Updated with proper endpoint handling
import { apiClient } from "./apiService";

const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  timeout: 10000,
};

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
          message: "Connection error",
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
      const response = await apiClient.get("/api/zenoti/centers");
      return response;
    } catch (error) {
      console.error("Error getting Zenoti centers:", error);
      // Return a formatted error response instead of throwing
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch centers",
        },
      };
    }
  },

  // FIXED: Debug Centers endpoint
  debugCenters: async () => {
    try {
      return await apiClient.get("/api/zenoti/debug/centers");
    } catch (error) {
      console.error("Error getting Zenoti debug centers:", error);
      throw error;
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
      return await apiClient.get("/api/zenoti/clients", {
        params: { ...params, allCenters: true },
      });
    } catch (error) {
      console.error("Error searching clients across centers:", error);
      throw error;
    }
  },

  // FIXED: Changed from getClientDetails to getClient to match backend
  getClient: async (clientId, centerCode = null) => {
    try {
      const params = centerCode ? { centerCode } : {};
      return await apiClient.get(`/api/zenoti/client/${clientId}`, { params });
    } catch (error) {
      console.error("Error getting Zenoti client details:", error);
      throw error;
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

  // FIXED: Appointments - Using apiClient instead of zenotiApiClient
  getAppointments: async (params = {}) => {
    try {
      console.log("Getting Zenoti appointments with params:", params);
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

  getAppointmentsAcrossAllCenters: async (params) => {
    try {
      return await apiClient.get("/api/zenoti/appointments", {
        params: { ...params, allCenters: true },
      });
    } catch (error) {
      console.error("Error getting appointments across centers:", error);
      throw error;
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

  // Book appointment
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
      throw error;
    }
  },

  getServicesAcrossAllCenters: async (params = {}) => {
    try {
      return await apiClient.get("/api/zenoti/services", {
        params: { ...params, allCenters: true },
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
      throw error;
    }
  },

  getStaffAcrossAllCenters: async (params = {}) => {
    try {
      return await apiClient.get("/api/zenoti/staff", {
        params: { ...params, allCenters: true },
      });
    } catch (error) {
      console.error("Error getting staff across all centers:", error);
      throw error;
    }
  },

  // Reports
  generateWeeklyReport: async (params) => {
    try {
      return await apiClient.get("/api/zenoti/reports/weekly", { params });
    } catch (error) {
      console.error("Error generating weekly report:", error);
      throw error;
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

  // Webhook stats
  getWebhookStats: async () => {
    try {
      return await apiClient.get("/api/zenoti/webhooks/stats");
    } catch (error) {
      console.error("Error getting webhook stats:", error);
      throw error;
    }
  },
};

export default zenotiService;
