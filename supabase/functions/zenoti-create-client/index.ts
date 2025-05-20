
// supabase/functions/zenoti-create-client/index.ts

import { corsHeaders } from '../_shared/cors.ts';
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";


interface ClientData {
  firstName?: string;
  lastName: string;  // Required
  email?: string;
  mobile?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  customFields?: Record<string, any>;
  centerCode: string;  // Required
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Extract client data from request
    const { clientData } = await req.json() as { clientData: ClientData };
    
    // Validate required fields
    if (!clientData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Client data is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    if (!clientData.lastName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Last name is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    if (!clientData.email && !clientData.mobile) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Either email or mobile is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    if (!clientData.centerCode) {
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
    
    // Format client data for Zenoti API
    const zenotiClientData = {
      first_name: clientData.firstName || "",
      last_name: clientData.lastName,
      email: clientData.email || "",
      mobile: clientData.mobile || "",
      gender: clientData.gender || "NA",
      date_of_birth: clientData.dateOfBirth || "",
      address: clientData.address ? {
        line_1: clientData.address.line1 || "",
        line_2: clientData.address.line2 || "",
        city: clientData.address.city || "",
        state: clientData.address.state || "",
        zip_code: clientData.address.zipCode || "",
        country: clientData.address.country || "USA"
      } : undefined,
      custom_fields: clientData.customFields || {}
    };
    
    // Call the zenoti-connector function to create the client
    const connectorResponse = await fetch(
      new URL('/zenoti-connector', req.url).href, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({
          endpoint: `centers/${clientData.centerCode}/guests`,
          method: 'POST',
          body: zenotiClientData
        })
      }
    );
    
    const result = await connectorResponse.json();
    
    // Process the response
    if (result.success) {
      // Format the new client data consistently
      const newClient = result.data?.guest || result.data;
      
      // If the operation was successful but data is missing, create a basic response
      const clientResponse = {
        id: newClient?.id || newClient?.guest_id,
        guest_id: newClient?.guest_id || newClient?.id,
        first_name: newClient?.first_name || clientData.firstName || "",
        last_name: newClient?.last_name || clientData.lastName,
        email: newClient?.email || clientData.email || "",
        mobile: newClient?.mobile || clientData.mobile || "",
        center_code: clientData.centerCode,
        _raw: newClient
      };
      
      return new Response(
        JSON.stringify({
          success: true,
          client: clientResponse
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.data?.error || result.error || 'Failed to create client in Zenoti'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
  } catch (error) {
    console.error('Error creating client:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error creating client: ${error.message}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
