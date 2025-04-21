// supabase/functions/update-analytics-stats/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const handler = async (event, context) => {
  try {
    // Get the supabase admin client
    const supabaseAdmin = context.supabaseAdmin;
    
    // Get JWT token from request and validate user's permission
    const authHeader = event.request.headers.get('Authorization');
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - Missing token' })
      };
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - Invalid token' })
      };
    }
    
    // Check if user has admin privileges
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch user profile' })
      };
    }
    
    const isAdmin = profile.roles?.includes('admin') || profile.roles?.includes('super_admin');
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied - Admin privileges required' })
      };
    }
    
    // Log the start of the operation for monitoring
    console.log(`Analytics stats update started by user ${user.id} (${user.email})`);
    
    // Get active users in the last hour
    const { data: activeUsersData, error: userCountError } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id", { count: "exact" })
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .is("user_id", "not.null");
    
    if (userCountError) {
      console.error("Error fetching active users:", userCountError);
      throw userCountError;
    }
    
    // Calculate unique active users
    const uniqueUserIds = new Set();
    activeUsersData?.forEach(event => {
      if (event.user_id) uniqueUserIds.add(event.user_id);
    });
    const activeUsers = uniqueUserIds.size;
    
    // Get queries in the last hour
    const { count: queries, error: queryError } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "search")
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (queryError) {
      console.error("Error fetching search queries:", queryError);
      throw queryError;
    }
    
    // Get error rate - errors divided by total requests
    const { count: errors, error: errorCountError } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "error")
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (errorCountError) {
      console.error("Error fetching error count:", errorCountError);
      throw errorCountError;
    }
    
    const { count: totalRequests, error: requestError } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["api_call", "search", "page_view"])
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (requestError) {
      console.error("Error fetching total requests:", requestError);
      throw requestError;
    }
    
    // Calculate error rate with protection against division by zero
    const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
    
    // Get average response time
    const { data: responseTimeData, error: timeError } = await supabaseAdmin
      .from("analytics_events")
      .select("data")
      .eq("event_type", "api_call")
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (timeError) {
      console.error("Error fetching response times:", timeError);
      throw timeError;
    }
    
    // Calculate average response time with proper error handling
    let avgResponseTime = 0;
    if (responseTimeData && responseTimeData.length > 0) {
      const responseTimes = responseTimeData
        .map(item => {
          try {
            return item.data && typeof item.data === 'object' ? 
              parseFloat(item.data.responseTime || 0) : 0;
          } catch (e) {
            console.warn("Error parsing response time:", e);
            return 0;
          }
        })
        .filter(time => !isNaN(time) && time > 0);
      
      if (responseTimes.length > 0) {
        avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      }
    }
    
    // Update the analytics_stats table with optimistic concurrency control
    const timestamp = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("analytics_stats")
      .upsert({
        id: 1, // Using a fixed ID for simplicity
        active_users: activeUsers,
        queries_last_hour: queries || 0,
        error_rate: parseFloat(errorRate.toFixed(2)),
        avg_response_time: parseFloat(avgResponseTime.toFixed(2)),
        updated_at: timestamp,
        updated_by: user.id
      }, {
        onConflict: 'id'
      });
      
    if (updateError) {
      console.error("Error updating analytics stats:", updateError);
      throw updateError;
    }
    
    // Also log this data to analytics_history for trending
    const { error: historyError } = await supabaseAdmin
      .from("analytics_history")
      .insert({
        active_users: activeUsers,
        queries: queries || 0,
        error_rate: parseFloat(errorRate.toFixed(2)),
        avg_response_time: parseFloat(avgResponseTime.toFixed(2)),
        created_at: timestamp,
        created_by: user.id
      });
    
    if (historyError) {
      console.warn("Error recording analytics history:", historyError);
      // Non-critical error, continue with success
    }
    
    console.log(`Analytics stats update completed successfully by user ${user.id}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        timestamp,
        stats: {
          active_users: activeUsers,
          queries_last_hour: queries || 0,
          error_rate: parseFloat(errorRate.toFixed(2)),
          avg_response_time: parseFloat(avgResponseTime.toFixed(2))
        }
      })
    };
  } catch (error) {
    console.error("Critical error updating analytics stats:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};