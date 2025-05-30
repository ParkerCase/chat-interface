import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');
  const body = await req.json();
  const { center_code, name } = body;

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

  // Build query params
  const params = new URLSearchParams();
  params.append('center_id', center_id);
  if (name) params.append('name', name);

  try {
    const response = await fetch(`${zenotiApiUrl}/packages?${params.toString()}`, {
      headers: { 'Authorization': `apikey ${zenotiApiKey}` }
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
    } catch (jsonErr) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from Zenoti', raw: text }), { status: 502 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || err.toString() }), { status: 500 });
  }
}); 