import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const zenotiApiKey = Deno.env.get('ZENOTI_API_KEY');
  const zenotiApiUrl = Deno.env.get('ZENOTI_API_URL');

  const response = await fetch(`${zenotiApiUrl}/centers`, {
    headers: { 'Authorization': `apikey ${zenotiApiKey}` }
  });
  const data = await response.json();

  let upserted = 0;
  for (const center of data.centers) {
    const mapped = {
      id: center.id,
      center_id: center.id,
      center_code: center.code,
      name: center.display_name || center.name || '',
      details: center
    };
    const { error } = await supabase.from('zenoti_centers').upsert(mapped, { onConflict: 'id' });
    if (!error) upserted++;
  }

  return new Response(JSON.stringify({ success: true, count: upserted }));
}); 