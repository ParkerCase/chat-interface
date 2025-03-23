// src/components/ThemeCustomizer.jsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { SketchPicker } from "react-color";
import {
  Settings,
  Palette,
  Type,
  Image,
  Save,
  Undo,
  Check,
  Loader,
} from "lucide-react";
import { X } from "lucide-react";

import "./ThemeCustomizer.css";

const ThemeCustomizer = () => {
  const { currentTheme, themeList, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState("colors");
  const [isLoading, setIsLoading] = useState(false);
  const [customSettings, setCustomSettings] = useState({
    name: "My Custom Theme",
    description: "Personalized theme",
    colors: {
      primary: "#1976D2",
      background: "#FFFFFF",
      text: {
        primary: "#212121",
      },
    },
    customization: {
      backgroundType: "color",
      backgroundColor: "#FFFFFF",
      backgroundImage: null,
      accentColor: "#1976D2",
      textColor: "#212121",
      font: "Roboto",
      rounded: "medium",
      density: "normal",
    },
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [savedThemes, setSavedThemes] = useState([]);

  // Fonts available in enterprise mode
  const availableFonts = [
    "Roboto",
    "Montserrat",
    "Open Sans",
    "Lato",
    "Poppins",
    "Raleway",
    "Source Sans Pro",
    "Playfair Display",
  ];

  // Load saved custom themes
  useEffect(() => {
    const loadSavedThemes = async () => {
      try {
        const response = await fetch("/api/themes");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.themes) {
            const customThemes = data.themes.filter((theme) => theme.isCustom);
            setSavedThemes(customThemes);
          }
        }
      } catch (error) {
        console.error("Error loading saved themes:", error);
      }
    };

    loadSavedThemes();
  }, []);

  // Handle color change
  const handleColorChange = (color, property) => {
    if (property === "primary" || property === "background") {
      setCustomSettings((prev) => ({
        ...prev,
        colors: {
          ...prev.colors,
          [property]: color.hex,
        },
      }));
    } else if (property === "textPrimary") {
      setCustomSettings((prev) => ({
        ...prev,
        colors: {
          ...prev.colors,
          text: {
            ...prev.colors.text,
            primary: color.hex,
          },
        },
      }));
    } else if (property === "accent") {
      setCustomSettings((prev) => ({
        ...prev,
        customization: {
          ...prev.customization,
          accentColor: color.hex,
        },
      }));
    } else if (property === "backgroundColor") {
      setCustomSettings((prev) => ({
        ...prev,
        customization: {
          ...prev.customization,
          backgroundColor: color.hex,
        },
      }));
    }
  };

  // Handle background type change
  const handleBackgroundTypeChange = (type) => {
    setCustomSettings((prev) => ({
      ...prev,
      customization: {
        ...prev.customization,
        backgroundType: type,
      },
    }));
  };

  // Handle font change
  const handleFontChange = (font) => {
    setCustomSettings((prev) => ({
      ...prev,
      customization: {
        ...prev.customization,
        font,
      },
    }));
  };

  // Handle rounded corners change
  const handleRoundedChange = (value) => {
    setCustomSettings((prev) => ({
      ...prev,
      customization: {
        ...prev.customization,
        rounded: value,
      },
    }));
  };

  // Handle density change
  const handleDensityChange = (value) => {
    setCustomSettings((prev) => ({
      ...prev,
      customization: {
        ...prev.customization,
        density: value,
      },
    }));
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/themes/background", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.imageUrl) {
          setCustomSettings((prev) => ({
            ...prev,
            customization: {
              ...prev.customization,
              backgroundType: "image",
              backgroundImage: data.imageUrl,
            },
          }));
        }
      } else {
        console.error("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle preview
  // In ThemeCustomizer.jsx handlePreview function
  const handlePreview = async () => {
    try {
      console.log("Preview settings:", customSettings);
      setIsLoading(true);
      setPreviewMode(true);

      // Request CSS preview
      const response = await fetch("/api/themes/custom/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customSettings }),
      });

      console.log("Preview response status:", response.status);

      if (response.ok) {
        // Get the CSS text
        const css = await response.text();
        console.log("Received CSS length:", css.length);

        // Create a style element and apply the CSS
        const style = document.createElement("style");
        style.id = "theme-preview-style";
        style.textContent = css;

        // Remove existing preview style if any
        const existingStyle = document.getElementById("theme-preview-style");
        if (existingStyle) {
          existingStyle.remove();
        }

        // Add the new style to the document
        document.head.appendChild(style);
      } else {
        console.error("Failed to preview theme");
      }
    } catch (error) {
      console.error("Error previewing theme:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/themes/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customSettings }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.theme) {
          // Theme saved successfully
          setSavedThemes((prev) => [
            ...prev.filter((t) => t.id !== data.theme.id),
            data.theme,
          ]);

          // Set as current theme
          setTheme(data.theme.id);

          // Close customizer
          setIsOpen(false);
          setPreviewMode(false);

          // Remove preview style
          const previewStyle = document.getElementById("theme-preview-style");
          if (previewStyle) {
            previewStyle.remove();
          }
        }
      } else {
        console.error("Failed to save custom theme");
      }
    } catch (error) {
      console.error("Error saving custom theme:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reset preview
  const handleResetPreview = () => {
    setPreviewMode(false);
    const previewStyle = document.getElementById("theme-preview-style");
    if (previewStyle) {
      previewStyle.remove();
    }
  };

  if (!isOpen) {
    return (
      <div className="theme-customizer-button" onClick={() => setIsOpen(true)}>
        <Settings size={24} />
        <span>Customize Theme</span>
      </div>
    );
  }

  return (
    <div className="theme-customizer">
      <div className="customizer-header">
        <h3>Theme Customizer</h3>
        <button className="close-button" onClick={() => setIsOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <div className="customizer-tabs">
        <button
          className={tab === "colors" ? "active" : ""}
          onClick={() => setTab("colors")}
        >
          <Palette size={16} />
          <span>Colors</span>
        </button>
        <button
          className={tab === "typography" ? "active" : ""}
          onClick={() => setTab("typography")}
        >
          <Type size={16} />
          <span>Typography</span>
        </button>
        <button
          className={tab === "background" ? "active" : ""}
          onClick={() => setTab("background")}
        >
          <Image size={16} />
          <span>Background</span>
        </button>
      </div>

      <div className="customizer-content">
        {tab === "colors" && (
          <div className="colors-tab">
            <div className="color-picker-group">
              <label>Primary Color</label>
              <div
                className="color-preview"
                style={{ backgroundColor: customSettings.colors.primary }}
              >
                <SketchPicker
                  color={customSettings.colors.primary}
                  onChange={(color) => handleColorChange(color, "primary")}
                  disableAlpha
                />
              </div>
            </div>

            <div className="color-picker-group">
              <label>Text Color</label>
              <div
                className="color-preview"
                style={{ backgroundColor: customSettings.colors.text.primary }}
              >
                <SketchPicker
                  color={customSettings.colors.text.primary}
                  onChange={(color) => handleColorChange(color, "textPrimary")}
                  disableAlpha
                />
              </div>
            </div>

            <div className="color-picker-group">
              <label>Accent Color</label>
              <div
                className="color-preview"
                style={{
                  backgroundColor: customSettings.customization.accentColor,
                }}
              >
                <SketchPicker
                  color={customSettings.customization.accentColor}
                  onChange={(color) => handleColorChange(color, "accent")}
                  disableAlpha
                />
              </div>
            </div>
          </div>
        )}

        {tab === "typography" && (
          <div className="typography-tab">
            <div className="form-group">
              <label>Font Family</label>
              <select
                value={customSettings.customization.font}
                onChange={(e) => handleFontChange(e.target.value)}
              >
                {availableFonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Corner Roundness</label>
              <div className="button-group">
                {["none", "small", "medium", "large"].map((value) => (
                  <button
                    key={value}
                    className={
                      customSettings.customization.rounded === value
                        ? "active"
                        : ""
                    }
                    onClick={() => handleRoundedChange(value)}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>UI Density</label>
              <div className="button-group">
                {["compact", "normal", "comfortable"].map((value) => (
                  <button
                    key={value}
                    className={
                      customSettings.customization.density === value
                        ? "active"
                        : ""
                    }
                    onClick={() => handleDensityChange(value)}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "background" && (
          <div className="background-tab">
            <div className="form-group">
              <label>Background Type</label>
              <div className="button-group">
                <button
                  className={
                    customSettings.customization.backgroundType === "color"
                      ? "active"
                      : ""
                  }
                  onClick={() => handleBackgroundTypeChange("color")}
                >
                  Solid Color
                </button>
                <button
                  className={
                    customSettings.customization.backgroundType === "image"
                      ? "active"
                      : ""
                  }
                  onClick={() => handleBackgroundTypeChange("image")}
                >
                  Image
                </button>
              </div>
            </div>

            {customSettings.customization.backgroundType === "color" && (
              <div className="color-picker-group">
                <label>Background Color</label>
                <div
                  className="color-preview"
                  style={{
                    backgroundColor:
                      customSettings.customization.backgroundColor,
                  }}
                >
                  <SketchPicker
                    color={customSettings.customization.backgroundColor}
                    onChange={(color) =>
                      handleColorChange(color, "backgroundColor")
                    }
                    disableAlpha
                  />
                </div>
              </div>
            )}

            {customSettings.customization.backgroundType === "image" && (
              <div className="form-group">
                <label>Background Image</label>
                <div className="image-upload">
                  <input
                    type="file"
                    id="background-image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="background-image" className="upload-button">
                    {isLoading ? (
                      <Loader className="spinner" size={16} />
                    ) : (
                      <>
                        <Image size={16} /> Upload Image
                      </>
                    )}
                  </label>
                  {customSettings.customization.backgroundImage && (
                    <div className="image-preview">
                      <img
                        src={customSettings.customization.backgroundImage}
                        alt="Background Preview"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="customizer-actions">
        {previewMode ? (
          <>
            <button className="reset-button" onClick={handleResetPreview}>
              <Undo size={16} />
              <span>Reset</span>
            </button>
            <button
              className="save-button"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader className="spinner" size={16} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Theme</span>
                </>
              )}
            </button>
          </>
        ) : (
          <button
            className="preview-button"
            onClick={handlePreview}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className="spinner" size={16} />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Preview</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="customizer-footer">
        <div className="customizer-name">
          <label>Theme Name</label>
          <input
            type="text"
            value={customSettings.name}
            onChange={(e) =>
              setCustomSettings((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
            placeholder="My Custom Theme"
          />
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
