// src/services/supabaseReportsService.js
import { supabase } from "../lib/supabase";

/**
 * Service to handle all Zenoti reports via Supabase Functions
 */
const supabaseReportsService = {
  /**
   * Get sales accrual basis report
   * @param {Object} params - Report parameters 
   * @param {string} params.startDate - Start date YYYY-MM-DD
   * @param {string} params.endDate - End date YYYY-MM-DD
   * @param {string} params.centerCode - Center code (e.g., AUS)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.size - Page size for pagination
   */
  getSalesAccrualReport: async (params = {}) => {
    try {
      // Add report type to the params
      const reportParams = {
        ...params,
        reportType: 'accrual_basis'
      };
      
      const { data, error } = await supabase.functions.invoke('zenoti-reports', {
        body: reportParams
      });
      
      if (error) throw error;
      
      return { data };
    } catch (error) {
      console.error('Error fetching accrual basis report:', error);
      return {
        data: {
          success: false,
          error: error.message || 'Failed to fetch accrual basis report',
          data: [],
          summary: {
            total_sales: 0,
            total_refunds: 0,
            net_sales: 0
          }
        }
      };
    }
  },
  
  /**
   * Get sales cash basis report
   * @param {Object} params - Report parameters
   * @param {string} params.startDate - Start date YYYY-MM-DD
   * @param {string} params.endDate - End date YYYY-MM-DD
   * @param {string} params.centerCode - Center code (e.g., AUS)
   * @param {Array} params.itemTypes - Item type filters
   * @param {Array} params.paymentTypes - Payment type filters
   * @param {Array} params.saleTypes - Sale type filters
   * @param {number} params.page - Page number for pagination
   * @param {number} params.size - Page size for pagination
   */
  getSalesCashReport: async (params = {}) => {
    try {
      // Add report type to the params
      const reportParams = {
        ...params,
        reportType: 'cash_basis'
      };
      
      const { data, error } = await supabase.functions.invoke('zenoti-reports', {
        body: reportParams
      });
      
      if (error) throw error;
      
      return { data };
    } catch (error) {
      console.error('Error fetching cash basis report:', error);
      return {
        data: {
          success: false,
          error: error.message || 'Failed to fetch cash basis report',
          data: [],
          summary: {
            total_sales: 0,
            total_refunds: 0,
            net_sales: 0
          }
        }
      };
    }
  },
  
  /**
   * Get appointments report
   * @param {Object} params - Report parameters
   * @param {string} params.startDate - Start date YYYY-MM-DD
   * @param {string} params.endDate - End date YYYY-MM-DD
   * @param {string} params.centerCode - Center code (e.g., AUS)
   * @param {string} params.status - Filter by appointment status
   * @param {string} params.therapistId - Filter by therapist
   */
  getAppointmentsReport: async (params = {}) => {
    try {
      // Add report type to the params
      const reportParams = {
        ...params,
        reportType: 'appointments'
      };
      
      const { data, error } = await supabase.functions.invoke('zenoti-reports', {
        body: reportParams
      });
      
      if (error) throw error;
      
      return { data };
    } catch (error) {
      console.error('Error fetching appointments report:', error);
      return {
        data: {
          success: false,
          error: error.message || 'Failed to fetch appointments report',
          appointments: []
        }
      };
    }
  },
  
  /**
   * Get services report
   * @param {Object} params - Report parameters
   * @param {string} params.centerCode - Center code (e.g., AUS)
   * @param {string} params.serviceId - Specific service ID (optional)
   */
  getServicesReport: async (params = {}) => {
    try {
      // Add report type to the params
      const reportParams = {
        ...params,
        reportType: 'services'
      };
      
      const { data, error } = await supabase.functions.invoke('zenoti-reports', {
        body: reportParams
      });
      
      if (error) throw error;
      
      return { data };
    } catch (error) {
      console.error('Error fetching services report:', error);
      return {
        data: {
          success: false,
          error: error.message || 'Failed to fetch services report',
          services: []
        }
      };
    }
  },
  
  /**
   * Get packages report
   * @param {Object} params - Report parameters
   * @param {string} params.centerCode - Center code (e.g., AUS)
   */
  getPackagesReport: async (params = {}) => {
    try {
      // Add report type to the params
      const reportParams = {
        ...params,
        reportType: 'packages'
      };
      
      const { data, error } = await supabase.functions.invoke('zenoti-reports', {
        body: reportParams
      });
      
      if (error) throw error;
      
      return { data };
    } catch (error) {
      console.error('Error fetching packages report:', error);
      return {
        data: {
          success: false,
          error: error.message || 'Failed to fetch packages report',
          packages: []
        }
      };
    }
  },
  
  /**
   * Export report to file (CSV or JSON)
   * @param {Object} reportData - The report data to export
   * @param {string} format - The export format (csv or json)
   * @param {string} filename - The filename for the exported file
   */
  exportReport: async (reportData, format = 'csv', filename) => {
    try {
      // Format the data for export
      const formattedData = formatForExport(reportData, format);
      
      // Create download link
      const blob = new Blob([formattedData], { 
        type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return { success: true, message: `Report exported as ${format.toUpperCase()}` };
    } catch (error) {
      console.error('Error exporting report:', error);
      return { success: false, error: `Failed to export report: ${error.message}` };
    }
  }
};

/**
 * Helper functions
 */

// Format data for export
function formatForExport(reportData, format) {
  if (format === 'json') {
    return JSON.stringify(reportData, null, 2);
  }
  
  // CSV format
  const data = reportData.data || reportData.packages || reportData.services || reportData.appointments || [];
  if (!data || data.length === 0) {
    return 'No data available';
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]).join(',');
  
  // Build rows
  const rows = data.map(item => {
    return Object.values(item).map(formatCSVValue).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

// Format values for CSV to handle commas and quotes
function formatCSVValue(value) {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // If contains commas, quotes or newlines, wrap in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

export default supabaseReportsService;
