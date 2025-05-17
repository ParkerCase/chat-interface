// supabase/functions/zenoti-appointments/index.ts

import { corsHeaders } from '../_shared/cors.ts';

interface AppointmentParams {
  startDate?: string;
  endDate?: string;
  centerCode: string;
  status?: string;
  therapistId?: string;
  clientId?: string;
  limit?: number;
  offset?: number;
  allCenters?: boolean;
}

interface AppointmentResponse {
  success: boolean;
  appointments?: any[];
  error?: string;
  totalCount?: number;
  processing?: {
    chunking?: boolean;
    chunks?: {
      total: number;
      completed: number;
      failed: number;
    }
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Extract parameters from request
    let params: AppointmentParams;
    
    if (req.method === 'POST') {
      params = await req.json();
    } else {
      // Parse URL parameters
      const url = new URL(req.url);
      params = {
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        centerCode: url.searchParams.get('centerCode') || '',
        status: url.searchParams.get('status') || undefined,
        therapistId: url.searchParams.get('therapistId') || undefined,
        clientId: url.searchParams.get('clientId') || undefined,
        limit: url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')!) : 100,
        offset: url.searchParams.has('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
        allCenters: url.searchParams.get('allCenters') === 'true'
      };
    }
    
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
    
    // Set default date range if not provided
    if (!params.startDate) {
      // Default to today
      params.startDate = new Date().toISOString().split('T')[0];
    }
    
    if (!params.endDate) {
      // Default to 2 weeks from now
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);
      params.endDate = endDate.toISOString().split('T')[0];
    }
    
    // Prepare request to Zenoti
    const requestParams: Record<string, any> = {
      from_date: params.startDate,
      to_date: params.endDate,
      limit: params.limit || 100,
      offset: params.offset || 0
    };
    
    // Add additional filter parameters if provided
    if (params.status) {
      requestParams.status = params.status;
    }
    
    if (params.therapistId) {
      requestParams.therapist_id = params.therapistId;
    }
    
    if (params.clientId) {
      requestParams.guest_id = params.clientId;
    }
    
    // Determine the endpoint based on allCenters flag
    let endpoint = params.allCenters
      ? 'appointments'
      : `centers/${params.centerCode}/appointments`;
    
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
      const response: AppointmentResponse = {
        success: result.success
      };
      
      if (result.success) {
        // Format appointments from Zenoti response
        let appointments = [];
        
        if (result.data.appointments) {
          // Standard appointments endpoint format
          appointments = result.data.appointments;
          response.totalCount = result.data.total_count || appointments.length;
        } else if (Array.isArray(result.data)) {
          // Direct array format
          appointments = result.data;
          response.totalCount = appointments.length;
        }
        
        // Transform appointment data to a consistent format
        response.appointments = appointments.map((appointment: any) => {
          // Get service name from either blockout or service property
          const serviceName = appointment.blockout
            ? appointment.blockout.name
            : appointment.service
              ? appointment.service.name
              : appointment.service_name || 'Admin Time';
          
          // Handle client name when guest is null
          const clientName = appointment.guest
            ? `${appointment.guest.first_name || ''} ${appointment.guest.last_name || ''}`.trim()
            : appointment.client_name || 'No Client';
          
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
            notes: appointment.notes || '',
            therapist: appointment.therapist
              ? `${appointment.therapist.first_name || ''} ${appointment.therapist.last_name || ''}`.trim()
              : appointment.provider_name || 'Unassigned',
            guest: appointment.guest || null,
            center: appointment.center || null,
            // Include raw data for debugging
            _raw: appointment
          };
        });
        
        // Add processing info
        response.processing = {
          chunking: false, // Set to true if date range was chunked
          chunks: {
            total: 1,
            completed: 1,
            failed: 0
          }
        };
      } else {
        response.error = result.error || 'Failed to fetch appointments from Zenoti';
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
  } catch (error) {
    console.error('Error in zenoti-appointments function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error fetching appointments: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
