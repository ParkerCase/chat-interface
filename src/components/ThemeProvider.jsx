// src/components/ThemeProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

// Create Theme Context
const ThemeContext = createContext();

/**
 * Theme Provider Component
 *
 * Manages theme state, loading, and switching throughout the application
 * Provides theme context to all child components
 */
export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState("default");
  const [themeList, setThemeList] = useState([]);
  const [themeData, setThemeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enterpriseEnabled, setEnterpriseEnabled] = useState(false);

  // Load user's theme preference on initial mount
  useEffect(() => {
    // In ThemeProvider.jsx useEffect
    console.log(
      "Enterprise mode enabled:",
      process.env.TIER === "enterprise" || global.enterpriseInitialized
    );
    console.log("Enterprise features enabled:", enterpriseEnabled);
    const loadUserPreference = async () => {
      try {
        setLoading(true);
        // First check if user is logged in and has a preference
        try {
          const { data } = await axios.get("/api/themes/preference");
          if (data.success && data.themeId) {
            setCurrentTheme(data.themeId);
          }
        } catch (e) {
          // If not authenticated or no preference, use default from localStorage or 'default'
          const savedTheme = localStorage.getItem("theme") || "default";
          setCurrentTheme(savedTheme);
        }

        // Load all available themes
        const { data } = await axios.get("/api/themes");
        if (data.success) {
          setThemeList(data.themes);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading theme preference:", err);
        setError("Failed to load theme. Using default instead.");
        setCurrentTheme("default");
        setLoading(false);
      }
    };

    loadUserPreference();
  }, []);

  // Load theme CSS and data when currentTheme changes
  useEffect(() => {
    const loadThemeData = async () => {
      try {
        // Save current theme to localStorage
        localStorage.setItem("theme", currentTheme);

        // Get the theme data from API
        const { data } = await axios.get(`/api/themes/${currentTheme}`);
        if (data.success) {
          setThemeData(data.theme);
        }

        // Load the theme CSS
        loadThemeCSS(currentTheme);
        const hasEnterpriseThemes = themeList.some(
          (theme) => theme.id === "tatt2away" || theme.id === "dark"
        );
        setEnterpriseEnabled(hasEnterpriseThemes);
      } catch (error) {
        console.error("Error loading theme data:", err);
        setError("Failed to load theme data");
      }
    };

    if (currentTheme) {
      loadThemeData();
    }
  }, [currentTheme]);

  // Function to load theme CSS
  const loadThemeCSS = (themeId) => {
    // Check if theme stylesheet already exists
    const existingLink = document.getElementById("theme-stylesheet");
    if (existingLink) {
      // Update href if it exists
      existingLink.href = `/api/themes/${themeId}/css`;
    } else {
      // Create new stylesheet link if it doesn't exist
      const link = document.createElement("link");
      link.id = "theme-stylesheet";
      link.rel = "stylesheet";
      link.href = `/api/themes/${themeId}/css`;
      document.head.appendChild(link);
    }

    // Apply dark mode class if theme has dark mode enabled
    const prefersDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (themeData?.darkMode?.enabled && prefersDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  };

  // Function to set theme
  const setTheme = async (themeId) => {
    if (!themeId || themeId === currentTheme) return;

    setCurrentTheme(themeId);

    // If user is logged in, save preference to server
    try {
      await axios.post("/api/themes/preference", { themeId });
    } catch (err) {
      // If not authenticated, just save to localStorage (already done in useEffect)
      console.log("Theme preference saved locally only");
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (document.body.classList.contains("dark-mode")) {
      document.body.classList.remove("dark-mode");
    } else {
      document.body.classList.add("dark-mode");
    }
  };

  // Create context value
  const contextValue = {
    currentTheme,
    themeList,
    themeData,
    loading,
    error,
    setTheme,
    enterpriseEnabled,

    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// --- Theme Switcher Component ---

/**
 * ThemeSwitcher Component
 *
 * Provides UI for users to switch between available themes
 */
export const ThemeSwitcher = () => {
  const { themeList, currentTheme, setTheme, loading } = useTheme();

  if (loading) {
    return <div>Loading themes...</div>;
  }

  return (
    <div className="theme-switcher">
      <label htmlFor="theme-select">Theme: </label>
      <select
        id="theme-select"
        value={currentTheme}
        onChange={(e) => setTheme(e.target.value)}
        className="form-select"
      >
        {themeList.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name} {theme.isDefault ? "(Default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
};

// --- Dark Mode Toggle Component ---

/**
 * DarkModeToggle Component
 *
 * Toggle button for dark mode
 */
export const DarkModeToggle = () => {
  const { themeData, toggleDarkMode } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.body.classList.contains("dark-mode"));

    // Listen for changes in system preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (themeData?.darkMode?.enabled) {
        if (e.matches) {
          document.body.classList.add("dark-mode");
          setIsDarkMode(true);
        } else {
          document.body.classList.remove("dark-mode");
          setIsDarkMode(false);
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeData]);

  if (!themeData?.darkMode?.enabled) {
    return null; // Don't render toggle if dark mode not enabled for theme
  }

  return (
    <button
      onClick={() => {
        toggleDarkMode();
        setIsDarkMode(!isDarkMode);
      }}
      className="btn"
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDarkMode ? "🌞" : "🌙"}
    </button>
  );
};

// --- Theme Admin Panel Component ---

/**
 * ThemeAdminPanel Component
 *
 * Admin interface for managing themes
 * Requires admin privileges
 */
export const ThemeAdminPanel = () => {
  const { themeList, setTheme, currentTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    content: {},
  });
  const [statusMessage, setStatusMessage] = useState("");

  // Load theme data for editing
  const loadThemeForEdit = async (themeId) => {
    try {
      const { data } = await axios.get(`/api/themes/${themeId}`);
      if (data.success) {
        setSelectedTheme(data.theme);
        setFormData({
          id: themeId,
          name: data.theme.name || "",
          description: data.theme.description || "",
          content: data.theme,
        });
        setIsEditing(true);
      }
    } catch (err) {
      setStatusMessage(`Error loading theme: ${err.message}`);
    }
  };

  // Save theme changes
  const saveTheme = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.put(`/api/themes/${formData.id}`, {
        name: formData.name,
        description: formData.description,
        content: formData.content,
      });

      if (data.success) {
        setStatusMessage("Theme saved successfully!");
        setIsEditing(false);
        window.location.reload(); // Refresh to update theme list
      }
    } catch (err) {
      setStatusMessage(`Error saving theme: ${err.message}`);
    }
  };

  // Create new theme
  const createTheme = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`/api/themes`, {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        content: formData.content,
      });

      if (data.success) {
        setStatusMessage("Theme created successfully!");
        setIsEditing(false);
        window.location.reload(); // Refresh to update theme list
      }
    } catch (err) {
      setStatusMessage(`Error creating theme: ${err.message}`);
    }
  };

  // Delete theme
  const deleteTheme = async (themeId) => {
    if (!window.confirm("Are you sure you want to delete this theme?")) {
      return;
    }

    try {
      const { data } = await axios.delete(`/api/themes/${themeId}`);
      if (data.success) {
        setStatusMessage("Theme deleted successfully!");
        window.location.reload(); // Refresh to update theme list
      }
    } catch (err) {
      setStatusMessage(`Error deleting theme: ${err.message}`);
    }
  };

  // Import theme
  const importTheme = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("theme-import-file");
    if (!fileInput.files || fileInput.files.length === 0) {
      setStatusMessage("Please select a file to import");
      return;
    }

    const formData = new FormData();
    formData.append("theme", fileInput.files[0]);

    try {
      const { data } = await axios.post("/api/themes/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.success) {
        setStatusMessage(`Theme imported: ${data.theme.name}`);
        window.location.reload(); // Refresh to update theme list
      }
    } catch (err) {
      setStatusMessage(`Error importing theme: ${err.message}`);
    }
  };

  // Export theme
  const exportTheme = (themeId, format = "json") => {
    window.open(`/api/themes/${themeId}/export?format=${format}`, "_blank");
  };

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle JSON editor changes
  const handleJsonChange = (e) => {
    try {
      const content = JSON.parse(e.target.value);
      setFormData((prev) => ({
        ...prev,
        content,
      }));
    } catch (err) {
      // Invalid JSON - ignore for now
    }
  };

  if (isEditing) {
    return (
      <div className="theme-admin-panel">
        <h2>{formData.id ? "Edit Theme" : "Create Theme"}</h2>

        {statusMessage && (
          <div className="alert alert-info">{statusMessage}</div>
        )}

        <form onSubmit={formData.id ? saveTheme : createTheme}>
          <div className="form-group">
            <label htmlFor="theme-id">ID</label>
            <input
              type="text"
              id="theme-id"
              name="id"
              value={formData.id}
              onChange={handleChange}
              className="form-control"
              disabled={!!formData.id} // Disable if editing existing theme
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="theme-name">Name</label>
            <input
              type="text"
              id="theme-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="theme-description">Description</label>
            <textarea
              id="theme-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="theme-content">Theme JSON</label>
            <textarea
              id="theme-content"
              name="contentJson"
              value={JSON.stringify(formData.content, null, 2)}
              onChange={handleJsonChange}
              className="form-control code-editor"
              rows={15}
              required
            />
          </div>

          <div className="button-group">
            <button type="submit" className="btn btn-primary">
              {formData.id ? "Save Changes" : "Create Theme"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="theme-admin-panel">
      <h2>Theme Management</h2>

      {statusMessage && <div className="alert alert-info">{statusMessage}</div>}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormData({
              id: "",
              name: "",
              description: "",
              content: {
                colors: {
                  primary: "#1976D2",
                  background: "#FFFFFF",
                  text: {
                    primary: "#212121",
                  },
                },
              },
            });
            setIsEditing(true);
          }}
        >
          Create New Theme
        </button>

        <div className="import-form">
          <input type="file" id="theme-import-file" accept=".json" />
          <button className="btn btn-secondary" onClick={importTheme}>
            Import Theme
          </button>
        </div>
      </div>

      <h3>Available Themes</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Preview</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {themeList.map((theme) => (
            <tr
              key={theme.id}
              className={theme.id === currentTheme ? "active-theme" : ""}
            >
              <td>
                {theme.name} {theme.isDefault && "(Default)"}
              </td>
              <td>{theme.description}</td>
              <td>
                <div
                  className="color-preview"
                  style={{ display: "flex", gap: "5px" }}
                >
                  {theme.preview && (
                    <>
                      <div
                        style={{
                          background: theme.preview.primary,
                          width: "20px",
                          height: "20px",
                        }}
                      ></div>
                      <div
                        style={{
                          background: theme.preview.background,
                          width: "20px",
                          height: "20px",
                        }}
                      ></div>
                      <div
                        style={{
                          background: theme.preview.text,
                          width: "20px",
                          height: "20px",
                        }}
                      ></div>
                    </>
                  )}
                </div>
              </td>
              <td>
                <div className="btn-group">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => loadThemeForEdit(theme.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setTheme(theme.id)}
                    disabled={theme.id === currentTheme}
                  >
                    Apply
                  </button>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => exportTheme(theme.id, "json")}
                  >
                    Export
                  </button>
                  {!theme.isDefault && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteTheme(theme.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
