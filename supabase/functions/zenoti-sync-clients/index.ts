import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

Deno.serve(async (req) => {
  console.log("Function started", req.method);
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');

  let centerId, page = 1, size = 100;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.center_id) centerId = body.center_id;
      if (body.page !== undefined) page = body.page;
      if (body.size !== undefined) size = body.size;
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON in request body' }), { status: 400 });
  }
  if (!centerId) {
    return new Response(JSON.stringify({ success: false, error: 'center_id is required' }), { status: 400 });
  }
  let upserted = 0, totalFetched = 0;
  const url = `${zenotiApiUrl}/guests?center_id=${centerId}&page=${page}&size=${size}`;
  const guestsRes = await fetch(url, { headers: { 'Authorization': `apikey ${zenotiApiKey}` } });
  const guestsText = await guestsRes.text();
  let guestsData;
  try {
    guestsData = JSON.parse(guestsText);
  } catch (jsonErr) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON from Zenoti', raw: guestsText, center_id: centerId, page }), { status: 502 });
  }
  const guests = guestsData.guests || [];
  
  totalFetched += guests.length;
  let errors = [];
  for (const guest of guests) {
    const mapped = { id: guest.id, details: guest };
    const { error } = await supabase.from('zenoti_clients').upsert(mapped, { onConflict: 'id' });
    if (error && errors.length < 5) errors.push({ guest_id: guest.id, error });
    if (!error) upserted++;
  }
  return new Response(JSON.stringify({ success: true, upserted, totalFetched, page, size, center_id: centerId, errors }), { headers: { 'Content-Type': 'application/json' } });
}); 