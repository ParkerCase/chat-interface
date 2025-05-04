import React, { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { currentUser } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(null);
  const [availableThemes, setAvailableThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load available themes from Supabase
  // In ThemeContext.jsx, update the loadThemes function:
  // In ThemeContext.jsx, update the loadThemes useEffect:
  useEffect(() => {
    const loadThemes = async () => {
      try {
        setLoading(true);
        console.log("=== LOADING THEMES ===");

        const { data, error } = await supabase
          .from("themes")
          .select("*")
          .order("created_at", { ascending: true });

        console.log("Database query result:", { data, error });

        if (error) {
          console.error("Database error:", error);
          throw error;
        }

        console.log("Raw themes data:", data);

        if (data && data.length > 0) {
          console.log("Setting availableThemes to:", data);
          setAvailableThemes(data);

          // Check the state after setting
          console.log("Theme state after setting:", data);
        } else {
          console.warn("No themes found in database");
          setAvailableThemes([]);
        }
      } catch (error) {
        console.error("Error loading themes:", error);
        setAvailableThemes([]);
      } finally {
        setLoading(false);
        console.log("=== THEMES LOADING COMPLETE ===");
      }
    };

    loadThemes();
  }, []);

  // In ThemeContext.jsx, add more logging to track when availableThemes changes
  useEffect(() => {
    console.log("=== availableThemes CHANGED ===");
    console.log("Previous value:", availableThemes);
    console.log("New value:", availableThemes);
  }, [availableThemes]);

  // Add a check to ensure themes don't become undefined
  const safeMergedAvailableThemes = availableThemes || [];
  console.log("Safe themes for context:", safeMergedAvailableThemes);

  // Load user's theme preference
  useEffect(() => {
    const loadUserTheme = async () => {
      if (!currentUser?.id) return;

      try {
        // Get user's theme preference
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("theme_id")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (error) throw error;

        if (profile?.theme_id) {
          // Get the specific theme
          const { data: theme, error: themeError } = await supabase
            .from("themes")
            .select("*")
            .eq("id", profile.theme_id)
            .single();

          if (!themeError && theme) {
            setCurrentTheme(theme);
            applyTheme(theme);
          }
        }
      } catch (error) {
        console.error("Error loading user theme:", error);
      }
    };

    if (availableThemes.length > 0) {
      loadUserTheme();
    }
  }, [currentUser, availableThemes]);

  // Apply theme to CSS variables
  // In ThemeContext.jsx, update the applyTheme function:
  // In ThemeContext.jsx, update the applyTheme function with debug logs:
  const applyTheme = (theme) => {
    console.log("=== APPLYING THEME ===");
    console.log("Theme to apply:", theme);

    if (!theme?.content) {
      console.error("No theme content to apply");
      return;
    }

    const root = document.documentElement;
    console.log("Root element:", root);

    Object.entries(theme.content).forEach(([key, value]) => {
      console.log(`Setting --color-${key}: ${value}`);
      root.style.setProperty(`--color-${key}`, value);
    });

    localStorage.setItem("currentTheme", JSON.stringify(theme));
    console.log("=== THEME APPLIED ===");
  };

  // Change theme
  // In ThemeContext.jsx, update the changeTheme function:
  const changeTheme = async (themeId) => {
    console.log("=== CHANGE THEME CALLED ===");
    console.log("Theme ID:", themeId);
    console.log("Current user:", currentUser?.id);

    if (!currentUser?.id) {
      console.log("No user ID - applying theme directly");
      const theme = availableThemes.find((t) => t.id === themeId);
      if (theme) {
        console.log("Found theme, applying:", theme);
        setCurrentTheme(theme);
        applyTheme(theme);
      }
      return;
    }

    try {
      console.log("Finding theme...");
      const theme = availableThemes.find((t) => t.id === themeId);
      if (!theme) {
        console.error("Theme not found:", themeId);
        throw new Error("Theme not found");
      }

      console.log("Theme found:", theme);
      console.log("Updating user preference...");

      // Update user's preference
      const { error } = await supabase
        .from("profiles")
        .update({ theme_id: themeId })
        .eq("id", currentUser.id);

      if (error) {
        console.error("Error updating profile:", error);
        throw error;
      }

      console.log("Profile updated successfully");

      // Apply the theme
      console.log("Setting current theme...");
      setCurrentTheme(theme);
      console.log("Calling applyTheme...");
      applyTheme(theme);
      console.log("=== CHANGE THEME COMPLETE ===");
    } catch (error) {
      console.error("Error changing theme:", error);
      throw error;
    }
  };
  // Create custom theme
  const createCustomTheme = async (name, description, content) => {
    try {
      // Generate a unique ID
      const id = `custom-${Date.now()}`;

      const { data, error } = await supabase
        .from("themes")
        .insert([
          {
            id,
            name,
            description,
            content,
            author: currentUser?.email || "user",
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Update available themes
      setAvailableThemes((prev) => [...prev, data]);

      // Apply the new theme immediately
      await changeTheme(data.id);

      return data;
    } catch (error) {
      console.error("Error creating custom theme:", error);
      throw error;
    }
  };

  // Initialize from localStorage if user not logged in or loading
  useEffect(() => {
    if (!currentUser && !loading) {
      const savedTheme = localStorage.getItem("currentTheme");
      if (savedTheme) {
        try {
          const theme = JSON.parse(savedTheme);
          setCurrentTheme(theme);
          applyTheme(theme);
        } catch (e) {
          console.error("Error parsing saved theme:", e);
        }
      }
    }
  }, [currentUser, loading]);

  const value = {
    currentTheme,
    availableThemes,
    loading,
    changeTheme,
    createCustomTheme,
    applyTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
