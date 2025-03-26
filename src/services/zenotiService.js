// src/services/zenotiService.js
import { apiClient } from "./apiService";

/**
 * Service to handle all Zenoti-related API calls
 */
const zenotiService = {
  // Status and configuration
  checkConnectionStatus: async () => {
    try {
      console.log("Checking Zenoti connection status...");
      const response = await apiClient.get("/api/zenoti/status");
      console.log("Zenoti status response:", response.data);
      return response;
    } catch (error) {
      console.error("Error checking Zenoti connection:", error);
      return {
        data: {
          success: false,
          status: "error",
          message: error.message,
        },
      };
    }
  },

  // Get all Zenoti centers
  getCenters: async () => {
    try {
      console.log("Fetching Zenoti centers...");
      return await apiClient.get("/api/zenoti/centers");
    } catch (error) {
      console.error("Error getting Zenoti centers:", error);
      throw error;
    }
  },

  // Save Zenoti configuration
  saveConfiguration: async (config) => {
    try {
      console.log("Saving Zenoti configuration...");
      return await apiClient.post("/api/zenoti/config", { config });
    } catch (error) {
      console.error("Error saving Zenoti config:", error);
      throw error;
    }
  },

  // Test connection with provided configuration
  testConnection: async (config) => {
    try {
      console.log("Testing Zenoti connection with config...");
      return await apiClient.post("/api/zenoti/test-connection", { config });
    } catch (error) {
      console.error("Error testing Zenoti connection:", error);
      throw error;
    }
  },

  // Search for clients/customers
  searchClients: async (params) => {
    try {
      console.log("Searching Zenoti clients with params:", params);
      return await apiClient.get("/api/zenoti/clients", { params });
    } catch (error) {
      console.error("Error searching Zenoti clients:", error);
      throw error;
    }
  },

  // Search clients across all centers
  searchClientsAcrossAllCenters: async (params) => {
    try {
      console.log(
        "Searching Zenoti clients across all centers with params:",
        params
      );
      return await apiClient.get("/api/zenoti/clients", {
        params: { ...params, allCenters: true },
      });
    } catch (error) {
      console.error("Error searching Zenoti clients across centers:", error);
      throw error;
    }
  },

  // Create a new client
  createClient: async (clientData, centerCode) => {
    try {
      console.log("Creating new Zenoti client...");
      return await apiClient.post("/api/zenoti/client", {
        clientData,
        centerCode,
      });
    } catch (error) {
      console.error("Error creating Zenoti client:", error);
      throw error;
    }
  },

  // Get client details
  getClient: async (clientId, centerCode = null) => {
    try {
      const params = centerCode ? { centerCode } : {};
      return await apiClient.get(`/api/zenoti/client/${clientId}`, { params });
    } catch (error) {
      console.error("Error getting Zenoti client details:", error);
      throw error;
    }
  },

  // Update a client
  updateClient: async (clientId, updateData) => {
    try {
      console.log(`Updating Zenoti client ${clientId}...`);
      return await apiClient.put(`/api/zenoti/client/${clientId}`, {
        updateData,
      });
    } catch (error) {
      console.error("Error updating Zenoti client:", error);
      throw error;
    }
  },

  // Find a client across all centers
  findClientAcrossCenters: async (searchParams) => {
    try {
      console.log("Finding client across all centers:", searchParams);
      return await apiClient.get("/api/zenoti/client/find", {
        params: searchParams,
      });
    } catch (error) {
      console.error("Error finding client across centers:", error);
      throw error;
    }
  },

  // Get client history
  getClientHistory: async (clientId, params = {}) => {
    try {
      console.log(`Getting history for client ${clientId}...`);
      return await apiClient.get(`/api/zenoti/client/${clientId}/history`, {
        params,
      });
    } catch (error) {
      console.error("Error getting Zenoti client history:", error);
      throw error;
    }
  },

  // Get appointments
  getAppointments: async (params) => {
    try {
      console.log("Getting Zenoti appointments with params:", params);
      return await apiClient.get("/api/zenoti/appointments", { params });
    } catch (error) {
      console.error("Error getting Zenoti appointments:", error);
      throw error;
    }
  },

  // Get appointments across all centers
  getAppointmentsAcrossAllCenters: async (params) => {
    try {
      console.log("Getting Zenoti appointments across all centers...");
      return await apiClient.get("/api/zenoti/appointments", {
        params: { ...params, allCenters: true },
      });
    } catch (error) {
      console.error("Error getting appointments across centers:", error);
      throw error;
    }
  },

  // Get appointment details
  getAppointmentDetails: async (appointmentId) => {
    try {
      console.log(`Getting details for appointment ${appointmentId}...`);
      return await apiClient.get(`/api/zenoti/appointment/${appointmentId}`);
    } catch (error) {
      console.error("Error getting Zenoti appointment details:", error);
      throw error;
    }
  },

  // Book appointment
  bookAppointment: async (appointmentData, centerCode) => {
    try {
      console.log("Booking new Zenoti appointment...");
      return await apiClient.post("/api/zenoti/appointment", {
        appointmentData,
        centerCode,
      });
    } catch (error) {
      console.error("Error booking Zenoti appointment:", error);
      throw error;
    }
  },

  // Cancel appointment
  cancelAppointment: async (appointmentId, cancelData = {}) => {
    try {
      console.log(`Canceling appointment ${appointmentId}...`);
      return await apiClient.post(
        `/api/zenoti/appointment/${appointmentId}/cancel`,
        cancelData
      );
    } catch (error) {
      console.error("Error canceling Zenoti appointment:", error);
      throw error;
    }
  },

  // Reschedule appointment
  rescheduleAppointment: async (appointmentId, rescheduleData) => {
    try {
      console.log(`Rescheduling appointment ${appointmentId}...`);
      return await apiClient.post(
        `/api/zenoti/appointment/${appointmentId}/reschedule`,
        rescheduleData
      );
    } catch (error) {
      console.error("Error rescheduling Zenoti appointment:", error);
      throw error;
    }
  },

  // Get availability
  getAvailability: async (params) => {
    try {
      console.log("Getting Zenoti availability with params:", params);
      return await apiClient.get("/api/zenoti/availability", { params });
    } catch (error) {
      console.error("Error getting Zenoti availability:", error);
      throw error;
    }
  },

  // Get services
  getServices: async (params = {}) => {
    try {
      console.log("Getting Zenoti services with params:", params);
      return await apiClient.get("/api/zenoti/services", { params });
    } catch (error) {
      console.error("Error getting Zenoti services:", error);
      throw error;
    }
  },

  // Get staff
  getStaff: async (params = {}) => {
    try {
      console.log("Getting Zenoti staff with params:", params);
      return await apiClient.get("/api/zenoti/staff", { params });
    } catch (error) {
      console.error("Error getting Zenoti staff:", error);
      throw error;
    }
  },

  // Generate weekly report
  generateWeeklyReport: async (params) => {
    try {
      console.log("Generating Zenoti weekly report with params:", params);
      return await apiClient.get("/api/zenoti/reports/weekly", { params });
    } catch (error) {
      console.error("Error generating Zenoti weekly report:", error);
      throw error;
    }
  },

  // Generate client activity report
  generateClientActivityReport: async (params) => {
    try {
      console.log("Generating client activity report with params:", params);
      return await apiClient.get("/api/zenoti/reports/client-activity", {
        params,
      });
    } catch (error) {
      console.error("Error generating client activity report:", error);
      throw error;
    }
  },

  // Debug endpoints
  debugCenters: async () => {
    try {
      console.log("Fetching Zenoti centers debug info...");
      return await apiClient.get("/api/zenoti/debug/centers");
    } catch (error) {
      console.error("Error getting Zenoti debug centers:", error);
      throw error;
    }
  },
};

export default zenotiService;
