import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserPlus,
  Filter,
  Calendar,
  Clock,
  RefreshCw,
  Download,
  ChevronDown,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  Tag,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import CRMContactLookup from "./CRMContactLookup";
import CreateContactForm from "./CreateContactForm";
import "./CRMDashboard.css";

const CRMDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [activeSection, setActiveSection] = useState("contacts");
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactDetails, setContactDetails] = useState(null);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [error, setError] = useState(null);

  // Check connection status and load initial data
  useEffect(() => {
    const initializeCRM = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check Zenoti connection status
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
          // Load centers
          const centersResponse = await zenotiService.getCenters();
          if (centersResponse.data?.success) {
            setCenters(centersResponse.data.centers || []);

            // Set default center if available
            if (centersResponse.data.centers?.length > 0) {
              setSelectedCenter(centersResponse.data.centers[0].code);
            }
          }

          // Load recent contacts
          await loadRecentContacts();

          // Load upcoming appointments
          await loadAppointments();
        }
      } catch (err) {
        console.error("Error initializing CRM:", err);
        setError(
          "Failed to connect to CRM system. Please check your connection settings."
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeCRM();
  }, []);

  // Load recent contacts
  const loadRecentContacts = async () => {
    try {
      const response = await zenotiService.searchClients({
        sort: "last_visit",
        limit: 10,
      });

      if (response.data?.success) {
        // Format clients to match our contact structure
        const formattedContacts = (response.data.clients || []).map(
          (client) => ({
            id: client.id || client.guest_id,
            name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
            email: client.email,
            phone: client.mobile,
            lastContact: client.last_visit_date || null,
            centerCode: client.center_code,
          })
        );

        setRecentContacts(formattedContacts);
      }
    } catch (err) {
      console.error("Error loading recent contacts:", err);
      // Fall back to mock data if API call fails
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
  };

  // Load appointments
  const loadAppointments = async () => {
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const formattedToday = today.toISOString().split("T")[0];
      const formattedNextWeek = nextWeek.toISOString().split("T")[0];

      const response = await zenotiService.getAppointments({
        startDate: formattedToday,
        endDate: formattedNextWeek,
        centerCode: selectedCenter,
        status: "confirmed",
      });

      if (response.data?.success) {
        setAppointments(response.data.appointments || []);
      }
    } catch (err) {
      console.error("Error loading appointments:", err);
      // Set to empty array if API call fails
      setAppointments([]);
    }
  };

  // Handle contact selection
  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    loadContactDetails(contact.id);
  };

  // Load contact details
  const loadContactDetails = async (contactId) => {
    try {
      setIsLoading(true);

      const response = await zenotiService.getClientDetails(contactId);

      if (response.data?.success) {
        setContactDetails(response.data.client);
        setShowContactDetails(true);
      }
    } catch (err) {
      console.error("Error loading contact details:", err);
      setError("Failed to load contact details");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle contact creation
  const handleContactCreated = (newContact) => {
    setShowCreateContact(false);

    // Add to recent contacts
    setRecentContacts((prev) => [newContact, ...prev.slice(0, 9)]);

    // Select the new contact
    handleContactSelect(newContact);
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchTerm) return;

    try {
      setIsLoading(true);

      const response = await zenotiService.searchClients({
        query: searchTerm,
        centerCode: selectedCenter,
      });

      if (response.data?.success) {
        // Format clients to match our contact structure
        const formattedContacts = (response.data.clients || []).map(
          (client) => ({
            id: client.id || client.guest_id,
            name: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
            email: client.email,
            phone: client.mobile,
            lastContact: client.last_visit_date || null,
            centerCode: client.center_code,
          })
        );

        setContacts(formattedContacts);
        setActiveSection("search-results");
      }
    } catch (err) {
      console.error("Error searching contacts:", err);
      setError("Failed to search contacts");
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="crm-dashboard">
      {/* Header */}
      <div className="crm-header">
        <h2>Tatt2Away CRM Dashboard</h2>
        {connectionStatus && (
          <div
            className={`connection-status ${
              connectionStatus.connected ? "connected" : "disconnected"
            }`}
          >
            {connectionStatus.connected ? (
              <span>
                <span className="status-dot"></span> Connected to Zenoti
              </span>
            ) : (
              <span>
                <span className="status-dot"></span> Not connected to Zenoti
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Main content area */}
      <div className="crm-content">
        {/* Left sidebar */}
        <div className="crm-sidebar">
          <div className="sidebar-header">
            <h3>Quick Actions</h3>
          </div>
          <nav className="sidebar-nav">
            <button
              className={activeSection === "contacts" ? "active" : ""}
              onClick={() => setActiveSection("contacts")}
            >
              Contacts
            </button>
            <button
              className={activeSection === "appointments" ? "active" : ""}
              onClick={() => setActiveSection("appointments")}
            >
              Appointments
            </button>
            <button
              className={activeSection === "services" ? "active" : ""}
              onClick={() => setActiveSection("services")}
            >
              Services
            </button>
            <button
              className={activeSection === "reports" ? "active" : ""}
              onClick={() => setActiveSection("reports")}
            >
              Reports
            </button>
          </nav>

          {centers.length > 0 && (
            <div className="center-selector">
              <h3>Select Center</h3>
              <select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
              >
                {centers.map((center) => (
                  <option key={center.code} value={center.code}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sidebar-footer">
            <button
              className="create-contact-btn"
              onClick={() => setShowCreateContact(true)}
            >
              <UserPlus size={16} />
              Create Contact
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="crm-main">
          {/* Search bar */}
          <div className="search-container">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search contacts by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
              <button onClick={handleSearch} disabled={!searchTerm}>
                <Search size={18} />
                <span>Search</span>
              </button>
            </div>
            <div className="search-filters">
              <button>
                <Filter size={16} />
                <span>Filters</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Content sections */}
          {activeSection === "contacts" && (
            <div className="contacts-section">
              <div className="section-header">
                <h3>Recent Contacts</h3>
                <button onClick={loadRecentContacts}>
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoading ? (
                <div className="loading-message">Loading contacts...</div>
              ) : recentContacts.length === 0 ? (
                <div className="empty-state">
                  <p>No recent contacts found.</p>
                  <button
                    className="create-contact-btn"
                    onClick={() => setShowCreateContact(true)}
                  >
                    <UserPlus size={16} />
                    Create New Contact
                  </button>
                </div>
              ) : (
                <div className="contacts-table">
                  <table>
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
                      {recentContacts.map((contact) => (
                        <tr
                          key={contact.id}
                          onClick={() => handleContactSelect(contact)}
                        >
                          <td>{contact.name}</td>
                          <td>{contact.email || "—"}</td>
                          <td>{contact.phone || "—"}</td>
                          <td>{formatDate(contact.lastContact)}</td>
                          <td>
                            <button className="view-btn">View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === "search-results" && (
            <div className="search-results-section">
              <div className="section-header">
                <h3>Search Results</h3>
                <span className="result-count">
                  {contacts.length} contacts found
                </span>
              </div>

              {contacts.length === 0 ? (
                <div className="empty-state">
                  <p>No contacts found matching "{searchTerm}".</p>
                  <button
                    className="create-contact-btn"
                    onClick={() => setShowCreateContact(true)}
                  >
                    <UserPlus size={16} />
                    Create New Contact
                  </button>
                </div>
              ) : (
                <div className="contacts-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          onClick={() => handleContactSelect(contact)}
                        >
                          <td>{contact.name}</td>
                          <td>{contact.email || "—"}</td>
                          <td>{contact.phone || "—"}</td>
                          <td>
                            <button className="view-btn">View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === "appointments" && (
            <div className="appointments-section">
              <div className="section-header">
                <h3>Upcoming Appointments</h3>
                <button onClick={loadAppointments}>
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoading ? (
                <div className="loading-message">Loading appointments...</div>
              ) : appointments.length === 0 ? (
                <div className="empty-state">
                  <p>No upcoming appointments found.</p>
                  <button className="create-appointment-btn">
                    <Calendar size={16} />
                    Schedule Appointment
                  </button>
                </div>
              ) : (
                <div className="appointments-list">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="appointment-card">
                      <div className="appointment-header">
                        <div className="appointment-date">
                          <Calendar size={16} />
                          <span>
                            {new Date(
                              appointment.start_time
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="appointment-time">
                          <Clock size={16} />
                          <span>
                            {new Date(
                              appointment.start_time
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="appointment-details">
                        <h4>{appointment.service_name}</h4>
                        <p className="client-name">{appointment.client_name}</p>
                        <p className="duration">
                          {appointment.duration} minutes
                        </p>
                      </div>
                      <div className="appointment-actions">
                        <button>View Details</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === "services" && (
            <div className="services-section">
              <div className="section-header">
                <h3>Available Services</h3>
              </div>

              <div className="empty-state">
                <p>Service management will be available in the next update.</p>
              </div>
            </div>
          )}

          {activeSection === "reports" && (
            <div className="reports-section">
              <div className="section-header">
                <h3>Reports</h3>
              </div>

              <div className="empty-state">
                <p>Reporting features will be available in the next update.</p>
              </div>
            </div>
          )}
        </div>

        {/* Contact details panel */}
        {showContactDetails && contactDetails && (
          <div className="contact-details-panel">
            <div className="panel-header">
              <h3>Contact Details</h3>
              <button onClick={() => setShowContactDetails(false)}>×</button>
            </div>

            <div className="contact-info">
              <div className="contact-name">
                <h2>
                  {contactDetails.first_name} {contactDetails.last_name}
                </h2>
              </div>

              <div className="contact-details-section">
                <h4>Contact Information</h4>
                <div className="detail-item">
                  <Mail size={16} />
                  <span>Email:</span>
                  <span>{contactDetails.email || "—"}</span>
                </div>
                <div className="detail-item">
                  <Phone size={16} />
                  <span>Phone:</span>
                  <span>
                    {contactDetails.mobile || contactDetails.phone || "—"}
                  </span>
                </div>
              </div>

              <div className="contact-details-section">
                <h4>Personal Information</h4>
                {contactDetails.date_of_birth && (
                  <div className="detail-item">
                    <Calendar size={16} />
                    <span>Birthday:</span>
                    <span>
                      {new Date(
                        contactDetails.date_of_birth
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {contactDetails.gender && (
                  <div className="detail-item">
                    <Tag size={16} />
                    <span>Gender:</span>
                    <span>{contactDetails.gender}</span>
                  </div>
                )}
              </div>

              <div className="contact-details-section">
                <h4>Actions</h4>
                <div className="action-buttons">
                  <button className="action-button">
                    <MessageSquare size={16} />
                    <span>Message</span>
                  </button>
                  <button className="action-button">
                    <Calendar size={16} />
                    <span>Schedule</span>
                  </button>
                  <button className="action-button">
                    <FileText size={16} />
                    <span>Notes</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create contact modal */}
      {showCreateContact && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Create New Contact</h3>
              <button onClick={() => setShowCreateContact(false)}>×</button>
            </div>
            <div className="modal-content">
              <CreateContactForm
                provider="zenoti"
                onSuccess={handleContactCreated}
                onCancel={() => setShowCreateContact(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;
