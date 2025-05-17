// supabase/functions/zenoti-clients/index.ts

import { corsHeaders } from '../_shared/cors.ts';


interface ClientSearchParams {
  query?: string;
  centerCode: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

interface ClientResponse {
  success: boolean;
  clients?: any[];
  error?: string;
  totalCount?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // For POST requests, extract the search parameters from the request body
    // For GET requests, extract them from the query string
    let params: ClientSearchParams;
    
    if (req.method === 'POST') {
      params = await req.json();
    } else {
      // Parse URL parameters
      const url = new URL(req.url);
      params = {
        query: url.searchParams.get('query') || undefined,
        centerCode: url.searchParams.get('centerCode') || '',
        limit: url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')!) : 20,
        offset: url.searchParams.has('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
        sort: url.searchParams.get('sort') || undefined
      };
    }
    
    // Validate required parameters
    if (!params.centerCode) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Center code is required' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    // Call the zenoti-connector function
    const zenotiEndpoint = params.query 
      ? `guests/search` 
      : `centers/${params.centerCode}/guests`;
    
    // Prepare request parameters
    const requestParams: Record<string, any> = {
      limit: params.limit || 20,
      offset: params.offset || 0
    };
    
    // Add query parameter if provided
    if (params.query) {
      requestParams.q = params.query;
    }
    
    // Add sort parameter if provided
    if (params.sort) {
      if (params.sort === 'last_visit') {
        requestParams.sort_by = 'last_visit_date';
        requestParams.sort_order = 'desc';
      } else {
        requestParams.sort_by = params.sort;
      }
    }
    
    // Call the Zenoti connector function
    // Create the correct URL for the connector function
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const connectorUrl = `${baseUrl}/functions/v1/zenoti-connector`;
    
    try {
      const connectorResponse = await fetch(connectorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass through authorization header if present
          ...(req.headers.get('Authorization') ? 
              { 'Authorization': req.headers.get('Authorization') || '' } : {}),
          ...corsHeaders
        },
        body: JSON.stringify({
          endpoint: zenotiEndpoint,
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
      const response: ClientResponse = {
        success: result.success
      };
    
      if (result.success) {
        // Format clients from Zenoti response - handle both possible response formats
        let clients = [];
        
        if (result.data.guests) {
          // Standard guests endpoint format
          clients = result.data.guests;
          response.totalCount = result.data.total_count || clients.length;
        } else if (result.data.data) {
          // Search endpoint format
          clients = result.data.data;
          response.totalCount = result.data.total_count || clients.length;
        } else if (Array.isArray(result.data)) {
          // Direct array format
          clients = result.data;
          response.totalCount = clients.length;
        }
        
        // Transform client data to a consistent format
        response.clients = clients.map((client: any) => {
          // Extract personal info
          const personalInfo = client.personal_info || client;
          
          return {
            id: client.id || client.guest_id,
            guest_id: client.guest_id || client.id,
            first_name: personalInfo.first_name || '',
            last_name: personalInfo.last_name || '',
            email: personalInfo.email || '',
            mobile: personalInfo.mobile_phone?.number || personalInfo.mobile || personalInfo.phone || '',
            last_visit_date: client.last_visit_date || null,
            center_code: client.center_code || params.centerCode,
            center_name: client.center_name || params.centerCode,
            // Include raw data for debugging and additional fields
            _raw: client
          };
        });
      } else {
        response.error = result.error || 'Failed to fetch clients from Zenoti';
      }
    
      return new Response(
        JSON.stringify(response),
        {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    } catch (error) {
      console.error('Error in zenoti-clients function:', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Error fetching clients: ${error.message}`,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
  } catch (error) {
    console.error('Error in zenoti-clients function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error fetching clients: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
