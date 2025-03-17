// Header.jsx - Updated with theme switcher
import React, { useState, useEffect } from "react";
import { LogOut, Moon, Sun, Palette } from "lucide-react";
import "./Header.css";

function Header({ onLogout }) {
  const [themes, setThemes] = useState([]);
  const [currentTheme, setCurrentTheme] = useState("default");
  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Fetch available themes
    fetch("http://147.182.247.128:4000/api/themes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.themes) {
          setThemes(data.themes);
        }
      })
      .catch((err) => console.error("Error loading themes:", err));

    // Check for stored theme preference
    const savedTheme = localStorage.getItem("preferredTheme") || "default";
    setCurrentTheme(savedTheme);

    // Check for dark mode preference
    const prefersDark =
      localStorage.getItem("darkMode") === "true" ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(prefersDark);
    if (prefersDark) {
      document.body.classList.add("dark-mode");
    }
  }, []);

  const changeTheme = (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem("preferredTheme", themeId);

    // Load theme CSS
    fetch(`http://147.182.247.128:4000/api/themes/${themeId}/css`)
      .then((res) => res.text())
      .then((css) => {
        // Apply the CSS to the page
        const styleEl =
          document.getElementById("theme-style") ||
          document.createElement("style");
        styleEl.id = "theme-style";
        styleEl.textContent = css;
        if (!document.getElementById("theme-style")) {
          document.head.appendChild(styleEl);
        }
      })
      .catch((err) => console.error("Error loading theme CSS:", err));

    setShowThemeOptions(false);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());

    if (newDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  };

  return (
    <header className="app-header">
      <div className="logo-container">
        <img
          src="/Tatt2Away-Color-Black-Logo-300.png"
          alt="Tatt2Away Logo"
          className="logo"
        />
        <h1>Tatt2Away AI Assistant</h1>
      </div>

      <div className="header-actions">
        <button
          onClick={toggleDarkMode}
          className="theme-toggle"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="theme-selector">
          <button
            onClick={() => setShowThemeOptions(!showThemeOptions)}
            className="theme-button"
            aria-expanded={showThemeOptions}
            aria-label="Select theme"
          >
            <Palette size={20} />
            <span>Theme</span>
          </button>

          {showThemeOptions && (
            <div className="theme-options">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => changeTheme(theme.id)}
                  className={currentTheme === theme.id ? "active" : ""}
                  style={{
                    "--theme-color": theme.preview?.primary || "#4f46e5",
                  }}
                >
                  <span className="theme-color-indicator"></span>
                  {theme.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="logout-button"
          aria-label="Log out"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
