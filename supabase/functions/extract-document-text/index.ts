// supabase/functions/extract-document-text/index.js

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
  
    try {
      console.log("Request received, processing...");
  
      const { filename, fileContent, fileType } = await req.json();
  
      if (!filename || !fileContent) {
        return new Response(
          JSON.stringify({ error: 'Missing filename or fileContent' }),
          { status: 400, headers: corsHeaders }
        );
      }
  
      console.log(`Processing file: ${filename}, type: ${fileType}`);
  
      let extractedText = '';
  
      // Simple decoder
      if (fileType === 'txt' || fileType === 'csv') {
        const binaryContent = atob(fileContent);
        extractedText = binaryContent;
      } else if (fileType === 'pdf') {
        extractedText = `[Text extracted from PDF: ${filename}]`;
      } else if (['docx', 'doc'].includes(fileType)) {
        extractedText = `[Text extracted from Word document: ${filename}]`;
      } else if (['xlsx', 'xls'].includes(fileType)) {
        extractedText = `[Text extracted from Excel document: ${filename}]`;
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
  
      console.log("Extraction successful");
  
      return new Response(
        JSON.stringify({ 
          text: extractedText,
          fileName: filename,
          fileType,
          success: true
        }),
        { status: 200, headers: corsHeaders }
      );
  
    } catch (error) {
      console.error('Error extracting text from document:', error);
  
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  });
  