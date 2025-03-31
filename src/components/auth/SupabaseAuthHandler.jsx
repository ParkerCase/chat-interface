// src/components/auth/SupabaseAuthHandler.jsx
import React, { useEffect } from "react";
import { supabase, enhancedAuth } from "../../lib/supabase";

// This component acts as a direct handler for Supabase auth events
const SupabaseAuthHandler = () => {
  useEffect(() => {
    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Supabase auth event:", event);

      if (event === "SIGNED_IN") {
        console.log("User signed in, redirecting to admin...");
        // Small delay to allow state to update
        setTimeout(() => {
          // Force redirect to admin panel
          window.location.replace("/admin");
        }, 500);
      }
    });

    // Check on mount if we already have a session
    const checkExistingSession = async () => {
      const { data } = await enhancedAuth.getSession();
      if (data?.session) {
        console.log("Existing session found on mount");
        // Force redirect to admin panel
        window.location.replace("/admin");
      }
    };

    checkExistingSession();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // This component doesn't render anything
  return null;
};

export default SupabaseAuthHandler;
