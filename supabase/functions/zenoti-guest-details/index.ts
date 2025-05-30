import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

Deno.serve(async (req) => {
  const { guest_id } = await req.json();
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');

  if (!guest_id) {
    return new Response(JSON.stringify({ success: false, error: 'Missing guest_id' }), { status: 400 });
  }

  try {
    const response = await fetch(`${zenotiApiUrl}/guests/${guest_id}`, {
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