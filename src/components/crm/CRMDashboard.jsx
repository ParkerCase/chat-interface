import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Settings,
  Clipboard,
  Printer,
  BarChart4,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import CRMContactLookup from "./CRMContactLookup";
import CreateContactForm from "./CreateContactForm";
import AppointmentForm from "./AppointmentForm";
import ClientDetailModal from "./ClientDetailModal";
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
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [reportType, setReportType] = useState("weekly");
  const [staffMembers, setStaffMembers] = useState([]);
  const [appointmentDateRange, setAppointmentDateRange] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 14))
      .toISOString()
      .split("T")[0],
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for keeping track of loading state per section
  const loadingContactsRef = useRef(false);
  const loadingAppointmentsRef = useRef(false);
  const loadingServicesRef = useRef(false);
  const loadingStaffRef = useRef(false);

  // Make the appointment modal accessible globally
  useEffect(() => {
    window.openAppointmentModal = (client) => {
      setSelectedContact(client);
      setShowCreateAppointment(true);
    };

    // Add event listener for the scheduleAppointment event
    const handleScheduleEvent = (event) => {
      if (event.detail && event.detail.client) {
        window.openAppointmentModal(event.detail.client);
      }
    };

    window.addEventListener("scheduleAppointment", handleScheduleEvent);

    return () => {
      window.removeEventListener("scheduleAppointment", handleScheduleEvent);
      delete window.openAppointmentModal;
    };
  }, []);

  // Set up a refresh interval for auto-refreshing data
  useEffect(() => {
    // Refresh data every 5 minutes if active
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
          await loadCenters();

          // Set initialized flag
          setIsInitialized(true);
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

  // Load centers
  const loadCenters = async () => {
    try {
      const centersResponse = await zenotiService.getCenters();
      console.log("Centers response:", centersResponse);

      if (centersResponse.data?.success) {
        // Process centers data - check both possible formats from backend
        const centersData =
          centersResponse.data.centers ||
          centersResponse.data.centerMapping ||
          [];

        setCenters(centersData);

        // Set default center if available and not already set
        if (centersData.length > 0 && !selectedCenter) {
          setSelectedCenter(centersData[0].code);

          // Store in localStorage for persistence
          localStorage.setItem("selectedCenterCode", centersData[0].code);
        }

        return centersData;
      }
      return [];
    } catch (err) {
      console.error("Error loading centers:", err);
      return [];
    }
  };

  // Effect to load data when center is selected or changes
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected && isInitialized) {
      // Store selected center in localStorage
      localStorage.setItem("selectedCenterCode", selectedCenter);

      // Load data based on active section
      if (activeSection === "contacts") {
        loadRecentContacts();
      } else if (activeSection === "appointments") {
        loadAppointments();
      } else if (activeSection === "services") {
        loadServices();
      } else if (activeSection === "reports") {
        // Don't auto-load reports as they might be expensive operations
        // Clear any existing report data
        setReportData(null);
        setReports([]);
      }
    }
  }, [
    selectedCenter,
    activeSection,
    isInitialized,
    connectionStatus?.connected,
  ]);

  // Load recent contacts
  const loadRecentContacts = async () => {
    // Prevent duplicate loading
    if (loadingContactsRef.current) return;

    try {
      loadingContactsRef.current = true;
      setIsLoading(true);

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
    } finally {
      setIsLoading(false);
      loadingContactsRef.current = false;
    }
  };

  // Load appointments
  // In CRMDashboard.jsx - Enhanced appointment loading
  const loadAppointments = async () => {
    // Prevent duplicate loading
    if (loadingAppointmentsRef.current) return;

    try {
      loadingAppointmentsRef.current = true;
      setIsLoading(true);

      // Clear any previous error
      setError(null);

      console.log("Requesting appointments with params:", {
        startDate: appointmentDateRange.startDate,
        endDate: appointmentDateRange.endDate,
        centerCode: selectedCenter,
        status: filter === "all" ? "" : filter,
      });

      const response = await zenotiService.getAppointments({
        startDate: appointmentDateRange.startDate,
        endDate: appointmentDateRange.endDate,
        centerCode: selectedCenter,
        status: filter === "all" ? "" : filter,
        // For wider date ranges, backend will chunk into multiple requests
        // Add a freshData flag to bypass cache if needed
        freshData: false,
      });

      console.log("Appointment response:", response);

      if (response.data?.success) {
        // Handle possible data formats
        let formattedAppointments = [];

        if (Array.isArray(response.data.appointments)) {
          // Transform the appointments data to match expected format
          formattedAppointments = response.data.appointments.map(
            (appointment) => {
              // Get service name from either blockout or service property
              const serviceName = appointment.blockout
                ? appointment.blockout.name
                : appointment.service
                ? appointment.service.name
                : appointment.service_name || "Admin Time";

              // Handle client name when guest is null
              const clientName = appointment.guest
                ? `${appointment.guest.first_name || ""} ${
                    appointment.guest.last_name || ""
                  }`.trim()
                : appointment.client_name || "No Client";

              return {
                id: appointment.appointment_id || appointment.id,
                service_name: serviceName,
                client_name: clientName,
                start_time: appointment.start_time || appointment.startTime,
                duration: appointment.blockout
                  ? appointment.blockout.duration
                  : appointment.service
                  ? appointment.service.duration
                  : appointment.duration || 60,
                status: appointment.status,
                notes: appointment.notes || "",
                therapist: appointment.therapist
                  ? `${appointment.therapist.first_name || ""} ${
                      appointment.therapist.last_name || ""
                    }`.trim()
                  : appointment.provider_name || "Unassigned",
                guest: appointment.guest || null,
                center: appointment.center || null,
              };
            }
          );
        }

        setAppointments(formattedAppointments);

        // Show a notice if data was fetched in chunks
        if (response.data.processing?.chunking) {
          console.log(
            `Fetched ${formattedAppointments.length} appointments in ${response.data.processing.chunks.total} chunks.`
          );

          // Handle any failed chunks
          if (response.data.processing.chunks.failed > 0) {
            setError(
              `${response.data.processing.chunks.failed} out of ${response.data.processing.chunks.total} data chunks failed to load. Some appointments may be missing.`
            );
          }
        }
      } else {
        console.warn(
          "No appointments found or error in response",
          response.data
        );
        setAppointments([]);

        if (response.data?.error) {
          setError(`Failed to load appointments: ${response.data.error}`);
        }
      }
    } catch (err) {
      console.error("Error loading appointments:", err);
      // Set to empty array if API call fails
      setAppointments([]);
      setError(
        "Failed to load appointments: " + (err.message || "Unknown error")
      );
    } finally {
      setIsLoading(false);
      loadingAppointmentsRef.current = false;
    }
  };

  // Load services
  const loadServices = async () => {
    // Prevent duplicate loading
    if (loadingServicesRef.current) return;

    try {
      loadingServicesRef.current = true;
      setIsLoading(true);

      const response = await zenotiService.getServices({
        centerCode: selectedCenter,
        limit: 20,
      });

      if (response.data?.success) {
        setServices(response.data.services || []);

        // Also load staff when services tab is active
        await loadStaff();
      } else {
        setServices([]);
      }
    } catch (err) {
      console.error("Error loading services:", err);
      setServices([]);
    } finally {
      setIsLoading(false);
      loadingServicesRef.current = false;
    }
  };

  // Load staff members
  const loadStaff = async () => {
    // Prevent duplicate loading
    if (loadingStaffRef.current) return;

    try {
      loadingStaffRef.current = true;

      const response = await zenotiService.getStaff({
        centerCode: selectedCenter,
      });

      if (response.data?.success) {
        // Handle different possible response formats
        const staff = response.data.staff || response.data.therapists || [];
        setStaffMembers(staff);
      } else {
        setStaffMembers([]);
      }
    } catch (err) {
      console.error("Error loading staff:", err);
      setStaffMembers([]);
    } finally {
      loadingStaffRef.current = false;
    }
  };

  // Handle contact selection
  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setShowContactDetails(true);
  };

  // Close contact details modal
  const handleCloseContactDetails = () => {
    setShowContactDetails(false);
    setContactDetails(null);
  };

  // Handle center selection
  const handleCenterChange = (e) => {
    const newCenterCode = e.target.value;
    setSelectedCenter(newCenterCode);
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

  // Handle date range change for appointments
  const handleAppointmentDateChange = (type, value) => {
    setAppointmentDateRange((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  // Handle report date range change
  const handleDateRangeChange = (type, value) => {
    setDateRange((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  // Generate report based on selected type
  const generateReport = async () => {
    try {
      setGeneratingReport(true);
      setError(null);
      setReportData(null);

      // Define report params based on type
      const reportParams = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        centerCode: selectedCenter,
      };

      // Add debugging before making API call
      console.log(`Generating ${reportType} report with params:`, reportParams);

      let response = null;

      switch (reportType) {
        case "weekly":
          // For weekly reports, we need a week start date
          const weeklyParams = {
            weekStartDate: dateRange.startDate,
            centerCode: selectedCenter,
            compareWithPreviousWeek: true,
          };

          console.log("Generating weekly report with params:", weeklyParams);
          response = await zenotiService.generateWeeklyBusinessReport(
            weeklyParams
          );
          break;

        case "collections":
          console.log(
            "Generating collections report with params:",
            reportParams
          );
          response = await zenotiService.getCollectionsReport(reportParams);
          break;

        case "sales":
          console.log("Generating sales report with params:", reportParams);
          response = await zenotiService.getSalesReport(reportParams);
          break;

        case "client-activity":
          console.log(
            "Generating client activity report with params:",
            reportParams
          );
          response = await zenotiService.generateClientActivityReport(
            reportParams
          );
          break;

        case "invoices":
          // Special case for invoices - use searchInvoices instead if direct report fails
          console.log("Generating invoice report with params:", reportParams);
          try {
            // First attempt to use any specific invoice report endpoint
            response = await zenotiService.getInvoiceReport(reportParams);
          } catch (invoiceReportError) {
            console.error(
              "Invoice report endpoint failed:",
              invoiceReportError
            );
            console.log("Falling back to searchInvoices endpoint...");

            // Fall back to searchInvoices
            const searchResponse = await zenotiService.searchInvoices(
              reportParams
            );

            if (searchResponse.data?.success) {
              // Transform the invoice search results into a report format
              response = {
                data: {
                  success: true,
                  report: {
                    summary: {
                      total_amount:
                        searchResponse.data.invoices?.reduce(
                          (sum, inv) => sum + (parseFloat(inv.amount) || 0),
                          0
                        ) || 0,
                      count: searchResponse.data.invoices?.length || 0,
                    },
                    invoices: searchResponse.data.invoices || [],
                    dateRange: searchResponse.data.dateRange,
                  },
                },
              };
            } else {
              throw new Error("Failed to retrieve invoice data");
            }
          }
          break;

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      if (response?.data?.success) {
        // Handle different response formats
        const reportData =
          response.data.report ||
          response.data.overview ||
          (response.data.invoices
            ? { invoices: response.data.invoices }
            : null);

        if (reportData) {
          setReportData(reportData);
          console.log("Report data loaded successfully:", reportData);
        } else {
          throw new Error("Received successful response but no report data");
        }
      } else {
        throw new Error(response?.data?.error || "Failed to generate report");
      }
    } catch (err) {
      console.error(`Error generating ${reportType} report:`, err);
      setError(`Failed to generate ${reportType} report: ${err.message}`);
    } finally {
      setGeneratingReport(false);
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

  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Export report to CSV or PDF
  const exportReport = async (format) => {
    try {
      setIsLoading(true);

      if (!reportData) {
        setError("No report data to export");
        return;
      }

      const response = await zenotiService.generateReportFile(
        reportData,
        format,
        `${reportType}-report-${new Date().toISOString().split("T")[0]}`
      );

      if (response.data?.success) {
        // Create download link
        const downloadLink = document.createElement("a");
        downloadLink.href =
          response.data.result.downloadUrl || response.data.result.fileUrl;
        downloadLink.download = response.data.result.filename;
        downloadLink.click();
      } else {
        throw new Error(`Failed to export report as ${format}`);
      }
    } catch (err) {
      console.error(`Error exporting report as ${format}:`, err);
      setError(`Failed to export report: ${err.message}`);
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
                // Don't automatically load reports
              }}
            >
              Reports
            </button>
          </nav>

          {centers.length > 0 && (
            <div className="center-selector">
              <h3>Select Center</h3>
              <select value={selectedCenter} onChange={handleCenterChange}>
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
                  disabled={
                    !connectionStatus?.connected || loadingContactsRef.current
                  }
                >
                  <RefreshCw
                    size={14}
                    className={loadingContactsRef.current ? "spinning" : ""}
                  />
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
                    disabled={
                      !connectionStatus?.connected ||
                      loadingAppointmentsRef.current
                    }
                  >
                    <RefreshCw
                      size={14}
                      className={
                        loadingAppointmentsRef.current ? "spinning" : ""
                      }
                    />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Date range selector for appointments */}
              <div className="date-range-selector">
                <div className="date-field">
                  <label htmlFor="appointmentStartDate">Start Date:</label>
                  <input
                    type="date"
                    id="appointmentStartDate"
                    value={appointmentDateRange.startDate}
                    onChange={(e) =>
                      handleAppointmentDateChange("startDate", e.target.value)
                    }
                  />
                </div>
                <div className="date-field">
                  <label htmlFor="appointmentEndDate">End Date:</label>
                  <input
                    type="date"
                    id="appointmentEndDate"
                    value={appointmentDateRange.endDate}
                    onChange={(e) =>
                      handleAppointmentDateChange("endDate", e.target.value)
                    }
                  />
                </div>
                <button
                  className="apply-date-btn"
                  onClick={loadAppointments}
                  disabled={
                    !connectionStatus?.connected ||
                    loadingAppointmentsRef.current
                  }
                >
                  Apply Date Range
                </button>
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
                  <p>
                    No upcoming appointments found for the selected date range.
                  </p>
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
                  {appointments.map((appointment, index) => (
                    <div
                      key={appointment.id || index}
                      className="appointment-card"
                    >
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
                  disabled={
                    !connectionStatus?.connected || loadingServicesRef.current
                  }
                >
                  <RefreshCw
                    size={14}
                    className={loadingServicesRef.current ? "spinning" : ""}
                  />
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
                <div className="services-tables-container">
                  <div className="services-table">
                    <h4>Available Services</h4>
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
                            <td>
                              ${parseFloat(service.price || 0).toFixed(2)}
                            </td>
                            <td>{service.category || "Uncategorized"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {staffMembers.length > 0 && (
                    <div className="staff-table">
                      <h4>Staff Members</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Position</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffMembers.map((staff) => (
                            <tr key={staff.id}>
                              <td>{`${staff.first_name || ""} ${
                                staff.last_name || ""
                              }`}</td>
                              <td>
                                {staff.designation || staff.position || "Staff"}
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${
                                    staff.status === "Active"
                                      ? "active"
                                      : "inactive"
                                  }`}
                                >
                                  {staff.status || "Active"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === "reports" && (
            <div className="reports-section">
              <div className="section-header">
                <h3>Reports</h3>
                <div className="report-actions">
                  {reportData && (
                    <>
                      <button
                        className="export-csv-btn"
                        onClick={() => exportReport("csv")}
                        disabled={!reportData || isLoading}
                      >
                        <Download size={14} />
                        <span>Export CSV</span>
                      </button>
                      <button
                        className="print-btn"
                        onClick={() => exportReport("pdf")}
                        disabled={!reportData || isLoading}
                      >
                        <Printer size={14} />
                        <span>Export PDF</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!connectionStatus?.connected ? (
                <div className="not-connected-message">
                  <AlertCircle size={48} />
                  <h3>Not Connected to Zenoti</h3>
                  <p>
                    Please configure your Zenoti connection to access reports.
                  </p>
                </div>
              ) : (
                <div className="report-controls">
                  <div className="report-type-selector">
                    <label htmlFor="reportType">Report Type:</label>
                    <select
                      id="reportType"
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                    >
                      <option value="weekly">Weekly Business Report</option>
                      <option value="collections">Collections Report</option>
                      <option value="sales">Sales Report</option>
                      <option value="client-activity">
                        Client Activity Report
                      </option>
                    </select>
                  </div>

                  <div className="date-fields">
                    {reportType === "weekly" ? (
                      <div className="date-field">
                        <label htmlFor="weekStartDate">
                          Week Start Date (Sunday):
                        </label>
                        <input
                          type="date"
                          id="weekStartDate"
                          value={dateRange.startDate}
                          onChange={(e) =>
                            handleDateRangeChange("startDate", e.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <div className="date-field">
                          <label htmlFor="startDate">Start Date:</label>
                          <input
                            type="date"
                            id="startDate"
                            value={dateRange.startDate}
                            onChange={(e) =>
                              handleDateRangeChange("startDate", e.target.value)
                            }
                          />
                        </div>
                        <div className="date-field">
                          <label htmlFor="endDate">End Date:</label>
                          <input
                            type="date"
                            id="endDate"
                            value={dateRange.endDate}
                            onChange={(e) =>
                              handleDateRangeChange("endDate", e.target.value)
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    className="generate-report-btn"
                    onClick={generateReport}
                    disabled={generatingReport}
                  >
                    {generatingReport ? (
                      <>
                        <RefreshCw size={16} className="spinning" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BarChart4 size={16} />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Report results display */}
              {reportData && (
                <div className="report-results">
                  <h4>
                    {reportType.charAt(0).toUpperCase() +
                      reportType.slice(1).replace("-", " ")}{" "}
                    Report
                  </h4>

                  {reportType === "weekly" && (
                    <div className="weekly-report">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <h5>Total Revenue</h5>
                          <div className="summary-value">
                            {formatCurrency(reportData.totalRevenue || 0)}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Appointments</h5>
                          <div className="summary-value">
                            {reportData.appointmentCount || 0}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>New Clients</h5>
                          <div className="summary-value">
                            {reportData.newClients || 0}
                          </div>
                        </div>
                        {reportData.serviceBreakdown && (
                          <div className="summary-card">
                            <h5>Top Service</h5>
                            <div className="summary-value">
                              {Object.entries(reportData.serviceBreakdown || {})
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 1)
                                .map(([service]) => service)[0] || "None"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add more detailed sections as needed */}
                    </div>
                  )}

                  {reportType === "collections" && (
                    <div className="collections-report">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <h5>Total Collected</h5>
                          <div className="summary-value">
                            {formatCurrency(
                              reportData.summary?.total_collected || 0
                            )}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Cash Collections</h5>
                          <div className="summary-value">
                            {formatCurrency(
                              reportData.summary?.total_collected_cash || 0
                            )}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Non-Cash Collections</h5>
                          <div className="summary-value">
                            {formatCurrency(
                              reportData.summary?.total_collected_non_cash || 0
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Payment types breakdown if available */}
                      {reportData.centers &&
                        Object.keys(reportData.centers).length > 0 && (
                          <div className="centers-breakdown">
                            <h5>Collections by Center</h5>
                            <table>
                              <thead>
                                <tr>
                                  <th>Center</th>
                                  <th>Total</th>
                                  <th>Cash</th>
                                  <th>Non-Cash</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(reportData.centers).map(
                                  ([centerCode, centerData]) => (
                                    <tr key={centerCode}>
                                      <td>{centerCode}</td>
                                      <td>
                                        {formatCurrency(
                                          centerData.total_collected || 0
                                        )}
                                      </td>
                                      <td>
                                        {formatCurrency(
                                          centerData.total_collected_cash || 0
                                        )}
                                      </td>
                                      <td>
                                        {formatCurrency(
                                          centerData.total_collected_non_cash ||
                                            0
                                        )}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>
                  )}

                  {reportType === "sales" && (
                    <div className="sales-report">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <h5>Total Sales</h5>
                          <div className="summary-value">
                            {formatCurrency(
                              reportData.summary?.total_sales || 0
                            )}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Total Refunds</h5>
                          <div className="summary-value">
                            {formatCurrency(
                              reportData.summary?.total_refunds || 0
                            )}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Net Sales</h5>
                          <div className="summary-value">
                            {formatCurrency(reportData.summary?.net_sales || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Items breakdown if available */}
                      {reportData.items && reportData.items.length > 0 && (
                        <div className="items-breakdown">
                          <h5>Sales by Item</h5>
                          <table>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Total Amount</th>
                                <th>Refunds</th>
                                <th>Net Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.items.map((item, index) => (
                                <tr key={index}>
                                  <td>{item.name}</td>
                                  <td>{item.quantity || 0}</td>
                                  <td>
                                    {formatCurrency(item.total_amount || 0)}
                                  </td>
                                  <td>
                                    {formatCurrency(item.refund_amount || 0)}
                                  </td>
                                  <td>
                                    {formatCurrency(item.net_amount || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {reportType === "client-activity" && (
                    <div className="client-activity-report">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <h5>Total Clients</h5>
                          <div className="summary-value">
                            {reportData.totalClients || 0}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>New Clients</h5>
                          <div className="summary-value">
                            {reportData.newClients || 0}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Returning Clients</h5>
                          <div className="summary-value">
                            {reportData.returningClients || 0}
                          </div>
                        </div>
                        <div className="summary-card">
                          <h5>Avg. Spend</h5>
                          <div className="summary-value">
                            {formatCurrency(reportData.averageSpend || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Client breakdown if available */}
                      {reportData.topClients &&
                        reportData.topClients.length > 0 && (
                          <div className="clients-breakdown">
                            <h5>Top Clients by Spend</h5>
                            <table>
                              <thead>
                                <tr>
                                  <th>Client</th>
                                  <th>Visits</th>
                                  <th>Total Spend</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportData.topClients.map((client, index) => (
                                  <tr key={index}>
                                    <td>{client.name}</td>
                                    <td>{client.visits || 0}</td>
                                    <td>
                                      {formatCurrency(client.totalSpend || 0)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact details modal */}
      {showContactDetails && selectedContact && (
        <ClientDetailModal
          client={selectedContact}
          onClose={handleCloseContactDetails}
          centerCode={selectedCenter}
        />
      )}

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
              <AppointmentForm
                onSuccess={handleAppointmentCreated}
                onCancel={() => setShowCreateAppointment(false)}
                initialContact={selectedContact}
                centerCode={selectedCenter}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;
