# Zenoti Integration Testing Guide

This document provides comprehensive testing instructions for the Zenoti integration with Supabase Functions. The integration consists of several Edge Functions deployed to Supabase that communicate with the Zenoti API, as well as a client-side service to interact with these functions.

## Prerequisites

Before testing, ensure you have:

1. Access to a Zenoti account with valid API credentials
2. Supabase project with Edge Functions capability
3. Required database tables:
   - `integrations` - Stores Zenoti API configuration
   - `integration_logs` - Logs integration activities
   - `profiles` - User profiles with roles for access control
   - `zenoti_centers` - Caches center information

## Deployment Steps

1. Deploy all functions to Supabase:

```bash
# Navigate to the supabase/functions directory
cd supabase/functions

# Deploy each function
supabase functions deploy zenoti-clients --no-verify-jwt
supabase functions deploy zenoti-appointments --no-verify-jwt
supabase functions deploy zenoti-config
supabase functions deploy zenoti-connector
supabase functions deploy zenoti-services --no-verify-jwt
```

2. Set the required environment variables:

```bash
supabase secrets set SUPABASE_URL=https://your-project-id.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing Plan

### 1. Configuration Testing

#### Test the Configuration Function

```bash
# Test retrieving configuration (requires authentication)
curl -X GET "https://rfnglcfyzoyqenofmsev.supabasebasedomain.co/functions/v1/zenoti-config" \
  -H "Authorization: Bearer ${SUPABASE_AUTH_TOKEN}" \
  -H "Content-Type: application/json"

# Test setting configuration (requires admin role)
curl -X POST "https://rfnglcfyzoyqenofmsev.supabasebasedomain.co/functions/v1/zenoti-config" \
  -H "Authorization: Bearer ${SUPABASE_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "set",
    "config": {
      "apiUrl": "https://api.zenoti.com/v1",
      "apiKey": "your-api-key",
      "username": "your-username",
      "password": "your-password",
      "useOAuth": true,
      "defaultCenterCode": "AUS"
    }
  }'

# Test connection
curl -X POST "https://rfnglcfyzoyqenofmsev.supabasebasedomain.co/functions/v1/zenoti-config" \
  -H "Authorization: Bearer ${SUPABASE_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test",
    "config": {
      "apiUrl": "https://api.zenoti.com/v1",
      "apiKey": "your-api-key",
      "username": "your-username",
      "password": "your-password",
      "useOAuth": true
    }
  }'
```

#### Test in the UI

1. Log in as an admin user
2. Navigate to the Zenoti configuration section
3. Enter configuration details and save
4. Test the connection using the UI

### 2. Zenoti Connector Testing

The connector is a core function that handles all Zenoti API requests. Test it directly:

```bash
# Test fetching centers
curl -X POST "https://rfnglcfyzoyqenofmsev.supabase.co/functions/v1/zenoti-connector" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "centers",
    "method": "GET",
    "requiresAuth": true
  }'
```

### 3. Clients API Testing

```bash
# Test fetching clients for a specific center
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-clients?centerCode=AUS&limit=10" \
  -H "Content-Type: application/json"

# Test searching for clients
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-clients?centerCode=AUS&query=smith&limit=10" \
  -H "Content-Type: application/json"
```

### 4. Appointments API Testing

```bash
# Test fetching appointments for a specific date range
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-appointments?centerCode=AUS&startDate=2023-05-01&endDate=2023-05-07" \
  -H "Content-Type: application/json"

# Test fetching appointments for a specific client
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-appointments?centerCode=AUS&clientId=12345" \
  -H "Content-Type: application/json"

# Test fetching appointments for a specific therapist
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-appointments?centerCode=AUS&therapistId=67890" \
  -H "Content-Type: application/json"
```

### 5. Services API Testing

```bash
# Test fetching all services for a center
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-services?centerCode=AUS" \
  -H "Content-Type: application/json"

# Test fetching a specific service
curl -X GET "https://your-project-id.supabasebasedomain.co/functions/v1/zenoti-services?serviceId=12345" \
  -H "Content-Type: application/json"
```

### 6. Frontend Service Testing

In the browser console or within your application code, test the `supabaseZenotiService.js` methods:

```javascript
// Test configuration and connection
const configStatus = await supabaseZenotiService.checkConnectionStatus();
console.log("Configuration status:", configStatus);

// Test fetching centers
const centers = await supabaseZenotiService.getCenters();
console.log("Centers:", centers);

// Test searching clients
const clients = await supabaseZenotiService.searchClients({
  centerCode: "AUS",
  query: "smith",
  limit: 10,
});
console.log("Clients:", clients);

// Test fetching appointments
const appointments = await supabaseZenotiService.getAppointments({
  centerCode: "AUS",
  startDate: "2023-05-01",
  endDate: "2023-05-07",
});
console.log("Appointments:", appointments);

// Test fetching services
const services = await supabaseZenotiService.getServices({
  centerCode: "AUS",
});
console.log("Services:", services);
```

### 7. End-to-End Testing Scenarios

Test the complete flow by performing these scenarios:

1. **Configuration and Connection**

   - Configure Zenoti integration with valid credentials
   - Verify connection status shows "connected"
   - Try with invalid credentials and verify proper error handling

2. **Center Management**

   - Fetch all available centers
   - Verify centers are correctly cached in the database
   - Verify UI displays centers correctly

3. **Client Search and Management**

   - Search for clients using various criteria
   - Verify client information is formatted correctly
   - Test pagination with large result sets

4. **Appointment Management**

   - Fetch appointments for various date ranges
   - Filter appointments by therapist and client
   - Verify appointment details are complete and correctly formatted

5. **Service Catalog**
   - Fetch all services
   - Get details for specific services
   - Verify service pricing and duration information is correct

## Troubleshooting

### Common Issues

1. **Authentication Failures**

   - Check that your Zenoti API key is valid
   - Verify username/password for OAuth
   - Confirm the API URL is correct

2. **Function Deployment Issues**

   - Check for any TypeScript errors using `tsc` before deployment
   - Verify all dependencies are available in the functions
   - Check Supabase logs for detailed error messages

3. **CORS Issues**

   - Ensure CORS headers are included in all responses
   - Check that preflight OPTIONS requests are handled correctly

4. **Rate Limiting**
   - If you receive 429 errors, you may be hitting Zenoti API rate limits
   - Implement exponential backoff in your application

### Debugging Tools

1. **Function Logs**

   - Access Supabase Function logs in the dashboard
   - Add detailed console.log statements for debugging

2. **Network Monitoring**

   - Use browser developer tools to monitor API calls
   - Check response headers and status codes

3. **Database Inspection**
   - Directly query tables to verify data is being stored correctly
   - Check integration_logs for error records

## Best Practices

1. **Security**

   - Never expose API keys or credentials in client-side code
   - Always use secure connections (HTTPS)
   - Implement proper role-based access control

2. **Performance**

   - Use caching where appropriate (e.g., centers, services)
   - Minimize API calls by batching requests where possible
   - Use pagination for large data sets

3. **Error Handling**

   - Always provide meaningful error messages
   - Gracefully handle API failures
   - Log detailed error information for debugging

4. **Maintenance**
   - Regularly test the integration to ensure it remains functional
   - Keep an eye on Zenoti API changes or updates
   - Update your integration when necessary

## Conclusion

A thorough testing approach will ensure your Zenoti integration functions correctly in all scenarios. Following this guide should help you identify and resolve any issues before they impact users.

Remember to update these tests as you add new functionality or modify existing features.
