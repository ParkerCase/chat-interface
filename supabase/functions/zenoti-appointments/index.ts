// supabase/functions/zenoti-appointments/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

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
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');
  const body = await req.json();
  const { center_code, start_date, end_date, status } = body;
  const date_type = body.date_type !== undefined ? body.date_type : 0;

  // Lookup center_id from center_code
  let center_id = null;
  if (center_code) {
    const { data: center } = await supabase
      .from('zenoti_centers')
      .select('center_id')
      .eq('center_code', center_code)
      .single();
    if (center && center.center_id) {
      center_id = center.center_id;
    }
  }
  if (!center_id) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or missing center_code/center_id' }), { status: 400 });
  }

  // Build request body for Zenoti
  const zenotiBody = {
    center_ids: [center_id],
    start_date,
    end_date,
    date_type,
    appointment_statuses: status ? [status] : [-1],
    page: 1,
    size: 1000
  };

  try {
    const response = await fetch(`${zenotiApiUrl}/reports/appointments/flat_file?page=1&size=1000`, {
      method: 'POST',
      headers: { 'Authorization': `apikey ${zenotiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(zenotiBody)
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      const appointments = data.appointments || [];
      let upserted = 0;
      let errors = [];
      let first_mapped = null;
      for (const [i, appt] of appointments.entries()) {
        const mapped = {
          appointment_id: appt.invoice_id || appt.appointment_id || crypto.randomUUID(),
          appointment_group_id: null,
          invoice_id: appt.invoice_id || null,
          service: appt.service_name ? { name: appt.service_name, category: appt.service_category, subcategory: appt.service_subcategory } : null,
          start_time: appt.start_time ? new Date(appt.start_time).toISOString() : null,
          end_time: appt.end_time ? new Date(appt.end_time).toISOString() : null,
          status: appt.status || null,
          guest: appt.guest_id ? { id: appt.guest_id, name: appt.guest_name, email: appt.email } : null,
          therapist: appt.provider_id ? { id: appt.provider_id, name: appt.serviced_by } : null,
          notes: appt.appointment_notes || null,
          price: appt.guest_price_adjusted || null,
          actual_start_time: null,
          actual_completed_time: null,
          checkin_time: null,
          updated_at: appt.modified_on ? new Date(appt.modified_on).toISOString() : new Date().toISOString(),
          details: appt,
          center_id: center_id,
          center_code: center_code
        };
        if (i === 0) first_mapped = mapped;
        const { error } = await supabase.from('zenoti_appointments').upsert(mapped, { onConflict: 'appointment_id' });
        if (!error) upserted++;
        else if (errors.length < 5) errors.push({ index: i, error: error.message || error, mapped });
      }
      return new Response(JSON.stringify({ success: true, upserted, count: appointments.length, errors, first_mapped }), { headers: { 'Content-Type': 'application/json' } });
    } catch (jsonErr) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from Zenoti', raw: text }), { status: 502 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || err.toString() }), { status: 500 });
  }
});
