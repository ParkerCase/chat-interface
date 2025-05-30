import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');

  const centersRes = await fetch(`${zenotiApiUrl}/centers`, {
    headers: { 'Authorization': `apikey ${zenotiApiKey}` }
  });
  const centersData = await centersRes.json();

  let total = 0;
  for (const center of centersData.centers) {
    const apptRes = await fetch(`${zenotiApiUrl}/centers/${center.id}/appointments`, {
      headers: { 'Authorization': `apikey ${zenotiApiKey}` }
    });
    const apptData = await apptRes.json();
    for (const appt of apptData.appointments) {
      await supabase.from('zenoti_appointments').upsert(appt, { onConflict: 'appointment_id' });
      total++;
    }
  }

  return new Response(JSON.stringify({ success: true, count: total }));
}); 