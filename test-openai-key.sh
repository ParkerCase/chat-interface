#!/bin/bash

echo "🔑 OpenAI API Key Tester"
echo "========================"

# Check if .env file exists in root
if [ -f ".env" ]; then
    echo "✅ Found root .env file"
    
    # Extract the API key from root .env
    ROOT_KEY=$(grep "REACT_APP_OPENAI_API_KEY" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    
    if [ -n "$ROOT_KEY" ]; then
        echo "🔍 Testing root .env API key..."
        echo "Key preview: ${ROOT_KEY:0:7}...${ROOT_KEY: -4}"
        
        # Test the key
        RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/openai_response.json \
            -H "Authorization: Bearer $ROOT_KEY" \
            -H "Content-Type: application/json" \
            "https://api.openai.com/v1/models")
        
        if [ "$RESPONSE" = "200" ]; then
            echo "✅ ROOT API KEY: VALID AND WORKING!"
            echo "📊 Available models:"
            cat /tmp/openai_response.json | grep -o '"id":"[^"]*"' | head -5
        else
            echo "❌ ROOT API KEY: FAILED (HTTP $RESPONSE)"
            echo "Response:"
            cat /tmp/openai_response.json
        fi
    else
        echo "❌ No REACT_APP_OPENAI_API_KEY found in root .env"
    fi
else
    echo "❌ No root .env file found"
fi

echo ""
echo "------------------------"

# Check if supabase functions .env exists
if [ -f "supabase/functions/.env" ]; then
    echo "✅ Found supabase/functions/.env file"
    
    # Extract the API key from supabase .env
    SUPABASE_KEY=$(grep "OPENAI_API_KEY" supabase/functions/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    
    if [ -n "$SUPABASE_KEY" ]; then
        echo "🔍 Testing supabase functions .env API key..."
        echo "Key preview: ${SUPABASE_KEY:0:7}...${SUPABASE_KEY: -4}"
        
        # Test the key
        RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/openai_response2.json \
            -H "Authorization: Bearer $SUPABASE_KEY" \
            -H "Content-Type: application/json" \
            "https://api.openai.com/v1/models")
        
        if [ "$RESPONSE" = "200" ]; then
            echo "✅ SUPABASE API KEY: VALID AND WORKING!"
            echo "📊 Available models:"
            cat /tmp/openai_response2.json | grep -o '"id":"[^"]*"' | head -5
        else
            echo "❌ SUPABASE API KEY: FAILED (HTTP $RESPONSE)"
            echo "Response:"
            cat /tmp/openai_response2.json
        fi
    else
        echo "❌ No OPENAI_API_KEY found in supabase/functions/.env"
    fi
else
    echo "❌ No supabase/functions/.env file found"
fi

echo ""
echo "🎯 SUMMARY:"
echo "For RAG system to work, you need a valid key in:"
echo "   📁 /Users/parkercase/OmniDash/.env"
echo "   🔑 REACT_APP_OPENAI_API_KEY=sk-..."
echo ""
echo "Clean up temp files..."
rm -f /tmp/openai_response.json /tmp/openai_response2.json
