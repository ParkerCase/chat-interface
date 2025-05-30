import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, User, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import CRMDashboard from "../crm/CRMDashboard";

const CRMTabContent = () => {
  const [showCRMDashboard, setShowCRMDashboard] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [centers, setCenters] = useState([]);
  const [error, setError] = useState(null);

  // Center mapping - bidirectional
  const centerMapping = {
    // Code to ID
    AUS: "56081b99-7e03-46de-b589-3f60cbd90556",
    CHI: "dc196a75-018b-43a2-9c27-9f7b1cc8207f",
    CW: "982982ea-50ce-483f-a4e9-a8e5a76b4725",
    Draper: "7110ab1d-5f3d-44b6-90ec-358029263a6a",
    HTN: "d406abe6-6118-4d52-9794-546729918f52",
    Houston: "90aa9708-4678-4c04-999e-63e4aff12f40",
    // ID to Code (reverse mapping)
    "56081b99-7e03-46de-b589-3f60cbd90556": "AUS",
    "dc196a75-018b-43a2-9c27-9f7b1cc8207f": "CHI",
    "982982ea-50ce-483f-a4e9-a8e5a76b4725": "CW",
    "7110ab1d-5f3d-44b6-90ec-358029263a6a": "Draper",
    "d406abe6-6118-4d52-9794-546729918f52": "HTN",
    "90aa9708-4678-4c04-999e-63e4aff12f40": "Houston",
  };

  // Check connection status
  const checkConnectionStatus = useCallback(async () => {
    try {
      // Test connection to Supabase by trying to fetch a center
      const { data, error } = await supabase
        .from("zenoti_centers")
        .select("center_code")
        .limit(1);

      if (error) throw error;

      setConnectionStatus({
        connected: true,
        message: "Successfully connected to Supabase database",
      });
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      setConnectionStatus({
        connected: false,
        message: `Connection failed: ${error.message}`,
      });
      return false;
    }
  }, []);

  // Fetch centers from Supabase
  const fetchCenters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("zenoti_centers")
        .select("center_id, center_code, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;

      const formattedCenters = data.map((center) => ({
        center_id: center.center_id,
        center_code: center.center_code,
        name: center.name,
        // Ensure both mappings work
        id: center.center_id,
        code: center.center_code,
      }));

      setCenters(formattedCenters);
      return formattedCenters;
    } catch (error) {
      console.error("Error fetching centers:", error);
      setError(`Failed to fetch centers: ${error.message}`);
      return [];
    }
  }, []);

  // Fetch recent contacts from Supabase with proper pagination
  const fetchRecentContacts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("zenoti_clients")
        .select("id, details")
        .order("last_synced", { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        setRecentContacts([]);
        return [];
      }

      // Process contacts and extract information from details JSON
      const processedContacts = data
        .map((row) => {
          const details = row.details || {};
          const personalInfo = details.personal_info || {};

          // Get center information
          const centerId = details.center_id;
          const centerCode = centerMapping[centerId] || "Unknown";
          const centerName =
            centers.find((c) => c.center_id === centerId)?.name || centerCode;

          return {
            id: row.id,
            name:
              `${personalInfo.first_name || ""} ${
                personalInfo.last_name || ""
              }`.trim() || "Unknown",
            email: personalInfo.email || "",
            phone: personalInfo.mobile_phone?.number || "",
            lastContact: details.created_date || null,
            centerCode: centerCode,
            centerName: centerName,
            centerID: centerId,
            // Keep original data for debugging
            _originalDetails: details,
          };
        })
        .filter((contact) => contact.name !== "Unknown"); // Filter out contacts without names

      setRecentContacts(processedContacts);
      return processedContacts;
    } catch (error) {
      console.error("Error fetching recent contacts:", error);
      setError(`Failed to fetch contacts: ${error.message}`);
      return [];
    }
  }, [centers, centerMapping]);

  // Initialize tab data
  const initializeTab = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check connection first
      await checkConnectionStatus();

      // Fetch centers
      await fetchCenters();

      // Then fetch contacts (this depends on centers for proper mapping)
      await fetchRecentContacts();
    } catch (error) {
      console.error("Error initializing CRM tab:", error);
      setError(`Initialization failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [checkConnectionStatus, fetchCenters, fetchRecentContacts]);

  // Load data on mount
  useEffect(() => {
    initializeTab();
  }, []); // Only run on mount

  // Refetch contacts when centers change (but don't cause infinite loop)
  useEffect(() => {
    if (centers.length > 0 && recentContacts.length === 0) {
      fetchRecentContacts();
    }
  }, [centers.length]); // Only depend on centers length, not the full array

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return "Invalid date";
    }
  };

  // Handle CRM dashboard
  const handleOpenCRM = () => setShowCRMDashboard(true);
  const handleCloseCRM = () => setShowCRMDashboard(false);

  return (
    <div className="crm-tab-content">
      <div className="crm-header">
        <h2>CRM Integration</h2>
        <p>Manage your customer relationships and view Zenoti data</p>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="error-alert"
          style={{
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            padding: "12px",
            margin: "16px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} color="#c33" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Connection Status */}
      <div className="admin-section">
        <h3 className="admin-section-title">Connection Status</h3>
        <div
          className="connection-status-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
          }}
        >
          <div className="connection-icon">
            <div
              className={`status-icon ${
                connectionStatus?.connected ? "connected" : "disconnected"
              }`}
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: connectionStatus?.connected
                  ? "#4caf50"
                  : "#f44336",
              }}
            />
          </div>
          <div className="connection-details" style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 4px 0" }}>Zenoti CRM via Supabase</h4>
            <p style={{ margin: 0, color: "#666" }}>
              {connectionStatus?.message || "Checking connection status..."}
            </p>
            {centers.length > 0 && (
              <p
                style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#888" }}
              >
                Connected to {centers.length} center
                {centers.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="connection-actions">
            <button
              className="refresh-button"
              onClick={initializeTab}
              disabled={isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <h3 className="admin-section-title">Quick Actions</h3>
        <div className="admin-actions" style={{ display: "flex", gap: "12px" }}>
          <button
            className="admin-button"
            onClick={handleOpenCRM}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            <User size={18} />
            Open CRM Dashboard
          </button>
        </div>
      </div>

      {/* Recent Contacts */}
      <div className="admin-section">
        <h3 className="admin-section-title">Recent Contacts</h3>
        <p style={{ margin: "0 0 16px 0", color: "#666" }}>
          Your most recently synced contacts from Zenoti
        </p>

        {isLoading ? (
          <div
            className="loading-indicator"
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#666",
            }}
          >
            <RefreshCw
              size={20}
              className="spinning"
              style={{ marginRight: "8px" }}
            />
            Loading recent contacts...
          </div>
        ) : recentContacts.length === 0 ? (
          <div
            className="empty-state"
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#888",
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
            }}
          >
            No recent contacts found. Try refreshing the connection.
          </div>
        ) : (
          <div
            className="contacts-table-container"
            style={{ overflowX: "auto" }}
          >
            <table
              className="admin-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#fff",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    Phone
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    Last Contact
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    Center
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentContacts.map((contact, index) => (
                  <tr
                    key={contact.id || index}
                    style={{
                      borderBottom:
                        index < recentContacts.length - 1
                          ? "1px solid #f0f0f0"
                          : "none",
                    }}
                  >
                    <td style={{ padding: "12px" }}>{contact.name}</td>
                    <td style={{ padding: "12px", color: "#666" }}>
                      {contact.email || "N/A"}
                    </td>
                    <td style={{ padding: "12px", color: "#666" }}>
                      {contact.phone || "N/A"}
                    </td>
                    <td style={{ padding: "12px", color: "#666" }}>
                      {formatDate(contact.lastContact)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#e3f2fd",
                          color: "#1976d2",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {contact.centerCode}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRM Dashboard Modal */}
      {showCRMDashboard && (
        <div
          className="crm-dashboard-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="crm-dashboard-container"
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              width: "98vw",
              height: "98vh",
              // maxWidth: "1400px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              margin: "auto",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              className="crm-dashboard-header"
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #e0e0e0",
                backgroundColor: "#f5f5f5",
                color: "black",
              }}
            >
              <h3 style={{ margin: 0 }}>Tatt2Away CRM Dashboard</h3>
              <button
                className="close-crm-button"
                onClick={handleCloseCRM}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <div
              className="crm-dashboard-content"
              style={{ flex: 1, overflow: "hidden" }}
            >
              <CRMDashboard
                centers={centers}
                onRefresh={initializeTab}
                centerMapping={centerMapping}
                onClose={handleCloseCRM}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMTabContent;
