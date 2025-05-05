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
  const [error, setError] = useState(null);
  const [enterpriseEnabled, setEnterpriseEnabled] = useState(false);

  // Load available themes from Supabase
  useEffect(() => {
    let mounted = true;

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

          // Check for enterprise themes
          const hasEnterpriseThemes = data.some(
            (theme) => theme.id === "tatt2away" || theme.id === "dark"
          );
          setEnterpriseEnabled(hasEnterpriseThemes);
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
                primary: "#4f46e5",
                secondary: "#64748b",
                background: "#FFFFFF",
                surface: "#f8fafc",
                text: "#1f2937",
                "text-secondary": "#6b7280",
                border: "#e5e7eb",
                success: "#10b981",
                danger: "#ef4444",
                warning: "#f59e0b",
                info: "#3b82f6",
              },
              darkContent: {
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
              isDefault: true,
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
              darkMode: {
                enabled: true,
              },
            },
          ]);
          setEnterpriseEnabled(true);
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
    const loadUserPreference = async () => {
      try {
        // First check if user is logged in and has a preference
        if (currentUser?.id) {
          try {
            const { data: profile, error } = await supabase
              .from("profiles")
              .select("theme_id")
              .eq("id", currentUser.id)
              .maybeSingle();

            if (!error && profile?.theme_id) {
              // Get the specific theme
              const selectedTheme = availableThemes.find(
                (theme) => theme.id === profile.theme_id
              );

              if (selectedTheme) {
                setCurrentTheme(selectedTheme);
                applyTheme(selectedTheme);
                return;
              }
            }
          } catch (e) {
            console.error("Error loading user theme preference:", e);
          }
        }

        // If not authenticated or no preference, use default from localStorage or 'default'
        const savedThemeJson = localStorage.getItem("currentTheme");
        let savedTheme;

        try {
          if (savedThemeJson) {
            savedTheme = JSON.parse(savedThemeJson);
            const themeExists = availableThemes.find(
              (t) => t.id === savedTheme.id
            );

            if (themeExists) {
              setCurrentTheme(themeExists);
              applyTheme(themeExists);
              return;
            }
          }
        } catch (e) {
          console.error("Error parsing saved theme:", e);
        }

        // Fall back to default theme
        const defaultTheme = availableThemes.find(
          (theme) => theme.id === "default" || theme.isDefault
        );

        if (defaultTheme) {
          setCurrentTheme(defaultTheme);
          applyTheme(defaultTheme);
        }
      } catch (err) {
        console.error("Error in theme initialization:", err);
        setError("Failed to load theme. Using default instead.");
      }
    };

    if (availableThemes.length > 0) {
      loadUserPreference();
    }
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
      // Set both --color-{key} and --{key} for maximum compatibility
      root.style.setProperty(`--color-${key}`, value);
      root.style.setProperty(`--${key}`, value);
    });

    // Store theme preference
    localStorage.setItem("currentTheme", JSON.stringify(theme));

    // Handle dark mode
    const isDarkMode = theme.darkMode?.enabled || false;

    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.add("dark");

      // Apply dark mode variables if available
      if (theme.darkContent) {
        Object.entries(theme.darkContent).forEach(([key, value]) => {
          root.style.setProperty(`--color-${key}`, value);
          root.style.setProperty(`--${key}`, value);
        });
      }
    } else {
      document.body.classList.remove("dark-mode");
      document.body.classList.remove("dark");
    }

    // Apply CSS to override any hardcoded colors
    ensureGlobalThemeOverrides(theme, isDarkMode);
  };

  // Ensure theme is applied to all components by adding global CSS overrides
  const ensureGlobalThemeOverrides = (theme, isDarkMode) => {
    // Get or create the theme override style sheet
    let styleSheet = document.getElementById("theme-override-styles");
    if (!styleSheet) {
      styleSheet = document.createElement("style");
      styleSheet.id = "theme-override-styles";
      document.head.appendChild(styleSheet);
    }

    // Add global overrides for common components
    const overrides = `
      /* Global color overrides */
      .admin-container { 
        background-color: var(--color-background) !important;
        color: var(--color-text) !important; 
      }
      
      .admin-section {
        background-color: var(--color-surface) !important;
        border-color: var(--color-border) !important;
      }
      
      .admin-nav-item {
        color: var(--color-text) !important;
      }
      
      .admin-nav-item.active {
        color: var(--color-primary) !important;
        border-color: var(--color-primary) !important;
      }
      
      button, .btn, .button {
        background-color: var(--color-primary);
        color: white;
      }
      
      button:hover, .btn:hover, .button:hover {
        background-color: var(--color-primary-hover);
      }
      
      input, select, textarea {
        background-color: var(--color-background) !important;
        color: var(--color-text) !important;
        border-color: var(--color-border) !important;
      }
      
      table, th, td {
        border-color: var(--color-border) !important;
      }
      
      /* Dark mode specific overrides */
      ${
        isDarkMode
          ? `
        .modal-container, .dropdown-menu, .dropdown-content {
          background-color: var(--color-surface) !important;
          color: var(--color-text) !important;
          border-color: var(--color-border) !important;
        }
      `
          : ""
      }
    `;

    styleSheet.textContent = overrides;
  };

  // Change theme
  const changeTheme = async (themeId) => {
    if (!themeId) return;

    try {
      const theme = availableThemes.find((t) => t.id === themeId);
      if (!theme) {
        throw new Error("Theme not found");
      }

      // If user is logged in, save preference to server
      if (currentUser?.id) {
        try {
          await supabase
            .from("profiles")
            .update({ theme_id: themeId })
            .eq("id", currentUser.id);
        } catch (err) {
          // If not authenticated, just save to localStorage (already done in applyTheme)
          console.log("Theme preference saved locally only");
        }
      }

      // Apply the theme
      setCurrentTheme(theme);
      applyTheme(theme);
      return true;
    } catch (error) {
      console.error("Error changing theme:", error);
      setError("Failed to change theme: " + error.message);
      return false;
    }
  };

  // Create custom theme
  const createCustomTheme = async (name, description, content) => {
    try {
      const id = `custom-${Date.now()}`;

      let themeData = {
        id,
        name,
        description,
        content,
        author: currentUser?.email || "user",
        created_at: new Date().toISOString(),
        isCustom: true,
      };

      // If user is logged in, save to database
      if (currentUser?.id) {
        const { data, error } = await supabase
          .from("themes")
          .insert([themeData])
          .select()
          .single();

        if (error) throw error;

        themeData = data;
      }

      // Update available themes
      setAvailableThemes((prev) => [...prev, themeData]);

      // Apply the new theme immediately
      await changeTheme(themeData.id);

      return themeData;
    } catch (error) {
      console.error("Error creating custom theme:", error);
      setError("Failed to create theme: " + error.message);
      throw error;
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (document.body.classList.contains("dark-mode")) {
      document.body.classList.remove("dark-mode");
      document.body.classList.remove("dark");
    } else {
      document.body.classList.add("dark-mode");
      document.body.classList.add("dark");
    }
  };

  // Get current theme ID for comparison
  const currentThemeId = currentTheme?.id || "default";

  const value = {
    currentTheme,
    currentThemeId,
    availableThemes,
    loading,
    error,
    changeTheme,
    createCustomTheme,
    applyTheme,
    toggleDarkMode,
    enterpriseEnabled,
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
