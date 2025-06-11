import { useAuth } from "../hooks/useAuth";
import { supabase } from "./supabaseClient";

export const useClaude = () => {
  const { user } = useAuth();

  const research = async (query, options = {}) => {
    // 1. Check cache
    const { data: cached } = await supabase
      .from("claude_responses")
      .select("*")
      .textSearch("search_vector", query)
      .eq("user_id", user.id)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(3);

    if (cached?.length > 0 && !options.forceNew) {
      return { cached: true, results: cached[0] };
    }

    // 2. Call Claude MCP (via your API route or directly if browser-safe)
    const response = await fetch("/api/claude-research", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${
          (
            await supabase.auth.getSession()
          ).data.session.access_token
        }`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        integrations: options.sources || [
          "zenoti",
          "closeio",
          "gdrive",
          "dropbox",
          "slack",
        ],
        researchMode: options.deep ? "thorough" : "quick",
      }),
    });

    const result = await response.json();

    // 3. Cache result
    await supabase.from("claude_responses").insert({
      user_id: user.id,
      query_text: query,
      response_data: result,
      sources_used: result.sources,
      citations: result.citations,
      research_duration: result.duration,
    });

    return { cached: false, results: result };
  };

  return { research };
};
