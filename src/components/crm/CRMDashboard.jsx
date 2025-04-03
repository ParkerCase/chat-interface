import React, { useState, useEffect, useCallback } from "react";
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
  Edit,
  X,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import CRMContactLookup from "./CRMContactLookup";
import CreateContactForm from "./CreateContactForm";
import AppointmentForm from "./AppointmentForm"; // You'll need to create this component
import "./CRMDashboard.css";

const CRMDashboard = ({ onClose }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [activeSection, setActiveSection] = useState("contacts");
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactDetails, setContactDetails] = useState(null);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("Loading data...");
  const [reports, setReports] = useState([]);

  // Set up a refresh interval for auto-refreshing data
  useEffect(() => {
    // Refresh data every 5 minutes
    const refreshInterval = setInterval(() => {
      if (activeSection === "appointments") {
        loadAppointments();
      }
    }, 300000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [activeSection]);

  // Check connection status and load initial data
  useEffect(() => {
    const initializeCRM = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLoadingMessage("Checking Zenoti connection...");

        // Check Zenoti connection status
        const statusResponse = await zenotiService.checkConnectionStatus();
        console.log("Connection status response:", statusResponse);

        const isConnected =
          statusResponse.data?.success &&
          statusResponse.data?.status === "connected";

        setConnectionStatus({
          connected: isConnected,
          message: isConnected
            ? "Connected to Zenoti"
            : "Not connected to Zenoti",
          details: statusResponse.data,
        });

        if (isConnected) {
          // Load centers
          setLoadingMessage("Loading centers...");
          const centersResponse = await zenotiService.getCenters();
          console.log("Centers response:", centersResponse);

          if (centersResponse.data?.success) {
            // Process centers data - check both possible formats from backend
            const centersData =
              centersResponse.data.centers ||
              centersResponse.data.centerMapping ||
              [];

            setCenters(centersData);

            // Set default center if available
            if (centersData.length > 0) {
              setSelectedCenter(centersData[0].code);
            }
          }

          // Load recent contacts
          setLoadingMessage("Loading recent contacts...");
          await loadRecentContacts();

          // Load upcoming appointments
          setLoadingMessage("Loading appointments...");
          await loadAppointments();

          // Load services
          setLoadingMessage("Loading services...");
          await loadServices();
        }
      } catch (err) {
        console.error("Error initializing CRM:", err);
        setError(
          "Failed to connect to CRM system. Please check your connection settings."
        );
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    };

    initializeCRM();
  }, []);

  // Load recent contacts
  const loadRecentContacts = async () => {
    try {
      console.log("Loading recent contacts...");
      const response = await zenotiService.searchClients({
        sort: "last_visit",
        limit: 10,
        centerCode: selectedCenter,
      });

      console.log("Recent contacts response:", response);

      if (response.data?.success && response.data?.clients) {
        // Format clients with updated mapping that handles nested personal_info
        const formattedContacts = response.data.clients.map((client) => {
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
            centerCode: client.center_id || client.center_code || "",
            centerName: client.center_name || "",
          };
        });

        console.log("Formatted contacts:", formattedContacts);
        setRecentContacts(formattedContacts);
      } else {
        console.warn("No client data found in response", response);
        setRecentContacts([]);
      }
    } catch (err) {
      console.error("Error loading recent contacts:", err);
      // Fallback to empty array
      setRecentContacts([]);
    }
  };

  // Load appointments
  const loadAppointments = async () => {
    try {
      setIsLoading(true);

      // Get date range for appointments (today to next 2 weeks)
      const today = new Date();
      const nextTwoWeeks = new Date();
      nextTwoWeeks.setDate(today.getDate() + 14);

      const formattedToday = today.toISOString().split("T")[0];
      const formattedNextTwoWeeks = nextTwoWeeks.toISOString().split("T")[0];

      console.log("Requesting appointments with params:", {
        startDate: formattedToday,
        endDate: formattedNextTwoWeeks,
        centerCode: selectedCenter,
        status: filter === "all" ? "" : filter,
      });

      const response = await zenotiService.getAppointments({
        startDate: formattedToday,
        endDate: formattedNextTwoWeeks,
        centerCode: selectedCenter,
        status: filter === "all" ? "" : filter,
      });

      console.log("Appointment response:", response);

      if (response.data?.success) {
        // Transform the appointments data to match expected format
        const formattedAppointments = (response.data.appointments || []).map(
          (appointment) => {
            // Get service name from either blockout or service property
            const serviceName = appointment.blockout
              ? appointment.blockout.name
              : appointment.service
              ? appointment.service.name
              : "Admin Time";

            // Handle client name when guest is null
            const clientName = appointment.guest
              ? `${appointment.guest.first_name || ""} ${
                  appointment.guest.last_name || ""
                }`.trim()
              : "No Client";

            return {
              id: appointment.appointment_id || appointment.id,
              service_name: serviceName,
              client_name: clientName,
              start_time: appointment.start_time || appointment.startTime,
              duration: appointment.blockout
                ? appointment.blockout.duration
                : appointment.service
                ? appointment.service.duration
                : 60,
              status: appointment.status,
              notes: appointment.notes || "",
              therapist: appointment.therapist
                ? `${appointment.therapist.first_name || ""} ${
                    appointment.therapist.last_name || ""
                  }`.trim()
                : "Unassigned",
              guest: appointment.guest || null,
              center: appointment.center || null,
            };
          }
        );

        setAppointments(formattedAppointments);
      } else {
        console.warn(
          "No appointments found or error in response",
          response.data
        );
        setAppointments([]);
      }
    } catch (err) {
      console.error("Error loading appointments:", err);
      // Set to empty array if API call fails
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load services
  const loadServices = async () => {
    try {
      const response = await zenotiService.getServices({
        centerCode: selectedCenter,
        limit: 20,
      });

      if (response.data?.success) {
        setServices(response.data.services || []);
      } else {
        setServices([]);
      }
    } catch (err) {
      console.error("Error loading services:", err);
      setServices([]);
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

      // Use the correct method name - getClient instead of getClientDetails
      const response = await zenotiService.getClient(contactId, selectedCenter);

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

  // Handle appointment creation
  const handleAppointmentCreated = (newAppointment) => {
    setShowCreateAppointment(false);

    // Reload appointments to show the new one
    loadAppointments();
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
          (client) => {
            const personalInfo = client.personal_info || client;
            return {
              id: client.id || client.guest_id,
              name: `${personalInfo.first_name || ""} ${
                personalInfo.last_name || ""
              }`.trim(),
              email: personalInfo.email || "",
              phone:
                personalInfo.mobile_phone?.number ||
                personalInfo.mobile ||
                personalInfo.phone ||
                "",
              lastContact: client.last_visit_date || null,
              centerCode: client.center_id || client.center_code || "",
              centerName: client.center_name || "",
            };
          }
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

  // Format time
  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return "";

    return new Date(dateTimeString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get weekly report data
  const loadWeeklyReport = async () => {
    try {
      setIsLoading(true);

      // Get the current week's start date (Sunday)
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day;
      const weekStart = new Date(today.setDate(diff));
      const formattedDate = weekStart.toISOString().split("T")[0];

      const response = await zenotiService.generateWeeklyReport({
        weekStartDate: formattedDate,
        centerCode: selectedCenter,
        compareWithPreviousWeek: true,
      });

      if (response.data?.success) {
        setReports([response.data.report || response.data.overview]);
      }
    } catch (err) {
      console.error("Error loading weekly report:", err);
      setError("Failed to load weekly report");
    } finally {
      setIsLoading(false);
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
        {onClose && (
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>{loadingMessage || "Loading..."}</span>
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
              onClick={() => {
                setActiveSection("appointments");
                loadAppointments();
              }}
            >
              Appointments
            </button>
            <button
              className={activeSection === "services" ? "active" : ""}
              onClick={() => {
                setActiveSection("services");
                loadServices();
              }}
            >
              Services
            </button>
            <button
              className={activeSection === "reports" ? "active" : ""}
              onClick={() => {
                setActiveSection("reports");
                loadWeeklyReport();
              }}
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
              disabled={!connectionStatus?.connected}
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
                disabled={!connectionStatus?.connected}
              />
              <button
                onClick={handleSearch}
                disabled={!searchTerm || !connectionStatus?.connected}
              >
                <Search size={18} />
                <span>Search</span>
              </button>
            </div>
            <div className="search-filters">
              <button disabled={!connectionStatus?.connected}>
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
                <button
                  onClick={loadRecentContacts}
                  disabled={!connectionStatus?.connected}
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>

              {!connectionStatus?.connected ? (
                <div className="not-connected-message">
                  <AlertCircle size={48} />
                  <h3>Not Connected to Zenoti</h3>
                  <p>
                    Please configure your Zenoti connection to access contacts.
                  </p>
                </div>
              ) : isLoading ? (
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
                <div className="appointment-actions">
                  <button
                    className="create-appointment-btn"
                    onClick={() => setShowCreateAppointment(true)}
                    disabled={!connectionStatus?.connected}
                  >
                    <Calendar size={16} />
                    Schedule Appointment
                  </button>
                  <button
                    onClick={loadAppointments}
                    disabled={!connectionStatus?.connected}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {!connectionStatus?.connected ? (
                <div className="not-connected-message">
                  <AlertCircle size={48} />
                  <h3>Not Connected to Zenoti</h3>
                  <p>
                    Please configure your Zenoti connection to access
                    appointments.
                  </p>
                </div>
              ) : isLoading ? (
                <div className="loading-message">Loading appointments...</div>
              ) : appointments.length === 0 ? (
                <div className="empty-state">
                  <p>No upcoming appointments found.</p>
                  <button
                    className="create-appointment-btn"
                    onClick={() => setShowCreateAppointment(true)}
                  >
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
                          <span>{formatTime(appointment.start_time)}</span>
                        </div>
                      </div>
                      <div className="appointment-details">
                        <h4>{appointment.service_name}</h4>
                        <p className="client-name">{appointment.client_name}</p>
                        {appointment.therapist &&
                          appointment.therapist !== "Unassigned" && (
                            <p className="therapist-name">
                              Provider: {appointment.therapist}
                            </p>
                          )}
                        {appointment.notes && (
                          <p className="appointment-notes small-text">
                            {appointment.notes}
                          </p>
                        )}
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
                <button
                  onClick={loadServices}
                  disabled={!connectionStatus?.connected}
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>

              {!connectionStatus?.connected ? (
                <div className="not-connected-message">
                  <AlertCircle size={48} />
                  <h3>Not Connected to Zenoti</h3>
                  <p>
                    Please configure your Zenoti connection to access services.
                  </p>
                </div>
              ) : services.length === 0 ? (
                <div className="empty-state">
                  <p>No services found for the selected center.</p>
                </div>
              ) : (
                <div className="services-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Service Name</th>
                        <th>Duration</th>
                        <th>Price</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service) => (
                        <tr key={service.id}>
                          <td>{service.name}</td>
                          <td>{service.duration} mins</td>
                          <td>${parseFloat(service.price || 0).toFixed(2)}</td>
                          <td>{service.category || "Uncategorized"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSection === "reports" && (
            <div className="reports-section">
              <div className="section-header">
                <h3>Reports</h3>
                <button
                  onClick={loadWeeklyReport}
                  disabled={!connectionStatus?.connected}
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>

              {!connectionStatus?.connected ? (
                <div className="not-connected-message">
                  <AlertCircle size={48} />
                  <h3>Not Connected to Zenoti</h3>
                  <p>
                    Please configure your Zenoti connection to access reports.
                  </p>
                </div>
              ) : reports.length === 0 ? (
                <div className="empty-state">
                  <p>No report data available.</p>
                  <button
                    onClick={loadWeeklyReport}
                    className="load-report-btn"
                  >
                    <Download size={16} />
                    Load Weekly Report
                  </button>
                </div>
              ) : (
                <div className="report-content">
                  <h4>Weekly Business Summary</h4>
                  {reports[0] && (
                    <div className="report-summary">
                      <div className="report-metric">
                        <span className="metric-label">Total Revenue</span>
                        <span className="metric-value">
                          ${parseFloat(reports[0].totalRevenue || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="report-metric">
                        <span className="metric-label">Appointments</span>
                        <span className="metric-value">
                          {reports[0].appointmentCount || 0}
                        </span>
                      </div>
                      <div className="report-metric">
                        <span className="metric-label">New Clients</span>
                        <span className="metric-value">
                          {reports[0].newClients || 0}
                        </span>
                      </div>
                    </div>
                  )}
                  <button className="download-report-btn">
                    <Download size={16} />
                    Download Full Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contact details panel */}
        {showContactDetails && contactDetails && (
          <div className="contact-details-panel">
            {/* Close button for mobile */}
            <button
              className="close-details-button"
              onClick={() => setShowContactDetails(false)}
            >
              <X size={16} />
            </button>

            <div className="contact-info">
              <div className="contact-name">
                <h2>
                  {contactDetails.personal_info?.first_name ||
                    contactDetails.first_name ||
                    ""}{" "}
                  {contactDetails.personal_info?.last_name ||
                    contactDetails.last_name ||
                    ""}
                </h2>
              </div>

              <div className="contact-details-section">
                <h4>Contact Information</h4>
                <div className="detail-item">
                  <Mail size={16} />
                  <span>Email:</span>
                  <span>
                    {contactDetails.personal_info?.email ||
                      contactDetails.email ||
                      "—"}
                  </span>
                </div>
                <div className="detail-item">
                  <Phone size={16} />
                  <span>Phone:</span>
                  <span>
                    {contactDetails.personal_info?.mobile_phone?.number ||
                      contactDetails.personal_info?.mobile ||
                      contactDetails.mobile ||
                      contactDetails.phone ||
                      "—"}
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

                {contactDetails.center_code && (
                  <div className="detail-item">
                    <Info size={16} />
                    <span>Center:</span>
                    <span>
                      {centers.find(
                        (c) => c.code === contactDetails.center_code
                      )?.name || contactDetails.center_code}
                    </span>
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
                  <button
                    className="action-button"
                    onClick={() => {
                      setShowCreateAppointment(true);
                      // Pre-select this contact for the appointment
                    }}
                  >
                    <Calendar size={16} />
                    <span>Schedule</span>
                  </button>
                  <button className="action-button">
                    <FileText size={16} />
                    <span>Notes</span>
                  </button>
                  <button className="action-button">
                    <Edit size={16} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <div className="contact-details-section">
                <h4>Recent Appointments</h4>
                {/* This would fetch and display recent appointments for this contact */}
                <div className="no-recent-appointments">
                  <p>No recent appointments found.</p>
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

      {/* Create appointment modal */}
      {showCreateAppointment && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Schedule Appointment</h3>
              <button onClick={() => setShowCreateAppointment(false)}>×</button>
            </div>
            <div className="modal-content">
              {/* You'll need to create this AppointmentForm component */}
              <div className="placeholder-form">
                <p className="form-message">
                  <Info size={16} />
                  The appointment booking form is coming soon. This will be
                  implemented in the next phase.
                </p>
                <button
                  className="cancel-btn"
                  onClick={() => setShowCreateAppointment(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;
