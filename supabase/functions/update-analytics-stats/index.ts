import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const handler = async (event, context) => {
  try {
    const supabaseAdmin = context.supabaseAdmin;
    
    // Get active users in the last hour
    const { data: activeUsers, error: userError } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (userError) throw userError;
    
    // Get queries in the last hour
    const { count: queries, error: queryError } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "search")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (queryError) throw queryError;
    
    // Get error rate - errors divided by total requests
    const { count: errors, error: errorCountError } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "error")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (errorCountError) throw errorCountError;
    
    const { count: totalRequests, error: requestError } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["api_call", "search", "page_view"])
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (requestError) throw requestError;
    
    // Calculate error rate
    const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
    
    // Get average response time
    const { data: responseTimeData, error: timeError } = await supabaseAdmin
      .from("analytics_events")
      .select("data->responseTime")
      .eq("event_type", "api_call")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (timeError) throw timeError;
    
    let avgResponseTime = 0;
    if (responseTimeData && responseTimeData.length > 0) {
      const responseTimes = responseTimeData
        .map(item => parseFloat(item.data?.responseTime || 0))
        .filter(time => !isNaN(time));
      
      if (responseTimes.length > 0) {
        avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      }
    }
    
    // Update the analytics_stats table
    const { error: updateError } = await supabaseAdmin
      .from("analytics_stats")
      .upsert({
        id: 1,
        active_users: activeUsers?.count || 0,
        queries_last_hour: queries || 0,
        error_rate: errorRate,
        avg_response_time: avgResponseTime,
        updated_at: new Date().toISOString()
      });
      
    if (updateError) throw updateError;
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error("Error updating analytics stats:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};