// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

console.log("Hello from Functions!")

function withCors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(res.body, { ...res, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const { email, full_name, first_name, last_name, role } = await req.json();

  // Use environment variables for security
  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Create the user in Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    user_metadata: {
      full_name,
      first_name,
      last_name,
      role,
    },
    email_confirm: true,
  });

  if (error) {
    return withCors(new Response(JSON.stringify({ error: error.message }), { status: 400 }));
  }

  // 2. Create the profile row
  const { error: profileError } = await supabase.from("profiles").upsert([
    {
      id: data.user.id,
      email,
      full_name,
      first_name,
      last_name,
      roles: [role],
      status: "Active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  if (profileError) {
    return withCors(new Response(JSON.stringify({ error: profileError.message }), { status: 400 }));
  }

  return withCors(new Response(JSON.stringify({ success: true, user: data.user }), { status: 200 }));
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-user' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
