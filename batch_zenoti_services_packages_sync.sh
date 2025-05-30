#!/bin/bash

# Usage: ./batch_zenoti_services_packages_sync.sh
# This script will upsert all services (skipping the already-synced center) and all packages for every center into Supabase.

# SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co/functions/v1"
SUPABASE_URL="https://rfnglcfyzoyqenofmsev.supabase.co/functions/v1"
SUPABASE_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg"

# Get all center IDs from Supabase
CENTER_IDS=(
"56081b99-7e03-46de-b589-3f60cbd90556"
"dc196a75-018b-43a2-9c27-9f7b1cc8207f"
"982982ea-50ce-483f-a4e9-a8e5a76b4725"
"7110ab1d-5f3d-44b6-90ec-358029263a6a"
"d406abe6-6118-4d52-9794-546729918f52"
"90aa9708-4678-4c04-999e-63e4aff12f40"
)

# Center to skip for services
SKIP_CENTER_ID="90aa9708-4678-4c04-999e-63e4aff12f40"

echo "Syncing services and packages for all centers..."

for CENTER_ID in "${CENTER_IDS[@]}"; do
  # Sync services (skip the already-synced center)
  if [[ "$CENTER_ID" != "$SKIP_CENTER_ID" ]]; then
    echo "  Syncing services for center: $CENTER_ID"
    curl -s -X POST "$SUPABASE_URL/zenoti-sync-services" \
      -H "Authorization: Bearer $SUPABASE_JWT" \
      -H "Content-Type: application/json" \
      -d "{\"center_id\":\"$CENTER_ID\"}"
    sleep 2
  else
    echo "  Skipping services for center: $CENTER_ID (already synced)"
  fi

  # Sync packages (no skip)
  echo "  Syncing packages for center: $CENTER_ID"
  curl -s -X POST "$SUPABASE_URL/zenoti-sync-packages" \
    -H "Authorization: Bearer $SUPABASE_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"center_id\":\"$CENTER_ID\"}"
  sleep 2

done

echo "All services and packages sync complete." 