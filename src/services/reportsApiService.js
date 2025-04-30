// src/services/reportsApiService.js - Fixed version

import { apiClient } from "./apiService";
import axios from "axios";

/**
 * Enhanced service for handling CRM and Zenoti reports with improved
 * error handling and proper response processing
 */
const reportsApiService = {
  /**
   * Get available centers
   */
  getCenters: async () => {
    try {
      console.log("Fetching Zenoti centers");
      const response = await apiClient.get("/api/zenoti/centers");
      return response;
    } catch (error) {
      console.error("Error fetching centers:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch centers",
          centers: [],
        },
      };
    }
  },

  /**
   * Get sales report data using the accrual basis endpoint
   * @param {Object} params - The request body parameters
   * @returns {Promise<Object>} The response object
   */
  getSalesAccrualBasisReport: async (params) => {
    try {
      console.log("Making accrual basis report request with params:", params);

      // Ensure center_ids is not empty or contains empty strings
      if (!params.center_ids || !params.center_ids[0]) {
        console.error("Invalid center_ids parameter:", params.center_ids);
        throw new Error("A valid center ID is required for sales reports");
      }

      const response = await axios.post(
        "/api/zenoti/reports/sales/accrual-basis",
        params,
        {
          params: {
            page: params.page || 1,
            size: params.size || 100,
          },
        }
      );

      console.log("Accrual basis response status:", response.status);
      return response;
    } catch (error) {
      console.error("Error fetching accrual basis sales report:", error);
      throw error;
    }
  },

  /**
   * Get sales report data using the cash basis endpoint
   * @param {Object} params - The request body parameters
   * @returns {Promise<Object>} The response object
   */
  getSalesCashBasisReport: async (params) => {
    try {
      console.log("Making cash basis report request with params:", params);

      // Ensure center_ids is not empty or contains empty strings
      if (!params.center_ids || !params.center_ids[0]) {
        console.error("Invalid center_ids parameter:", params.center_ids);
        throw new Error("A valid center ID is required for sales reports");
      }

      const response = await axios.post(
        "/api/zenoti/reports/sales/cash-basis",
        params,
        {
          params: {
            page: params.page || 1,
            size: params.size || 50,
          },
        }
      );

      console.log("Cash basis response status:", response.status);
      return response;
    } catch (error) {
      console.error("Error fetching cash basis sales report:", error);
      throw error;
    }
  },

  /**
   * Get sales report with proper handling of actual API response format
   */
  getSalesReport: async (params) => {
    try {
      const response = await axios.get("/api/zenoti/reports/sales", {
        params,
      });
      return response;
    } catch (error) {
      console.error("Error fetching sales report:", error);
      throw error;
    }
  },

  /**
   * Get appointments report with proper handling of actual API response format
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

      const response = await apiClient.get("/api/zenoti/appointments", {
        params,
      });

      // Ensure appointments array exists
      if (response.data && response.data.success === undefined) {
        response.data = {
          success: true,
          appointments: response.data.appointments || [],
        };
      }

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
   * Get packages report with proper handling of actual API response format
   */
  getPackagesReport: async (params = {}) => {
    try {
      console.log("Fetching packages report with params:", params);

      // Add timestamp to prevent caching
      params._t = Date.now();

      const response = await apiClient.get("/api/zenoti/packages", {
        params,
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
   * Get services report with proper handling of actual API response format
   */
  getServicesReport: async (params = {}) => {
    try {
      console.log("Fetching services report with params:", params);

      // Add timestamp to prevent caching
      params._t = Date.now();

      // Add limit if not provided
      if (!params.limit) {
        params.limit = 100;
      }

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
   */
  generateReportFile: async (reportData, format = "csv", filename) => {
    try {
      console.log(`Generating ${format} report file: ${filename}`);

      // Use client-side solution for now to avoid backend issues
      let fileContent = "";
      let mimeType = "";
      let extension = format;

      // Generate content based on format
      if (format === "csv") {
        fileContent = convertToCSV(reportData);
        mimeType = "text/csv";
      } else if (format === "json") {
        fileContent = JSON.stringify(reportData, null, 2);
        mimeType = "application/json";
      } else {
        // Default to CSV if format not supported
        fileContent = convertToCSV(reportData);
        mimeType = "text/csv";
        extension = "csv";
      }

      // Create and download the file
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, message: `Report exported as ${format}` };
    } catch (error) {
      console.error("Error generating report file:", error);
      throw error;
    }
  },

  /**
   * Email a report (mock implementation for now)
   */
  emailReport: async (emailData) => {
    try {
      console.log("Emailing report to:", emailData.recipients);

      // For now, just simulate success
      return {
        data: {
          success: true,
          message: `Report emailed to ${emailData.recipients.join(", ")}`,
        },
      };
    } catch (error) {
      console.error("Error emailing report:", error);
      throw error;
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

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!data) return "";

  // Handle different data structures
  if (Array.isArray(data)) {
    // If data is an array of objects
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((item) =>
      Object.values(item).map(formatCSVValue).join(",")
    );

    return [headers, ...rows].join("\n");
  } else if (data.appointments && Array.isArray(data.appointments)) {
    // Handle appointments report
    const appointments = data.appointments;
    if (appointments.length === 0) return "No appointments found";

    // Extract common properties that would be useful in a CSV
    const headers = "Date,Time,Client,Service,Therapist,Status";

    const rows = appointments.map((appt) => {
      const date = appt.startTime
        ? new Date(appt.startTime).toLocaleDateString()
        : "N/A";
      const time = appt.startTime
        ? new Date(appt.startTime).toLocaleTimeString()
        : "N/A";

      // Extract client name with fallbacks
      const clientName = appt.guest
        ? `${appt.guest.firstName || ""} ${appt.guest.lastName || ""}`.trim()
        : "Unknown Client";

      // Extract service name with fallbacks
      const serviceName = appt.service
        ? appt.service.name
        : appt.parentServiceName || "Unknown Service";

      // Extract therapist name with fallbacks
      const therapistName = appt.therapist
        ? `${appt.therapist.firstName || ""} ${
            appt.therapist.lastName || ""
          }`.trim()
        : "Unknown Therapist";

      // Map status codes to readable strings
      const statusMap = {
        0: "Booked",
        1: "Confirmed",
        2: "Checked In",
        3: "Completed",
        4: "Cancelled",
        5: "No Show",
      };
      const status = statusMap[appt.status] || "Unknown";

      return [date, time, clientName, serviceName, therapistName, status]
        .map(formatCSVValue)
        .join(",");
    });

    return [headers, ...rows].join("\n");
  } else if (data.summary) {
    // Handle sales or collections report with summary
    let csv = "Category,Metric,Value\n";

    // Add summary data
    Object.entries(data.summary).forEach(([key, value]) => {
      csv += `Summary,${key.replace(/_/g, " ")},${value}\n`;
    });

    // Add item breakdown if available
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item) => {
        const name = formatCSVValue(item.name || "Unknown");
        const amount = item.finalSalePrice || item.netAmount || item.total || 0;
        csv += `Item,${name},${amount}\n`;
      });
    }

    return csv;
  }

  // Fallback - convert to JSON and then to CSV
  return "Data Type,Value\nJSON," + formatCSVValue(JSON.stringify(data));
}

// Format a value for CSV to handle commas and quotes
function formatCSVValue(value) {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);

  // If the value contains commas, quotes, or newlines, wrap it in quotes
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    // Double up any quotes within the string
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

// Process items from centerSalesReport format
function processItemsFromCenterSalesReport(centerSalesReport) {
  if (!Array.isArray(centerSalesReport)) return [];

  // Group items by name
  const itemMap = {};

  centerSalesReport.forEach((sale) => {
    const itemName = sale.item?.name || "Unknown Item";

    if (!itemMap[itemName]) {
      itemMap[itemName] = {
        name: itemName,
        quantity: 0,
        totalAmount: 0,
        finalSalePrice: 0,
        netAmount: 0,
      };
    }

    // Increment counters
    itemMap[itemName].quantity += sale.quantity || 0;
    itemMap[itemName].totalAmount += sale.finalSalePrice || 0;
    itemMap[itemName].finalSalePrice += sale.finalSalePrice || 0;
    itemMap[itemName].netAmount += sale.finalSalePrice || 0;
  });

  // Convert map to array
  return Object.values(itemMap);
}

export default reportsApiService;
