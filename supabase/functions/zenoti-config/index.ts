// supabase/functions/zenoti-config/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';

interface ZenotiConfig {
  apiUrl: string; 
  apiKey: string;
  username?: string;
  password?: string;
  useOAuth?: boolean;
  defaultCenterCode?: string;
  refreshRate?: string;
}

interface ConfigRequest {
  action: 'get' | 'set' | 'test';
  config?: ZenotiConfig;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Get Supabase client using service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user information from the request
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        userId = user.id;
      }
    }
    
    // Require authentication
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    // Check if user has admin privileges
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch user profile' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    const isAdmin = profile.roles?.includes('admin') || profile.roles?.includes('super_admin');
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin privileges required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    // Parse the request body
    let params: ConfigRequest;
    
    if (req.method === 'POST') {
      params = await req.json();
    } else {
      // For GET requests, assume we're retrieving config
      params = { action: 'get' };
    }
    
    // Handle the request based on the action
    switch (params.action) {
      case 'get':
        return await getConfiguration(supabase);
      case 'set':
        return await setConfiguration(supabase, params.config, userId);
      case 'test':
        return await testConfiguration(params.config);
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
    }
  } catch (error) {
    console.error('Error in zenoti-config function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error managing Zenoti configuration: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});

/**
 * Gets the current Zenoti configuration
 */
async function getConfiguration(supabase) {
  const { data, error } = await supabase
    .from('integrations')
    .select('config')
    .eq('provider', 'zenoti')
    .single();
    
  if (error) {
    // If no record exists, return an empty config
    if (error.code === 'PGRST116') {
      return new Response(
        JSON.stringify({
          success: true,
          config: null,
          exists: false
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to retrieve configuration: ${error.message}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // For security, mask sensitive fields
  const maskedConfig = { ...data.config };
  if (maskedConfig.apiKey) maskedConfig.apiKey = '••••••••••••••••';
  if (maskedConfig.password) maskedConfig.password = '••••••••••••••••';
  
  return new Response(
    JSON.stringify({
      success: true,
      config: maskedConfig,
      exists: true
    }),
    {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}

/**
 * Sets the Zenoti configuration
 */
async function setConfiguration(supabase, config: ZenotiConfig | undefined, userId: string) {
  if (!config) {
    return new Response(
      JSON.stringify({ success: false, error: 'Configuration is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Validate required fields
  if (!config.apiUrl) {
    return new Response(
      JSON.stringify({ success: false, error: 'API URL is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Check if we have an existing configuration
  const { data: existingConfig, error: getError } = await supabase
    .from('integrations')
    .select('id, config')
    .eq('provider', 'zenoti')
    .single();
    
  // Prepare the merged configuration, preserving sensitive fields if not provided
  let mergedConfig = { ...config };
  
  if (existingConfig) {
    // If apiKey is masked or empty, use existing value
    if (!config.apiKey || config.apiKey === '••••••••••••••••') {
      mergedConfig.apiKey = existingConfig.config.apiKey;
    }
    
    // If password is masked or empty, use existing value
    if (!config.password || config.password === '••••••••••••••••') {
      mergedConfig.password = existingConfig.config.password;
    }
  }
  
  // Insert or update the configuration
  const { data, error } = await supabase
    .from('integrations')
    .upsert({
      provider: 'zenoti',
      config: mergedConfig,
      updated_at: new Date().toISOString(),
      updated_by: userId
    })
    .select()
    .single();
    
  if (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to save configuration: ${error.message}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Log the configuration change
  await supabase
    .from('integration_logs')
    .insert({
      provider: 'zenoti',
      event_type: 'config_updated',
      user_id: userId,
      details: {
        updated_fields: Object.keys(config)
      }
    });
  
  // For security, mask sensitive fields in response
  const maskedConfig = { ...mergedConfig };
  if (maskedConfig.apiKey) maskedConfig.apiKey = '••••••••••••••••';
  if (maskedConfig.password) maskedConfig.password = '••••••••••••••••';
  
  return new Response(
    JSON.stringify({
      success: true,
      config: maskedConfig,
      message: 'Configuration saved successfully'
    }),
    {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}

/**
 * Tests the Zenoti configuration
 */
async function testConfiguration(config: ZenotiConfig | undefined) {
  if (!config) {
    return new Response(
      JSON.stringify({ success: false, error: 'Configuration is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  try {
    // Perform a simple test - fetch centers
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if provided
    if (config.apiKey) {
      headers['X-API-KEY'] = config.apiKey;
    }
    
    // If useOAuth is true and credentials are provided, get token via OAuth
    if (config.useOAuth && config.username && config.password) {
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
      
      if (!tokenResponse.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Authentication failed: ${tokenResponse.statusText}`,
            status: tokenResponse.status
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }
      
      const tokenData = await tokenResponse.json();
      headers['Authorization'] = `Bearer ${tokenData.access_token}`;
    }
    
    // Try to fetch centers as a test
    const response = await fetch(`${config.apiUrl}/centers`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `API request failed: ${response.statusText}`,
          status: response.status
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    // Try to parse the response
    const data = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        status: response.status,
        message: 'Connection successful',
        centers: data.centers || []
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Connection test failed: ${error.message}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}
