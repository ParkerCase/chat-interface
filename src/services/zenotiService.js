// src/services/zenotiService.js - Enhanced to support new endpoints
import { apiClient } from "./apiService";

/**
 * Service to handle all Zenoti-related API calls with comprehensive error handling
 */
const zenotiService = {
  // Connection & Configuration
  checkConnectionStatus: async () => {
    try {
      console.log("Checking Zenoti connection status...");
      const response = await apiClient.get("/api/zenoti/status");
      console.log("Connection status response:", response);
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

  // Get client purchase history
  getClientPurchaseHistory: async (clientId, params = {}) => {
    try {
      return await apiClient.get(`/api/zenoti/client/${clientId}/history`, {
        params,
      });
    } catch (error) {
      console.error("Error getting client purchase history:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get purchase history",
          history: [],
        },
      };
    }
  },

  // APPOINTMENTS
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
      return {
        data: {
          success: false,
          error: error.message || "Failed to get appointment details",
        },
      };
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
  getAvailableSlots: async (params) => {
    try {
      const response = await apiClient.get("/api/zenoti/availability", {
        params,
      });
      // Check different response formats
      if (response.data?.success) {
        return response.data?.availability || { slots: [] };
      } else {
        return { slots: [] };
      }
    } catch (error) {
      console.error("Error getting availability:", error);
      return { slots: [] };
    }
  },

  getAvailableSlotsAcrossAllCenters: async (params) => {
    try {
      const allCentersParams = { ...params, allCenters: true };
      const response = await apiClient.get("/api/zenoti/availability", {
        params: allCentersParams,
      });
      return response.data || { centerResults: {} };
    } catch (error) {
      console.error("Error getting availability across centers:", error);
      return { centerResults: {} };
    }
  },

  // Services
  getServices: async (params = {}) => {
    try {
      const response = await apiClient.get("/api/zenoti/services", { params });
      // Ensure we always return a proper structure even if the backend response is incorrect
      if (response.data && !response.data.services && response.data.data) {
        response.data.services = response.data.data;
      }
      return response.data || { services: [], success: false };
    } catch (error) {
      console.error("Error getting services:", error);
      return {
        success: false,
        error: error.message || "Failed to get services",
        services: [],
      };
    }
  },

  // NEW: Packages endpoint
  getPackages: async (params = {}) => {
    try {
      console.log("Getting Zenoti packages with params:", params);
      const response = await apiClient.get("/api/zenoti/packages", { params });

      // Handle different possible response formats
      if (response.data?.success) {
        // If packages are not directly in the data object, look in packages property
        if (!Array.isArray(response.data) && !response.data.packages) {
          return {
            data: {
              success: true,
              packages: [],
              message: "No packages found",
            },
          };
        }

        // Return as-is if already formatted correctly
        return response;
      }

      // Return consistent error format if unsuccessful
      return {
        data: {
          success: false,
          error: response.data?.error || "Failed to get packages",
          packages: [],
        },
      };
    } catch (error) {
      console.error("Error getting Zenoti packages:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get packages",
          packages: [],
        },
      };
    }
  },

  // Get packages by center
  getPackagesByCenter: async (centerCode) => {
    try {
      if (!centerCode) {
        return {
          data: {
            success: false,
            error: "Center code is required",
            packages: [],
          },
        };
      }

      return await zenotiService.getPackages({ centerCode });
    } catch (error) {
      console.error("Error getting packages by center:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get packages by center",
          packages: [],
        },
      };
    }
  },

  // Get package details
  getPackageDetails: async (packageId, centerCode = null) => {
    try {
      const params = centerCode ? { centerCode } : {};
      const response = await apiClient.get(
        `/api/zenoti/packages/${packageId}`,
        { params }
      );

      return response;
    } catch (error) {
      console.error("Error getting package details:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get package details",
        },
      };
    }
  },

  // Staff
  getStaff: async (params = {}) => {
    try {
      const response = await apiClient.get("/api/zenoti/staff", { params });

      // If therapists field exists, ensure we have consistent data structure
      if (response.data && response.data.therapists) {
        return {
          therapists: response.data.therapists,
          total_count:
            response.data.total_count || response.data.therapists.length,
          success: response.data.success !== false,
        };
      }

      // If staff field exists and therapists doesn't, map it
      if (response.data && response.data.staff && !response.data.therapists) {
        return {
          therapists: response.data.staff,
          total_count: response.data.total_count || response.data.staff.length,
          success: response.data.success !== false,
        };
      }

      return (
        response.data || {
          therapists: [],
          staff: [],
          success: false,
        }
      );
    } catch (error) {
      console.error("Error getting staff:", error);
      return {
        success: false,
        error: error.message || "Failed to get staff",
        therapists: [],
        staff: [],
      };
    }
  },

  // Reports
  // Removing client activity and weekly report methods that don't work

  // Collections Report
  getCollectionsReport: async (params) => {
    try {
      console.log("Getting collections report with params:", params);
      if (!params.startDate || !params.endDate) {
        throw new Error("Start date and end date are required");
      }

      const response = await apiClient.get("/api/zenoti/reports/collections", {
        params,
      });

      return response;
    } catch (error) {
      console.error("Error getting collections report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get collections report",
          report: {
            summary: {
              total_collected: 0,
              total_collected_cash: 0,
              total_collected_non_cash: 0,
            },
            payment_types: {},
            transactions: [],
          },
        },
      };
    }
  },

  // Sales Report
  getSalesReport: async (params) => {
    try {
      console.log("Getting sales report with params:", params);
      if (!params.startDate || !params.endDate) {
        throw new Error("Start date and end date are required");
      }

      const response = await apiClient.get("/api/zenoti/reports/sales", {
        params,
      });

      return response;
    } catch (error) {
      console.error("Error getting sales report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get sales report",
          report: {
            summary: {
              total_sales: 0,
              total_refunds: 0,
              net_sales: 0,
            },
            items: [],
          },
        },
      };
    }
  },

  // Search invoices
  searchInvoices: async (params) => {
    try {
      const response = await apiClient.get("/api/zenoti/invoices", { params });

      // Make sure response has a consistent structure
      if (response.data?.success && !response.data.invoices) {
        response.data.invoices = [];
      }

      return response;
    } catch (error) {
      console.error("Error searching invoices:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to search invoices",
          invoices: [],
        },
      };
    }
  },

  // Report file generation
  generateReportFile: async (reportData, format, filename) => {
    try {
      return await apiClient.post("/api/zenoti/reports/export", {
        reportData,
        format,
        filename,
      });
    } catch (error) {
      console.error("Error generating report file:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to generate report file",
        },
      };
    }
  },

  // Email report
  emailReport: async (emailData) => {
    try {
      return await apiClient.post("/api/zenoti/reports/email", emailData);
    } catch (error) {
      console.error("Error emailing report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to email report",
        },
      };
    }
  },

  // List report files
  getReportFiles: async () => {
    try {
      return await apiClient.get("/api/zenoti/reports/list");
    } catch (error) {
      console.error("Error getting report files:", error);
      return {
        data: {
          success: false,
          files: [],
          error: error.message,
        },
      };
    }
  },

  // Delete client
  deleteClient: async (clientId, centerCode = null) => {
    try {
      const params = centerCode ? { centerCode } : {};
      return await apiClient.delete(`/api/zenoti/client/${clientId}`, {
        params,
      });
    } catch (error) {
      console.error("Error deleting client:", error);
      throw error;
    }
  },
};

export default zenotiService;
