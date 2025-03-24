// src/components/enterprise/IntegrationSettings.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import {
  Link as LinkIcon,
  FileText,
  Database,
  Cloud,
  Loader,
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw,
  Plus,
} from "lucide-react";
import Header from "../Header";
import UpgradePrompt from "../UpgradePrompt";
import ZenotiStatus from "../zenoti/ZenotiStatus";
import ZenotiConfigForm from "../zenoti/ZenotiConfigForm";
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
  const [showConfigForm, setShowConfigForm] = useState(false);

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

        // In a production app, fetch from API - for now using mock data
        // const response = await apiService.integrations.getAll();

        // Mock data for development
        const mockIntegrations = [
          {
            id: "zenoti",
            name: "Zenoti",
            description: "Zenoti Salon & Spa Management Software",
            type: "crm",
            icon: "crm",
            connected: false,
            status: "disconnected",
          },
          {
            id: "dropbox",
            name: "Dropbox",
            description: "Cloud storage and file sharing service",
            type: "cloud",
            icon: "cloud",
            connected: true,
            status: "connected",
          },
          {
            id: "salesforce",
            name: "Salesforce",
            description: "Customer relationship management platform",
            type: "crm",
            icon: "crm",
            connected: false,
            status: "disconnected",
          },
        ];

        setIntegrations(mockIntegrations);

        // Set Zenoti as default selected integration
        const zenotiIntegration = mockIntegrations.find(
          (i) => i.id === "zenoti"
        );
        if (zenotiIntegration) {
          setSelectedIntegration(zenotiIntegration);
        } else if (mockIntegrations.length > 0) {
          setSelectedIntegration(mockIntegrations[0]);
        }
      } catch (err) {
        console.error("Error loading integrations:", err);
        setError("Failed to load integrations. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, [isFeatureEnabled]);

  const handleSelectIntegration = (integration) => {
    setSelectedIntegration(integration);
    setShowConfigForm(false);
  };

  const handleOpenConfigForm = () => {
    setShowConfigForm(true);
  };

  const handleConfigSuccess = (config) => {
    setShowConfigForm(false);

    // Update the integration status
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === selectedIntegration.id
          ? {
              ...integration,
              connected: true,
              status: "connected",
              lastSync: new Date().toISOString(),
            }
          : integration
      )
    );

    // Update selected integration
    setSelectedIntegration((prev) => ({
      ...prev,
      connected: true,
      status: "connected",
      lastSync: new Date().toISOString(),
    }));
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
                      <LinkIcon size={20} />
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

                <div className="integration-item add-integration">
                  <Plus size={20} />
                  <div className="integration-item-details">
                    <h4>Add Integration</h4>
                    <span className="status">Available in Enterprise tier</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="integration-details">
              {showConfigForm && selectedIntegration ? (
                // Show config form if in configuration mode
                <div>
                  <h2>Configure {selectedIntegration.name} Integration</h2>
                  {selectedIntegration.id === "zenoti" && (
                    <ZenotiConfigForm
                      onSuccess={handleConfigSuccess}
                      onCancel={() => setShowConfigForm(false)}
                    />
                  )}
                </div>
              ) : selectedIntegration ? (
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
                      {selectedIntegration.connected && (
                        <button
                          className="sync-button"
                          onClick={() =>
                            handleSyncIntegration(selectedIntegration.type)
                          }
                        >
                          <RefreshCw size={16} />
                          Sync Now
                        </button>
                      )}
                      <button
                        className="settings-button"
                        onClick={handleOpenConfigForm}
                      >
                        <Settings size={16} />
                        Settings
                      </button>
                    </div>
                  </div>

                  <div className="integration-description">
                    <p>{selectedIntegration.description}</p>
                  </div>

                  {/* Status Widget */}
                  {selectedIntegration.id === "zenoti" && (
                    <ZenotiStatus onConfigureClick={handleOpenConfigForm} />
                  )}

                  {selectedIntegration.connected ? (
                    <div className="integration-config">
                      <h3>Connection Details</h3>
                      <div className="config-form">
                        <div className="form-group">
                          <label>API Status</label>
                          <div className="status-badge connected">
                            <CheckCircle size={16} className="mr-2" />
                            Connected
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Last Synced</label>
                          <div>
                            {selectedIntegration.lastSync
                              ? new Date(
                                  selectedIntegration.lastSync
                                ).toLocaleString()
                              : "Never"}
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Sync Frequency</label>
                          <div>
                            {selectedIntegration.syncFrequency || "Daily"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="not-connected-message">
                      <AlertCircle size={24} />
                      <h3>Not Connected</h3>
                      <p>This integration is not currently connected.</p>
                      <button
                        className="connect-button"
                        onClick={handleOpenConfigForm}
                      >
                        <LinkIcon size={16} />
                        Configure Connection
                      </button>
                    </div>
                  )}
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
