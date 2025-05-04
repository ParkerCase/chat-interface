// src/components/admin/ThemeSettings.jsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { ChromePicker } from "react-color";

import { Palette, Plus, Check, Loader, AlertCircle, Save } from "lucide-react";
import "./ThemeSettings.css";

function ThemeSettings() {
  // All hooks at the top - required by React
  const [showCustomThemeForm, setShowCustomThemeForm] = useState(false);
  const [customTheme, setCustomTheme] = useState({
    name: "",
    description: "",
    content: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);

  // Theme context hook
  const {
    currentTheme,
    availableThemes,
    loading,
    changeTheme,
    createCustomTheme,
  } = useTheme();

  // Debug effect - uncomment to debug
  useEffect(() => {
    console.log("ThemeSettings Debug:", {
      currentTheme,
      availableThemesCount: availableThemes?.length,
      loading,
      availableThemes,
    });
  }, [currentTheme, availableThemes, loading]);

  // Handle theme selection
  // Update handleThemeSelect with debugging:
  const handleThemeSelect = async (themeId) => {
    try {
      console.log("Attempting to change theme to:", themeId);
      setError("");

      if (!themeId || !changeTheme) {
        throw new Error("Invalid theme ID or change function missing");
      }

      await changeTheme(themeId);
      console.log("Theme change complete");
    } catch (err) {
      setError(`Failed to apply theme: ${err.message}`);
      console.error("Theme selection error:", err);
    }
  };

  const debugCurrentCSS = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    console.log("=== CURRENT CSS VARIABLES ===");
    ["primary", "secondary", "background", "surface", "text", "border"].forEach(
      (key) => {
        const value = computedStyle.getPropertyValue(`--color-${key}`);
        console.log(`--color-${key}: ${value}`);
      }
    );

    console.log("=== APPLIED STYLES ===");
    console.log("Body color:", computedStyle.getPropertyValue("color"));
    console.log(
      "Body background:",
      computedStyle.getPropertyValue("background-color")
    );
  };

  // Add a debug button to your component:

  // Handle custom theme submission
  const handleCustomThemeSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      // Validation
      if (!customTheme.name.trim()) {
        throw new Error("Theme name is required");
      }

      if (Object.keys(customTheme.content).length === 0) {
        throw new Error("Please customize at least one color");
      }

      if (!createCustomTheme) {
        throw new Error("Create theme function not available");
      }

      await createCustomTheme(
        customTheme.name.trim(),
        customTheme.description.trim(),
        customTheme.content
      );

      // Reset form after successful creation
      setShowCustomThemeForm(false);
      setCustomTheme({
        name: "",
        description: "",
        content: {},
      });
    } catch (err) {
      setError(`Failed to create theme: ${err.message}`);
      console.error("Theme creation error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Add this function to ThemeSettings to debug CSS application:
  const debugCSSVariables = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    console.log("Current CSS Variables:");
    ["primary", "secondary", "background", "surface", "text", "border"].forEach(
      (key) => {
        const value = computedStyle.getPropertyValue(`--color-${key}`);
        console.log(`--color-${key}: ${value}`);
      }
    );
  };

  // Add a debug button in your component:
  <button onClick={debugCSSVariables} className="debug-css-button">
    Debug CSS Variables
  </button>;

  // Handle color changes in custom theme form
  const handleColorChange = (colorKey, value) => {
    setCustomTheme((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        [colorKey]: value,
      },
    }));
  };

  // Move validation to onBlur instead of onChange:

  // Loading state
  if (loading) {
    return (
      <div className="theme-settings-loading">
        <Loader className="spinner" size={32} />
        <p>Loading themes...</p>
      </div>
    );
  }

  // Error state for missing themes
  if (!availableThemes || availableThemes.length === 0) {
    return (
      <div className="theme-settings">
        <div className="theme-settings-header">
          <Palette size={24} />
          <h2>Themes</h2>
        </div>
        <div className="no-themes-message">
          <AlertCircle size={48} />
          <h3>No themes available</h3>
          <p>
            Unable to load theme data. Please check your database connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="reload-button"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-settings">
      <div className="theme-settings-header">
        <Palette size={24} />
        <h2>Themes</h2>
      </div>

      {/* Debug info panel */}
      {debugInfo && (
        <div className="debug-panel">
          <h4>Debug Information</h4>
          <pre>
            {JSON.stringify(
              {
                availableThemesCount: availableThemes?.length,
                currentThemeId: currentTheme?.id,
                loadingState: loading,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="close-error"
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {/* Theme grid */}

      <div className="theme-grid">
        {(availableThemes || []).map((theme, index) => {
          // Validate theme data
          if (!theme || typeof theme !== "object") {
            console.error(`Invalid theme at index ${index}:`, theme);
            return null;
          }

          const { id, name, description, content } = theme;

          // Validate required fields
          if (!id || !name || !content) {
            console.error(`Incomplete theme data at index ${index}:`, theme);
            return null;
          }

          // Validate content structure
          if (typeof content !== "object" || !content.primary) {
            console.error(`Invalid theme content at index ${index}:`, content);
            return null;
          }

          const isActive = currentTheme?.id === id;

          return (
            <div
              key={id}
              className={`theme-card ${isActive ? "active" : ""}`}
              onClick={() => handleThemeSelect(id)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleThemeSelect(id);
                }
              }}
            >
              <div className="theme-preview">
                <div
                  className="preview-strip"
                  style={{ backgroundColor: content.primary }}
                />
                <div
                  className="preview-content"
                  style={{
                    backgroundColor: content.background || "#ffffff",
                    color: content.text || "#1f2937",
                  }}
                >
                  <div style={{ color: content.primary }}>{name}</div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: content["text-secondary"] || "#6b7280",
                    }}
                  >
                    {description || ""}
                  </div>
                </div>
              </div>
              {isActive && (
                <div className="theme-active-indicator">
                  <Check size={16} />
                  <span>Active</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Create custom theme card */}
        <div
          className="theme-card create-theme"
          onClick={() => setShowCustomThemeForm(true)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setShowCustomThemeForm(true);
            }
          }}
        >
          <div className="create-theme-content">
            <Plus size={32} />
            <span>Create Custom Theme</span>
          </div>
        </div>
      </div>

      {/* Custom theme form */}
      {showCustomThemeForm && (
        <div className="custom-theme-form">
          <form onSubmit={handleCustomThemeSubmit}>
            <div className="form-header">
              <h3>Create Custom Theme</h3>
              <button
                type="button"
                onClick={() => setShowCustomThemeForm(false)}
                className="close-form"
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="theme-name">Theme Name *</label>
              <input
                id="theme-name"
                type="text"
                value={customTheme.name}
                onChange={(e) =>
                  setCustomTheme((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="My Custom Theme"
                required
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="theme-description">Description</label>
              <input
                id="theme-description"
                type="text"
                value={customTheme.description}
                onChange={(e) =>
                  setCustomTheme((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="A theme that suits my needs"
                maxLength={200}
              />
            </div>

            <div className="color-editors">
              {Object.entries({
                primary: "Primary Color",
                secondary: "Secondary Color",
                background: "Background Color",
                surface: "Surface Color",
                text: "Text Color",
                "text-secondary": "Secondary Text",
                border: "Border Color",
                success: "Success Color",
                warning: "Warning Color",
                error: "Error Color",
                accent: "Accent Color",
              }).map(([key, label]) => (
                <div key={key} className="color-editor">
                  <label htmlFor={`color-${key}`}>{label}</label>
                  <div className="color-picker-container">
                    <div
                      className="color-preview"
                      style={{
                        backgroundColor: customTheme.content[key] || "#000000",
                      }}
                      onClick={() =>
                        setShowColorPicker(showColorPicker === key ? null : key)
                      }
                    />
                    <input
                      type="text"
                      value={customTheme.content[key] || ""}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      placeholder={`#${label
                        .toLowerCase()
                        .replace(/\s+/g, "")}`}
                      maxLength={7}
                    />
                    {showColorPicker === key && (
                      <div className="color-picker-popover">
                        <div
                          className="color-picker-cover"
                          onClick={() => setShowColorPicker(null)}
                        />
                        <ChromePicker
                          color={customTheme.content[key] || "#000000"}
                          onChange={(color) =>
                            handleColorChange(key, color.hex)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowCustomThemeForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? (
                  <>
                    <Loader className="spinner" size={14} />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Create Theme</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ThemeSettings;
