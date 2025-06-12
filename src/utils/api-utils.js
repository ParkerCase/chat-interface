// src/utils/api-utils.js
// Constants and API utility functions

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

// Configuration - Using environment variables with fallbacks
export const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  endpoints: {
    chat: "/api/chat",
    search: "/api/search/image",
    visualSearch: "/search/visual",
    analyzePath: "/api/analyze/path",
    status: "/status/check",
  },
};

// Enhanced utility function for API calls with timeout and retry
export const fetchWithTimeout = async (url, options, timeout = 60000) => {
  // Use a longer timeout for image-related endpoints
  if (url.includes("/image") || url.includes("/search/visual")) {
    timeout = 300000; // 5 minutes for image processing
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. The server is taking too long to respond."
      );
    }

    throw error;
  }
};

export function cn(...args) {
  return args.filter(Boolean).join(" ");
}

export function useSessionTracker(user) {
  useEffect(() => {
    if (!user) return;

    // On mount, create session
    const createSession = async () => {
      await supabase.from("sessions").insert({
        user_id: user.id,
        is_current: true,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      });
    };
    createSession();

    // On activity, update last_active every 5 min
    const interval = setInterval(async () => {
      await supabase
        .from("sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_current", true);
    }, 5 * 60 * 1000);

    // On unmount, mark session as not current
    return () => {
      clearInterval(interval);
      supabase
        .from("sessions")
        .update({ is_current: false })
        .eq("user_id", user.id)
        .eq("is_current", true);
    };
  }, [user]);
}
