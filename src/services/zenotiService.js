// src/services/zenotiService.js
import apiService from "./apiService";

/**
 * Service to handle all Zenoti-related API calls
 */
const zenotiService = {
  /**
   * Check connection status with Zenoti
   * @returns {Promise} Connection status result
   */
  checkConnectionStatus: async () => {
    try {
      return await apiService.zenoti.checkConnectionStatus();
    } catch (error) {
      console.error("Error checking Zenoti connection:", error);
      throw error;
    }
  },

  /**
   * Get all Zenoti centers
   * @returns {Promise} Centers information
   */
  getCenters: async () => {
    try {
      return await apiService.zenoti.getCenters();
    } catch (error) {
      console.error("Error getting Zenoti centers:", error);
      throw error;
    }
  },

  /**
   * Search for clients in Zenoti
   * @param {Object} params Search parameters
   * @returns {Promise} Client search results
   */
  // In your client search function
  searchClients: async (params = {}) => {
    try {
      // Start with just the default center, not all centers
      const searchParams = {
        ...params,
        limit: 20, // Limit results
        allCenters: false, // Force single center initially
      };

      return await apiService.zenoti.searchClients(searchParams);
    } catch (error) {
      console.error("Error searching Zenoti clients:", error);
      throw error;
    }
  },

  /**
   * Get client details from Zenoti
   * @param {string} clientId Client ID
   * @param {string} centerCode Optional center code
   * @returns {Promise} Client details
   */
  getClientDetails: async (clientId, centerCode) => {
    try {
      return await apiService.zenoti.getClient(clientId);
    } catch (error) {
      console.error("Error getting Zenoti client details:", error);
      throw error;
    }
  },

  /**
   * Create a new client in Zenoti
   * @param {Object} clientData Client data
   * @param {string} centerCode Center code
   * @returns {Promise} Created client data
   */
  createClient: async (clientData, centerCode) => {
    try {
      return await apiService.zenoti.createClient(clientData, centerCode);
    } catch (error) {
      console.error("Error creating Zenoti client:", error);
      throw error;
    }
  },

  /**
   * Get client history from Zenoti
   * @param {string} clientId Client ID
   * @param {Object} params Optional parameters
   * @returns {Promise} Client history data
   */
  getClientHistory: async (clientId, params = {}) => {
    try {
      return await apiService.zenoti.getClientHistory(clientId);
    } catch (error) {
      console.error("Error getting Zenoti client history:", error);
      throw error;
    }
  },

  /**
   * Get appointments from Zenoti
   * @param {Object} params Search parameters
   * @returns {Promise} Appointment data
   */
  getAppointments: async (params) => {
    try {
      return await apiService.zenoti.getAppointments(params);
    } catch (error) {
      console.error("Error getting Zenoti appointments:", error);
      throw error;
    }
  },

  /**
   * Get appointment details from Zenoti
   * @param {string} appointmentId Appointment ID
   * @returns {Promise} Appointment details
   */
  getAppointmentDetails: async (appointmentId) => {
    try {
      return await apiService.zenoti.getAppointment(appointmentId);
    } catch (error) {
      console.error("Error getting Zenoti appointment details:", error);
      throw error;
    }
  },

  /**
   * Book a new appointment in Zenoti
   * @param {Object} appointmentData Appointment data
   * @param {string} centerCode Center code
   * @returns {Promise} Booked appointment data
   */
  bookAppointment: async (appointmentData, centerCode) => {
    try {
      return await apiService.zenoti.createAppointment(
        appointmentData,
        centerCode
      );
    } catch (error) {
      console.error("Error booking Zenoti appointment:", error);
      throw error;
    }
  },

  /**
   * Get staff availability from Zenoti
   * @param {Object} params Search parameters
   * @returns {Promise} Availability data
   */
  getAvailability: async (params) => {
    try {
      return await apiService.zenoti.getAvailability(params);
    } catch (error) {
      console.error("Error getting Zenoti availability:", error);
      throw error;
    }
  },

  /**
   * Get services from Zenoti
   * @param {Object} params Optional parameters
   * @returns {Promise} Services data
   */
  getServices: async (params = {}) => {
    try {
      return await apiService.zenoti.getServices(params);
    } catch (error) {
      console.error("Error getting Zenoti services:", error);
      throw error;
    }
  },

  /**
   * Get staff from Zenoti
   * @param {Object} params Optional parameters
   * @returns {Promise} Staff data
   */
  getStaff: async (params = {}) => {
    try {
      return await apiService.zenoti.getStaff(params);
    } catch (error) {
      console.error("Error getting Zenoti staff:", error);
      throw error;
    }
  },

  /**
   * Generate a weekly business report
   * @param {Object} params Report parameters
   * @returns {Promise} Report data
   */
  generateWeeklyReport: async (params) => {
    try {
      return await apiService.zenoti.getWeeklyBusinessReport(params);
    } catch (error) {
      console.error("Error generating Zenoti weekly report:", error);
      throw error;
    }
  },
};

export default zenotiService;
