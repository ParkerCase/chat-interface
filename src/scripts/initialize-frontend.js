// src/scripts/initialize-frontend.js
import { supabase } from "../lib/supabase";

/**
 * Initialize the frontend with default data and ensure all required tables exist
 */
export async function initializeFrontend() {
  console.log("Initializing frontend...");

  try {
    // Check if user is authenticated
    const { data: user, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated:", authError);
      return false;
    }

    // Check if user has a profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found, creating one...");

      // Create a profile if it doesn't exist
      const { error: createError } = await supabase.from("profiles").insert({
        id: user.user.id,
        email: user.user.email,
        full_name: user.user.email.split("@")[0], // Default name from email
        roles: ["user"],
        settings: {
          theme: "default",
          notifications: true,
        },
      });

      if (createError) {
        console.error("Error creating profile:", createError);
        return false;
      }
    }

    // Check if slack channels exist
    const { data: channels, error: channelsError } = await supabase
      .from("slack_channels")
      .select("*");

    if (channelsError) {
      console.error("Error checking channels:", channelsError);
      console.log("Please run the database schema SQL script first.");
      return false;
    }

    if (!channels || channels.length === 0) {
      console.log("No channels found, creating default channels...");

      // Create default channels
      const defaultChannels = [
        {
          name: "general",
          description: "General discussion",
          type: "general",
          admin_only: false,
        },
        {
          name: "admin-only",
          description: "Admin discussion",
          type: "general",
          admin_only: true,
        },
        {
          name: "knowledge-base",
          description: "Knowledge sharing",
          type: "knowledge",
          admin_only: false,
        },
      ];

      for (const channel of defaultChannels) {
        const { error } = await supabase.from("slack_channels").insert(channel);

        if (error) {
          console.error(`Error creating channel ${channel.name}:`, error);
        }
      }
    }

    // Check if default themes exist
    const { data: themes, error: themesError } = await supabase
      .from("themes")
      .select("*");

    if (themesError || !themes || themes.length === 0) {
      console.log("Creating default themes...");

      const defaultThemes = [
        {
          id: "default",
          name: "Default",
          description: "Default system theme",
          content: {
            primary: "#4f46e5",
            secondary: "#64748b",
            background: "#ffffff",
            surface: "#f8fafc",
            text: "#1f2937",
            "text-secondary": "#6b7280",
            border: "#e5e7eb",
            success: "#10b981",
            danger: "#ef4444",
            warning: "#f59e0b",
            info: "#3b82f6",
          },
        },
        {
          id: "dark",
          name: "Dark Mode",
          description: "Dark interface theme",
          content: {
            primary: "#6366f1",
            secondary: "#94a3b8",
            background: "#0f172a",
            surface: "#1e293b",
            text: "#f8fafc",
            "text-secondary": "#94a3b8",
            border: "#334155",
            success: "#10b981",
            danger: "#ef4444",
            warning: "#f59e0b",
            info: "#06b6d4",
          },
        },
      ];

      for (const theme of defaultThemes) {
        const { error } = await supabase.from("themes").insert(theme);

        if (error) {
          console.error(`Error creating theme ${theme.name}:`, error);
        }
      }
    }

    console.log("Frontend initialization complete!");
    return true;
  } catch (error) {
    console.error("Error during initialization:", error);
    return false;
  }
}

// Auto-run if this script is executed directly
if (typeof window !== "undefined") {
  initializeFrontend().then((success) => {
    if (success) {
      console.log("✅ Frontend initialized successfully");
    } else {
      console.error("❌ Frontend initialization failed");
    }
  });
}
