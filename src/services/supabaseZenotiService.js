// src/services/supabaseZenotiService.js
import { supabase } from "../lib/supabase";

/**
 * Service to handle all Zenoti-related operations via Supabase Edge Functions
 */
const supabaseZenotiService = {
  // Connection & Configuration
  checkConnectionStatus: async () => {
    try {
      console.log("Checking Zenoti connection status...");

      // Call the Supabase function to debug Zenoti environment and connectivity
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: { endpoint: "debug-zenoti" },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        return {
          data: {
            success: true,
            status: "connected",
            details: {
              config: data.config,
              timestamp: data.timestamp,
              auth: data.auth,
            },
          },
        };
      }

      // If we couldn't establish connection using the debug endpoint,
      // try just checking if auth works
      try {
        const authTest = await supabase.functions.invoke("zenoti-connector", {
          body: { endpoint: "test-auth" },
        });

        if (authTest.data?.success) {
          return {
            data: {
              success: true,
              status: "connected",
              details: {
                authMethod: authTest.data.authMethod,
                tokenAvailable: authTest.data.tokenAvailable,
              },
            },
          };
        }
      } catch (authError) {
        console.warn("Auth test failed:", authError);
      }

      return {
        data: {
          success: false,
          status: data?.status || "error",
          error: data?.error || "Failed to connect to Zenoti",
        },
      };
    } catch (error) {
      console.error("Error checking Zenoti connection:", error);
      return {
        data: {
          success: false,
          status: "error",
          errorType: error.name || "connection",
          message: "Connection error: " + (error.message || "Unknown error"),
        },
      };
    }
  },

  // Centers
  getCenters: async () => {
    try {
      console.log("Fetching Zenoti centers");

      // Call the connector function through Supabase
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: {
            endpoint: "centers",
            method: "GET",
            requiresAuth: true,
          },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        const centers = data.data?.centers || [];

        return {
          data: {
            success: true,
            centers: centers.map((center) => ({
              id: center.id,
              code: center.code,
              name: center.name,
              ...center, // Preserve other properties
            })),
            defaultCenter: centers.length > 0 ? centers[0].code : null,
          },
        };
      }

      // If fetch failed but got a response
      return {
        data: {
          success: false,
          error: data?.error || "Failed to fetch centers from Zenoti",
          centers: [],
        },
      };
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

      const endpoint = params.query
        ? "guests/search"
        : `centers/${params.centerCode}/guests`;

      const queryParams = {
        limit: params.limit || 10,
        offset: params.offset || 0,
      };

      // Add query param if searching
      if (params.query) {
        queryParams.q = params.query;
      }

      // Add sort if provided
      if (params.sort) {
        if (params.sort === "last_visit") {
          queryParams.sort_by = "last_visit_date";
          queryParams.sort_order = "desc";
        } else {
          queryParams.sort_by = params.sort;
        }
      }

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: {
            endpoint,
            method: "GET",
            params: queryParams,
            centerCode: params.centerCode,
            requiresAuth: true,
          },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        // Extract clients data based on response format
        const responseData = data.data || {};
        let clients = [];

        if (responseData.guests) {
          clients = responseData.guests;
        } else if (responseData.data) {
          clients = responseData.data;
        } else if (Array.isArray(responseData)) {
          clients = responseData;
        }

        // Format client data consistently
        const formattedClients = clients.map((client) => {
          // Extract personal info
          const personalInfo = client.personal_info || client;

          return {
            id: client.id || client.guest_id,
            name: `${personalInfo.first_name || ""} ${
              personalInfo.last_name || ""
            }`.trim(),
            email: personalInfo.email || "",
            phone:
              personalInfo.mobile_phone?.number ||
              personalInfo.mobile ||
              personalInfo.phone ||
              "",
            lastContact: client.last_visit_date || null,
            centerCode: client.center_code || params.centerCode,
            // Include original data for debugging
            _raw: client,
          };
        });

        return {
          data: {
            success: true,
            clients: formattedClients,
            totalCount: responseData.total_count || formattedClients.length,
          },
        };
      }

      return {
        data: {
          success: false,
          error: data?.error || "Failed to search clients",
          clients: [],
        },
      };
    } catch (error) {
      console.error("Error searching Zenoti clients:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to search clients",
          clients: [],
        },
      };
    }
  },

  // Appointments
  getAppointments: async (params = {}) => {
    try {
      console.log("Getting Zenoti appointments with params:", params);

      // Validate and set default date range
      if (!params.startDate || !params.endDate) {
        const today = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(today.getDate() + 14);

        params.startDate =
          params.startDate || today.toISOString().split("T")[0];
        params.endDate =
          params.endDate || twoWeeksLater.toISOString().split("T")[0];
      }

      const queryParams = {
        from_date: params.startDate,
        to_date: params.endDate,
        limit: params.limit || 100,
        offset: params.offset || 0,
      };

      // Add status filter if provided
      if (params.status) {
        queryParams.status = params.status;
      }

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: {
            endpoint: `centers/${params.centerCode}/appointments`,
            method: "GET",
            params: queryParams,
            centerCode: params.centerCode,
            requiresAuth: true,
          },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        // Extract appointments
        const responseData = data.data || {};
        const appointments = responseData.appointments || [];

        // Format appointments
        const formattedAppointments = appointments.map((appointment) => {
          // Get service name from either blockout or service property
          const serviceName = appointment.blockout
            ? appointment.blockout.name
            : appointment.service
            ? appointment.service.name
            : appointment.service_name || "Admin Time";

          // Handle client name when guest is null
          const clientName = appointment.guest
            ? `${appointment.guest.first_name || ""} ${
                appointment.guest.last_name || ""
              }`.trim()
            : appointment.client_name || "No Client";

          return {
            id: appointment.appointment_id || appointment.id,
            service_name: serviceName,
            client_name: clientName,
            start_time: appointment.start_time || appointment.startTime,
            end_time: appointment.end_time || appointment.endTime,
            duration: appointment.blockout
              ? appointment.blockout.duration
              : appointment.service
              ? appointment.service.duration
              : appointment.duration || 60,
            status: appointment.status,
            notes: appointment.notes || "",
            therapist: appointment.therapist
              ? `${appointment.therapist.first_name || ""} ${
                  appointment.therapist.last_name || ""
                }`.trim()
              : appointment.provider_name || "Unassigned",
            guest: appointment.guest || null,
            center: appointment.center || null,
          };
        });

        return {
          data: {
            success: true,
            appointments: formattedAppointments,
            totalCount:
              responseData.total_count || formattedAppointments.length,
          },
        };
      }

      return {
        data: {
          success: false,
          error: data?.error || "Failed to fetch appointments",
          appointments: [],
        },
      };
    } catch (error) {
      console.error("Error getting Zenoti appointments:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to fetch appointments",
          appointments: [],
        },
      };
    }
  },

  // Services
  getServices: async (params = {}) => {
    try {
      console.log("Getting Zenoti services with params:", params);

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: {
            endpoint: `centers/${params.centerCode}/services`,
            method: "GET",
            params: {
              limit: params.limit || 100,
              offset: params.offset || 0,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        // Extract services data
        const responseData = data.data || {};
        const services = responseData.services || [];

        // Format services data
        const formattedServices = services.map((service) => ({
          id: service.id,
          name: service.name || "Unknown Service",
          description: service.description || "",
          duration: service.duration,
          price: service.price || service.price_info?.price || 0,
          category: service.category || "Uncategorized",
          is_active: service.is_active !== false,
        }));

        return {
          data: {
            success: true,
            services: formattedServices,
            totalCount: responseData.total_count || formattedServices.length,
          },
        };
      }

      return {
        data: {
          success: false,
          error: data?.error || "Failed to get services",
          services: [],
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

  // Staff
  getStaff: async (params = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: {
            endpoint: `centers/${params.centerCode}/therapists`,
            method: "GET",
            params: {
              limit: params.limit || 100,
              offset: params.offset || 0,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        // Extract therapists data
        const responseData = data.data || {};
        const therapists = responseData.therapists || [];

        // Format therapists data
        const formattedTherapists = therapists.map((therapist) => ({
          id: therapist.id,
          name: `${therapist.first_name || ""} ${
            therapist.last_name || ""
          }`.trim(),
          first_name: therapist.first_name || "",
          last_name: therapist.last_name || "",
          designation: therapist.designation || "",
          expertise: therapist.expertise || [],
          is_active: therapist.is_active !== false,
        }));

        return {
          data: {
            success: true,
            therapists: formattedTherapists,
            staff: formattedTherapists, // For backward compatibility
            totalCount: responseData.total_count || formattedTherapists.length,
          },
        };
      }

      return {
        data: {
          success: false,
          error: data?.error || "Failed to get staff",
          therapists: [],
          staff: [],
        },
      };
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

  // Get packages
  getPackages: async (params = {}) => {
    try {
      console.log("Getting Zenoti packages with params:", params);

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: {
            endpoint: `centers/${params.centerCode}/packages`,
            method: "GET",
            params: {
              limit: params.limit || 100,
              offset: params.offset || 0,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          },
        }
      );

      if (error) {
        console.error("Supabase function invocation error:", error);
        throw error;
      }

      if (data?.success) {
        // Extract packages data
        const responseData = data.data || {};
        const packages = responseData.packages || [];

        // Format packages data
        const formattedPackages = packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name || "Unknown Package",
          description: pkg.description || "",
          type: pkg.type || "Standard",
          price: pkg.price || 0,
          validity_days: pkg.validity_days || 365,
          status: pkg.status || (pkg.is_active ? "Active" : "Inactive"),
        }));

        return {
          data: {
            success: true,
            packages: formattedPackages,
            totalCount: responseData.total_count || formattedPackages.length,
          },
        };
      }

      return {
        data: {
          success: false,
          error: data?.error || "Failed to get packages",
          packages: [],
        },
      };
    } catch (error) {
      console.error("Error getting packages:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to get packages",
          packages: [],
        },
      };
    }
  },

  // Add more methods as needed...
};

export default supabaseZenotiService;
