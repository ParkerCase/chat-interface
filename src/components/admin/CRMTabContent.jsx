import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, RefreshCw, Database, Clock } from "lucide-react";
import zenotiService from "../../services/zenotiService";
import ImportContacts from "../crm/ImportContacts";
import CRMDashboard from "../crm/CRMDashboard";
import ZenotiConfigForm from "../zenoti/ZenotiConfigForm";

const USE_MOCK_DATA = false; // Set to false when you want to use real API

const CRMTabContent = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCRMDashboard, setShowCRMDashboard] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [centers, setCenters] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);

  const navigate = useNavigate();

  // Improved connection status check
  // Modified checkConnectionStatus function
  const checkConnectionStatus = async () => {
    try {
      // If mock mode is on, return mock status
      if (USE_MOCK_DATA) {
        setConnectionStatus({
          connected: true,
          message: "Connected to Zenoti (MOCK DATA MODE)",
        });
        return true;
      }

      console.log("Checking Zenoti connection status...");
      const response = await zenotiService.checkConnectionStatus();
      console.log("Zenoti status response:", response);

      // Extract connection status
      const isConnected = response.data?.success === true;

      console.log("Connection status determined as:", isConnected);

      // Update state
      setConnectionStatus({
        connected: isConnected,
        message:
          response.data?.message ||
          (isConnected ? "Connected to Zenoti" : "Not connected to Zenoti"),
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

  const fetchCenters = async () => {
    try {
      console.log("Attempting to fetch centers...");
      const response = await zenotiService.getCenters();
      console.log("Centers response:", response);

      if (response.data?.success && response.data?.centers) {
        console.log("Setting centers:", response.data.centers);
        setCenters(response.data.centers);
        return response.data.centers;
      } else if (response.data?.centers) {
        console.log("Setting centers from direct data:", response.data.centers);
        setCenters(response.data.centers);
        return response.data.centers;
      } else if (response.data?.centerMapping) {
        console.log(
          "Setting centers from centerMapping:",
          response.data.centerMapping
        );
        setCenters(response.data.centerMapping);
        return response.data.centerMapping;
      } else {
        console.warn("No centers found in response:", response.data);
      }
      return [];
    } catch (err) {
      console.error("Error fetching centers:", err);
      return [];
    }
  };

  // Also update your initializeTab function to log more details
  const initializeTab = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("Initializing CRM tab...");

      // Check connection status
      const isConnected = await checkConnectionStatus();
      console.log("Connection status check result:", isConnected);

      if (isConnected) {
        // Load center data
        const centerData = await fetchCenters();
        console.log("Fetched center data:", centerData);

        // In your initializeTab function where you format contacts
        try {
          console.log("Attempting to fetch clients...");
          const response = await zenotiService.searchClients({
            limit: 5,
          });
          console.log("Clients response:", response);

          // Get clients from response data
          const clientsData =
            response.data?.clients ||
            (response.data?.success ? response.data.clients : []);

          if (clientsData && clientsData.length > 0) {
            console.log("Found clients data:", clientsData);

            // Format clients with updated mapping that handles nested personal_info
            const formattedContacts = clientsData.map((client) => {
              // Check if we have personal_info object
              const personalInfo = client.personal_info || client;

              return {
                id: client.id || client.guest_id,
                name: `${personalInfo.first_name || ""} ${
                  personalInfo.last_name || ""
                }`.trim(),
                email: personalInfo.email || "",
                // Handle phone which could be in different formats
                phone:
                  personalInfo.mobile_phone?.number ||
                  personalInfo.mobile ||
                  personalInfo.phone ||
                  "",
                lastContact:
                  client.last_visit_date ||
                  client.created_date ||
                  client.last_modified_date ||
                  null,
                centerCode:
                  client.center_id ||
                  client._centerCode ||
                  client.center_code ||
                  "",
                centerName: client.center_name || client._centerName || "",
              };
            });

            console.log("Setting formatted contacts:", formattedContacts);
            setRecentContacts(formattedContacts);
          } else {
            console.warn("No client data found in response", response);
            setRecentContacts(getMockContacts());
          }
        } catch (error) {
          console.error("Error loading clients:", error);
          setRecentContacts(getMockContacts());
        }
      } else {
        console.log("Not connected, using mock data");
        setRecentContacts(getMockContacts());
      }
    } catch (err) {
      console.error("Error initializing CRM tab:", err);
      setRecentContacts(getMockContacts());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Extract mock contacts to a separate function
  const getMockContacts = () => [
    {
      id: "1",
      name: "Alex Thompson",
      email: "alex@example.com",
      phone: "555-123-4567",
      lastContact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      centerCode: "AUS",
      centerName: "Austin",
    },
    {
      id: "2",
      name: "Emma Wilson",
      email: "emma@example.com",
      phone: "555-765-4321",
      lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      centerCode: "CHI",
      centerName: "Chicago",
    },
  ];

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

  // Handle contact view
  const handleViewContact = (contactId, centerCode) => {
    console.log(`View contact ${contactId} from center ${centerCode}`);
    // Pass the contact data to CRMDashboard
    setSelectedContact({ id: contactId, centerCode });
    setShowCRMDashboard(true);
  };

  return (
    <div className="crm-tab-content">
      <h2>CRM Integration</h2>

      {/* Connection Status - Moved to top for better visibility */}
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
            {connectionStatus?.connected && centers.length > 0 && (
              <p className="center-count-text">
                Connected to {centers.length} center
                {centers.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="connection-actions">
            <button className="refresh-button" onClick={initializeTab}>
              <RefreshCw style={{ marginBottom: "0" }} size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Rest of the component remains the same */}
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
                <th>Center</th>
                <th>Last Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentContacts.length > 0 ? (
                recentContacts.map((contact, index) => (
                  <tr key={`contact-tab-${contact.id || ''}-${index}`}>
                    <td>{contact.name}</td>
                    <td>{contact.email || "—"}</td>
                    <td>{contact.phone || "—"}</td>
                    <td>{contact.centerName || contact.centerCode || "—"}</td>
                    <td>
                      {contact.lastContact ? (
                        <div className="flex items-center gap-1">
                          <span>{formatDate(contact.lastContact)}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        className="action-button view-button"
                        onClick={() =>
                          handleViewContact(contact.id, contact.centerCode)
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-table-message">
                    No recent contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-container import-modal">
            <ImportContacts
              onClose={() => setShowImportModal(false)}
              onSuccess={handleImportComplete}
              centers={centers}
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
            <CRMDashboard
              centers={centers}
              onRefresh={initializeTab}
              selectedContact={selectedContact}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMTabContent;
