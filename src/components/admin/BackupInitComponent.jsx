// Add this component to your src/components/admin/ directory
// src/components/admin/BackupInitComponent.jsx

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Check,
  RefreshCw,
  Database,
  Clock,
  HardDrive,
  FileText,
} from "lucide-react";
import backupService from "../../services/BackupService";
import { supabase } from "../../lib/supabase";

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

      // Check if required tables exist
      const tables = ["backups", "image_embeddings"];
      const tableResults = {};
      let allTablesExist = true;

      for (const tableName of tables) {
        try {
          const { error } = await supabase
            .from(tableName)
            .select("id")
            .limit(1);

          if (error && error.message.includes("does not exist")) {
            tableResults[tableName] = false;
            allTablesExist = false;
          } else {
            tableResults[tableName] = true;
          }
        } catch (err) {
          tableResults[tableName] = false;
          allTablesExist = false;
        }
      }

      // Check for document_embeddings table separately since it's optional
      try {
        const { error } = await supabase
          .from("document_embeddings")
          .select("id")
          .limit(1);

        tableResults.document_embeddings =
          !error || !error.message.includes("does not exist");
      } catch (err) {
        tableResults.document_embeddings = false;
      }

      // Check if embedding RPC functions exist
      const rpcs = [
        "smart_image_search",
        "search_images_by_embedding",
        "search_images_by_keywords",
      ];

      const rpcResults = {};
      let allRpcsExist = true;

      for (const rpcName of rpcs) {
        try {
          // Call the RPC with minimal parameters to check if it exists
          const { error } = await supabase.rpc(rpcName, {
            query_embedding: [0, 0, 0],
            match_threshold: 0.1,
            match_limit: 1,
            emb_type: "full",
            offset_value: 0,
          });

          // If the error is about wrong parameters but not "function does not exist"
          if (error && !error.message.includes("does not exist")) {
            rpcResults[rpcName] = true;
          } else if (error && error.message.includes("does not exist")) {
            rpcResults[rpcName] = false;
            allRpcsExist = false;
          } else {
            rpcResults[rpcName] = true;
          }
        } catch (err) {
          // Check if the error contains "does not exist" message
          if (err.message && err.message.includes("does not exist")) {
            rpcResults[rpcName] = false;
            allRpcsExist = false;
          } else {
            // If the error is for other reasons, the function likely exists
            rpcResults[rpcName] = true;
          }
        }
      }

      const results = {
        tableExists: allTablesExist,
        tables: tableResults,
        rpcs: rpcResults,
        allRpcsExist,
        success: allTablesExist,
      };
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
            {checkResults && checkResults.tables && (
              <div className="status-details">
                <div className="detail-item">
                  <HardDrive size={14} />
                  <span>Image embeddings table: </span>
                  {checkResults.tables.image_embeddings ? (
                    <Check className="success" size={14} />
                  ) : (
                    <AlertCircle className="error" size={14} />
                  )}
                </div>
                <div className="detail-item">
                  <FileText size={14} />
                  <span>Document embeddings table: </span>
                  {checkResults.tables.document_embeddings ? (
                    <Check className="success" size={14} />
                  ) : (
                    <AlertCircle className="warning" size={14} />
                  )}
                </div>
              </div>
            )}
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
