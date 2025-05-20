// supabase/functions/zenoti-test/index.ts
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const config = {
      apiUrl: Deno.env.get("ZENOTI_API_URL") || "https://api.zenoti.com/v1",
      apiKey: Deno.env.get("ZENOTI_API_KEY"),
      username: Deno.env.get("ZENOTI_USERNAME"),
      password: Deno.env.get("ZENOTI_PASSWORD"),
      useOAuth: Deno.env.get("ZENOTI_USE_OAUTH") === "true"
    };
    
    // Try to get an OAuth token
    let authResult;
    
    if (config.useOAuth && config.username && config.password) {
      try {
        const tokenResponse = await fetch(`${config.apiUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'password',
            username: config.username,
            password: config.password,
          }),
        });
        
        const responseText = await tokenResponse.text();
        
        if (tokenResponse.ok) {
          const tokenData = JSON.parse(responseText);
          if (tokenData.access_token) {
            authResult = {
              success: true,
              method: "OAuth",
              token: `${tokenData.access_token.substring(0, 10)}...`
            };
          } else {
            authResult = {
              success: false, 
              method: "OAuth",
              error: "No access token in response"
            };
          }
        } else {
          authResult = {
            success: false,
            method: "OAuth",
            status: tokenResponse.status,
            error: responseText
          };
        }
      } catch (error) {
        authResult = {
          success: false,
          method: "OAuth",
          error: error.message
        };
      }
    } else if (config.apiKey) {
      authResult = {
        success: true,
        method: "API Key",
        keyPresent: true
      };
    } else {
      authResult = {
        success: false,
        error: "No authentication method configured"
      };
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        config: {
          apiUrl: config.apiUrl,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          hasApiKey: !!config.apiKey,
          useOAuth: config.useOAuth
        },
        auth: authResult,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
