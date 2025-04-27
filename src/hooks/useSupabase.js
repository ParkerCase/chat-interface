// src/hooks/useSupabase.js
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

// Get Supabase URL and key from environment variables
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://rfnglcfyzoyqenofmsev.supabase.co";
const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg";

// Create a single Supabase client for the entire app
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Custom hook to access Supabase client throughout the app
 * @returns {object} Supabase client instance
 */
export function useSupabase() {
  return supabase;
}

/**
 * Hook to handle Supabase authentication state
 * @returns {object} Auth state and methods
 */
export function useSupabaseAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get current session
    const getSession = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data?.session) {
          const { data: userData } = await supabase.auth.getUser();
          setUser(userData?.user || null);
        }
      } catch (err) {
        console.error("Error getting auth session:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data } = await supabase.auth.getUser();
        setUser(data?.user || null);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup
    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  return { user, loading, error, supabase };
}

export default supabase;
