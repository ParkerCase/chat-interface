// src/components/enterprise/IntegrationSettings.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import {
  Link,
  FileText,
  Database,
  Cloud,
  Loader,
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw,
} from "lucide-react";
import Header from "../Header";
import UpgradePrompt from "../UpgradePrompt";
import "./EnterpriseComponents.css";

const IntegrationSettings = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Example integration types with their icons
  const integrationTypes = {
    crm: { icon: <Database size={20} />, name: "CRM Systems" },
    dms: { icon: <FileText size={20} />, name: "Document Management" },
    cloud: { icon: <Cloud size={20} />, name: "Cloud Storage" },
  };

  useEffect(() => {
    // Check if user has access to this enterprise feature
    if (!isFeatureEnabled("custom_integrations")) {
      setShowUpgradePrompt(true);
      return;
    }

    // Load integrations
    const fetchIntegrations = async () => {
      try {
        setLoading(true);
        const response = await apiService.integrations.getAll();

        if (response.data && response.data.success) {
          setIntegrations(response.data.integrations || []);

          // Set first integration as selected if none is selected
          if (response.data.integrations?.length > 0 && !selectedIntegration) {
            setSelectedIntegration(response.data.integrations[0]);
          }
        } else {
          setError("Failed to load integrations");
        }
      } catch (err) {
        console.error("Error loading integrations:", err);
        setError("Failed to load integrations. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, [isFeatureEnabled, selectedIntegration]);

  const handleSelectIntegration = (integration) => {
    setSelectedIntegration(integration);
  };

  const handleTestIntegration = async (integrationType) => {
    // Implementation would go here
    console.log("Test integration", integrationType);
  };

  const handleSyncIntegration = async (integrationType) => {
    // Implementation would go here
    console.log("Sync integration", integrationType);
  };

  // Show upgrade prompt if feature not available
  if (showUpgradePrompt) {
    return (
      <UpgradePrompt
        feature="custom_integrations"
        onClose={() => navigate("/")}
      />
    );
  }

  return (
    <div className="enterprise-container">
      <Header currentUser={currentUser} onLogout={logout} />

      <div className="enterprise-content">
        <div className="enterprise-header">
          <h1>Integration Settings</h1>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <Loader className="spinner" size={32} />
            <p>Loading integrations...</p>
          </div>
        ) : (
          <div className="integration-container">
            <div className="integration-sidebar">
              <h3>Available Integrations</h3>
              <div className="integration-list">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className={`integration-item ${
                      selectedIntegration?.id === integration.id ? "active" : ""
                    }`}
                    onClick={() => handleSelectIntegration(integration)}
                  >
                    {integrationTypes[integration.type]?.icon || (
                      <Link size={20} />
                    )}
                    <div className="integration-item-details">
                      <h4>{integration.name}</h4>
                      <span
                        className={`status ${
                          integration.connected ? "connected" : "disconnected"
                        }`}
                      >
                        {integration.connected ? "Connected" : "Not Connected"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="integration-details">
              {selectedIntegration ? (
                <>
                  <div className="integration-header">
                    <h2>{selectedIntegration.name}</h2>
                    <div className="integration-actions">
                      <button
                        className="test-button"
                        onClick={() =>
                          handleTestIntegration(selectedIntegration.type)
                        }
                      >
                        <CheckCircle size={16} />
                        Test Connection
                      </button>
                      <button
                        className="sync-button"
                        onClick={() =>
                          handleSyncIntegration(selectedIntegration.type)
                        }
                      >
                        <RefreshCw size={16} />
                        Sync Now
                      </button>
                      <button className="settings-button">
                        <Settings size={16} />
                        Settings
                      </button>
                    </div>
                  </div>

                  <div className="integration-config">
                    <h3>Connection Details</h3>
                    <div className="config-form">
                      <div className="form-group">
                        <label>API Key</label>
                        <input
                          type="password"
                          value={
                            selectedIntegration.apiKey || "••••••••••••••••"
                          }
                          readOnly
                        />
                      </div>
                      <div className="form-group">
                        <label>Endpoint URL</label>
                        <input
                          type="text"
                          value={selectedIntegration.endpoint || ""}
                        />
                      </div>
                      <div className="form-group">
                        <label>Sync Frequency</label>
                        <select
                          defaultValue={
                            selectedIntegration.syncFrequency || "daily"
                          }
                        >
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="manual">Manual Only</option>
                        </select>
                      </div>
                    </div>

                    <div className="sync-status">
                      <h3>Sync Status</h3>
                      <div className="status-item">
                        <span>Last Sync:</span>
                        <span>
                          {selectedIntegration.lastSync
                            ? new Date(
                                selectedIntegration.lastSync
                              ).toLocaleString()
                            : "Never"}
                        </span>
                      </div>
                      <div className="status-item">
                        <span>Sync Status:</span>
                        <span
                          className={`sync-badge ${
                            selectedIntegration.syncStatus || "unknown"
                          }`}
                        >
                          {selectedIntegration.syncStatus || "Unknown"}
                        </span>
                      </div>
                      <div className="status-item">
                        <span>Total Items Synced:</span>
                        <span>{selectedIntegration.itemsSynced || 0}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <h3>No Integration Selected</h3>
                  <p>
                    Select an integration from the sidebar to view and edit its
                    settings.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationSettings;
