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
      const response = await fetch(`${zenotiApiUrl}/Centers/${center.center_id}/packages`, {
        headers: { 'Authorization': `apikey ${zenotiApiKey}` }
      });
      const text = await response.text();
      let packagesData;
      let parseError = null;
      try {
        packagesData = JSON.parse(text);
      } catch (jsonErr) {
        parseError = jsonErr.toString();
        results.push({ center_id: center.center_id, error: 'Invalid JSON from Zenoti', raw: text, parseError });
        continue;
      }
      // Extract the 'packages' array from the response
      const packages = Array.isArray(packagesData.packages) ? packagesData.packages : [];
      for (const pkg of packages) {
        if (!pkg.id) continue;
        const mapped = {
          id: pkg.id,
          center_id: center.center_id,
          code: pkg.code,
          name: pkg.name,
          description: pkg.description,
          type: pkg.type,
          category_id: pkg.category_id,
          business_unit_id: pkg.Business_unit_id,
          version_id: pkg.version_id,
          html_description: pkg.html_description,
          time: pkg.time,
          booking_start_date: pkg.booking_start_date,
          booking_end_date: pkg.booking_end_date,
          details: pkg
        };
        const { error } = await supabase.from('zenoti_packages').upsert(mapped, { onConflict: 'id' });
        if (error) {
          results.push({ center_id: center.center_id, package_id: pkg.id, upsert_error: error.message, mapped });
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