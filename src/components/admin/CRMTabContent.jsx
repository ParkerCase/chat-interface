import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { User, Database, Clock } from "lucide-react";
import zenotiService from "../../services/zenotiService";
import ImportContacts from "../crm/ImportContacts";
import CRMDashboard from "../crm/CRMDashboard";
import ZenotiConfigForm from "../zenoti/ZenotiConfigForm";

const CRMTabContent = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCRMDashboard, setShowCRMDashboard] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // In CRMTabContent.jsx
  const checkConnectionStatus = async () => {
    try {
      console.log("Checking Zenoti connection status...");
      const response = await zenotiService.checkConnectionStatus();
      console.log("Zenoti status response:", response);

      // More flexible check that handles different response formats
      const isConnected =
        (response.data?.success && response.data?.status === "connected") ||
        response.data?.details?.connected === true;

      console.log(
        "Connection status determined as:",
        isConnected ? "Connected" : "Not Connected"
      );

      setConnectionStatus({
        connected: isConnected,
        message: isConnected
          ? "Connected to Zenoti"
          : "Not connected to Zenoti",
      });

      return isConnected;
    } catch (err) {
      console.error("Error checking connection status:", err);
      setConnectionStatus({
        connected: false,
        message: "Error checking connection status",
      });
      return false;
    }
  };

  // Define initializeTab function using useCallback to be able to reference it elsewhere
  const initializeTab = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check connection status
      const statusResponse = await zenotiService.checkConnectionStatus();
      const isConnected =
        statusResponse.data?.success &&
        statusResponse.data?.status === "connected";

      setConnectionStatus({
        connected: isConnected,
        message: isConnected
          ? "Connected to Zenoti"
          : "Not connected to Zenoti",
      });

      if (isConnected) {
        // Load recent contacts
        const response = await zenotiService.searchClients({
          sort: "last_visit",
          limit: 5,
        });

        if (response.data?.success) {
          // Format clients to match our contact structure
          const formattedContacts = (response.data.clients || []).map(
            (client) => ({
              id: client.id || client.guest_id,
              name: `${client.first_name || ""} ${
                client.last_name || ""
              }`.trim(),
              email: client.email,
              phone: client.mobile,
              lastContact: client.last_visit_date || null,
              centerCode: client.center_code,
            })
          );

          setRecentContacts(formattedContacts);
        }
      } else {
        // Use mock data if not connected
        const mockContacts = [
          {
            id: "1",
            name: "Alex Thompson",
            email: "alex@example.com",
            phone: "555-123-4567",
            lastContact: new Date(
              Date.now() - 2 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            id: "2",
            name: "Emma Wilson",
            email: "emma@example.com",
            phone: "555-765-4321",
            lastContact: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        ];

        setRecentContacts(mockContacts);
      }
    } catch (err) {
      console.error("Error initializing CRM tab:", err);
      // Use mock data as fallback
      const mockContacts = [
        {
          id: "1",
          name: "Alex Thompson",
          email: "alex@example.com",
          phone: "555-123-4567",
          lastContact: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        {
          id: "2",
          name: "Emma Wilson",
          email: "emma@example.com",
          phone: "555-765-4321",
          lastContact: new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];

      setRecentContacts(mockContacts);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check connection and load recent contacts on mount
  useEffect(() => {
    initializeTab();
  }, [initializeTab]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const diffWeeks = Math.floor(diffDays / 7);
      return `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  useEffect(() => {
    const debugConnectionStatus = async () => {
      try {
        console.log("Checking Zenoti connection status...");
        const statusResponse = await zenotiService.checkConnectionStatus();
        console.log("Zenoti connection status response:", statusResponse);

        // Check if the response format is what we expect
        const isConnected =
          statusResponse.data?.success &&
          statusResponse.data?.status === "connected";

        console.log("Is connected:", isConnected);
        console.log("Status response data:", statusResponse.data);

        // Set connection status based on response
        setConnectionStatus({
          connected: isConnected,
          message: isConnected
            ? "Connected to Zenoti"
            : "Not connected to Zenoti",
        });
      } catch (err) {
        console.error("Error debugging Zenoti status:", err);
      }
    };

    debugConnectionStatus();
  }, []);

  // Handle import completion
  const handleImportComplete = (stats) => {
    console.log("Import completed:", stats);
    setShowImportModal(false);

    // Refresh contacts if import was successful
    if (stats.success > 0) {
      initializeTab();
    }
  };

  // Open CRM system
  const handleOpenCRM = () => {
    setShowCRMDashboard(true);
  };

  // Close CRM system
  const handleCloseCRM = () => {
    setShowCRMDashboard(false);
  };

  return (
    <div className="crm-tab-content">
      <h2>CRM Integration</h2>

      {/* Contact Management Section */}
      <div className="admin-section">
        <h3 className="admin-section-title">Contact Management</h3>
        <p>Access the CRM system to manage contacts and client information.</p>

        <div className="admin-actions">
          <button className="admin-button" onClick={handleOpenCRM}>
            <User size={18} />
            Open CRM System
          </button>

          <button
            className="admin-button"
            onClick={() => setShowImportModal(true)}
          >
            <Database size={18} />
            Import Contacts
          </button>
        </div>
      </div>

      {/* Recent Contacts Section */}
      <div className="admin-section">
        <h3 className="admin-section-title">Recent Contacts</h3>
        <p>Your most recently accessed contacts will appear here.</p>

        {isLoading ? (
          <div className="loading-indicator">Loading recent contacts...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Last Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentContacts.length > 0 ? (
                recentContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.name}</td>
                    <td>{contact.email || "—"}</td>
                    <td>{contact.phone || "—"}</td>
                    <td>
                      {contact.lastContact ? (
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{formatDate(contact.lastContact)}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button className="action-button edit-button">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-table-message">
                    No recent contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Connection Status */}
      <div className="admin-section">
        <h3 className="admin-section-title">Connection Status</h3>

        <div className="connection-status-card">
          <div className="connection-icon">
            {connectionStatus?.connected ? (
              <div className="status-icon connected"></div>
            ) : (
              <div className="status-icon disconnected"></div>
            )}
          </div>

          <div className="connection-details">
            <h4>Zenoti CRM</h4>
            <p
              className={
                connectionStatus?.connected
                  ? "connected-text"
                  : "disconnected-text"
              }
            >
              {connectionStatus?.message || "Checking connection status..."}
            </p>
          </div>

          <div className="connection-actions">
            <button
              className="config-button"
              onClick={() => setShowConfigModal(true)}
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Import Contacts Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-container import-modal">
            <ImportContacts
              onClose={() => setShowImportModal(false)}
              onSuccess={handleImportComplete}
            />
          </div>
        </div>
      )}

      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <ZenotiConfigForm
              onClose={() => setShowConfigModal(false)}
              onSuccess={() => {
                setShowConfigModal(false);
                initializeTab(); // Refresh after successful config
              }}
            />
          </div>
        </div>
      )}

      {/* CRM Dashboard Modal */}
      {showCRMDashboard && (
        <div className="crm-dashboard-container">
          <div className="crm-dashboard-header">
            <h3>Tatt2Away CRM Dashboard</h3>
            <button className="close-crm-button" onClick={handleCloseCRM}>
              Close
            </button>
          </div>

          <div className="crm-dashboard-content">
            <CRMDashboard />
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMTabContent;
