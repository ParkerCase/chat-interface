// supabase/functions/generate-embedding/index.ts

// Declare Deno as a global object (if needed by your linter/IDE)
declare const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
  
  interface RequestBody {
    text: string;
    model?: string;
  }
  
  interface OpenAIEmbeddingResponse {
    data: {
      embedding: number[];
      index: number;
      object: string;
    }[];
    model: string;
    object: string;
    usage: {
      prompt_tokens: number;
      total_tokens: number;
    };
  }
  
  interface OpenAIErrorResponse {
    error: {
      message: string;
      type?: string;
      param?: string;
      code?: string;
    };
  }
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
  
    try {
      const { text, model = "text-embedding-ada-002" } = await req.json() as RequestBody;
  
      if (!text) {
        return new Response(
          JSON.stringify({ error: 'Missing text parameter' }),
          { status: 400, headers: corsHeaders }
        );
      }
  
      const trimmedText = text.trim();
      const truncatedText = trimmedText.length > 8000
        ? trimmedText.substring(0, 8000)
        : trimmedText;
  
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable not set');
      }
  
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: truncatedText
        })
      });
  
      if (!response.ok) {
        const errorData = await response.json() as OpenAIErrorResponse;
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }
  
      const responseData = await response.json() as OpenAIEmbeddingResponse;
  
      if (!responseData.data?.[0]?.embedding) {
        throw new Error('Invalid response from OpenAI API');
      }
  
      const embedding = responseData.data[0].embedding;
  
      return new Response(
        JSON.stringify({ embedding, model, truncated: truncatedText.length < trimmedText.length }),
        { status: 200, headers: corsHeaders }
      );
  
    } catch (error) {
      console.error('Error generating embedding:', error);
  
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: corsHeaders }
      );
    }
  });
  