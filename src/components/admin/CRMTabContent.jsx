import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, User } from "lucide-react";
import { supabase } from "../../lib/supabase";
import CRMDashboard from "../crm/CRMDashboard";

const CRMTabContent = () => {
  const [showCRMDashboard, setShowCRMDashboard] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [centers, setCenters] = useState([]);
  const [centerIdMap, setCenterIdMap] = useState({});
  const [selectedContact, setSelectedContact] = useState(null);

  // Check connection status (dummy, always true for read-only)
  const checkConnectionStatus = async () => {
    setConnectionStatus({
      connected: true,
      message: "Read-only mode: Data loaded from Supabase",
    });
    return true;
  };

  // Fetch centers from Supabase and build centerIdMap
  const fetchCenters = async () => {
    const { data, error } = await supabase.from("zenoti_centers").select("*");
    if (!error && data) {
      setCenters(data);
      const map = {};
      data.forEach((c) => {
        map[c.center_id] = { code: c.center_code, name: c.name };
        map[c.center_code] = { id: c.center_id, name: c.name };
      });
      setCenterIdMap(map);
    }
    return data || [];
  };

  // Fetch recent contacts from Supabase
  const fetchRecentContacts = async () => {
    const { data, error } = await supabase
      .from("zenoti_clients")
      .select("id, details, center_id")
      .limit(100);
    if (!error && data) {
      // Flatten all fields from details JSON into top-level
      let contacts = data.map((row) => {
        const d = row.details || {};
        const centerId = d.center_id || row.center_id || d.center_code;
        const centerInfo = centerIdMap[centerId] || {};
        return {
          ...d,
          ...row,
          name: `${d.first_name || d.personal_info?.first_name || ""} ${
            d.last_name || d.personal_info?.last_name || ""
          }`.trim(),
          email: d.email || d.personal_info?.email || "",
          phone:
            d.mobile ||
            d.personal_info?.mobile ||
            d.mobile_phone?.number ||
            d.phone ||
            "",
          lastContact: d.last_visit_date || d.last_modified_date || null,
          centerCode: centerInfo.code || d.center_code || centerId || "",
          centerName: centerInfo.name || d.center_name || "",
        };
      });
      // Sort by last_visit_date descending if present
      contacts.sort((a, b) => {
        const aDate = a.last_visit_date || a.last_modified_date || "";
        const bDate = b.last_visit_date || b.last_modified_date || "";
        return new Date(bDate) - new Date(aDate);
      });
      setRecentContacts(contacts.slice(0, 10));
    } else {
      setRecentContacts([]);
    }
  };

  // Initialize tab
  const initializeTab = useCallback(async () => {
    setIsLoading(true);
    await checkConnectionStatus();
    await fetchCenters();
    await fetchRecentContacts();
    setIsLoading(false);
  }, [centerIdMap]);

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
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`;
    return date.toLocaleDateString();
  };

  // Open/close CRM dashboard
  const handleOpenCRM = () => setShowCRMDashboard(true);
  const handleCloseCRM = () => setShowCRMDashboard(false);

  return (
    <div className="crm-tab-content">
      <h2>CRM Integration (Read Only)</h2>
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
            <p>
              {connectionStatus?.message || "Checking connection status..."}
            </p>
            {centers.length > 0 && (
              <p className="center-count-text">
                Connected to {centers.length} center
                {centers.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="connection-actions">
            <button className="refresh-button" onClick={initializeTab}>
              <RefreshCw style={{ marginBottom: 0 }} size={16} /> Refresh
            </button>
          </div>
        </div>
      </div>
      <div className="admin-section">
        <h3 className="admin-section-title">Contact Management</h3>
        <p>View CRM contacts and client information (read only).</p>
        <div className="admin-actions">
          <button className="admin-button" onClick={handleOpenCRM}>
            <User size={18} /> Open CRM System
          </button>
        </div>
      </div>
      <div className="admin-section">
        <h3 className="admin-section-title">Recent Contacts</h3>
        <p>Your most recently accessed contacts will appear here.</p>
        {isLoading ? (
          <div className="loading-indicator">Loading recent contacts...</div>
        ) : recentContacts.length === 0 ? (
          <div className="empty-state">No recent contacts found.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Last Contact</th>
                <th>Center</th>
              </tr>
            </thead>
            <tbody>
              {recentContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>{contact.name}</td>
                  <td>{contact.email}</td>
                  <td>{contact.phone}</td>
                  <td>{formatDate(contact.lastContact)}</td>
                  <td>{contact.centerCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
