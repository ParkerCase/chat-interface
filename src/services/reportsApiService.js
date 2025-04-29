// src/services/reportsApiService.js
import { apiClient } from "./apiService";

/**
 * Service for handling CRM and Zenoti reports with better error handling and caching
 */
const reportsApiService = {
  /**
   * Get sales report with proper center ID mapping
   * @param {Object} params - Report parameters
   * @returns {Promise} - API response
   */
  getSalesReport: async (params = {}) => {
    try {
      console.log("Fetching sales report with params:", params);

      // Format date range to ensure consistent format
      if (params.startDate) {
        params.startDate = formatDateParam(params.startDate);
      }
      if (params.endDate) {
        params.endDate = formatDateParam(params.endDate);
      }

      // Remove any incorrect parameters
      // The backend expects centerCode, not center_ids or centerId
      if (params.center_ids) delete params.center_ids;
      if (params.centerId) delete params.centerId;

      const response = await apiClient.get("/api/zenoti/reports/sales", {
        params,
      });
      return response;
    } catch (error) {
      console.error("Error fetching sales report:", error);
      // Return a structured error response for consistent handling
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch sales report",
          report: createEmptyReport("sales"),
        },
      };
    }
  },

  /**
   * Get appointments report with date chunking handled by the backend
   * @param {Object} params - Report parameters
   * @returns {Promise} - API response
   */
  getAppointmentsReport: async (params = {}) => {
    try {
      console.log("Fetching appointments report with params:", params);

      // Format date range
      if (params.startDate) {
        params.startDate = formatDateParam(params.startDate);
      }
      if (params.endDate) {
        params.endDate = formatDateParam(params.endDate);
      }

      // Add timestamp to prevent caching
      params._t = Date.now();

      // Remove any incorrect parameters
      if (params.center_ids) delete params.center_ids;
      if (params.centerId) delete params.centerId;

      // According to the logs, the backend handles date chunking automatically
      // So we don't need to manually split large date ranges
      const response = await apiClient.get("/api/zenoti/appointments", {
        params,
      });
      return response;
    } catch (error) {
      console.error("Error fetching appointments report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch appointments report",
          appointments: [],
        },
      };
    }
  },

  /**
   * Get collections report
   * @param {Object} params - Report parameters
   * @returns {Promise} - API response
   */
  getCollectionsReport: async (params = {}) => {
    try {
      console.log("Fetching collections report with params:", params);

      // Format date range
      if (params.startDate) {
        params.startDate = formatDateParam(params.startDate);
      }
      if (params.endDate) {
        params.endDate = formatDateParam(params.endDate);
      }

      const response = await apiClient.get("/api/zenoti/reports/collections", {
        params,
      });
      return response;
    } catch (error) {
      console.error("Error fetching collections report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch collections report",
          report: createEmptyReport("collections"),
        },
      };
    }
  },

  /**
   * Get packages report
   * @param {Object} params - Report parameters
   * @returns {Promise} - API response
   */
  getPackagesReport: async (params = {}) => {
    try {
      console.log("Fetching packages report with params:", params);

      // Create a new params object without the incorrect centerId
      const cleanParams = { ...params };

      // Remove any incorrect parameters
      if (cleanParams.centerId) delete cleanParams.centerId;
      if (cleanParams.center_ids) delete cleanParams.center_ids;

      // The backend expects only centerCode
      const response = await apiClient.get("/api/zenoti/packages", {
        params: cleanParams,
      });

      return response;
    } catch (error) {
      console.error("Error fetching packages report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch packages report",
          packages: [],
        },
      };
    }
  },

  /**
   * Get services report
   * @param {Object} params - Report parameters
   * @returns {Promise} - API response
   */
  getServicesReport: async (params = {}) => {
    try {
      console.log("Fetching services report with params:", params);

      const response = await apiClient.get("/api/zenoti/services", { params });
      return response;
    } catch (error) {
      console.error("Error fetching services report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch services report",
          services: [],
        },
      };
    }
  },

  /**
   * Generate a report file for download
   * @param {Object} reportData - Report data to export
   * @param {String} format - Export format (csv, pdf, etc.)
   * @param {String} filename - Export filename
   * @returns {Promise} - API response
   */
  generateReportFile: async (reportData, format = "csv", filename) => {
    try {
      console.log(`Generating ${format} report file: ${filename}`);

      const response = await apiClient.post("/api/zenoti/reports/export", {
        reportData,
        format,
        filename,
      });

      return response;
    } catch (error) {
      console.error("Error generating report file:", error);
      throw error; // Let the UI handle this error
    }
  },

  /**
   * Email a report to specified recipients
   * @param {Object} emailData - Email data with report and recipients
   * @returns {Promise} - API response
   */
  emailReport: async (emailData) => {
    try {
      console.log("Emailing report to:", emailData.recipients);

      const response = await apiClient.post(
        "/api/zenoti/reports/email",
        emailData
      );
      return response;
    } catch (error) {
      console.error("Error emailing report:", error);
      throw error; // Let the UI handle this error
    }
  },
};

// Helper function to format date parameters consistently
function formatDateParam(date) {
  if (!date) return "";

  // If date is already a string in YYYY-MM-DD format, return it
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  // Otherwise, convert to YYYY-MM-DD format
  const dateObj = new Date(date);
  return dateObj.toISOString().split("T")[0];
}

// Create empty report structure for error fallbacks
function createEmptyReport(type) {
  switch (type) {
    case "sales":
      return {
        summary: {
          total_sales: 0,
          total_refunds: 0,
          net_sales: 0,
        },
        items: [],
      };
    case "collections":
      return {
        summary: {
          total_collected: 0,
          total_collected_cash: 0,
          total_collected_non_cash: 0,
        },
        payment_types: {},
        transactions: [],
      };
    default:
      return {};
  }
}

export default reportsApiService;
