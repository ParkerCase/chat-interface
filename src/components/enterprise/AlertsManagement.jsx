// src/components/enterprise/AlertsManagement.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import {
  Bell,
  BellOff,
  AlertTriangle,
  Info,
  CheckCircle,
  Trash2,
  Edit,
  Plus,
  Loader,
  AlertCircle,
  Filter,
} from "lucide-react";
import Header from "../Header";
import UpgradePrompt from "../UpgradePrompt";
import "./EnterpriseComponents.css";

const AlertsManagement = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [filter, setFilter] = useState("all"); // all, active, dismissed

  useEffect(() => {
    // Check if user has access to this enterprise feature
    if (!isFeatureEnabled("automated_alerts")) {
      setShowUpgradePrompt(true);
      return;
    }

    // Load alerts
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await apiService.alerts.getAll();

        if (response.data && response.data.success) {
          setAlerts(response.data.alerts || []);
        } else {
          setError("Failed to load alerts");
        }
      } catch (err) {
        console.error("Error loading alerts:", err);
        setError("Failed to load alerts. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [isFeatureEnabled]);

  const handleCreateAlert = () => {
    // Implementation would go here
    console.log("Create alert");
  };

  const handleEditAlert = (alert) => {
    // Implementation would go here
    console.log("Edit alert", alert);
  };

  const handleDeleteAlert = async (alertId) => {
    // Implementation would go here
    console.log("Delete alert", alertId);
  };

  const handleDismissAlert = async (alertId) => {
    // Implementation would go here
    console.log("Dismiss alert", alertId);
  };

  const handleFilter = (newFilter) => {
    setFilter(newFilter);
  };

  // Filter alerts based on current filter
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "all") return true;
    if (filter === "active") return !alert.dismissed;
    if (filter === "dismissed") return alert.dismissed;
    return true;
  });

  // Get icon based on alert severity
  const getAlertIcon = (severity) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle size={20} className="critical" />;
      case "warning":
        return <AlertTriangle size={20} className="warning" />;
      case "info":
        return <Info size={20} className="info" />;
      default:
        return <Bell size={20} />;
    }
  };

  // Show upgrade prompt if feature not available
  if (showUpgradePrompt) {
    return (
      <UpgradePrompt feature="automated_alerts" onClose={() => navigate("/")} />
    );
  }

  return (
    <div className="enterprise-container">
      <Header currentUser={currentUser} onLogout={logout} />

      <div className="enterprise-content">
        <div className="enterprise-header">
          <h1>Alerts Management</h1>
          <div className="header-actions">
            <div className="filter-buttons">
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => handleFilter("all")}
              >
                All
              </button>
              <button
                className={filter === "active" ? "active" : ""}
                onClick={() => handleFilter("active")}
              >
                Active
              </button>
              <button
                className={filter === "dismissed" ? "active" : ""}
                onClick={() => handleFilter("dismissed")}
              >
                Dismissed
              </button>
            </div>
            <button className="create-button" onClick={handleCreateAlert}>
              <Plus size={16} />
              Create Alert
            </button>
          </div>
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
            <p>Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <h3>No alerts found</h3>
            <p>No alerts match your current filter criteria.</p>
            {filter !== "all" && (
              <button
                className="view-all-button"
                onClick={() => setFilter("all")}
              >
                View All Alerts
              </button>
            )}
          </div>
        ) : (
          <div className="alerts-list">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-card ${alert.severity} ${
                  alert.dismissed ? "dismissed" : ""
                }`}
              >
                <div className="alert-header">
                  <div className="alert-title">
                    {getAlertIcon(alert.severity)}
                    <h3>{alert.title}</h3>
                    {alert.dismissed && (
                      <span className="dismissed-badge">Dismissed</span>
                    )}
                  </div>
                  <div className="alert-actions">
                    {!alert.dismissed && (
                      <button
                        className="dismiss-button"
                        onClick={() => handleDismissAlert(alert.id)}
                        title="Dismiss Alert"
                      >
                        <BellOff size={16} />
                      </button>
                    )}
                    <button
                      className="edit-button"
                      onClick={() => handleEditAlert(alert)}
                      title="Edit Alert"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteAlert(alert.id)}
                      title="Delete Alert"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="alert-content">
                  <p>{alert.message}</p>
                </div>
                <div className="alert-details">
                  <span className="timestamp">
                    Triggered: {new Date(alert.timestamp).toLocaleString()}
                  </span>
                  <span className="source">Source: {alert.source}</span>
                  {alert.affectedUsers && (
                    <span className="affected-users">
                      Affected Users: {alert.affectedUsers}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsManagement;
