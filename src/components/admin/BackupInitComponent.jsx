// Add this component to your src/components/admin/ directory
// src/components/admin/BackupInitComponent.jsx

import React, { useState, useEffect } from "react";
import { AlertCircle, Check, RefreshCw, Database, Clock } from "lucide-react";
import backupService from "../../services/BackupService";

/**
 * Component to initialize and prepare the backup system
 */
const BackupInitComponent = ({ onReady }) => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [checkResults, setCheckResults] = useState(null);
  const [setupInProgress, setSetupInProgress] = useState(false);

  useEffect(() => {
    checkTablesExist();
  }, []);

  const checkTablesExist = async () => {
    try {
      setChecking(true);
      setError(null);
      setStatus("checking");

      const results = await backupService.checkBackupConstraints();
      setCheckResults(results);

      if (results.success && results.tableExists) {
        setStatus("ready");
        if (onReady) onReady(true);
      } else {
        setStatus("not_ready");
      }
    } catch (err) {
      console.error("Error checking backup tables:", err);
      setError(err.message || "Failed to check backup tables");
      setStatus("error");
    } finally {
      setChecking(false);
    }
  };

  const setupBackupTables = async () => {
    try {
      setSetupInProgress(true);
      setError(null);
      setStatus("setting_up");

      // Call backend endpoint to create tables
      const response = await fetch("/api/admin/backup/setup-tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Server returned ${response.status}`
        );
      }

      const result = await response.json();

      if (result.success) {
        setStatus("ready");
        if (onReady) onReady(true);
      } else {
        throw new Error(result.message || "Unknown error creating tables");
      }
    } catch (err) {
      console.error("Error setting up backup tables:", err);
      setError(err.message || "Failed to set up backup tables");
      setStatus("error");
    } finally {
      setSetupInProgress(false);
    }
  };

  // Function to create tables directly
  const createTablesDirectly = async () => {
    try {
      setSetupInProgress(true);
      setError(null);
      setStatus("setting_up");

      // Ensure backup tables exist
      const result = await backupService.ensureBackupTablesExist();

      if (result) {
        setStatus("ready");
        if (onReady) onReady(true);
      } else {
        throw new Error("Failed to create backup tables");
      }
    } catch (err) {
      console.error("Error creating backup tables directly:", err);
      setError(err.message || "Failed to create backup tables");
      setStatus("error");
    } finally {
      setSetupInProgress(false);
    }
  };

  const renderStatus = () => {
    switch (status) {
      case "checking":
        return (
          <div className="backup-status checking">
            <RefreshCw className="icon spinning" />
            <p>Checking backup system status...</p>
          </div>
        );
      case "ready":
        return (
          <div className="backup-status ready">
            <Check className="icon success" />
            <p>Backup system is ready to use</p>
          </div>
        );
      case "not_ready":
        return (
          <div className="backup-status not-ready">
            <AlertCircle className="icon warning" />
            <p>Backup system needs setup</p>
            <div className="action-buttons">
              <button
                className="setup-button"
                onClick={setupBackupTables}
                disabled={setupInProgress}
              >
                {setupInProgress ? (
                  <>
                    <RefreshCw className="icon spinning" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Database className="icon" />
                    Set up backup tables
                  </>
                )}
              </button>
              <button
                className="retry-button"
                onClick={checkTablesExist}
                disabled={checking || setupInProgress}
              >
                <RefreshCw className="icon" />
                Check again
              </button>
            </div>
          </div>
        );
      case "setting_up":
        return (
          <div className="backup-status setting-up">
            <RefreshCw className="icon spinning" />
            <p>Setting up backup system...</p>
          </div>
        );
      case "error":
        return (
          <div className="backup-status error">
            <AlertCircle className="icon error" />
            <p>Error: {error}</p>
            <div className="action-buttons">
              <button
                className="retry-button"
                onClick={checkTablesExist}
                disabled={checking}
              >
                <RefreshCw className="icon" />
                Try again
              </button>
              <button
                className="alternative-button"
                onClick={createTablesDirectly}
                disabled={setupInProgress}
              >
                <Clock className="icon" />
                Try alternative method
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="backup-init-component">
      {renderStatus()}

      {checkResults && status !== "ready" && (
        <div className="check-results">
          <h4>Diagnostic Information</h4>
          <pre>{JSON.stringify(checkResults, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default BackupInitComponent;
