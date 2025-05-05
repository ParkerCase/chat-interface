// src/context/ThemeContext.jsx
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
  useEffect(() => {
    let mounted = true;

    // In ThemeContext.jsx, update loadThemes function:
    const loadThemes = async () => {
      try {
        setLoading(true);
        console.log("Loading themes from database...");

        // Try getting themes with a simpler query first
        const { data, error } = await supabase
          .from("themes")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error loading themes:", error);
          // Try fallback approach
          throw error;
        }

        if (mounted) {
          console.log(`Loaded ${data?.length || 0} themes successfully`);
          setAvailableThemes(data || []);
        }
      } catch (error) {
        console.error("Error loading themes:", error);
        if (mounted) {
          // Set default themes as fallback
          setAvailableThemes([
            {
              id: "default",
              name: "Default",
              description: "Default system theme",
              content: {
                primary: "#1976D2",
                background: "#FFFFFF",
                text: "#212121",
              },
            },
            {
              id: "dark",
              name: "Dark Mode",
              description: "Dark interface theme",
              content: {
                primary: "#90CAF9",
                background: "#121212",
                text: "#FFFFFF",
              },
            },
          ]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadThemes();

    return () => {
      mounted = false;
    };
  }, []);

  // Load user's theme preference
  useEffect(() => {
    if (!currentUser?.id || availableThemes.length === 0) return;

    const loadUserTheme = async () => {
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
          const selectedTheme = availableThemes.find(
            (theme) => theme.id === profile.theme_id
          );

          if (selectedTheme) {
            setCurrentTheme(selectedTheme);
            applyTheme(selectedTheme);
          }
        } else {
          // Default to "default" theme
          const defaultTheme = availableThemes.find(
            (theme) => theme.id === "default" || theme.isDefault
          );

          if (defaultTheme) {
            setCurrentTheme(defaultTheme);
            applyTheme(defaultTheme);
          }
        }
      } catch (error) {
        console.error("Error loading user theme:", error);
      }
    };

    loadUserTheme();
  }, [currentUser, availableThemes]);

  // Apply theme to CSS variables
  const applyTheme = (theme) => {
    console.log("Applying theme:", theme?.name);

    if (!theme?.content) {
      console.error("No theme content to apply");
      return;
    }

    const root = document.documentElement;

    // Apply theme variables
    Object.entries(theme.content).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Store theme preference
    localStorage.setItem("currentTheme", JSON.stringify(theme));

    // Handle dark mode
    const isDarkMode = theme.darkMode?.enabled || false;
    document.body.classList.toggle("dark-mode", isDarkMode);

    // Apply dark mode variables if available
    if (isDarkMode && theme.darkContent) {
      Object.entries(theme.darkContent).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
    }
  };

  // Change theme
  const changeTheme = async (themeId) => {
    if (!currentUser?.id) {
      // For non-logged in users, just apply the theme
      const theme = availableThemes.find((t) => t.id === themeId);
      if (theme) {
        setCurrentTheme(theme);
        applyTheme(theme);
      }
      return;
    }

    try {
      const theme = availableThemes.find((t) => t.id === themeId);
      if (!theme) {
        throw new Error("Theme not found");
      }

      // Update user's preference
      const { error } = await supabase
        .from("profiles")
        .update({ theme_id: themeId })
        .eq("id", currentUser.id);

      if (error) throw error;

      // Apply the theme
      setCurrentTheme(theme);
      applyTheme(theme);
    } catch (error) {
      console.error("Error changing theme:", error);
      throw error;
    }
  };

  // Create custom theme
  const createCustomTheme = async (name, description, content) => {
    try {
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
    if (!currentUser && !loading && availableThemes.length > 0) {
      const savedTheme = localStorage.getItem("currentTheme");
      if (savedTheme) {
        try {
          const theme = JSON.parse(savedTheme);
          // Verify the theme still exists in available themes
          const existingTheme = availableThemes.find((t) => t.id === theme.id);
          if (existingTheme) {
            setCurrentTheme(existingTheme);
            applyTheme(existingTheme);
          }
        } catch (e) {
          console.error("Error parsing saved theme:", e);
        }
      }
    }
  }, [currentUser, loading, availableThemes]);

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
