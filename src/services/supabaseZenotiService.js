// src/services/supabaseZenotiService.js
import { supabase } from "../lib/supabase";

/**
 * Service to handle all Zenoti-related operations via Supabase Functions
 */
const supabaseZenotiService = {
  // Connection & Configuration
  checkConnectionStatus: async () => {
    try {
      console.log("Checking Zenoti connection status...");

      // Call the Supabase Function for configuration
      const { data, error } = await supabase.functions.invoke("zenoti-config", {
        body: { action: "get" },
      });

      if (error) throw error;

      // If config exists, try to get centers to verify connection
      if (data.exists && data.config) {
        try {
          const { data: centersData, error: centersError } = await supabase.functions.invoke("zenoti-clients", {
            method: "GET",
            queryParams: { 
              centerCode: data.config.defaultCenterCode || "AUS",
              limit: 1
            }
          });

          if (!centersError) {
            return {
              data: {
                success: true,
                status: "connected",
                details: {
                  apiUrl: data.config.apiUrl,
                  username: data.config.username,
                  defaultCenterCode: data.config.defaultCenterCode,
                  lastSync: new Date().toISOString()
                }
              }
            };
          }
        } catch (centersError) {
          console.warn("Centers check failed:", centersError);
        }
      }

      return {
        data: {
          success: !!data.exists,
          status: data.exists ? "configured" : "not_configured",
          details: data.config || null
        }
      };
    } catch (error) {
      console.error("Error checking Zenoti connection:", error);
      return {
        data: {
          success: false,
          status: "error",
          errorType: error.name || "connection",
          message: "Connection error: " + (error.message || "Unknown error"),
        }
      };
    }
  },

  saveConfiguration: async (config) => {
    try {
      const { data, error } = await supabase.functions.invoke("zenoti-config", {
        body: { 
          action: "set",
          config 
        }
      });

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error("Error saving Zenoti config:", error);
      throw error;
    }
  },

  testConnection: async (config) => {
    try {
      const { data, error } = await supabase.functions.invoke("zenoti-config", {
        body: { 
          action: "test",
          config 
        }
      });

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error("Error testing Zenoti connection:", error);
      throw error;
    }
  },

  // Centers
  getCenters: async () => {
    try {
      console.log("Fetching Zenoti centers");
      
      // First try to get from cache
      const { data: cachedCenters, error: cacheError } = await supabase
        .from("zenoti_centers")
        .select("center_id, center_code, name, details, active")
        .eq("active", true)
        .order("name");
      
      // If we have cached centers and no error, return them
      if (!cacheError && cachedCenters && cachedCenters.length > 0) {
        return {
          data: {
            success: true,
            centers: cachedCenters.map(center => ({
              id: center.center_id,
              code: center.center_code,
              name: center.name,
              ...center.details
            })),
            source: "cache"
          }
        };
      }
      
      // Otherwise, fetch from Zenoti API
      const { data, error } = await supabase.functions.invoke("zenoti-connector", {
        body: {
          endpoint: "centers",
          method: "GET"
        }
      });

      if (error) throw error;

      if (data.success && data.data.centers) {
        // Also update our cache
        const centersToCache = data.data.centers.map(center => ({
          center_id: center.id,
          center_code: center.code,
          name: center.name,
          details: center,
          active: true
        }));

        // Upsert centers to cache
        const { error: upsertError } = await supabase
          .from("zenoti_centers")
          .upsert(centersToCache, { 
            onConflict: "center_code",
            returning: "minimal" 
          });

        if (upsertError) {
          console.warn("Failed to update centers cache:", upsertError);
        }

        return {
          data: {
            success: true,
            centers: data.data.centers,
            source: "api"
          }
        };
      }

      // If we get here, something went wrong
      return {
        data: {
          success: false,
          centers: [],
          error: "Failed to fetch centers"
        }
      };
    } catch (error) {
      console.error("Error getting Zenoti centers:", error);
      // Return a formatted error response instead of throwing
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch centers",
          centers: [], // Include empty centers array for graceful handling
        }
      };
    }
  },

  // Clients/Contacts
  searchClients: async (params = {}) => {
    try {
      console.log("Searching Zenoti clients with params:", params);
      
      const { data, error } = await supabase.functions.invoke("zenoti-clients", {
        method: "GET",
        queryParams: params
      });

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error("Error searching Zenoti clients:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to search clients",
          clients: []
        }
      };
    }
  },

  // Appointments
  getAppointments: async (params = {}) => {
    try {
      console.log("Getting Zenoti appointments with params:", params);
      
      const { data, error } = await supabase.functions.invoke("zenoti-appointments", {
        method: "GET",
        queryParams: params
      });

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error("Error getting Zenoti appointments:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch appointments",
          appointments: []
        }
      };
    }
  },

  // Services
  getServices: async (params = {}) => {
    try {
      console.log("Getting Zenoti services with params:", params);
      
      const { data, error } = await supabase.functions.invoke("zenoti-services", {
        method: "GET",
        queryParams: params
      });

      if (error) throw error;

      return { data: {
        success: true,
        services: data.services || []
      }};
    } catch (error) {
      console.error("Error getting services:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get services",
          services: []
        }
      };
    }
  },

  // Add more methods for other Zenoti operations
  // These would be implementations of the same methods from the original zenotiService.js
  // but using Supabase Functions instead of direct API calls

  // Generic method to call any Zenoti endpoint via the connector
  callZenotiApi: async (endpoint, method = "GET", params = {}, body = null) => {
    try {
      const { data, error } = await supabase.functions.invoke("zenoti-connector", {
        body: {
          endpoint,
          method,
          params,
          body
        }
      });

      if (error) throw error;

      return { data };
    } catch (error) {
      console.error(`Error calling Zenoti API (${endpoint}):`, error);
      return {
        data: {
          success: false,
          error: error.message || `Failed to call Zenoti API (${endpoint})`,
        }
      };
    }
  }
};

export default supabaseZenotiService;
