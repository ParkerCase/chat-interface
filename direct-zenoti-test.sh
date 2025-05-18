#!/bin/bash

# Save this as direct-zenoti-test.sh
echo "Testing direct Zenoti API access..."

# API credentials
API_KEY="fbc6eda6b8274b218b1bc3f036ccf76af182d536cb0e4952bc693b8df19018b5"
APP_ID="A34B1BC5-E598-4187-B2D9-0C37451EC58E"

# Try different header combinations
echo -e "\nTesting with X-API-KEY only..."
curl -s -X GET "https://api.zenoti.com/v1/centers" \
  -H "X-API-KEY: $API_KEY"

echo -e "\nTesting with X-APP-ID + X-API-KEY..."
curl -s -X GET "https://api.zenoti.com/v1/centers" \
  -H "X-API-KEY: $API_KEY" \
  -H "X-APP-ID: $APP_ID"

echo -e "\nTesting with different case (lowercase headers)..."
curl -s -X GET "https://api.zenoti.com/v1/centers" \
  -H "x-api-key: $API_KEY" \
  -H "x-app-id: $APP_ID"

echo -e "\nTesting with the test.zenoti.com endpoint..."
curl -s -X GET "https://test.api.zenoti.com/v1/centers" \
  -H "X-API-KEY: $API_KEY" \
  -H "X-APP-ID: $APP_ID"

echo -e "\nTesting with api2.zenoti.com endpoint..."
curl -s -X GET "https://api2.zenoti.com/v1/centers" \
  -H "X-API-KEY: $API_KEY" \
  -H "X-APP-ID: $APP_ID"