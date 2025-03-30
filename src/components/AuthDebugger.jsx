// src/components/AuthDebugger.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const AuthDebugger = () => {
  const { currentUser } = useAuth();
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkSupabaseSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSupabaseSession(data.session);
      } catch (err) {
        setError(err.message);
      }
    };

    checkSupabaseSession();
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        backgroundColor: "#f0f0f0",
        padding: "10px",
        border: "1px solid #ccc",
        zIndex: 9999,
        maxWidth: "300px",
        fontSize: "12px",
      }}
    >
      <h4>Auth Debugger</h4>
      <div>
        <strong>Local Auth State:</strong>{" "}
        {currentUser ? "✅ Logged in" : "❌ Not logged in"}
        {currentUser && (
          <div>
            <div>Email: {currentUser.email}</div>
            <div>Roles: {currentUser.roles?.join(", ") || "none"}</div>
          </div>
        )}
      </div>
      <div>
        <strong>Supabase Session:</strong>{" "}
        {supabaseSession ? "✅ Active" : "❌ None"}
      </div>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
    </div>
  );
};

export default AuthDebugger;
