import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');

  let centerIdFromBody = null;
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.center_id) centerIdFromBody = body.center_id;
    } catch {}
  }

  const results = [];
  try {
    // Fetch all centers or just the one specified
    let centers = [];
    if (centerIdFromBody) {
      const { data, error } = await supabase.from('zenoti_centers').select('center_id').eq('center_id', centerIdFromBody);
      if (error) throw new Error(error.message);
      centers = data || [];
    } else {
      const centersRes = await supabase.from('zenoti_centers').select('center_id');
      if (centersRes.error) throw new Error(centersRes.error.message);
      centers = centersRes.data || [];
    }
    let upserted = 0;
    for (const center of centers) {
      // Skip the already-synced center for services (unless explicitly requested)
      if (!centerIdFromBody && center.center_id === '90aa9708-4678-4c04-999e-63e4aff12f40') continue;
      const response = await fetch(`${zenotiApiUrl}/Centers/${center.center_id}/services`, {
        headers: { 'Authorization': `apikey ${zenotiApiKey}` }
      });
      const text = await response.text();
      let servicesData;
      let parseError = null;
      try {
        servicesData = JSON.parse(text);
      } catch (jsonErr) {
        parseError = jsonErr.toString();
        results.push({ center_id: center.center_id, error: 'Invalid JSON from Zenoti', raw: text, parseError });
        continue;
      }
      // Extract the 'services' array from the response
      const services = Array.isArray(servicesData.services) ? servicesData.services : [];
      for (const service of services) {
        if (!service.id) continue;
        const mapped = {
          id: service.id,
          center_id: center.center_id,
          code: service.code,
          name: service.name,
          description: service.description,
          duration: service.duration,
          price: service.price_info?.sale_price || null,
          category: service.additional_info?.category?.name || null,
          details: service
        };
        const { error } = await supabase.from('zenoti_services').upsert(mapped, { onConflict: 'id' });
        if (error) {
          results.push({ center_id: center.center_id, service_id: service.id, upsert_error: error.message, mapped });
        } else {
          upserted++;
        }
      }
    }
    return new Response(JSON.stringify({ success: true, upserted, results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || err.toString(), results }), { status: 500 });
  }
}); 