#!/bin/bash

SUPABASE_URL="https://rfnglcfyzoyqenofmsev.functions.supabase.co"
SUPABASE_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg"
SIZE=100  # For paginated endpoints, if needed

CENTER_IDS=(
"56081b99-7e03-46de-b589-3f60cbd90556"
"dc196a75-018b-43a2-9c27-9f7b1cc8207f"
"982982ea-50ce-483f-a4e9-a8e5a76b4725"
"7110ab1d-5f3d-44b6-90ec-358029263a6a"
"d406abe6-6118-4d52-9794-546729918f52"
"90aa9708-4678-4c04-999e-63e4aff12f40"
)

START_DATE="2023-01-01"
END_DATE=$(date +"%Y-%m-01")  # First of this month

# Helper to increment month
next_month() {
  date -j -v+1m -f "%Y-%m-%d" "$1" +"%Y-%m-%d" 2>/dev/null || date -d "$1 +1 month" +"%Y-%m-%d"
}

for CENTER_ID in "${CENTER_IDS[@]}"; do
  echo "Syncing center: $CENTER_ID"

  # 1. Sync Services
  echo "  Syncing services..."
  curl -s -X POST "$SUPABASE_URL/zenoti-sync-services" \
    -H "Authorization: Bearer $SUPABASE_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"center_id\":\"$CENTER_ID\"}"
  sleep 2

  # 2. Sync Packages
  echo "  Syncing packages..."
  curl -s -X POST "$SUPABASE_URL/zenoti-sync-packages" \
    -H "Authorization: Bearer $SUPABASE_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"center_id\":\"$CENTER_ID\"}"
  sleep 2

  # 3. Sync Reports (Appointments, Cash, Accrual) by month
  current="$START_DATE"
  while [[ "$current" < "$END_DATE" ]]; do
    next=$(next_month "$current")
    echo "    Syncing appointments for $current to $next"
    curl -s -X POST "$SUPABASE_URL/zenoti-sync-appointments" \
      -H "Authorization: Bearer $SUPABASE_JWT" \
      -H "Content-Type: application/json" \
      -d "{\"center_id\":\"$CENTER_ID\", \"start_date\":\"$current\", \"end_date\":\"$next\"}"
    sleep 2

    echo "    Syncing cash report for $current to $next"
    curl -s -X POST "$SUPABASE_URL/zenoti-sync-cash-report" \
      -H "Authorization: Bearer $SUPABASE_JWT" \
      -H "Content-Type: application/json" \
      -d "{\"center_id\":\"$CENTER_ID\", \"start_date\":\"$current\", \"end_date\":\"$next\"}"
    sleep 2

    echo "    Syncing accrual report for $current to $next"
    curl -s -X POST "$SUPABASE_URL/zenoti-sync-accrual-report" \
      -H "Authorization: Bearer $SUPABASE_JWT" \
      -H "Content-Type: application/json" \
      -d "{\"center_id\":\"$CENTER_ID\", \"start_date\":\"$current\", \"end_date\":\"$next\"}"
    sleep 2

    current="$next"
  done
done