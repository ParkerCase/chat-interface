# Quick OpenAI API Key Test

## Run this in your terminal:

```bash
cd /Users/parkercase/OmniDash
chmod +x test-openai-key.sh
./test-openai-key.sh
```

## Alternative: Quick Manual Test

If the script doesn't work, test manually:

```bash
# Test your current key from root .env
API_KEY=$(grep "REACT_APP_OPENAI_API_KEY" .env | cut -d '=' -f2)
curl -H "Authorization: Bearer $API_KEY" https://api.openai.com/v1/models
```

## Expected Results:

**✅ Valid Key (200 response):**
```json
{
  "object": "list",
  "data": [
    {"id": "gpt-3.5-turbo", "object": "model", ...},
    {"id": "text-embedding-ada-002", "object": "model", ...}
  ]
}
```

**❌ Invalid Key (401 response):**
```json
{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error"
  }
}
```

## If Key is Invalid:

1. **Get a new one**: https://platform.openai.com/api-keys
2. **Add to root .env**:
   ```
   REACT_APP_OPENAI_API_KEY=sk-your-new-key-here
   ```
3. **Restart your dev server**
4. **Test again**

The RAG system will immediately start working once the key is valid!
