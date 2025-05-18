#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API credentials
USERNAME="parker@tatt2away.com"
PASSWORD="January_0119!"
API_KEY="fbc6eda6b8274b218b1bc3f036ccf76af182d536cb0e4952bc693b8df19018b5"
APP_ID="A34B1BC5-E598-4187-B2D9-0C37451EC58E"
API_SECRET="dfbc618cb2fb4173889537c475f79671607f85f855874db0808fa8cb29e3871e"

echo -e "${BLUE}=== Testing Zenoti API Access ===${NC}"

# 1. Test OAuth authentication
echo -e "\n${BLUE}Testing OAuth Authentication...${NC}"
OAUTH_RESPONSE=$(curl -s -X POST "https://api.zenoti.com/v1/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=$USERNAME&password=$PASSWORD")

echo "OAuth Response: $OAUTH_RESPONSE"

if [[ "$OAUTH_RESPONSE" == *"access_token"* ]]; then
  echo -e "${GREEN}OAuth Authentication Successful!${NC}"
  TOKEN=$(echo $OAUTH_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
  
  # Test using OAuth token
  echo -e "\n${BLUE}Testing API call with OAuth token...${NC}"
  CENTERS_RESPONSE=$(curl -s "https://api.zenoti.com/v1/centers" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-API-KEY: $API_KEY")
  
  echo "Centers Response: ${CENTERS_RESPONSE:0:200}..."
  
  if [[ "$CENTERS_RESPONSE" == *"centers"* ]]; then
    echo -e "${GREEN}API call with OAuth token successful!${NC}"
  else
    echo -e "${RED}API call with OAuth token failed${NC}"
  fi
else
  echo -e "${RED}OAuth Authentication Failed: $OAUTH_RESPONSE${NC}"
fi

# 2. Test API Key + App ID authentication
echo -e "\n${BLUE}Testing API Key + App ID Authentication...${NC}"
CENTERS_RESPONSE=$(curl -s "https://api.zenoti.com/v1/centers" \
  -H "X-API-KEY: $API_KEY" \
  -H "X-APP-ID: $APP_ID")

echo "Centers Response: ${CENTERS_RESPONSE:0:200}..."

if [[ "$CENTERS_RESPONSE" == *"centers"* ]]; then
  echo -e "${GREEN}API Key + App ID Authentication successful!${NC}"
else
  echo -e "${RED}API Key + App ID Authentication failed${NC}"
fi

# 3. Test with API v2 endpoint
echo -e "\n${BLUE}Testing with API v2 endpoint...${NC}"
V2_RESPONSE=$(curl -s "https://api.zenoti.com/v2/centers" \
  -H "X-API-KEY: $API_KEY" \
  -H "X-APP-ID: $APP_ID")

echo "V2 Response: ${V2_RESPONSE:0:200}..."

if [[ "$V2_RESPONSE" == *"centers"* ]]; then
  echo -e "${GREEN}API v2 call successful!${NC}"
else
  echo -e "${RED}API v2 call failed${NC}"
fi

