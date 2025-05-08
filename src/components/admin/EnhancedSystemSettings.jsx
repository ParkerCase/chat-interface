// src/components/admin/EnhancedSystemSettings.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import {
  Settings,
  Shield,
  Database,
  Cloud,
  Server,
  Globe,
  Mail,
  BellRing,
  Clock,
  Key,
  Lock,
  UserCog,
  FileText,
  Sliders,
  Save,
  RefreshCw,
  Check,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Loader,
  Upload,
  X,
} from "lucide-react";
import apiService from "../../services/apiService";
import documentProcessor from "../../utils/DocumentProcessor";

import FileUploadDropzone from "../storage/FileUploadDropzone";

import Header from "../Header";
import "./EnhancedSystemSettings.css";

const EnhancedSystemSettings = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled, organizationTier } = useFeatureFlags();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeSection, setActiveSection] = useState("general");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [isProcessorInitialized, setIsProcessorInitialized] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Settings state
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "Tatt2Away AI Assistant",
    organizationName: "Tatt2Away",
    adminEmail: "",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    language: "en-US",
  });

  const [storageSettings, setStorageSettings] = useState({
    storagePath: "/data/uploads",
    maxFileSize: 50, // MB
    acceptedFileTypes: "pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif",
    storageQuota: 50, // GB
    enableVersioning: true,
    autoDeleteOldVersions: false,
    retentionDays: 30,
    compressionEnabled: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 60, // minutes
    requireStrongPasswords: true,
    passwordExpiry: 90, // days
    forceMfa: false,
    maxLoginAttempts: 5,
    lockoutDuration: 15, // minutes
    allowedIpRanges: "",
    ssoEnabled: false,
    ssoProvider: "none",
  });

  // const [notificationSettings, setNotificationSettings] = useState({
  //   emailNotifications: true,
  //   slackNotifications: false,
  //   slackWebhookUrl: "",
  //   notifyOnNewUsers: true,
  //   notifyOnErrors: true,
  //   notifyOnStorageLimit: true,
  //   digestFrequency: "daily",
  //   adminAlerts: true,
  // });

  const [apiSettings, setApiSettings] = useState({
    apiEnabled: true,
    rateLimit: 1000, // requests per hour
    apiKeys: [],
    allowedDomains: "",
    webhookUrl: "",
    logAllRequests: true,
  });

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    backupFrequency: "daily",
    backupTime: "00:00",
    backupRetention: 7, // days
    backupLocation: "cloud",
    customBackupPath: "",
    includeFiles: true,
    includeDatabase: true,
    includeSettings: true,
  });

  // Fetch settings on component mount
  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const initProcessor = async () => {
      try {
        await documentProcessor.initialize();
        setIsProcessorInitialized(true);

        // Load settings from processor
        const processorSettings = documentProcessor.settings;
        if (processorSettings) {
          setStorageSettings((prev) => ({
            ...prev,
            storagePath: processorSettings.storagePath || prev.storagePath,
            maxFileSize: processorSettings.maxFileSize || prev.maxFileSize,
            acceptedFileTypes:
              processorSettings.acceptedFileTypes || prev.acceptedFileTypes,
            storageQuota: processorSettings.storageQuota || prev.storageQuota,
            enableVersioning:
              processorSettings.enableVersioning !== undefined
                ? processorSettings.enableVersioning
                : prev.enableVersioning,
            autoDeleteOldVersions:
              processorSettings.autoDeleteOldVersions !== undefined
                ? processorSettings.autoDeleteOldVersions
                : prev.autoDeleteOldVersions,
            retentionDays:
              processorSettings.retentionDays || prev.retentionDays,
            compressionEnabled:
              processorSettings.compressionEnabled !== undefined
                ? processorSettings.compressionEnabled
                : prev.compressionEnabled,
          }));
        }
      } catch (error) {
        console.error("Error initializing document processor:", error);
        setError(
          "Failed to initialize document processor. Using default settings."
        );
      }
    };

    initProcessor();
  }, []);

  // Clear success message after 5 seconds
  useEffect(() => {
    let timeout;
    if (success) {
      timeout = setTimeout(() => {
        setSuccess(null);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [success]);

  // Fetch settings from Supabase
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from settings table using the safe RPC function
      const { data, error } = await supabase.from("settings").select("*");

      if (error) throw error;

      if (data && data.length > 0) {
        // Process settings by category
        data.forEach((setting) => {
          switch (setting.category) {
            case "general":
              setGeneralSettings((prev) => ({
                ...prev,
                [setting.key]: setting.value,
              }));
              break;
            case "storage":
              setStorageSettings((prev) => ({
                ...prev,
                [setting.key]: setting.value,
              }));
              break;
            case "security":
              setSecuritySettings((prev) => ({
                ...prev,
                [setting.key]: setting.value,
              }));
              break;
            // case "notifications":
            //   setNotificationSettings((prev) => ({
            //     ...prev,
            //     [setting.key]: setting.value,
            //   }));
            //   break;
            case "api":
              setApiSettings((prev) => ({
                ...prev,
                [setting.key]: setting.value,
              }));
              break;
            case "backup":
              setBackupSettings((prev) => ({
                ...prev,
                [setting.key]: setting.value,
              }));
              break;
            default:
              break;
          }
        });
      }

      // Set admin email from current user if not already set
      if (!generalSettings.adminEmail && currentUser?.email) {
        setGeneralSettings((prev) => ({
          ...prev,
          adminEmail: currentUser.email,
        }));
      }

      // Fetch API keys
      const { data: apiKeys, error: apiKeysError } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (apiKeysError) {
        console.warn("Error fetching API keys:", apiKeysError);
      } else if (apiKeys) {
        setApiSettings((prev) => ({
          ...prev,
          apiKeys: apiKeys,
        }));
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (files) => {
    setSuccess(`Successfully uploaded ${files.length} document(s)`);

    // Normalize the file objects to ensure they have expected properties
    const normalizedFiles = files.map((file) => ({
      name: file.name || file.path?.split("/").pop() || "File",
      size: file.size || 0,
      type: file.type || "application/octet-stream",
      // Add any other needed properties
      ...file,
    }));

    setUploadedFiles((prev) => [...normalizedFiles, ...prev].slice(0, 5)); // Keep last 5 uploads
  };

  // Add this function to your component
  const handleUploadError = (error, file) => {
    setError(`Error uploading ${file.name}: ${error.message}`);
  };

  // Save settings to Supabase
  const saveSettings = async (category, settings) => {
    try {
      setSaving(true);
      setError(null);

      // Prepare settings for saving
      const settingsToSave = Object.entries(settings).map(([key, value]) => ({
        category,
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.id,
      }));

      // Use the safe RPC function to bypass RLS
      const { error } = await supabase.rpc("save_settings", {
        settings: settingsToSave,
      });

      if (error) throw error;

      setSuccess(
        `${capitalizeFirstLetter(category)} settings saved successfully`
      );
    } catch (err) {
      console.error(`Error saving ${category} settings:`, err);
      setError(`Failed to save ${category} settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const validateStorageSettings = () => {
    const {
      maxFileSize,
      acceptedFileTypes,
      retentionDays,
      autoDeleteOldVersions,
      storageQuota,
    } = storageSettings;

    let hasError = false;

    // Validate file size is reasonable
    if (maxFileSize <= 0 || maxFileSize > 100) {
      setError("Max file size must be between 1 and 100 MB");
      hasError = true;
    }

    // Validate storage quota
    if (storageQuota <= 0 || storageQuota > 1000) {
      setError("Storage quota must be between 1 and 1000 GB");
      hasError = true;
    }

    // Validate retention days if auto-delete is enabled
    if (autoDeleteOldVersions && (retentionDays < 1 || retentionDays > 365)) {
      setError(
        "Retention days must be between 1 and 365 when auto-delete is enabled"
      );
      hasError = true;
    }

    // Validate accepted file types format
    if (!acceptedFileTypes || acceptedFileTypes.trim() === "") {
      setError("Accepted file types cannot be empty");
      hasError = true;
    }

    return !hasError;
  };

  const handleStorageSubmit = async (e) => {
    e.preventDefault();

    // Validate settings before saving
    if (!validateStorageSettings()) {
      return; // Stop if validation fails
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare settings for saving
      const settingsToSave = Object.entries(storageSettings).map(
        ([key, value]) => ({
          category: "storage",
          key,
          value: typeof value === "boolean" ? value.toString() : value,
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.id,
        })
      );

      // Use the RPC function to save settings
      const { data, error } = await supabase.rpc("save_settings", {
        settings: settingsToSave,
      });

      if (error) throw error;

      setSuccess("Storage settings saved successfully");

      // Reinitialize the document processor to load new settings
      setTimeout(async () => {
        try {
          await documentProcessor.initialize();
          console.log("Document processor reinitialized with new settings");
        } catch (err) {
          console.error("Error reinitializing document processor:", err);
        }
      }, 1000);
    } catch (err) {
      console.error("Error saving storage settings:", err);
      setError(`Failed to save storage settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus("Initiating backup...");

    try {
      // Call the backup endpoint
      const response = await apiService.files?.triggerBackup();

      if (response.data?.success) {
        setBackupStatus(
          "Backup initiated successfully. Files will be processed in the background."
        );

        // Monitor backup progress
        const interval = setInterval(async () => {
          const statusResponse = await apiService.files.getBackupStatus();

          if (statusResponse.data?.status === "completed") {
            setBackupStatus("Backup completed successfully!");
            clearInterval(interval);
            setIsBackingUp(false);
          } else if (statusResponse.data?.status === "failed") {
            setBackupStatus(`Backup failed: ${statusResponse.data?.error}`);
            clearInterval(interval);
            setIsBackingUp(false);
          } else {
            setBackupStatus(
              `Backup in progress: ${statusResponse.data?.progress || 0}%`
            );
          }
        }, 5000);

        // Set timeout to stop polling after 30 minutes
        setTimeout(() => {
          clearInterval(interval);
          setIsBackingUp(false);
        }, 30 * 60 * 1000);
      } else {
        throw new Error(response.data?.error || "Failed to initiate backup");
      }
    } catch (error) {
      console.error("Backup error:", error);
      setBackupStatus(`Backup failed: ${error.message}`);
      setIsBackingUp(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e, category) => {
    e.preventDefault();

    // Special validation for storage settings
    if (category === "storage") {
      // Validate settings before saving
      if (!validateStorageSettings()) {
        return; // Stop if validation fails
      }
    }

    let settingsToSave;

    switch (category) {
      case "general":
        settingsToSave = generalSettings;
        break;
      case "storage":
        settingsToSave = storageSettings;
        break;
      case "security":
        settingsToSave = securitySettings;
        break;
      // case "notifications":
      //   settingsToSave = notificationSettings;
      //   break;
      case "api":
        settingsToSave = apiSettings;
        break;
      case "backup":
        settingsToSave = backupSettings;
        break;
      default:
        return;
    }

    await saveSettings(category, settingsToSave);

    // Reinitialize document processor if storage settings were saved
    if (category === "storage") {
      setTimeout(async () => {
        try {
          await documentProcessor.initialize();
          console.log("Document processor reinitialized with new settings");
        } catch (err) {
          console.error("Error reinitializing document processor:", err);
        }
      }, 1000);
    }
  };

  // Handle input change
  const handleInputChange = (e, category) => {
    const { name, value, type, checked } = e.target;
    const inputValue =
      type === "checkbox"
        ? checked
        : type === "number"
        ? parseFloat(value)
        : value;

    switch (category) {
      case "general":
        setGeneralSettings((prev) => ({
          ...prev,
          [name]: inputValue,
        }));
        break;
      case "storage":
        // Convert values to appropriate types
        let inputValue;
        if (type === "checkbox") {
          inputValue = checked;
        } else if (
          ["maxFileSize", "storageQuota", "retentionDays"].includes(name)
        ) {
          // Convert numeric fields to numbers
          inputValue = parseFloat(value) || 0;

          // Add validation for maxFileSize (e.g., cap at 100MB)
          if (name === "maxFileSize" && inputValue > 100) {
            inputValue = 100;
            setError("Maximum file size capped at 100MB");
            setTimeout(() => setError(null), 3000);
          } else if (name === "maxFileSize" && inputValue <= 0) {
            inputValue = 1;
            setError("Minimum file size is 1MB");
            setTimeout(() => setError(null), 3000);
          }

          // Add validation for storageQuota
          if (name === "storageQuota" && inputValue > 1000) {
            inputValue = 1000;
            setError("Storage quota capped at 1000GB (1TB)");
            setTimeout(() => setError(null), 3000);
          } else if (name === "storageQuota" && inputValue <= 0) {
            inputValue = 1;
            setError("Minimum storage quota is 1GB");
            setTimeout(() => setError(null), 3000);
          }

          // Add validation for retentionDays
          if (name === "retentionDays" && inputValue > 365) {
            inputValue = 365;
            setError("Maximum retention period is 365 days");
            setTimeout(() => setError(null), 3000);
          } else if (name === "retentionDays" && inputValue < 1) {
            inputValue = 1;
            setError("Minimum retention period is 1 day");
            setTimeout(() => setError(null), 3000);
          }
        } else if (name === "acceptedFileTypes") {
          // Validate accepted file types format (comma-separated list)
          // Remove any spaces after commas and trim individual extensions
          const cleanedTypes = value
            .split(",")
            .map((type) => type.trim())
            .join(",");
          inputValue = cleanedTypes;

          // Check if the format is valid
          const validExtensions = cleanedTypes
            .split(",")
            .every((ext) => /^[a-zA-Z0-9]+$/.test(ext.trim()));

          if (!validExtensions && cleanedTypes.trim() !== "") {
            setError(
              "File extensions should be comma-separated without dots or spaces (e.g., pdf,doc,docx)"
            );
            setTimeout(() => setError(null), 5000);
          }
        } else {
          inputValue = value;
        }

        const validateStorageSettings = () => {
          const {
            maxFileSize,
            acceptedFileTypes,
            retentionDays,
            autoDeleteOldVersions,
            storageQuota,
          } = storageSettings;

          let hasError = false;

          // Validate file size is reasonable
          if (maxFileSize <= 0 || maxFileSize > 100) {
            setError("Max file size must be between 1 and 100 MB");
            hasError = true;
          }

          // Validate storage quota
          if (storageQuota <= 0 || storageQuota > 1000) {
            setError("Storage quota must be between 1 and 1000 GB");
            hasError = true;
          }

          // Validate retention days if auto-delete is enabled
          if (
            autoDeleteOldVersions &&
            (retentionDays < 1 || retentionDays > 365)
          ) {
            setError(
              "Retention days must be between 1 and 365 when auto-delete is enabled"
            );
            hasError = true;
          }

          // Validate accepted file types format
          if (!acceptedFileTypes || acceptedFileTypes.trim() === "") {
            setError("Accepted file types cannot be empty");
            hasError = true;
          }

          return !hasError;
        };

        // Update storage settings state
        setStorageSettings((prev) => ({
          ...prev,
          [name]: inputValue,
        }));
        break;
      case "security":
        setSecuritySettings((prev) => ({
          ...prev,
          [name]: inputValue,
        }));
        break;
      // case "notifications":
      //   setNotificationSettings((prev) => ({
      //     ...prev,
      //     [name]: inputValue,
      //   }));
      //   break;
      case "api":
        setApiSettings((prev) => ({
          ...prev,
          [name]: inputValue,
        }));
        break;
      case "backup":
        setBackupSettings((prev) => ({
          ...prev,
          [name]: inputValue,
        }));
        break;
      default:
        break;
    }
  };

  // Generate a new API key
  const generateApiKey = async (name, expiryDays = 365) => {
    try {
      setSaving(true);
      setError(null);

      // Generate a random key
      const apiKey =
        "key_" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Save to database
      const { data, error } = await supabase
        .from("api_keys")
        .insert([
          {
            name,
            key: apiKey,
            expires_at: expiresAt.toISOString(),
            created_by: currentUser?.id,
            created_at: new Date().toISOString(),
            is_active: true,
          },
        ])
        .select();

      if (error) throw error;

      // Add to state
      if (data && data.length > 0) {
        setApiSettings((prev) => ({
          ...prev,
          apiKeys: [data[0], ...prev.apiKeys],
        }));

        setSuccess(`API key "${name}" generated successfully`);
      }
    } catch (err) {
      console.error("Error generating API key:", err);
      setError(`Failed to generate API key: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Revoke an API key
  const revokeApiKey = async (id) => {
    try {
      setSaving(true);
      setError(null);

      // Update key in database
      const { error } = await supabase
        .from("api_keys")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: currentUser?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Update in state
      setApiSettings((prev) => ({
        ...prev,
        apiKeys: prev.apiKeys.map((key) =>
          key.id === id
            ? { ...key, is_active: false, revoked_at: new Date().toISOString() }
            : key
        ),
      }));

      setSuccess("API key revoked successfully");
    } catch (err) {
      console.error("Error revoking API key:", err);
      setError(`Failed to revoke API key: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Test database connection
  const testDatabaseConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionStatus(null);

      // Test connection with simple query
      const start = Date.now();
      const { data, error } = await supabase
        .from("profiles")
        .select("count", { count: "exact" })
        .limit(1);

      const duration = Date.now() - start;

      if (error) {
        setConnectionStatus({
          success: false,
          message: `Connection failed: ${error.message}`,
          details: error,
        });
      } else {
        setConnectionStatus({
          success: true,
          message: `Connection successful (${duration}ms)`,
          count: data?.length || 0,
        });
      }
    } catch (err) {
      console.error("Database connection test error:", err);
      setConnectionStatus({
        success: false,
        message: `Connection failed: ${err.message}`,
        details: err,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Run a backup
  const runBackup = async () => {
    try {
      setSaving(true);
      setError(null);

      // In a real implementation, this would call a backend API to trigger a backup
      // For demo purposes, we'll simulate a successful backup

      // Create a backup record
      const { data, error } = await supabase
        .from("backups")
        .insert([
          {
            type: "manual",
            status: "completed",
            location: backupSettings.backupLocation,
            includes_files: backupSettings.includeFiles,
            includes_database: backupSettings.includeDatabase,
            includes_settings: backupSettings.includeSettings,
            created_by: currentUser?.id,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            size_mb: 125.4, // Simulated backup size
          },
        ])
        .select();

      if (error) throw error;

      setSuccess("Backup completed successfully");
    } catch (err) {
      console.error("Backup error:", err);
      setError(`Failed to create backup: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // Render
  return (
    <div className="enhanced-system-settings">
      <div className="admin-section">
        <h2 className="admin-section-title">System Settings</h2>

        {/* Success message */}
        {success && (
          <div className="success-message">
            <Check className="success-icon" size={18} />
            <p>{success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="error-message">
            <AlertCircle className="error-icon" size={18} />
            <p>{error}</p>
          </div>
        )}

        <div className="settings-container">
          {/* Settings Navigation */}
          <div className="settings-navigation">
            <button
              className={`nav-item ${
                activeSection === "general" ? "active" : ""
              }`}
              onClick={() => setActiveSection("general")}
            >
              <Settings size={20} />
              <span>General</span>
            </button>
            <button
              className={`nav-item ${
                activeSection === "storage" ? "active" : ""
              }`}
              onClick={() => setActiveSection("storage")}
            >
              <Database size={20} />
              <span>Storage</span>
            </button>
            <button
              className={`nav-item ${
                activeSection === "security" ? "active" : ""
              }`}
              onClick={() => setActiveSection("security")}
            >
              <Shield size={20} />
              <span>Security</span>
            </button>
            {/* <button
              className={`nav-item ${
                activeSection === "notifications" ? "active" : ""
              }`}
              onClick={() => setActiveSection("notifications")}
            >
              <BellRing size={20} />
              <span>Notifications</span>
            </button> */}
            <button
              className={`nav-item ${activeSection === "api" ? "active" : ""}`}
              onClick={() => setActiveSection("api")}
            >
              <Key size={20} />
              <span>API</span>
            </button>
            <button
              className={`nav-item ${
                activeSection === "backup" ? "active" : ""
              }`}
              onClick={() => setActiveSection("backup")}
            >
              <Cloud size={20} />
              <span>Backup</span>
            </button>
          </div>

          {/* Settings Content */}
          <div className="settings-content">
            {loading ? (
              <div className="settings-loading">
                <Loader className="spinner" size={32} />
                <p>Loading settings...</p>
              </div>
            ) : (
              <>
                {/* General Settings */}
                {activeSection === "general" && (
                  <div className="settings-section">
                    <h3 className="settings-title">General Settings</h3>
                    <p className="settings-description">
                      Configure basic application settings and preferences.
                    </p>

                    <form onSubmit={(e) => handleSubmit(e, "general")}>
                      <div className="form-group">
                        <label htmlFor="siteName">Site Name</label>
                        <input
                          type="text"
                          id="siteName"
                          name="siteName"
                          value={generalSettings.siteName}
                          onChange={(e) => handleInputChange(e, "general")}
                          className="form-input"
                        />
                        <p className="input-help">
                          The name displayed in the browser title bar and email
                          templates.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="organizationName">
                          Organization Name
                        </label>
                        <input
                          type="text"
                          id="organizationName"
                          name="organizationName"
                          value={generalSettings.organizationName}
                          onChange={(e) => handleInputChange(e, "general")}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="adminEmail">Admin Email</label>
                        <input
                          type="email"
                          id="adminEmail"
                          name="adminEmail"
                          value={generalSettings.adminEmail}
                          onChange={(e) => handleInputChange(e, "general")}
                          className="form-input"
                        />
                        <p className="input-help">
                          This email will receive system notifications and
                          alerts.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="timezone">Timezone</label>
                        <select
                          id="timezone"
                          name="timezone"
                          value={generalSettings.timezone}
                          onChange={(e) => handleInputChange(e, "general")}
                          className="form-select"
                        >
                          <option value="America/New_York">
                            Eastern Time (ET)
                          </option>
                          <option value="America/Chicago">
                            Central Time (CT)
                          </option>
                          <option value="America/Denver">
                            Mountain Time (MT)
                          </option>
                          <option value="America/Los_Angeles">
                            Pacific Time (PT)
                          </option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="dateFormat">Date Format</label>
                        <select
                          id="dateFormat"
                          name="dateFormat"
                          value={generalSettings.dateFormat}
                          onChange={(e) => handleInputChange(e, "general")}
                          className="form-select"
                        >
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="language">Language</label>
                        <select
                          id="language"
                          name="language"
                          value={generalSettings.language}
                          onChange={(e) => handleInputChange(e, "general")}
                          className="form-select"
                        >
                          <option value="en-US">English (US)</option>
                          <option value="en-GB">English (UK)</option>
                          <option value="es-ES">Spanish</option>
                          <option value="fr-FR">French</option>
                        </select>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                {/* Storage Settings */}
                {activeSection === "storage" && (
                  <div className="settings-section">
                    <h3 className="settings-title">Storage Settings</h3>
                    <p className="settings-description">
                      Configure file storage settings and limits.
                    </p>

                    <form onSubmit={(e) => handleSubmit(e, "storage")}>
                      <div className="form-group">
                        <label htmlFor="storagePath">Storage Path</label>
                        <input
                          type="text"
                          id="storagePath"
                          name="storagePath"
                          value={storageSettings.storagePath}
                          onChange={(e) => handleInputChange(e, "storage")}
                          className="form-input"
                        />
                        <p className="input-help">
                          The base path where files will be stored.
                        </p>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="maxFileSize">
                            Max File Size (MB)
                          </label>
                          <input
                            type="number"
                            id="maxFileSize"
                            name="maxFileSize"
                            min="1"
                            value={storageSettings.maxFileSize}
                            onChange={(e) => handleInputChange(e, "storage")}
                            className="form-input"
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="storageQuota">
                            Storage Quota (GB)
                          </label>
                          <input
                            type="number"
                            id="storageQuota"
                            name="storageQuota"
                            min="1"
                            value={storageSettings.storageQuota}
                            onChange={(e) => handleInputChange(e, "storage")}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="acceptedFileTypes">
                          Accepted File Types
                        </label>
                        <input
                          type="text"
                          id="acceptedFileTypes"
                          name="acceptedFileTypes"
                          value={storageSettings.acceptedFileTypes}
                          onChange={(e) => handleInputChange(e, "storage")}
                          className="form-input"
                        />
                        <p className="input-help">
                          Comma-separated list of allowed file extensions
                          (without dots).
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="enableVersioning"
                            checked={storageSettings.enableVersioning}
                            onChange={(e) => handleInputChange(e, "storage")}
                          />
                          <span className="checkbox-label">
                            Enable file versioning
                          </span>
                        </label>
                        <p className="input-help">
                          Keep track of file changes and allow reverting to
                          previous versions.
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="compressionEnabled"
                            checked={storageSettings.compressionEnabled}
                            onChange={(e) => handleInputChange(e, "storage")}
                          />
                          <span className="checkbox-label">
                            Enable file compression
                          </span>
                        </label>
                        <p className="input-help">
                          Compress files to save storage space when possible.
                        </p>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>

                      <div className="upload-section-container">
                        <div className="upload-divider">
                          <div className="divider-line"></div>
                          <span>Upload Files</span>
                          <div className="divider-line"></div>
                        </div>

                        <p className="upload-instructions">
                          Upload documents to be processed with your current
                          settings and added to the knowledge base.
                        </p>

                        <button
                          type="button"
                          className="toggle-upload-button"
                          onClick={() => setShowUploadZone(!showUploadZone)}
                        >
                          {showUploadZone ? (
                            <>
                              <X size={16} />
                              Hide Upload Zone
                            </>
                          ) : (
                            <>
                              <Upload size={16} />
                              Show Upload Zone
                            </>
                          )}
                        </button>

                        {showUploadZone && (
                          <div className="upload-zone-wrapper">
                            <FileUploadDropzone
                              bucket="documents"
                              folder={
                                storageSettings?.storagePath?.replace(
                                  /^\//,
                                  ""
                                ) || "data/uploads"
                              }
                              maxSize={
                                storageSettings?.maxFileSize
                                  ? storageSettings.maxFileSize * 1024 * 1024
                                  : undefined
                              }
                              acceptedFileTypes={storageSettings?.acceptedFileTypes
                                ?.split(",")
                                .map((ext) => `.${ext.trim()}`)
                                .reduce(
                                  (acc, ext) => ({ ...acc, [ext]: [] }),
                                  {}
                                )}
                              processForKnowledgeBase={true}
                              onUploadComplete={handleUploadComplete}
                              onUploadError={handleUploadError}
                            />
                          </div>
                        )}

                        {uploadedFiles.length > 0 && (
                          <div className="recent-uploads">
                            <h4>Recent Uploads</h4>
                            <ul className="uploads-list">
                              {uploadedFiles.map((file, index) => (
                                <li key={index} className="upload-item">
                                  <div className="upload-icon">
                                    {
                                      file && file.name
                                        ? file.name.endsWith(".pdf")
                                          ? "📄"
                                          : file.name.endsWith(".doc") ||
                                            file.name.endsWith(".docx")
                                          ? "📝"
                                          : file.name.endsWith(".csv") ||
                                            file.name.endsWith(".xls") ||
                                            file.name.endsWith(".xlsx")
                                          ? "📊"
                                          : "📁"
                                        : "📁" // Default icon if filename is missing
                                    }
                                  </div>
                                  <div className="upload-details">
                                    <span className="upload-name">
                                      {file && file.name
                                        ? file.name
                                        : "Unknown file"}
                                    </span>
                                    <span className="upload-meta">
                                      {new Date().toLocaleString()} •{" "}
                                      {file && file.size
                                        ? (file.size / 1024).toFixed(2)
                                        : "?"}{" "}
                                      KB
                                    </span>
                                  </div>
                                  <div className="upload-status">
                                    ✓ Processed
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </form>
                  </div>
                )}
                {/* Security Settings */}
                {activeSection === "security" && (
                  <div className="settings-section">
                    <h3 className="settings-title">Security Settings</h3>
                    <p className="settings-description">
                      Configure security settings and access controls.
                    </p>

                    <form onSubmit={(e) => handleSubmit(e, "security")}>
                      <div className="form-group">
                        <label htmlFor="sessionTimeout">
                          Session Timeout (minutes)
                        </label>
                        <input
                          type="number"
                          id="sessionTimeout"
                          name="sessionTimeout"
                          min="5"
                          max="1440"
                          value={securitySettings.sessionTimeout}
                          onChange={(e) => handleInputChange(e, "security")}
                          className="form-input"
                        />
                        <p className="input-help">
                          Users will be logged out after this period of
                          inactivity.
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="requireStrongPasswords"
                            checked={securitySettings.requireStrongPasswords}
                            onChange={(e) => handleInputChange(e, "security")}
                          />
                          <span className="checkbox-label">
                            Require strong passwords
                          </span>
                        </label>
                        <p className="input-help">
                          Passwords must contain uppercase, lowercase, numbers,
                          and special characters.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="passwordExpiry">
                          Password Expiry (days)
                        </label>
                        <input
                          type="number"
                          id="passwordExpiry"
                          name="passwordExpiry"
                          min="0"
                          value={securitySettings.passwordExpiry}
                          onChange={(e) => handleInputChange(e, "security")}
                          className="form-input"
                        />
                        <p className="input-help">
                          Set to 0 to disable password expiration.
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="forceMfa"
                            checked={securitySettings.forceMfa}
                            onChange={(e) => handleInputChange(e, "security")}
                          />
                          <span className="checkbox-label">
                            Force multi-factor authentication for all users
                          </span>
                        </label>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="maxLoginAttempts">
                            Max Login Attempts
                          </label>
                          <input
                            type="number"
                            id="maxLoginAttempts"
                            name="maxLoginAttempts"
                            min="1"
                            value={securitySettings.maxLoginAttempts}
                            onChange={(e) => handleInputChange(e, "security")}
                            className="form-input"
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="lockoutDuration">
                            Lockout Duration (mins)
                          </label>
                          <input
                            type="number"
                            id="lockoutDuration"
                            name="lockoutDuration"
                            min="1"
                            value={securitySettings.lockoutDuration}
                            onChange={(e) => handleInputChange(e, "security")}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                {activeSection === "api" && (
                  <div className="settings-section">
                    <h3 className="settings-title">API Settings</h3>
                    <p className="settings-description">
                      Configure API access and settings.
                    </p>

                    <form onSubmit={(e) => handleSubmit(e, "api")}>
                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="apiEnabled"
                            checked={apiSettings.apiEnabled}
                            onChange={(e) => handleInputChange(e, "api")}
                          />
                          <span className="checkbox-label">
                            Enable API access
                          </span>
                        </label>
                      </div>

                      <div className="form-group">
                        <label htmlFor="rateLimit">
                          Rate Limit (requests/hour)
                        </label>
                        <input
                          type="number"
                          id="rateLimit"
                          name="rateLimit"
                          min="1"
                          value={apiSettings.rateLimit}
                          onChange={(e) => handleInputChange(e, "api")}
                          className="form-input"
                          disabled={!apiSettings.apiEnabled}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="allowedDomains">
                          Allowed Domains (CORS)
                        </label>
                        <input
                          type="text"
                          id="allowedDomains"
                          name="allowedDomains"
                          value={apiSettings.allowedDomains}
                          onChange={(e) => handleInputChange(e, "api")}
                          className="form-input"
                          disabled={!apiSettings.apiEnabled}
                        />
                        <p className="input-help">
                          Comma-separated list of domains allowed to make API
                          requests. Leave empty to allow all.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="webhookUrl">Webhook URL</label>
                        <input
                          type="text"
                          id="webhookUrl"
                          name="webhookUrl"
                          value={apiSettings.webhookUrl}
                          onChange={(e) => handleInputChange(e, "api")}
                          className="form-input"
                          disabled={!apiSettings.apiEnabled}
                        />
                        <p className="input-help">
                          URL to receive webhook notifications for API events.
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="logAllRequests"
                            checked={apiSettings.logAllRequests}
                            onChange={(e) => handleInputChange(e, "api")}
                          />
                          <span className="checkbox-label">
                            Log all API requests
                          </span>
                        </label>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* API Keys Management */}
                    <div className="api-keys-section">
                      <div className="section-header">
                        <h4>API Keys</h4>
                        <button
                          className="add-key-button"
                          onClick={() => {
                            const name = prompt(
                              "Enter a name for this API key:"
                            );
                            if (name) {
                              generateApiKey(name);
                            }
                          }}
                          disabled={!apiSettings.apiEnabled || saving}
                        >
                          <Key size={14} />
                          Generate New Key
                        </button>
                      </div>

                      {apiSettings.apiKeys && apiSettings.apiKeys.length > 0 ? (
                        <div className="api-keys-list">
                          {apiSettings.apiKeys.map((key) => (
                            <div
                              key={key.id}
                              className={`api-key-item ${
                                !key.is_active ? "revoked" : ""
                              }`}
                            >
                              <div className="api-key-info">
                                <div className="api-key-name">{key.name}</div>
                                <div className="api-key-details">
                                  <span className="api-key-created">
                                    Created:{" "}
                                    {new Date(
                                      key.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                  {key.expires_at && (
                                    <span className="api-key-expires">
                                      Expires:{" "}
                                      {new Date(
                                        key.expires_at
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                  {key.revoked_at && (
                                    <span className="api-key-revoked">
                                      Revoked:{" "}
                                      {new Date(
                                        key.revoked_at
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="api-key-value">
                                {key.key.substring(0, 10)}...
                              </div>
                              <div className="api-key-actions">
                                {key.is_active && (
                                  <button
                                    className="revoke-key-button"
                                    onClick={() => revokeApiKey(key.id)}
                                    disabled={saving}
                                  >
                                    <X size={14} />
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-keys-message">
                          <p>
                            No API keys found. Generate a key to access the API.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Backup Settings */}
                {activeSection === "backup" && (
                  <div className="settings-section">
                    <h3 className="settings-title">Backup & Recovery</h3>
                    <p className="settings-description">
                      Configure automated backups and recovery options.
                    </p>

                    <div className="database-connection">
                      <div className="connection-header">
                        <h4>Database Connection</h4>
                        <button
                          className="test-connection-button"
                          onClick={testDatabaseConnection}
                          disabled={testingConnection}
                        >
                          {testingConnection ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <RefreshCw size={14} />
                              Test Connection
                            </>
                          )}
                        </button>
                      </div>

                      {connectionStatus && (
                        <div
                          className={`connection-status ${
                            connectionStatus.success ? "success" : "error"
                          }`}
                        >
                          {connectionStatus.success ? (
                            <Check size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          <p>{connectionStatus.message}</p>
                        </div>
                      )}
                    </div>

                    <form onSubmit={(e) => handleSubmit(e, "backup")}>
                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="autoBackup"
                            checked={backupSettings.autoBackup}
                            onChange={(e) => handleInputChange(e, "backup")}
                          />
                          <span className="checkbox-label">
                            Enable automated backups
                          </span>
                        </label>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="backupFrequency">
                            Backup Frequency
                          </label>
                          <select
                            id="backupFrequency"
                            name="backupFrequency"
                            value={backupSettings.backupFrequency}
                            onChange={(e) => handleInputChange(e, "backup")}
                            className="form-select"
                            disabled={!backupSettings.autoBackup}
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label htmlFor="backupTime">Backup Time</label>
                          <input
                            type="time"
                            id="backupTime"
                            name="backupTime"
                            value={backupSettings.backupTime}
                            onChange={(e) => handleInputChange(e, "backup")}
                            className="form-input"
                            disabled={
                              !backupSettings.autoBackup ||
                              backupSettings.backupFrequency === "hourly"
                            }
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="backupRetention">
                          Backup Retention (days)
                        </label>
                        <input
                          type="number"
                          id="backupRetention"
                          name="backupRetention"
                          min="1"
                          value={backupSettings.backupRetention}
                          onChange={(e) => handleInputChange(e, "backup")}
                          className="form-input"
                          disabled={!backupSettings.autoBackup}
                        />
                        <p className="input-help">
                          Number of days to keep backups before deletion.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="backupLocation">Backup Location</label>
                        <select
                          id="backupLocation"
                          name="backupLocation"
                          value={backupSettings.backupLocation}
                          onChange={(e) => handleInputChange(e, "backup")}
                          className="form-select"
                        >
                          <option value="local">Local Storage</option>
                          <option value="cloud">Cloud Storage</option>
                          <option value="s3">Amazon S3</option>
                          <option value="custom">Custom Location</option>
                        </select>
                      </div>

                      {backupSettings.backupLocation === "custom" && (
                        <div className="form-group">
                          <label htmlFor="customBackupPath">
                            Custom Backup Path
                          </label>
                          <input
                            type="text"
                            id="customBackupPath"
                            name="customBackupPath"
                            value={backupSettings.customBackupPath}
                            onChange={(e) => handleInputChange(e, "backup")}
                            className="form-input"
                          />
                        </div>
                      )}

                      <div className="form-group checkbox-group">
                        <h4 className="checkbox-group-title">
                          Include in Backups
                        </h4>
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="includeFiles"
                            checked={backupSettings.includeFiles}
                            onChange={(e) => handleInputChange(e, "backup")}
                          />
                          <span className="checkbox-label">User files</span>
                        </label>

                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="includeDatabase"
                            checked={backupSettings.includeDatabase}
                            onChange={(e) => handleInputChange(e, "backup")}
                          />
                          <span className="checkbox-label">Database</span>
                        </label>

                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="includeSettings"
                            checked={backupSettings.includeSettings}
                            onChange={(e) => handleInputChange(e, "backup")}
                          />
                          <span className="checkbox-label">Settings</span>
                        </label>
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="run-backup-button"
                          onClick={runBackup}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Running Backup...
                            </>
                          ) : (
                            <>
                              <Cloud size={14} />
                              Run Backup & Sync Files
                            </>
                          )}
                        </button>

                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>

                      {/* Add status display after the buttons */}
                      {backupStatus && (
                        <div
                          className={`backup-status ${
                            isBackingUp ? "in-progress" : "completed"
                          }`}
                        >
                          {backupStatus}
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedSystemSettings;
