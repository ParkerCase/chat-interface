// src/services/zenotiService.js
// Updated to use Supabase Edge Functions instead of direct API calls

import { supabase } from "../lib/supabase";

/**
 * Enhanced service for handling all Zenoti-related API calls via Supabase Functions
 */
const zenotiService = {
  // Connection & Configuration
  checkConnectionStatus: async () => {
    try {
      console.log("Checking Zenoti connection status via Supabase...");

      // Call the debug endpoint to check configuration and connectivity
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: "debug-zenoti",
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      if (data?.success) {
        return {
          data: {
            success: true,
            status: "connected",
            details: data.config || {},
          },
        };
      } else {
        // Try the test-auth endpoint as fallback
        console.log("Trying auth test endpoint...");
        const authTest = await supabase.functions.invoke("zenoti-connector", {
          body: JSON.stringify({
            endpoint: "test-auth",
          }),
        });

        if (authTest.data?.success) {
          return {
            data: {
              success: true,
              status: "connected",
              details: {
                authMethod: authTest.data.authMethod,
              },
            },
          };
        }

        return {
          data: {
            success: false,
            status: "error",
            error: data?.error || "Unknown connection error",
          },
        };
      }
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
      console.log("Fetching Zenoti centers via Supabase...");

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: "centers",
            method: "GET",
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format response to match expected structure
      return {
        data: {
          success: data?.success || false,
          centers: data?.data?.centers || [],
          defaultCenter: data?.data?.defaultCenter || null,
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

      // Use the clients endpoint for searches
      let endpoint;
      let queryParams = {};

      if (params.query) {
        endpoint = "guests/search";
        queryParams = {
          q: params.query,
          limit: params.limit || 10,
          offset: params.offset || 0,
        };
      } else {
        // If no query, get recent clients
        endpoint = `centers/${params.centerCode}/guests`;
        queryParams = {
          limit: params.limit || 10,
          offset: params.offset || 0,
        };

        // Add sort parameter if provided
        if (params.sort) {
          if (params.sort === "last_visit") {
            queryParams.sort_by = "last_visit_date";
            queryParams.sort_order = "desc";
          } else {
            queryParams.sort_by = params.sort;
          }
        }
      }

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint,
            method: "GET",
            params: queryParams,
            centerCode: params.centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response to match expected client format
      const responseData = data?.data || {};
      const clients = responseData.guests || responseData.data || [];

      return {
        data: {
          success: data?.success || false,
          clients: formatClients(clients),
          totalCount: responseData.total_count || clients.length,
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

  // Get client details
  getClient: async (clientId, centerCode = null) => {
    try {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `guests/${clientId}`,
            method: "GET",
            centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const client = data?.data?.guest || data?.data;

      return {
        data: {
          success: data?.success || false,
          client: client ? formatClient(client) : null,
        },
      };
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

  // Create client
  createClient: async (clientData, centerCode) => {
    try {
      if (!centerCode) {
        throw new Error("Center code is required");
      }

      // Format the client data for Zenoti API
      const formattedData = {
        first_name: clientData.firstName || "",
        last_name: clientData.lastName,
        email: clientData.email || "",
        mobile: clientData.phone || clientData.mobile || "",
        gender: clientData.gender || "NA",
      };

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `centers/${centerCode}/guests`,
            method: "POST",
            body: formattedData,
            centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const newClient = data?.data?.guest || data?.data;

      return {
        data: {
          success: data?.success || false,
          client: newClient ? formatClient(newClient) : null,
        },
      };
    } catch (error) {
      console.error("Error creating Zenoti client:", error);
      return {
        data: {
          success: false,
          error: error.message || "Failed to create client",
        },
      };
    }
  },

  // Appointments
  getAppointments: async (params = {}) => {
    try {
      console.log("Getting Zenoti appointments with params:", params);

      if (!params.startDate || !params.endDate) {
        // Default to upcoming 2 weeks if not provided
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
          body: JSON.stringify({
            endpoint: `centers/${params.centerCode}/appointments`,
            method: "GET",
            params: queryParams,
            centerCode: params.centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const appointments = data?.data?.appointments || [];

      return {
        data: {
          success: data?.success || false,
          appointments: formatAppointments(appointments),
          totalCount: data?.data?.total_count || appointments.length,
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

  // Get appointment details
  getAppointmentDetails: async (appointmentId, centerCode = null) => {
    try {
      if (!appointmentId) {
        throw new Error("Appointment ID is required");
      }

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `appointments/${appointmentId}`,
            method: "GET",
            centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const appointment = data?.data?.appointment || data?.data;

      return {
        data: {
          success: data?.success || false,
          appointment: appointment ? formatAppointment(appointment) : null,
        },
      };
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

  // Services
  getServices: async (params = {}) => {
    try {
      console.log("Getting Zenoti services with params:", params);

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `centers/${params.centerCode}/services`,
            method: "GET",
            params: {
              limit: params.limit || 100,
              offset: params.offset || 0,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const services = data?.data?.services || [];

      return {
        data: {
          success: data?.success || false,
          services: formatServices(services),
          totalCount: data?.data?.total_count || services.length,
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

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `services/${serviceId}`,
            method: "GET",
            centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const service = data?.data?.service || data?.data;

      return {
        data: {
          success: data?.success || false,
          service: service ? formatService(service) : null,
        },
      };
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

  // Get packages
  getPackages: async (params = {}) => {
    try {
      console.log("Getting Zenoti packages with params:", params);

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `centers/${params.centerCode}/packages`,
            method: "GET",
            params: {
              limit: params.limit || 100,
              offset: params.offset || 0,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const packages = data?.data?.packages || [];

      return {
        data: {
          success: data?.success || false,
          packages: formatPackages(packages),
          totalCount: data?.data?.total_count || packages.length,
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

  // Staff
  getStaff: async (params = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: `centers/${params.centerCode}/therapists`,
            method: "GET",
            params: {
              limit: params.limit || 100,
              offset: params.offset || 0,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const therapists = data?.data?.therapists || [];

      return {
        data: {
          success: data?.success || false,
          therapists: formatTherapists(therapists),
          staff: formatTherapists(therapists), // For backward compatibility
          totalCount: data?.data?.total_count || therapists.length,
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

  // Sales Report
  getSalesReport: async (params) => {
    try {
      console.log("Getting sales report with params:", params);

      if (!params.startDate || !params.endDate) {
        throw new Error("Start date and end date are required");
      }

      // Format data for Zenoti API
      const formattedStartDate = `${params.startDate} 00:00:00`;
      const formattedEndDate = `${params.endDate} 23:59:59`;

      // Use the reports endpoint
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: JSON.stringify({
            endpoint: "reports/sales/accrual_basis/flat_file",
            method: "POST",
            body: {
              center_ids: [await getCenterIdFromCode(params.centerCode)],
              start_date: formattedStartDate,
              end_date: formattedEndDate,
            },
            centerCode: params.centerCode,
            requiresAuth: true,
          }),
        }
      );

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      // Format the response
      const salesData = data?.data?.report?.sales || [];
      const summary = data?.data?.report?.total || {};

      return {
        data: {
          success: data?.success || false,
          report: {
            summary: {
              total_sales: summary.sales || 0,
              total_refunds: summary.refunds || 0,
              net_sales: (summary.sales || 0) - (summary.refunds || 0),
            },
            items: formatSalesItems(salesData),
          },
        },
      };
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
};

/************ Helper functions ************/

// Format clients data consistently
function formatClients(clients) {
  if (!clients || !Array.isArray(clients)) return [];

  return clients.map(formatClient);
}

// Format a single client
function formatClient(client) {
  if (!client) return null;

  // Extract personal info
  const personalInfo = client.personal_info || client;

  return {
    id: client.id || client.guest_id,
    guest_id: client.guest_id || client.id,
    first_name: personalInfo.first_name || "",
    last_name: personalInfo.last_name || "",
    name: `${personalInfo.first_name || ""} ${
      personalInfo.last_name || ""
    }`.trim(),
    email: personalInfo.email || "",
    phone:
      personalInfo.mobile_phone?.number ||
      personalInfo.mobile ||
      personalInfo.phone ||
      "",
    mobile:
      personalInfo.mobile_phone?.number ||
      personalInfo.mobile ||
      personalInfo.phone ||
      "",
    lastContact: client.last_visit_date || null,
    center_code: client.center_code || "",
    centerCode: client.center_code || "",
    // Include raw data for debugging
    _raw: client,
  };
}

// Format appointments data consistently
function formatAppointments(appointments) {
  if (!appointments || !Array.isArray(appointments)) return [];

  return appointments.map(formatAppointment);
}

// Format a single appointment
function formatAppointment(appointment) {
  if (!appointment) return null;

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
    appointment_id: appointment.appointment_id || appointment.id,
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
    // Include raw data for debugging
    _raw: appointment,
  };
}

// Format services data consistently
function formatServices(services) {
  if (!services || !Array.isArray(services)) return [];

  return services.map(formatService);
}

// Format a single service
function formatService(service) {
  if (!service) return null;

  return {
    id: service.id,
    name: service.name || "Unknown Service",
    code: service.code,
    description: service.description || "",
    category: service.category || "Uncategorized",
    duration: service.duration,
    price: service.price || service.price_info?.price || 0,
    is_active: service.is_active !== false,
    // Include raw data for debugging
    _raw: service,
  };
}

// Format packages data consistently
function formatPackages(packages) {
  if (!packages || !Array.isArray(packages)) return [];

  return packages.map(formatPackage);
}

// Format a single package
function formatPackage(pkg) {
  if (!pkg) return null;

  return {
    id: pkg.id,
    name: pkg.name || "Unknown Package",
    code: pkg.code,
    description: pkg.description || "",
    type: pkg.type || "Standard",
    price: pkg.price || 0,
    validity_days: pkg.validity_days || 365,
    status: pkg.status || (pkg.is_active ? "Active" : "Inactive"),
    // Include raw data for debugging
    _raw: pkg,
  };
}

// Format therapists data consistently
function formatTherapists(therapists) {
  if (!therapists || !Array.isArray(therapists)) return [];

  return therapists.map(formatTherapist);
}

// Format a single therapist
function formatTherapist(therapist) {
  if (!therapist) return null;

  return {
    id: therapist.id,
    first_name: therapist.first_name || "",
    last_name: therapist.last_name || "",
    name: `${therapist.first_name || ""} ${therapist.last_name || ""}`.trim(),
    designation: therapist.designation || "",
    expertise: therapist.expertise || [],
    is_active: therapist.is_active !== false,
    // Include raw data for debugging
    _raw: therapist,
  };
}

// Format sales items consistently
function formatSalesItems(items) {
  if (!items || !Array.isArray(items)) return [];

  return items.map((item) => ({
    name: item.item_name || "Unknown",
    type: item.item_type || "Unknown",
    quantity: item.qty || 1,
    totalAmount: item.sales_inc_tax || 0,
    saleDate: item.sale_date || new Date().toISOString().split("T")[0],
    paymentType: item.payment_type || "Unknown",
    guest: {
      name: item.guest_name || "Unknown",
      code: item.guest_code || "",
    },
    // Include raw data
    _raw: item,
  }));
}

// Helper function to get center ID from center code
async function getCenterIdFromCode(centerCode) {
  if (!centerCode) return null;

  // Hardcoded center ID mapping - same as in your Supabase functions
  const CENTER_ID_MAP = {
    AUS: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
    CHI: "c359afac-3210-49e5-a930-6676d8bb188a",
    CW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7",
    Draper: "5da78932-c7e1-48b2-a099-9c302c75d7e1",
    HTN: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12",
    DEFAULT: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
  };

  // Use the hardcoded mapping
  return CENTER_ID_MAP[centerCode] || CENTER_ID_MAP.DEFAULT;
}

export default zenotiService;
