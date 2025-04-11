// Header.jsx - Updated with theme switcher and user profile display
import React, { useState, useEffect } from "react";
import { LogOut, Moon, Sun, Palette, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Header.css";

function Header({ onLogout, currentUser: propCurrentUser }) {
  const { currentUser: contextCurrentUser, getCurrentUser } = useAuth();
  const [themes, setThemes] = useState([]);
  const [currentTheme, setCurrentTheme] = useState("default");
  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userData, setUserData] = useState(null);

  // Use user data from props or context, and refresh it on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Attempt to get fresh user data
        const freshUserData = await getCurrentUser();
        if (freshUserData) {
          setUserData(freshUserData);
        } else if (propCurrentUser) {
          setUserData(propCurrentUser);
        } else if (contextCurrentUser) {
          setUserData(contextCurrentUser);
        }
      } catch (error) {
        console.error("Error fetching current user in Header:", error);
        // Use whatever user data is available as fallback
        setUserData(propCurrentUser || contextCurrentUser);
      }
    };

    fetchCurrentUser();
  }, [propCurrentUser, contextCurrentUser, getCurrentUser]);

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
        {/* User profile display */}
        {userData && (
          <div className="user-profile">
            <div className="user-avatar">
              <User size={16} />
            </div>
            <span className="user-name">{userData.name}</span>
          </div>
        )}
        
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
