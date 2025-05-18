// supabase/functions/zenoti-connector/index.ts

import { corsHeaders } from '../_shared/cors.ts';

// Zenoti API configuration
interface ZenotiConfig {
  apiUrl: string; 
  apiKey?: string;
  username?: string;
  password?: string;
  useOAuth?: boolean;
  appId?: string;
  apiSecret?: string;
  defaultCenterCode?: string;
}

// Type definitions for request handlers
interface ZenotiRequest {
  endpoint: string;
  method?: string;
  params?: Record<string, any>;
  body?: any;
  centerCode?: string;
  requiresAuth?: boolean;
}

// Set to true to use mock data instead of real API calls
const TEST_MODE = true;

// Hardcoded center ID mapping - used for specific Zenoti endpoints that require UUIDs
const CENTER_ID_MAP: Record<string, string> = {
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

// Create a cache to store auth tokens
const TOKEN_CACHE: Record<string, { token: string; expires: number }> = {};

// Get configuration from environment variables
const getConfigFromEnv = (): ZenotiConfig => {
  console.log("Reading Zenoti config from environment variables");
  return {
    apiUrl: Deno.env.get("ZENOTI_API_URL") || "https://api.zenoti.com/v1",
    apiKey: Deno.env.get("ZENOTI_API_KEY"),
    apiSecret: Deno.env.get("ZENOTI_API_SECRET"),
    appId: Deno.env.get("ZENOTI_APP_ID"),
    username: Deno.env.get("ZENOTI_USERNAME"),
    password: Deno.env.get("ZENOTI_PASSWORD"),
    useOAuth: Deno.env.get("ZENOTI_USE_OAUTH") === "true",
    defaultCenterCode: Deno.env.get("ZENOTI_DEFAULT_CENTER_CODE") || "AUS"
  };
};

// Helper function to generate mock data
const getMockData = (endpoint: string) => {
  console.log(`Generating mock data for endpoint: ${endpoint}`);
  
  // Centers endpoint
  if (endpoint.startsWith("centers") || endpoint === "centers") {
    return {
      centers: [
        { id: "ca3dc432-280b-4cdb-86ea-6e582f3182a9", code: "AUS", name: "Austin Center" },
        { id: "c359afac-3210-49e5-a930-6676d8bb188a", code: "CHI", name: "Chicago Center" },
        { id: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7", code: "CW", name: "CW Center" },
        { id: "5da78932-c7e1-48b2-a099-9c302c75d7e1", code: "Draper", name: "Draper Center" },
        { id: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12", code: "HTN", name: "HTN Center" },
        { id: "8ae56789-f213-4cd7-9e34-10a2bc45d678", code: "Houston", name: "Houston Center" }
      ]
    };
  }
  
  // Clients/Guests endpoint
  if (endpoint.includes("guests/search") || endpoint.includes("clients")) {
    return {
      clients: [
        { 
          id: "client1", 
          guest_id: "client1",
          first_name: "John", 
          last_name: "Doe", 
          email: "john.doe@example.com", 
          mobile: "555-123-4567",
          last_visit_date: new Date(Date.now() - 86400000).toISOString(),
          center_code: "AUS"
        },
        { 
          id: "client2", 
          guest_id: "client2",
          first_name: "Jane", 
          last_name: "Smith", 
          email: "jane.smith@example.com", 
          mobile: "555-987-6543",
          last_visit_date: new Date(Date.now() - 172800000).toISOString(),
          center_code: "CHI"
        },
        { 
          id: "client3", 
          guest_id: "client3",
          first_name: "Robert", 
          last_name: "Johnson", 
          email: "robert.johnson@example.com", 
          mobile: "555-456-7890",
          last_visit_date: new Date(Date.now() - 259200000).toISOString(),
          center_code: "CW"
        }
      ],
      total_count: 3
    };
  }
  
  // Services endpoint
  if (endpoint.includes("services")) {
    if (endpoint.match(/services\/[\w\d-]+$/)) {
      // Single service details
      return {
        service: {
          id: endpoint.split('/').pop(),
          name: "Test Service",
          description: "This is a test service description",
          duration: 60,
          price: 100,
          category: "Test Category",
          is_active: true
        }
      };
    }
    
    return {
      services: [
        {
          id: "service1",
          name: "Tatt2Away Session",
          description: "Non-laser tattoo removal session",
          duration: 60,
          price: 199.99,
          category: "Tattoo Removal",
          is_active: true
        },
        {
          id: "service2",
          name: "Consultation",
          description: "Initial consultation for tattoo removal",
          duration: 30,
          price: 0,
          category: "Consultation",
          is_active: true
        },
        {
          id: "service3",
          name: "Touch-up Session",
          description: "Follow-up treatment session",
          duration: 45,
          price: 149.99,
          category: "Tattoo Removal",
          is_active: true
        }
      ]
    };
  }
  
  // Appointments endpoint
  if (endpoint.includes("appointments")) {
    // Check if it's a specific appointment
    if (endpoint.match(/appointments\/[\w\d-]+$/)) {
      // Single appointment details
      return {
        appointment: {
          id: endpoint.split('/').pop(),
          appointment_id: endpoint.split('/').pop(),
          service_name: "Tatt2Away Session",
          client_name: "John Doe",
          start_time: new Date(Date.now() + 86400000).toISOString(),
          end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
          duration: 60,
          status: "Confirmed",
          notes: "Test appointment notes",
          therapist: "Jane Smith",
          guest: {
            id: "client1",
            first_name: "John",
            last_name: "Doe"
          },
          center: {
            id: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
            code: "AUS"
          }
        }
      };
    }
    
    return {
      appointments: [
        {
          id: "appointment1",
          appointment_id: "appointment1",
          service_name: "Tatt2Away Session",
          client_name: "John Doe",
          start_time: new Date(Date.now() + 86400000).toISOString(),
          end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
          duration: 60,
          status: "Confirmed",
          notes: "First session",
          therapist: "Jane Smith"
        },
        {
          id: "appointment2",
          appointment_id: "appointment2",
          service_name: "Consultation",
          client_name: "Jane Smith",
          start_time: new Date(Date.now() + 172800000).toISOString(),
          end_time: new Date(Date.now() + 172800000 + 1800000).toISOString(),
          duration: 30,
          status: "Booked",
          notes: "New client consultation",
          therapist: "Robert Johnson"
        },
        {
          id: "appointment3",
          appointment_id: "appointment3",
          service_name: "Touch-up Session",
          client_name: "Robert Johnson",
          start_time: new Date(Date.now() + 259200000).toISOString(),
          end_time: new Date(Date.now() + 259200000 + 2700000).toISOString(),
          duration: 45,
          status: "Confirmed",
          notes: "Follow-up session",
          therapist: "John Doe"
        }
      ],
      total_count: 3
    };
  }
  
  // Reports endpoint
  if (endpoint.includes("reports")) {
    // Accrual basis report
    if (endpoint.includes("accrual_basis")) {
      return {
        report: {
          sales: [
            {
              sale_date: new Date().toISOString().split('T')[0],
              invoice_no: "INV001",
              guest_code: "client1",
              guest_name: "John Doe",
              center_name: "Austin Center",
              item_name: "Tatt2Away Session",
              item_type: "Service",
              qty: 1,
              sales_inc_tax: 199.99,
              payment_type: "Card",
              sold_by: "Jane Smith",
              created_by: "System",
              status: "Completed"
            },
            {
              sale_date: new Date().toISOString().split('T')[0],
              invoice_no: "INV002",
              guest_code: "client2",
              guest_name: "Jane Smith",
              center_name: "Chicago Center",
              item_name: "Touch-up Session",
              item_type: "Service",
              qty: 1,
              sales_inc_tax: 149.99,
              payment_type: "Cash",
              sold_by: "Robert Johnson",
              created_by: "System",
              status: "Completed"
            }
          ],
          total: {
            sales: 349.98,
            refunds: 0,
            net_sales: 349.98
          }
        }
      };
    }
    
    // Cash basis report
    if (endpoint.includes("cash_basis")) {
      return {
        report: {
          sales: [
            {
              sale_date: new Date().toISOString().split('T')[0],
              invoice_no: "INV001",
              guest_code: "client1",
              guest_name: "John Doe",
              center_name: "Austin Center",
              item_name: "Tatt2Away Session",
              item_type: "Service",
              qty: 1,
              sales_collected_inc_tax: 199.99,
              payment_type: "Card",
              sold_by: "Jane Smith",
              created_by: "System",
              status: "Completed"
            },
            {
              sale_date: new Date().toISOString().split('T')[0],
              invoice_no: "INV002",
              guest_code: "client2",
              guest_name: "Jane Smith",
              center_name: "Chicago Center",
              item_name: "Touch-up Session",
              item_type: "Service",
              qty: 1,
              sales_collected_inc_tax: 149.99,
              payment_type: "Cash",
              sold_by: "Robert Johnson",
              created_by: "System",
              status: "Completed"
            }
          ],
          total: {
            sales_collected_inc_tax: 349.98,
            refunds: 0,
            net_sales: 349.98
          }
        }
      };
    }
  }
  
  // Packages endpoint
  if (endpoint.includes("packages")) {
    if (endpoint.match(/packages\/[\w\d-]+$/)) {
      // Single package details
      return {
        package: {
          id: endpoint.split('/').pop(),
          name: "Test Package",
          description: "This is a test package description",
          type: "Standard",
          price: 499.99,
          validity_days: 365,
          status: "Active",
          services: [
            {
              name: "Tatt2Away Session",
              quantity: 5,
              value: 199.99
            },
            {
              name: "Touch-up Session",
              quantity: 2,
              value: 149.99
            }
          ],
          terms_and_conditions: "Test terms and conditions"
        }
      };
    }
    
    return {
      packages: [
        {
          id: "package1",
          name: "Tatt2Away Starter Package",
          description: "5 Tatt2Away sessions + 2 touch-ups",
          type: "Standard",
          price: 999.99,
          validity_days: 365,
          status: "Active"
        },
        {
          id: "package2",
          name: "Tatt2Away Premium Package",
          description: "10 Tatt2Away sessions + 5 touch-ups",
          type: "Premium",
          price: 1799.99,
          validity_days: 730,
          status: "Active"
        },
        {
          id: "package3",
          name: "Tatt2Away Basic Package",
          description: "3 Tatt2Away sessions",
          type: "Basic",
          price: 549.99,
          validity_days: 180,
          status: "Active"
        }
      ]
    };
  }
  
  // Default mock data
  return {
    message: "Mock data not implemented for this endpoint",
    endpoint
  };
};

Deno.serve(async (req) => {
  // CORS preflight handler
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Debug endpoint to check environment variables
  if (req.url.includes('/debug-env')) {
    const config = getConfigFromEnv();
    return new Response(
      JSON.stringify({
        success: true,
        env: {
          apiUrl: config.apiUrl,
          hasApiKey: !!config.apiKey,
          hasApiSecret: !!config.apiSecret,
          hasAppId: !!config.appId,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          useOAuth: config.useOAuth,
          defaultCenterCode: config.defaultCenterCode
        },
        envVars: {
          ZENOTI_API_URL: Deno.env.get("ZENOTI_API_URL") || "Not set",
          ZENOTI_USERNAME: Deno.env.get("ZENOTI_USERNAME") ? "Set" : "Not set",
          ZENOTI_PASSWORD: Deno.env.get("ZENOTI_PASSWORD") ? "Set" : "Not set",
          ZENOTI_USE_OAUTH: Deno.env.get("ZENOTI_USE_OAUTH") || "Not set",
          ZENOTI_API_KEY: Deno.env.get("ZENOTI_API_KEY") ? "Set" : "Not set",
          ZENOTI_APP_ID: Deno.env.get("ZENOTI_APP_ID") ? "Set" : "Not set",
          ZENOTI_DEFAULT_CENTER_CODE: Deno.env.get("ZENOTI_DEFAULT_CENTER_CODE") || "Not set"
        },
        testMode: TEST_MODE
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }

  // Test authentication endpoint
  if (req.url.includes('/test-auth')) {
    try {
      const config = getConfigFromEnv();
      
      if (TEST_MODE) {
        return new Response(
          JSON.stringify({
            success: true,
            testMode: true,
            message: "Test mode is enabled, authentication is simulated",
            authMethod: "Mock"
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
      
      const authToken = await getZenotiAuthToken(config);
      
      return new Response(
        JSON.stringify({
          success: true,
          authMethod: authToken === "API_KEY_AUTH" ? "API Key" : "OAuth",
          tokenAvailable: authToken !== "API_KEY_AUTH"
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          detail: error.toString()
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }

  try {
    const requestData = await req.json();
    
    // Validate the request data
    if (!requestData || typeof requestData !== 'object') {
      throw new Error('Invalid request data');
    }
    
    if (!requestData.endpoint || typeof requestData.endpoint !== 'string') {
      throw new Error('Missing or invalid endpoint parameter');
    }
    
    // Parse and validate the request with defaults
    const { 
      endpoint, 
      method = 'GET', 
      params, 
      body, 
      centerCode, 
      requiresAuth = true 
    } = requestData as ZenotiRequest;
    
    console.log(`Processing request for endpoint: ${endpoint}, method: ${method}`);
    
    // Handle test mode
    if (TEST_MODE) {
      console.log(`TEST MODE: Returning mock data for endpoint: ${endpoint}`);
      
      // Return mock data
      return new Response(
        JSON.stringify({
          success: true,
          status: 200,
          statusText: "OK",
          data: getMockData(endpoint)
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // Get configuration from environment
    const config = getConfigFromEnv();
    
    // 1. Handle authentication if required
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (requiresAuth) {
      try {
        const authToken = await getZenotiAuthToken(config);
        
        // Always add API key
        if (config.apiKey) {
          headers['X-API-KEY'] = config.apiKey;
        }
        
        // Add App ID if available
        if (config.appId) {
          headers['X-APP-ID'] = config.appId;
        }
        
        // Add OAuth token if not using API key auth
        if (authToken !== "API_KEY_AUTH") {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
      } catch (authError) {
        console.error("Authentication error:", authError.message);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
    }
    
    // 2. Prepare URL, including center code if provided
    let url = `${config.apiUrl}/${endpoint}`;
    
    // 3. Add query params if provided
    if (params && typeof params === 'object' && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
          continue;
        }
        
        if (Array.isArray(value)) {
          value.forEach(v => {
            if (v !== undefined && v !== null) {
              queryParams.append(`${key}[]`, v.toString());
            }
          });
        } else {
          queryParams.append(key, value.toString());
        }
      }
      
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    // 4. Execute the request to Zenoti
    const requestOptions: RequestInit = {
      method,
      headers,
    };
    
    // Add body if provided for non-GET requests
    if (method !== 'GET' && body) {
      requestOptions.body = JSON.stringify(body);
    }
    
    console.log(`Making ${method} request to Zenoti: ${url}`);
    
    try {
      const response = await fetch(url, requestOptions);
      
      // Log the raw response status
      console.log("Zenoti API response status:", response.status);
      
      // Get response text first to avoid JSON parsing errors
      const responseText = await response.text();
      console.log(`Response preview (${responseText.length} bytes): ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
      
      // Try to parse as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError.message);
        throw new Error(`Failed to parse Zenoti response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
      }
      
      // 5. Return the formatted response
      return new Response(
        JSON.stringify({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        }),
        {
          status: response.ok ? 200 : response.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    } catch (fetchError) {
      console.error("Fetch error:", fetchError.message);
      throw new Error(`Error connecting to Zenoti API: ${fetchError.message}`);
    }
  } catch (error) {
    console.error('Zenoti connector error:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        errorDetail: error.toString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});

/**
 * Gets an authentication token for Zenoti API
 * Uses cache to avoid requesting a new token for every request
 */
async function getZenotiAuthToken(config: ZenotiConfig): Promise<string> {
  console.log("Starting authentication process for Organization-level Employee access...");
  console.log("Auth config:", {
    hasApiKey: !!config.apiKey,
    hasApiSecret: !!config.apiSecret,
    hasAppId: !!config.appId,
    hasUsername: !!config.username,
    hasPassword: !!config.password,
    useOAuth: config.useOAuth
  });
  
  const cacheKey = `${config.username}:${config.apiKey}`;
  
  // Check cache first
  if (TOKEN_CACHE[cacheKey] && TOKEN_CACHE[cacheKey].expires > Date.now()) {
    console.log("Using cached token (expires in", (TOKEN_CACHE[cacheKey].expires - Date.now()) / 1000, "seconds)");
    return TOKEN_CACHE[cacheKey].token;
  }
  
  // Try organization-level API Key + App ID authentication first (matches your Zenoti integration config)
  if (config.apiKey) {
    console.log("Using Organization-level API Key authentication");
    
    // For this method, we don't need a token, but return a string to indicate
    // that authentication is handled by headers
    return "API_KEY_AUTH";
  }
  
  // If useOAuth is true and credentials are provided, get token via OAuth as fallback
  if (config.useOAuth && config.username && config.password) {
    console.log("Using OAuth authentication with username:", config.username);
    
    // Log OAuth token request for debugging
    console.log(`Requesting OAuth token from ${config.apiUrl}/oauth/token`);
    
    try {
      const tokenResponse = await fetch(`${config.apiUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: config.username,
          password: config.password,
        }),
      });
      
      // Get full response text
      const responseText = await tokenResponse.text();
      console.log("OAuth response status:", tokenResponse.status);
      console.log("OAuth response body:", responseText.substring(0, 100));
      
      // Check for HTTP error
      if (!tokenResponse.ok) {
        throw new Error(`OAuth request failed with status ${tokenResponse.status}: ${responseText}`);
      }
      
      // Try to parse the response
      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse OAuth response: ${responseText}`);
      }
      
      if (!tokenData.access_token) {
        throw new Error(`No access token in response: ${JSON.stringify(tokenData)}`);
      }
      
      console.log("Successfully obtained OAuth token");
      
      // Cache the token with expiry
      TOKEN_CACHE[cacheKey] = {
        token: tokenData.access_token,
        expires: Date.now() + (tokenData.expires_in * 1000) - 60000, // Subtract 1 minute for safety
      };
      
      return tokenData.access_token;
    } catch (error) {
      console.error("OAuth authentication error:", error.message);
      throw error;
    }
  }
  
  // If no auth methods available
  throw new Error("No valid authentication method available for Zenoti");
}

/**
 * Helper to get center ID from center code
 */
function getCenterIdFromCode(centerCode: string): string {
  if (!centerCode) return CENTER_ID_MAP.DEFAULT;
  return CENTER_ID_MAP[centerCode] || CENTER_ID_MAP.DEFAULT;
}