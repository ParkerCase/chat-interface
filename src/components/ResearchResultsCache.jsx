import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function ResearchResultsCache({ userId }) {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userId) return;
    const fetchResults = async () => {
      let query = supabase
        .from("claude_responses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (search) query = query.textSearch("search_vector", search);
      const { data } = await query;
      setResults(data || []);
    };
    fetchResults();
  }, [userId, search]);

  return (
    <div className="results-cache">
      <input
        type="text"
        placeholder="Search past research..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul>
        {results.map((r) => (
          <li key={r.id}>
            <b>{r.query_text}</b>
            <div>{r.response_data?.content?.slice(0, 200)}...</div>
            <small>{new Date(r.created_at).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
