// supabase/functions/zenoti-connector/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';

// Zenoti API configuration
interface ZenotiConfig {
  apiUrl: string; 
  apiKey: string;
  username?: string;
  password?: string;
  useOAuth?: boolean;
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

// Hardcoded center ID mapping - used for specific Zenoti endpoints that require UUIDs
const CENTER_ID_MAP: Record<string, string> = {
  AUS: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
  CHI: "c359afac-3210-49e5-a930-6676d8bb188a",
  CW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7",
  Draper: "5da78932-c7e1-48b2-a099-9c302c75d7e1",
  HTN: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12",
  DEFAULT: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
};

// Create a cache to store auth tokens
const TOKEN_CACHE: Record<string, { token: string; expires: number }> = {};

Deno.serve(async (req) => {
  // CORS preflight handler
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    
    // Get Supabase client using service role (needed to access protected tables)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Retrieve Zenoti configuration from database
    const { data: zenotiConfig, error: configError } = await supabase
      .from('integrations')
      .select('config')
      .eq('provider', 'zenoti')
      .single();
    
    if (configError) {
      throw new Error(`Failed to retrieve Zenoti configuration: ${configError.message}`);
    }
    
    const config: ZenotiConfig = zenotiConfig.config;
    
    // 2. Handle authentication if required
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (requiresAuth) {
      const authToken = await getZenotiAuthToken(config);
      headers['Authorization'] = `Bearer ${authToken}`;
      
      // Add API key if provided
      if (config.apiKey) {
        headers['X-API-KEY'] = config.apiKey;
      }
    }
    
    // 3. Prepare URL, including center code if provided
    let url = `${config.apiUrl}/${endpoint}`;
    
    // 4. Execute the request to Zenoti
    const requestOptions: RequestInit = {
      method,
      headers,
    };
    
    // Add query params if provided
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
    
    // Add body if provided for non-GET requests
    if (method !== 'GET' && body) {
      requestOptions.body = JSON.stringify(body);
    }
    
    console.log(`Making ${method} request to Zenoti: ${url}`);
    
    const response = await fetch(url, requestOptions);
    const responseData = await response.json();
    
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
  } catch (error) {
    console.error('Zenoti connector error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
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
// Replace the getZenotiAuthToken function with this improved version:
async function getZenotiAuthToken(config: ZenotiConfig): Promise<string> {
  const cacheKey = `${config.username}:${config.apiKey}`;
  
  // Check cache first
  if (TOKEN_CACHE[cacheKey] && TOKEN_CACHE[cacheKey].expires > Date.now()) {
    console.log("Using cached token");
    return TOKEN_CACHE[cacheKey].token;
  }
  
  // Try App ID + API Key header-based auth first
  if (config.appId && config.apiKey) {
    console.log("Using App ID + API Key authentication");
    
    // For this method, we don't need a token, but return a string to indicate
    // that authentication is handled by headers
    return "API_KEY_AUTH";
  }
  
  // If useOAuth is true and credentials are provided, get token via OAuth
  if (config.useOAuth && config.username && config.password) {
    console.log("Using OAuth authentication with:", config.username);
    
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
      
      // Check for HTTP error and log detailed response
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("OAuth failed with status:", tokenResponse.status);
        console.error("OAuth error response:", errorText);
        throw new Error(`Failed to authenticate with Zenoti: ${tokenResponse.statusText}`);
      }
      
      const tokenData = await tokenResponse.json();
      console.log("Successfully obtained OAuth token");
      
      // Cache the token with expiry
      TOKEN_CACHE[cacheKey] = {
        token: tokenData.access_token,
        expires: Date.now() + (tokenData.expires_in * 1000) - 60000, // Subtract 1 minute for safety
      };
      
      return tokenData.access_token;
    } catch (error) {
      console.error("OAuth authentication error:", error);
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
