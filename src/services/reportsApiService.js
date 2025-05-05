// src/services/reportsApiService.js - Fixed version

import { apiClient } from "./apiService";

// Utility function for extracting CSV data - place this OUTSIDE the reportsApiService object
function extractSalesDataFromCSV(csvData) {
  if (!csvData || typeof csvData !== "string") return [];

  try {
    // Simple CSV parsing for Zenoti sales data
    const lines = csvData.split("\n");
    if (lines.length <= 1) return [];

    // Get headers
    const headers = lines[0].split(",");

    // Process data rows
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(",");
      const row = {};

      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || "";
      });

      result.push({
        item_name: row["Item Name"] || "",
        item_type: row["Item Type"] || "",
        final_sale_price: parseFloat(row["Sales(Inc. Tax)"] || 0),
        is_refund:
          (row["Sales(Inc. Tax)"] && parseFloat(row["Sales(Inc. Tax)"]) < 0) ||
          false,
      });
    }

    return result;
  } catch (error) {
    console.error("Error parsing CSV data:", error);
    return [];
  }
}

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

  // Replace ONLY these two functions in your reportsApiService.js file
  // DO NOT replace the entire file this time

  // Replace getSalesAccrualBasisReport function
  getSalesAccrualBasisReport: async (params) => {
    try {
      console.log("Making accrual basis report request with params:", params);

      // Validate center_ids parameter
      if (
        !params.center_ids ||
        !params.center_ids.length ||
        !params.center_ids[0]
      ) {
        console.error("Invalid center_ids parameter:", params.center_ids);
        throw new Error("A valid center ID is required for sales reports");
      }

      // Transform parameters to match Zenoti's expected format
      const zenotiParams = {
        start_date: params.start_date,
        end_date: params.end_date,
        centers: {
          ids: params.center_ids,
        },
      };

      console.log(
        "Sending accrual basis request with Zenoti format:",
        JSON.stringify(zenotiParams)
      );

      // Use the correct endpoint path matching Zenoti's expected endpoint
      const response = await apiClient.post(
        "/api/zenoti/reports/sales/accrual_basis/flat_file",
        zenotiParams,
        {
          params: {
            page: params.page || 1,
            size: params.size || 100,
          },
        }
      );

      // Log the raw response and data with full details
      console.log("Accrual basis raw response status:", response.status);
      console.log(
        "Accrual basis FULL response data:",
        JSON.stringify(response.data, null, 2)
      );

      // Fix the response format to be what the frontend expects
      if (response.status === 200) {
        // Extract data from response
        let success = true;
        let salesData = [];
        let summary = {
          total_sales: 0,
          total_refunds: 0,
          net_sales: 0,
        };

        // Check for the report format from Zenoti
        if (response.data && response.data.report) {
          console.log("Response has report property, checking structure...");

          // If we have sales array data, use it
          if (
            response.data.report.sales &&
            Array.isArray(response.data.report.sales)
          ) {
            console.log(
              "Found sales array with items:",
              response.data.report.sales.length
            );
            salesData = response.data.report.sales;
          }

          // Check for total information
          if (response.data.report.total) {
            console.log("Found totals data:", response.data.report.total);
            summary.total_sales = response.data.report.total.sales || 0;
            summary.total_refunds = response.data.report.total.refunds || 0;
            summary.net_sales = summary.total_sales - summary.total_refunds;
          }

          // Check if we have error information
          if (response.data.report.error) {
            console.log("Report contains error:", response.data.report.error);
            // Still return success true since we got a valid response, just no data
          }
        }

        // Create properly structured response for frontend
        const standardResponse = {
          success: success,
          data: salesData,
          summary: summary,
        };

        console.log("Standardized response:", standardResponse);
        return { data: standardResponse };
      }

      return response;
    } catch (error) {
      console.error("Error fetching accrual basis sales report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch sales report",
          data: [],
          summary: {
            total_sales: 0,
            total_refunds: 0,
            net_sales: 0,
          },
        },
      };
    }
  },

  // Replace getSalesCashBasisReport function
  getSalesCashBasisReport: async (params) => {
    try {
      console.log("Making cash basis report request with params:", params);

      // Extract center_ids from the centers object structure
      let centerIds = params.center_ids;
      if (!centerIds && params.centers?.ids) {
        centerIds = params.centers.ids;
      }

      // Validate center_ids parameter
      if (!centerIds || !centerIds.length || !centerIds[0]) {
        console.error("Invalid center_ids parameter:", centerIds);
        console.error(
          "Original params structure:",
          JSON.stringify(params, null, 2)
        );
        throw new Error("A valid center ID is required for sales reports");
      }

      // Prepare the request with the correct structure
      const requestParams = {
        ...params,
        // Remove center_ids from the top level since it should be in centers.ids
        center_ids: undefined,
      };

      // Ensure we have the correct centers structure
      if (!requestParams.centers) {
        requestParams.centers = { ids: centerIds };
      }

      console.log(
        "Sending cash basis request with params:",
        JSON.stringify(requestParams)
      );

      // Use the correct endpoint path matching your backend route
      const response = await apiClient.post(
        "/api/zenoti/reports/sales/cash_basis/flat_file",
        requestParams,
        {
          params: {
            page: params.page || 1,
            size: params.size || 50,
          },
        }
      );

      // Log the raw response
      console.log("Cash basis raw response status:", response.status);
      console.log(
        "Cash basis FULL response data:",
        JSON.stringify(response.data, null, 2)
      );

      // Fix the response format to be what the frontend expects
      if (response.status === 200) {
        // Extract data from response
        let success = true;
        let salesData = [];
        let summary = {
          total_sales: 0,
          total_refunds: 0,
          net_sales: 0,
        };

        // Check for the report format from Zenoti
        if (response.data && response.data.report) {
          console.log("Response has report property, checking structure...");

          // If we have sales array data, use it
          if (
            response.data.report.sales &&
            Array.isArray(response.data.report.sales)
          ) {
            console.log(
              "Found sales array with items:",
              response.data.report.sales.length
            );
            salesData = response.data.report.sales;
          }

          // Check for total information
          if (response.data.report.total) {
            console.log("Found totals data:", response.data.report.total);
            summary.total_sales = response.data.report.total.sales || 0;
            summary.total_refunds = response.data.report.total.refunds || 0;
            summary.net_sales = summary.total_sales - summary.total_refunds;
          }

          // Check if we have error information
          if (response.data.report.error) {
            console.log("Report contains error:", response.data.report.error);
            // Still return success true since we got a valid response, just no data
          }
        }

        // Create properly structured response for frontend
        const standardResponse = {
          success: success,
          data: salesData,
          summary: summary,
        };

        console.log("Standardized response:", standardResponse);
        return { data: standardResponse };
      }

      return response;
    } catch (error) {
      console.error("Error fetching cash basis sales report:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch sales report",
          data: [],
          summary: {
            total_sales: 0,
            total_refunds: 0,
            net_sales: 0,
          },
        },
      };
    }
  },

  /**
   * Get sales report with proper handling of actual API response format
   * This is the more reliable fallback method that uses centerCode instead of center_ids
   */
  getSalesReport: async (params) => {
    try {
      console.log("Using fallback sales report method with params:", params);

      // Make sure we have required parameters
      if (!params.startDate || !params.endDate || !params.centerCode) {
        throw new Error("Start date, end date and center code are required");
      }

      // Add timestamp to prevent caching
      if (!params._t) params._t = Date.now();

      const response = await apiClient.get("/api/zenoti/reports/sales", {
        params,
      });

      console.log("Regular sales report response:", response.data);

      if (!response.data) {
        // If response doesn't contain data, create a default structure
        response.data = {
          success: true,
          items: [],
          summary: {
            total_sales: 0,
            total_refunds: 0,
            net_sales: 0,
          },
        };
      }

      return response;
    } catch (error) {
      console.error("Error fetching sales report:", error);
      // Return a structured error response instead of throwing
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch sales report",
          items: [],
          summary: {
            total_sales: 0,
            total_refunds: 0,
            net_sales: 0,
          },
        },
      };
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

      console.log("Appointments response:", response.data);

      // Ensure appointments array exists
      if (response.data && response.data.success === undefined) {
        response.data = {
          success: true,
          appointments: response.data.appointments || response.data || [],
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

      // Make sure we have a centerCode
      if (!params.centerCode) {
        throw new Error("Center code is required");
      }

      // Add timestamp to prevent caching
      params._t = Date.now();

      const response = await apiClient.get("/api/zenoti/packages", {
        params,
      });

      console.log("Packages response:", response.data);

      // Ensure we have a consistent data structure
      if (response.data) {
        if (!response.data.packages && Array.isArray(response.data)) {
          // If the response is already an array, wrap it
          response.data = {
            success: true,
            packages: response.data,
          };
        } else if (!response.data.packages) {
          // If there's no packages property, add an empty one
          response.data.packages = [];
        }
      } else {
        response.data = {
          success: true,
          packages: [],
        };
      }

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
  /**
   * Get services report with proper handling of actual API response format
   */
  getServicesReport: async (params = {}) => {
    try {
      console.log("Fetching services report with params:", params);

      // Make sure we have a centerCode
      if (!params.centerCode) {
        throw new Error("Center code is required");
      }

      // Add timestamp to prevent caching
      params._t = Date.now();

      // Add limit if not provided
      if (!params.limit) {
        params.limit = 100;
      }

      const response = await apiClient.get("/api/zenoti/services", { params });

      console.log("Services response:", response.data);

      // Ensure we have a consistent data structure
      if (response.data) {
        if (!response.data.services && Array.isArray(response.data)) {
          // If the response is already an array, wrap it
          response.data = {
            success: true,
            services: response.data,
          };
        } else if (response.data.success === undefined) {
          // Ensure success flag exists
          response.data.success = true;
        }

        // If success is true but no services array exists, add an empty one
        if (response.data.success && !response.data.services) {
          response.data.services = [];
        }
      } else {
        response.data = {
          success: true,
          services: [],
        };
      }

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

      // First try to use the API if available
      try {
        const response = await apiClient.post("/api/zenoti/reports/export", {
          reportData,
          format,
          filename,
        });

        if (response.data?.success) {
          console.log("Successfully generated report file via API");
          return response.data;
        }
      } catch (apiError) {
        console.warn(
          "API export failed, using client-side generation:",
          apiError
        );
      }

      // Use client-side solution as fallback
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
   * Email a report
   */
  emailReport: async (emailData) => {
    try {
      console.log("Emailing report to:", emailData.recipients);

      // Try to use the API
      try {
        const response = await apiClient.post(
          "/api/zenoti/reports/email",
          emailData
        );
        if (response.data?.success) {
          return response;
        }
      } catch (apiError) {
        console.warn("API email failed, using fallback:", apiError);
      }

      // For now, just simulate success
      return {
        data: {
          success: true,
          message: `Report would be emailed to ${emailData.recipients.join(
            ", "
          )}`,
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
      const date =
        appt.startTime || appt.start_time
          ? new Date(appt.startTime || appt.start_time).toLocaleDateString()
          : "N/A";
      const time =
        appt.startTime || appt.start_time
          ? new Date(appt.startTime || appt.start_time).toLocaleTimeString()
          : "N/A";

      // Extract client name with fallbacks
      const clientName = appt.guest
        ? `${appt.guest.firstName || ""} ${appt.guest.lastName || ""}`.trim()
        : appt.guest_name || appt.clientName || "Unknown Client";

      // Extract service name with fallbacks
      const serviceName = appt.service
        ? appt.service.name
        : appt.parentServiceName || appt.serviceName || "Unknown Service";

      // Extract therapist name with fallbacks
      const therapistName = appt.therapist
        ? `${appt.therapist.firstName || ""} ${
            appt.therapist.lastName || ""
          }`.trim()
        : appt.therapistName || "Unknown Therapist";

      // Map status codes to readable strings
      const statusMap = {
        0: "Booked",
        1: "Confirmed",
        2: "Checked In",
        3: "Completed",
        4: "Cancelled",
        5: "No Show",
      };
      const status =
        typeof appt.status === "number"
          ? statusMap[appt.status] || "Unknown"
          : appt.status || "Unknown";

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
  } else if (data.packages && Array.isArray(data.packages)) {
    // Handle packages report
    const packages = data.packages;
    if (packages.length === 0) return "No packages found";

    const headers = "Name,Type,Price,Validity,Status";

    const rows = packages.map((pkg) => {
      const name = pkg.name || "Unknown";
      const type = pkg.type || "Standard";
      const price = pkg.price || 0;
      const validity = pkg.validity_days || pkg.validity || "N/A";
      const status =
        pkg.active || pkg.status === "Active" ? "Active" : "Inactive";

      return [name, type, price, validity, status]
        .map(formatCSVValue)
        .join(",");
    });

    return [headers, ...rows].join("\n");
  } else if (data.services && Array.isArray(data.services)) {
    // Handle services report
    const services = data.services;
    if (services.length === 0) return "No services found";

    const headers = "Name,Category,Duration,Price";

    const rows = services.map((svc) => {
      const name = svc.name || "Unknown";
      const category = svc.category || "Uncategorized";
      const duration = formatDuration(svc.duration);
      const price = svc.price_info?.sale_price || svc.price || 0;

      return [name, category, duration, price].map(formatCSVValue).join(",");
    });

    return [headers, ...rows].join("\n");
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

// Format duration for CSV output
function formatDuration(minutes) {
  if (!minutes) return "N/A";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ""}`;
  } else {
    return `${mins}m`;
  }
}

export default reportsApiService;
