// src/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import apiService from "../services/apiService";

const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState("default");
  const [themeList, setThemeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enterpriseEnabled, setEnterpriseEnabled] = useState(false);

  // Load themes and user preference
  useEffect(() => {
    async function loadThemes() {
      try {
        setLoading(true);
        // Fetch available themes
        const themesResponse = await apiService.themes.getAll();

        if (themesResponse.data?.success) {
          setThemeList(themesResponse.data.themes);

          // Check for enterprise themes
          const hasEnterpriseThemes = themesResponse.data.themes.some(
            (theme) => theme.isEnterprise
          );
          setEnterpriseEnabled(hasEnterpriseThemes);
        }

        // Get user preference
        const prefResponse = await apiService.themes.getPreference();

        if (prefResponse.data?.success) {
          setCurrentTheme(prefResponse.data.themeId);
        }
      } catch (error) {
        console.error("Error loading themes:", error);
        setError("Failed to load themes");
      } finally {
        setLoading(false);
      }
    }

    loadThemes();
  }, []);

  // Update theme when currentTheme changes
  useEffect(() => {
    async function applyTheme() {
      if (!currentTheme) return;

      try {
        // Get theme CSS
        const cssResponse = await fetch(`/api/themes/${currentTheme}/css`);
        if (cssResponse.ok) {
          const css = await cssResponse.text();

          // Apply CSS
          const styleEl =
            document.getElementById("theme-stylesheet") ||
            document.createElement("style");
          styleEl.id = "theme-stylesheet";
          styleEl.textContent = css;

          if (!document.getElementById("theme-stylesheet")) {
            document.head.appendChild(styleEl);
          }

          // Save preference if user is logged in
          if (apiService.auth.isAuthenticated()) {
            apiService.themes.setPreference(currentTheme);
          } else {
            localStorage.setItem("preferredTheme", currentTheme);
          }
        }
      } catch (error) {
        console.error("Error applying theme:", error);
      }
    }

    applyTheme();
  }, [currentTheme]);

  // Set theme function
  const setTheme = (themeId) => {
    setCurrentTheme(themeId);
  };

  const value = {
    currentTheme,
    themeList,
    loading,
    error,
    setTheme,
    enterpriseEnabled,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
