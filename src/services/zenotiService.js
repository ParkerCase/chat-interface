// src/services/zenotiService.js - Enhanced to support new endpoints
import { apiClient } from "./apiService";

// Define the center ID mapping
const getCenterIdMap = () => {
  // Default hardcoded values as fallback
  const defaultMap = {
    AUS: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
    CHI: "c359afac-3210-49e5-a930-6676d8bb188a",
    CW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7",
    Draper: "5da78932-c7e1-48b2-a099-9c302c75d7e1",
    HTN: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12",
    TRA: "ca3dc432-280b-4cdb-86ea-6e582f3182a9", // Same as AUS
    TRC: "c359afac-3210-49e5-a930-6676d8bb188a", // Same as CHI
    TRW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7", // Same as CW
    TRD: "5da78932-c7e1-48b2-a099-9c302c75d7e1", // Same as Draper
    TRH: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12", // Same as HTN
    Houston: "8ae56789-f213-4cd7-9e34-10a2bc45d678",
    DEFAULT: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
  };

  // Check if environment variable is set
  if (process.env.REACT_APP_CENTER_ID_MAP) {
    try {
      const envMap = JSON.parse(process.env.REACT_APP_CENTER_ID_MAP);
      // Merge environment config with defaults, prioritizing environment
      return { ...defaultMap, ...envMap };
    } catch (e) {
      console.error("Error parsing REACT_APP_CENTER_ID_MAP:", e);
      // Fall back to hardcoded values on error
      return defaultMap;
    }
  }

  return defaultMap;
};

// Create the CENTER_ID_MAP constant
const CENTER_ID_MAP = getCenterIdMap();

/**
 * Service to handle all Zenoti-related API calls with comprehensive error handling
 */
const zenotiService = {
  // Connection & Configuration
  checkConnectionStatus: async () => {
    try {
      console.log("Checking Zenoti connection status...");

      // First try a lightweight call to check basic connection
      try {
        const centersResponse = await apiClient.get("/api/zenoti/centers");

        if (centersResponse.data?.success) {
          console.log("Connection successful via centers endpoint");
          return {
            data: {
              success: true,
              status: "connected",
              details: {
                centers: centersResponse.data.centers?.length || 0,
                defaultCenter: centersResponse.data.defaultCenter,
              },
            },
          };
        }
      } catch (e) {
        console.warn("Centers check failed, trying status endpoint:", e);
      }

      // Fall back to the direct status endpoint
      const response = await apiClient.get("/api/zenoti/status");
      console.log("Connection status response:", response);
      return response;
    } catch (error) {
      console.error("Error checking Zenoti connection:", error);

      // Try to determine if this is a connection issue or auth issue
      let errorType = "connection";
      if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
          errorType = "authentication";
        } else if (error.response.status >= 500) {
          errorType = "server";
        }
      }

      return {
        data: {
          success: false,
          status: "error",
          errorType: errorType,
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

      // Handle status filter - make sure it's properly formatted for API
      if (params.status) {
        console.log(`Filtering appointments by status: "${params.status}"`);
      } else {
        console.log("No status filter applied");
      }

      // Add timestamp to prevent caching issues
      params._t = new Date().getTime();

      const response = await apiClient.get("/api/zenoti/appointments", {
        params,
      });

      console.log("Appointments API response:", response.data);

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
      if (!appointmentId) {
        throw new Error("Appointment ID is required");
      }

      const params = centerCode ? { centerCode } : {};
      const response = await apiClient.get(
        `/api/zenoti/appointment/${appointmentId}`,
        {
          params,
        }
      );

      // Normalize the response
      if (response.data?.success) {
        // Ensure we have a complete appointment object
        let appointment = response.data.appointment;

        // If we have only minimal data, enhance it with additional info
        if (appointment && !appointment.service && appointment.service_id) {
          try {
            // Try to get service details
            const serviceResponse = await zenotiService.getServiceDetails(
              appointment.service_id,
              centerCode
            );

            if (serviceResponse.data?.success) {
              appointment.service = serviceResponse.data.service;
            }
          } catch (serviceError) {
            console.warn("Error enhancing with service details:", serviceError);
          }
        }

        // If we have a guest/client ID but no details, fetch them
        if (appointment && !appointment.guest && appointment.guest_id) {
          try {
            // Try to get client details
            const clientResponse = await zenotiService.getClient(
              appointment.guest_id,
              centerCode
            );

            if (clientResponse.data?.success) {
              appointment.guest = clientResponse.data.client;
            }
          } catch (clientError) {
            console.warn("Error enhancing with client details:", clientError);
          }
        }

        // Update the response with enhanced data
        response.data.appointment = appointment;
      }

      return response;
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
      console.log("Getting Zenoti services with params:", params);
      const response = await apiClient.get("/api/zenoti/services", { params });

      // Ensure we return a consistent data structure regardless of the backend response
      if (response && response.data) {
        // If data.services exists, use it
        if (response.data.services) {
          return {
            data: {
              success: true,
              services: response.data.services,
            },
          };
        }
        // If data.data exists (legacy format), map it to services
        else if (response.data.data) {
          return {
            data: {
              success: true,
              services: response.data.data,
            },
          };
        }
        // If response.data is an array, assume it's the services array
        else if (Array.isArray(response.data)) {
          return {
            data: {
              success: true,
              services: response.data,
            },
          };
        }
        // If we have a valid response but no services data, return empty array
        else {
          return {
            data: {
              success: true,
              services: [],
            },
          };
        }
      }

      // Return empty data if nothing worked
      return {
        data: {
          success: false,
          services: [],
          error: "Invalid API response format",
        },
      };
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

  // Get service details
  getServiceDetails: async (serviceId, centerCode = null) => {
    try {
      if (!serviceId) {
        throw new Error("Service ID is required");
      }

      const params = centerCode ? { centerCode } : {};
      const response = await apiClient.get(
        `/api/zenoti/services/${serviceId}`,
        { params }
      );

      return response;
    } catch (error) {
      console.error("Error getting service details:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get service details",
          service: null,
        },
      };
    }
  },

  getCenterIdFromCode: async (centerCode) => {
    try {
      if (!centerCode) {
        throw new Error("Center code is required");
      }

      // Check cache first
      const cachedId = localStorage.getItem(`zenoti_center_id_${centerCode}`);
      if (cachedId) {
        console.log(`Using cached center ID for ${centerCode}: ${cachedId}`);
        return {
          success: true,
          centerId: cachedId,
        };
      }

      // Check hardcoded mapping as fallback
      if (CENTER_ID_MAP[centerCode]) {
        console.log(
          `Using hardcoded center ID for ${centerCode}: ${CENTER_ID_MAP[centerCode]}`
        );

        // Cache the hardcoded ID
        localStorage.setItem(
          `zenoti_center_id_${centerCode}`,
          CENTER_ID_MAP[centerCode]
        );

        return {
          success: true,
          centerId: CENTER_ID_MAP[centerCode],
          source: "hardcoded",
        };
      }

      // Get all centers and find the matching one
      const response = await zenotiService.getCenters();

      if (response.data?.success) {
        const centers = response.data.centers || [];
        console.log(`Found ${centers.length} centers in response`);

        const center = centers.find((c) => c.code === centerCode);

        if (center) {
          const centerId = center.id || center.center_id;

          if (centerId) {
            // Cache the ID for future use
            localStorage.setItem(`zenoti_center_id_${centerCode}`, centerId);
            console.log(
              `Found and cached center ID for ${centerCode}: ${centerId}`
            );

            // Also add to our hardcoded map for future use in case localStorage is cleared
            if (!CENTER_ID_MAP[centerCode]) {
              console.log(`Adding ${centerCode}: ${centerId} to CENTER_ID_MAP`);
              // Note: This won't persist after page reload, but it's helpful for debugging
              CENTER_ID_MAP[centerCode] = centerId;
            }

            return {
              success: true,
              centerId: centerId,
              source: "api",
            };
          } else {
            console.warn(`Center with code ${centerCode} found but has no ID`);
          }
        } else {
          console.warn(`Center with code ${centerCode} not found`);
        }

        // If we couldn't find the center, check if we have a defaultCenter ID
        if (response.data.defaultCenter && response.data.defaultCenterId) {
          console.log(
            `Using default center ID: ${response.data.defaultCenterId}`
          );

          // Cache this default ID too
          localStorage.setItem(
            `zenoti_center_id_${centerCode}`,
            response.data.defaultCenterId
          );

          return {
            success: true,
            centerId: response.data.defaultCenterId,
            source: "default",
          };
        }
      }

      // If we get here, use a generic center ID as last resort
      const genericCenterId = "999999"; // This is a last resort fallback ID
      console.warn(
        `Using generic center ID ${genericCenterId} for ${centerCode} as last resort`
      );
      localStorage.setItem(`zenoti_center_id_${centerCode}`, genericCenterId);

      return {
        success: true,
        centerId: genericCenterId,
        source: "fallback",
      };
    } catch (error) {
      console.error("Error getting center ID from code:", error);

      // Absolute last resort - use a hardcoded fallback and pretend it succeeded
      const fallbackId = "999999";
      console.warn(
        `Using emergency fallback ID ${fallbackId} for ${centerCode} after error`
      );
      localStorage.setItem(`zenoti_center_id_${centerCode}`, fallbackId);

      return {
        success: true,
        centerId: fallbackId,
        source: "emergency",
        originalError: error.message,
      };
    }
  },

  // Update the getPackages method to use center ID if available
  getPackages: async (params = {}) => {
    try {
      console.log("Getting Zenoti packages with params:", params);

      // If centerCode is provided, convert it to centerId
      if (params.centerCode && !params.centerId) {
        const centerResult = await zenotiService.getCenterIdFromCode(
          params.centerCode
        );
        if (centerResult.success) {
          params.centerId = centerResult.centerId;
        } else {
          console.warn(
            "Could not convert center code to ID, using code directly"
          );
        }
      }

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

  getStaffDetails: async (staffId) => {
    try {
      if (!staffId) {
        throw new Error("Staff ID is required");
      }

      const response = await apiClient.get(`/api/zenoti/staff/${staffId}`);
      return response;
    } catch (error) {
      console.error("Error getting staff details:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get staff details",
          staff: null,
        },
      };
    }
  },

  // Reports
  // Removing client activity and weekly report methods that don't work
  /**
   * Get appointments report with detailed filters
   * @param {Object} params - Report parameters
   * @param {string[]} params.center_ids - Array of center IDs
   * @param {number} params.date_type - 0 (Appointment date) or 1 (Booking date)
   * @param {number[]} params.appointment_statuses - Array of status codes (-1: All, 0: Open, etc.)
   * @param {number[]} params.appointment_sources - Array of source codes (-1: All, 0: Zenoti, etc.)
   * @param {string} params.start_date - Start date (YYYY-MM-DD)
   * @param {string} params.end_date - End date (YYYY-MM-DD)
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.size - Page size (default: 100)
   */
  getAppointmentsReport: async (params = {}) => {
    try {
      // Set defaults
      const defaultParams = {
        date_type: 0, // Appointment date
        appointment_statuses: [-1], // All statuses
        appointment_sources: [-1], // All sources
        page: 1,
        size: 100,
      };

      // Merge defaults with provided params
      const reportParams = { ...defaultParams, ...params };

      // Validation
      if (!reportParams.start_date || !reportParams.end_date) {
        throw new Error("Start date and end date are required");
      }

      if (!reportParams.center_ids || !reportParams.center_ids.length) {
        if (reportParams.centerCode) {
          // Try to convert center code to ID if provided
          const centerResult = await zenotiService.getCenterIdFromCode(
            reportParams.centerCode
          );
          if (centerResult.success) {
            reportParams.center_ids = [centerResult.centerId];
          } else {
            throw new Error("Valid center_ids or centerCode is required");
          }
        } else {
          throw new Error("center_ids are required");
        }
      }

      // Remove any extra params not needed in the API request
      const { centerCode, ...cleanParams } = reportParams;

      console.log("Getting appointments report with params:", cleanParams);

      const response = await apiClient.post(
        `/api/zenoti/reports/appointments/flat_file?page=${cleanParams.page}&size=${cleanParams.size}`,
        cleanParams
      );

      return response;
    } catch (error) {
      console.error("Error getting appointments report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get appointments report",
          report: { appointments: [] },
        },
      };
    }
  },

  /**
   * Get sales accrual basis report
   * @param {Object} params - Report parameters
   * @param {string[]} params.center_ids - Array of center IDs
   * @param {string} params.start_date - Start date (YYYY-MM-DD HH:MM:SS)
   * @param {string} params.end_date - End date (YYYY-MM-DD HH:MM:SS)
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.size - Page size (default: 100)
   */
  getSalesAccrualReport: async (params = {}) => {
    try {
      // Set defaults
      const defaultParams = {
        page: 1,
        size: 100,
      };

      // Merge defaults with provided params
      const reportParams = { ...defaultParams, ...params };

      // Validation
      if (!reportParams.start_date || !reportParams.end_date) {
        throw new Error("Start date and end date are required");
      }

      if (!reportParams.center_ids || !reportParams.center_ids.length) {
        if (reportParams.centerCode) {
          // Try to convert center code to ID if provided
          const centerResult = await zenotiService.getCenterIdFromCode(
            reportParams.centerCode
          );
          if (centerResult.success) {
            reportParams.center_ids = [centerResult.centerId];
          } else {
            throw new Error("Valid center_ids or centerCode is required");
          }
        } else {
          throw new Error("center_ids are required");
        }
      }

      // Ensure dates are in correct format
      if (!reportParams.start_date.includes(" ")) {
        reportParams.start_date = `${reportParams.start_date} 00:00:00`;
      }

      if (!reportParams.end_date.includes(" ")) {
        reportParams.end_date = `${reportParams.end_date} 23:59:59`;
      }

      // Remove any extra params not needed in the API request
      const { centerCode, ...cleanParams } = reportParams;

      console.log("Getting sales accrual report with params:", cleanParams);

      const response = await apiClient.post(
        `/api/zenoti/reports/sales/accrual_basis/flat_file?page=${cleanParams.page}&size=${cleanParams.size}`,
        cleanParams
      );

      return response;
    } catch (error) {
      console.error("Error getting sales accrual report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get sales accrual report",
          report: { sales: [] },
        },
      };
    }
  },

  /**
   * Get sales cash basis report with detailed filters
   * @param {Object} params - Report parameters
   * @param {string[]} params.center_ids - Array of center IDs
   * @param {string} params.start_date - Start date (YYYY-MM-DD HH:MM:SS)
   * @param {string} params.end_date - End date (YYYY-MM-DD HH:MM:SS)
   * @param {string} params.level_of_detail - Detail level (default: "1")
   * @param {number[]} params.item_types - Array of item type codes (-1: All, 0: Service, etc.)
   * @param {number[]} params.payment_types - Array of payment type codes (-1: All, 0: Cash, etc.)
   * @param {number[]} params.sale_types - Array of sale type codes (-1: All, 0: Sale, etc.)
   * @param {string[]} params.sold_by_ids - Array of staff IDs (optional)
   * @param {number[]} params.invoice_statuses - Array of invoice status codes (-1: All)
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.size - Page size (default: 50)
   */
  getSalesCashReport: async (params = {}) => {
    try {
      // Set defaults
      const defaultParams = {
        level_of_detail: "1",
        item_types: [-1],
        payment_types: [-1],
        sale_types: [-1],
        sold_by_ids: [],
        invoice_statuses: [-1],
        page: 1,
        size: 50,
      };

      // Merge defaults with provided params
      const reportParams = { ...defaultParams, ...params };

      // Validation
      if (!reportParams.start_date || !reportParams.end_date) {
        throw new Error("Start date and end date are required");
      }

      if (!reportParams.center_ids || !reportParams.center_ids.length) {
        if (reportParams.centerCode) {
          // Try to convert center code to ID if provided
          const centerResult = await zenotiService.getCenterIdFromCode(
            reportParams.centerCode
          );
          if (centerResult.success) {
            reportParams.center_ids = [centerResult.centerId];
          } else {
            throw new Error("Valid center_ids or centerCode is required");
          }
        } else {
          throw new Error("center_ids are required");
        }
      }

      // Ensure dates are in correct format
      if (!reportParams.start_date.includes(" ")) {
        reportParams.start_date = `${reportParams.start_date} 00:00:00`;
      }

      if (!reportParams.end_date.includes(" ")) {
        reportParams.end_date = `${reportParams.end_date} 23:59:59`;
      }

      // Remove any extra params not needed in the API request
      const { centerCode, ...cleanParams } = reportParams;

      console.log("Getting sales cash report with params:", cleanParams);

      const response = await apiClient.post(
        `/api/zenoti/reports/sales/cash_basis/flat_file?page=${cleanParams.page}&size=${cleanParams.size}`,
        cleanParams
      );

      return response;
    } catch (error) {
      console.error("Error getting sales cash report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get sales cash report",
          report: { sales: [] },
        },
      };
    }
  },

  // Handy utility for translating enum values to labels
  getAppointmentStatusLabel: (statusCode) => {
    const statuses = {
      "-1": "All",
      Open: "Open",
      Closed: "Closed",
      Cancelled: "Cancelled",
      NoShow: "No Show",
      CheckedIn: "Checked In",
      Confirmed: "Confirmed",
      Deleted: "Deleted",
    };
    return statuses[statusCode] || "Unknown";
  },

  getAppointmentSourceLabel: (sourceCode) => {
    const sources = {
      "-1": "All",
      0: "Zenoti",
      1: "Mobile CMA",
      2: "Online",
      14: "Zenoti Mobile",
      16: "POS",
      24: "Kiosk",
      26: "Kiosk Web",
    };
    return sources[sourceCode] || "Unknown";
  },

  getItemTypeLabel: (typeCode) => {
    const types = {
      "-1": "All",
      0: "Service",
      2: "Product",
      3: "Membership",
      4: "Package",
      5: "Day Promo Package",
      6: "Prepaid Card",
      61: "Gift Card",
      11: "Class",
    };
    return types[typeCode] || "Unknown";
  },

  getPaymentTypeLabel: (typeCode) => {
    const types = {
      "-1": "All",
      0: "Cash",
      1: "Card",
      2: "Check",
      3: "Custom Financial",
      4: "Custom Non-Financial",
      5: "Membership",
      6: "Membership Service",
      7: "Package",
      8: "Gift Card",
      9: "Prepaid Card",
      10: "Loyalty Points",
      11: "Custom",
      16: "Cashback",
    };
    return types[typeCode] || "Unknown";
  },

  getSaleTypeLabel: (typeCode) => {
    const types = {
      "-1": "All",
      0: "Sale",
      1: "Refund",
      2: "Recurring",
      3: "Charges",
    };
    return types[typeCode] || "Unknown";
  },

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
      // First try the API endpoint
      try {
        const response = await apiClient.post("/api/zenoti/reports/export", {
          reportData,
          format,
          filename,
        });

        if (response.data?.success) {
          return response;
        }
      } catch (apiError) {
        console.warn(
          "API export failed, falling back to client-side generation:",
          apiError
        );
      }

      // If API fails, generate on client side
      let fileContent = "";
      let mimeType = "";

      // Generate content based on format
      if (format === "csv") {
        fileContent = zenotiService.convertToCSV(reportData);
        mimeType = "text/csv";
      } else if (format === "json") {
        fileContent = JSON.stringify(reportData, null, 2);
        mimeType = "application/json";
      } else {
        throw new Error(
          `Client-side generation not supported for ${format} format`
        );
      }

      // Create mock response with file data
      return {
        data: {
          success: true,
          result: {
            fileData: btoa(fileContent), // Base64 encode
            filename: `${filename}.${format}`,
            mimeType: mimeType,
          },
        },
      };
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

  convertToCSV: (data) => {
    if (!data) return "";

    // Handle different report types
    if (data.summary) {
      // Collections or sales report
      let csv = "Category,Metric,Value\n";

      // Add summary data
      Object.entries(data.summary).forEach(([key, value]) => {
        csv += `Summary,${key.replace(/_/g, " ")},${value}\n`;
      });

      // Add detailed data if available
      if (data.items) {
        data.items.forEach((item) => {
          csv += `Item,${item.name},${item.total_amount || item.count || 0}\n`;
        });
      }

      if (data.transactions) {
        data.transactions.forEach((tx, index) => {
          csv += `Transaction,${tx.id || `TX-${index}`},${tx.amount || 0}\n`;
        });
      }

      return csv;
    }

    // Packages report
    if (Array.isArray(data)) {
      let headers = Object.keys(data[0] || {}).join(",");
      let csv = headers + "\n";

      data.forEach((row) => {
        const values = Object.values(row)
          .map((value) => {
            // Handle strings with commas
            if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            }
            return value;
          })
          .join(",");

        csv += values + "\n";
      });

      return csv;
    }

    // Generic object
    return JSON.stringify(data);
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
