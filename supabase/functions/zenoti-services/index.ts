// supabase/functions/zenoti-services/index.ts

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

interface ServiceParams {
  centerCode: string;
  allCenters?: boolean;
  limit?: number;
  offset?: number;
  serviceId?: string;
}

interface ServiceResponse {
  success: boolean;
  services?: any[];
  service?: any;
  error?: string;
  totalCount?: number;
}

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const body = await req.json();
  const { name, code } = body;

  let query = supabase.from('zenoti_services').select('*');
  if (name) query = query.ilike('name', `%${name}%`);
  if (code) query = query.eq('code', code);

  const { data, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
});

/**
 * Gets details for a specific service
 */
async function getServiceDetails(baseUrl: string, params: ServiceParams): Promise<Response> {
  // Validate required parameters
  if (!params.serviceId) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Service ID is required' 
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Call the Zenoti connector function
  // Create the correct URL for the connector function
  const url = new URL(baseUrl);
  const baseUrlString = `${url.protocol}//${url.host}`;
  const connectorUrl = `${baseUrlString}/functions/v1/zenoti-connector`;
  
  try {
    const connectorResponse = await fetch(connectorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        endpoint: `services/${params.serviceId}`,
        method: 'GET',
        centerCode: params.centerCode,
        requiresAuth: true
      })
    });
    
    if (!connectorResponse.ok) {
      throw new Error(`Connector responded with status: ${connectorResponse.status}, ${await connectorResponse.text()}`);
    }
  
    const result = await connectorResponse.json();
    
    // Process and format the response
    const response: ServiceResponse = {
      success: result.success
    };
    
    if (result.success) {
      // Format service from Zenoti response
      const serviceData = result.data.service || result.data;
      
      // Transform to a consistent format
      response.service = {
        id: serviceData.id || params.serviceId,
        name: serviceData.name || 'Unknown Service',
        code: serviceData.code,
        description: serviceData.description || '',
        category: serviceData.category || 'Uncategorized',
        duration: serviceData.duration,
        price: serviceData.price || serviceData.price_info?.price || 0,
        setup_time: serviceData.setup_time || 0,
        clean_time: serviceData.clean_time || 0,
        process_time: serviceData.process_time || serviceData.duration || 0,
        allow_online_booking: serviceData.allow_online_booking || false,
        gender_specific: serviceData.gender_specific || 'No',
        priority: serviceData.priority || 'Standard',
        pre_appointment_notes: serviceData.pre_appointment_notes || '',
        post_appointment_notes: serviceData.post_appointment_notes || '',
        is_active: serviceData.is_active !== false,
        _raw: serviceData
      };
    } else {
      response.error = result.error || 'Failed to fetch service details from Zenoti';
    }
    
    return new Response(
      JSON.stringify(response),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    console.error('Error calling zenoti-connector:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error connecting to Zenoti: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

/**
 * Gets all services for a center
 */
async function getAllServices(baseUrl: string, params: ServiceParams): Promise<Response> {
  // Validate required parameters
  if (!params.centerCode && !params.allCenters) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Center code is required unless allCenters is true' 
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Prepare request parameters
  const requestParams: Record<string, any> = {
    limit: params.limit || 100,
    offset: params.offset || 0
  };
  
  // Determine the endpoint based on allCenters flag
  let endpoint = params.allCenters
    ? 'services'
    : `centers/${params.centerCode}/services`;
  
  // Call the Zenoti connector function
  // Create the correct URL for the connector function
  const url = new URL(baseUrl);
  const baseUrlString = `${url.protocol}//${url.host}`;
  const connectorUrl = `${baseUrlString}/functions/v1/zenoti-connector`;
  
  try {
    const connectorResponse = await fetch(connectorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        endpoint,
        method: 'GET',
        params: requestParams,
        centerCode: params.centerCode,
        requiresAuth: true
      })
    });
    
    if (!connectorResponse.ok) {
      throw new Error(`Connector responded with status: ${connectorResponse.status}, ${await connectorResponse.text()}`);
    }
  
    const result = await connectorResponse.json();
    
    // Process and format the response
    const response: ServiceResponse = {
      success: result.success
    };
    
    if (result.success) {
      // Format services from Zenoti response
      let services = [];
      
      if (result.data.services) {
        // Standard services endpoint format
        services = result.data.services;
        response.totalCount = result.data.total_count || services.length;
      } else if (Array.isArray(result.data)) {
        // Direct array format
        services = result.data;
        response.totalCount = services.length;
      }
      
      // Transform service data to a consistent format
      response.services = services.map((service: any) => ({
        id: service.id,
        name: service.name || 'Unknown Service',
        code: service.code,
        description: service.description || '',
        category: service.category || 'Uncategorized',
        duration: service.duration,
        price: service.price || service.price_info?.price || 0,
        is_active: service.is_active !== false,
        // Include raw data for debugging
        _raw: service
      }));
    } else {
      response.error = result.error || 'Failed to fetch services from Zenoti';
    }
    
    return new Response(
      JSON.stringify(response),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    console.error('Error calling zenoti-connector:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error connecting to Zenoti: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}
