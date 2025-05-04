import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserPlus,
  Filter,
  Calendar,
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
  Users,
  FileUp,
  ExternalLink,
  Trash2,
  Package,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import analyticsUtils from "../../utils/analyticsUtils";
import CRMContactLookup from "./CRMContactLookup";
import CreateContactForm from "./CreateContactForm";
import AppointmentForm from "./AppointmentForm";
import ImprovedReportsSection from "./ImprovedReportsSection";

import AppointmentDetails from "./AppointmentDetails";
import ClientDetailModal from "./ClientDetailModal";
import EnhancedCRMReportsSection from "./CRMReportsSection";
import ZenotiServicesSection from "../zenoti/ZenotiServicesSection";
import ZenotiPackagesSection from "../zenoti/ZenotiPackagesSection";
import CRMAnalyticsDashboard from "./CRMAnalyticsDashboard";
import ImportContacts from "./ImportContacts";
import "./CRMDashboard.css";

const CRMDashboard = ({ onClose, onRefresh, centers = [] }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [activeSection, setActiveSection] = useState("contacts");
  const [activeContactView, setActiveContactView] = useState("all"); // "all", "recent", "favorites"
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [localCenters, setLocalCenters] = useState(centers || []);
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);

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

    // Make the appointment details modal accessible globally
    window.openAppointmentDetailsModal = (appointment) => {
      setSelectedAppointment(appointment);
      // For now, we'll use the AppointmentDetails component to show the details
      // Show the details in read-only mode
      setShowAppointmentDetails(true);
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
      delete window.openAppointmentDetailsModal;

      // Clean up any pending state
      setSelectedAppointment(null);
      setShowAppointmentDetails(false);
      setShowCreateAppointment(false);
    };
  }, []);

  // Auto-hide success message after a few seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
          // Load centers if not provided
          if (!centers || centers.length === 0) {
            setLoadingMessage("Loading centers...");
            await loadCenters();
          } else {
            setLocalCenters(centers);
            if (centers.length > 0 && !selectedCenter) {
              // Try to get from local storage first
              const savedCenter = localStorage.getItem("selectedCenterCode");
              if (savedCenter && centers.some((c) => c.code === savedCenter)) {
                setSelectedCenter(savedCenter);
              } else {
                setSelectedCenter(centers[0].code);
              }
            }
          }

          // Set initialized flag
          setIsInitialized(true);

          // Track dashboard view for analytics
          analyticsUtils.trackPageView("crm_dashboard", {
            connected: true,
            centerCount: centers?.length || 0,
          });
        } else {
          // Track connection failure
          analyticsUtils.trackEvent(
            analyticsUtils.EVENT_TYPES.CRM_CONNECTION_ERROR,
            {
              error: statusResponse.data?.error || "Connection Failed",
            }
          );
        }
      } catch (err) {
        console.error("Error initializing CRM:", err);
        setError(
          "Failed to connect to CRM system. Please check your connection settings."
        );

        // Track error
        analyticsUtils.trackError(err, "crm_initialization");
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    };

    initializeCRM();
  }, [centers]);

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

        setLocalCenters(centersData);

        // Set default center if available and not already set
        if (centersData.length > 0 && !selectedCenter) {
          // Try to get from local storage first
          const savedCenter = localStorage.getItem("selectedCenterCode");
          if (savedCenter && centersData.some((c) => c.code === savedCenter)) {
            setSelectedCenter(savedCenter);
          } else {
            setSelectedCenter(centersData[0].code);
            localStorage.setItem("selectedCenterCode", centersData[0].code);
          }
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
      } else if (activeSection === "analytics") {
        loadAnalytics();
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
        limit: 15,
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
  const loadAppointments = async () => {
    // Prevent duplicate loading
    if (loadingAppointmentsRef.current) return;

    try {
      loadingAppointmentsRef.current = true;
      setIsLoading(true);

      // Clear any previous error
      setError(null);

      const params = {
        startDate: appointmentDateRange.startDate,
        endDate: appointmentDateRange.endDate,
        centerCode: selectedCenter,
        status: filter === "all" ? "" : filter,
        // For wider date ranges, backend will chunk into multiple requests
        // Add a freshData flag to bypass cache if needed
        freshData: false,
      };

      console.log("Requesting appointments with params:", params);

      const response = await zenotiService.getAppointments(params);

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
        limit: 50,
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

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to get CRM analytics data
      const response = await apiService.analytics.getCRMAnalytics({
        centerCode: selectedCenter,
        timeframe: "month", // Last 30 days by default
      });

      if (response.data?.success) {
        setAnalytics(response.data.analytics);
      } else {
        // If the dedicated endpoint fails, we'll mock some basic analytics from current data
        const mockAnalytics = {
          contactMetrics: {
            totalContacts: recentContacts.length,
            newContactsThisMonth: Math.floor(recentContacts.length * 0.3),
            activeContacts: recentContacts.filter(
              (c) =>
                c.lastContact &&
                new Date(c.lastContact) >
                  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ).length,
            contactsWithUpcomingAppointments: appointments.length,
          },
          appointmentMetrics: {
            totalAppointments: appointments.length,
            upcomingAppointments: appointments.filter(
              (a) => new Date(a.start_time) > new Date()
            ).length,
            completedAppointments: appointments.filter(
              (a) => a.status === "Completed"
            ).length,
            canceledAppointments: appointments.filter(
              (a) => a.status === "Canceled"
            ).length,
          },
          serviceMetrics: {
            totalServices: services.length,
            popularServices: services.slice(0, 5).map((s) => ({
              name: s.name,
              count: Math.floor(Math.random() * 20) + 1,
            })),
          },
          conversionRate: {
            leadToClient: 0.68,
            appointmentShowRate: 0.92,
            repeatClientRate: 0.75,
          },
        };

        setAnalytics(mockAnalytics);
      }
    } catch (err) {
      console.error("Error loading CRM analytics:", err);
      setError("Failed to load analytics data");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle contact selection
  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setShowContactDetails(true);

    // Track contact view for analytics
    analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_CONTACT_VIEW, {
      contactId: contact.id,
      contactName: contact.name,
      provider: contact.provider || "zenoti",
    });
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

    // Show success message
    setSuccessMessage(`Contact ${newContact.name} created successfully`);
  };

  // Handle appointment creation or rescheduling
  const handleAppointmentCreated = (newAppointment) => {
    setShowCreateAppointment(false);
    setSelectedAppointment(null);

    // Reload appointments to show the new one or updated one
    loadAppointments();

    // Show success message based on mode
    const wasRescheduling = !!selectedAppointment;
    setSuccessMessage(
      `Appointment ${
        wasRescheduling ? "rescheduled" : "scheduled"
      } successfully`
    );
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
        setActiveContactView("search");

        // Track search for analytics
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_CONTACT_SEARCH,
          {
            query: searchTerm,
            resultCount: formattedContacts.length,
          }
        );
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

  // Handle import completion
  const handleImportComplete = (stats) => {
    setShowImportModal(false);

    // Show success message
    setSuccessMessage(
      `Import completed: ${stats.success} contacts imported successfully`
    );

    // Refresh contacts if import was successful
    if (stats.success > 0) {
      loadRecentContacts();
    }
  };

  // Handle contact deletion
  const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    try {
      setIsLoading(true);

      // Make API call to delete contact
      const response = await zenotiService.deleteClient(
        contactToDelete.id,
        selectedCenter
      );

      if (response.data?.success) {
        // Remove from contacts lists
        setContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id));
        setRecentContacts((prev) =>
          prev.filter((c) => c.id !== contactToDelete.id)
        );

        setSuccessMessage(
          `Contact ${contactToDelete.name} deleted successfully`
        );

        // Track deletion for analytics
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_CONTACT_DELETE,
          {
            contactId: contactToDelete.id,
            contactName: contactToDelete.name,
          }
        );
      } else {
        throw new Error(response.data?.error || "Failed to delete contact");
      }
    } catch (err) {
      console.error("Error deleting contact:", err);
      setError(`Failed to delete contact: ${err.message}`);
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
      setContactToDelete(null);
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

  return (
    <div className="crm-dashboard">
      {/* Error message */}
      {error && (
        <div className="crm-error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="crm-success-message">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="crm-loading-overlay">
          <div className="crm-loading-spinner"></div>
          <span>{loadingMessage || "Loading..."}</span>
        </div>
      )}

      {/* Main content area */}
      <div className="crm-content">
        {/* Left sidebar */}
        <div className="crm-sidebar">
          <div className="sidebar-header">
            <h3>Menu</h3>
          </div>
          <nav className="sidebar-nav">
            <button
              className={activeSection === "contacts" ? "active" : ""}
              onClick={() => {
                setActiveSection("contacts");
                setActiveContactView("all");
              }}
            >
              <Users size={16} className="icon" />
              Contacts
            </button>
            <button
              className={activeSection === "appointments" ? "active" : ""}
              onClick={() => {
                setActiveSection("appointments");
                loadAppointments();
              }}
            >
              <Calendar size={16} className="icon" />
              Appointments
            </button>
            <button
              className={activeSection === "services" ? "active" : ""}
              onClick={() => {
                setActiveSection("services");
                loadServices();
              }}
            >
              <Tag size={16} className="icon" />
              Services
            </button>
            <button
              className={activeSection === "packages" ? "active" : ""}
              onClick={() => {
                setActiveSection("packages");
              }}
            >
              <Package size={16} className="icon" />
              Packages
            </button>
            <button
              className={activeSection === "reports" ? "active" : ""}
              onClick={() => {
                setActiveSection("reports");
              }}
            >
              <FileText size={16} className="icon" />
              Reports
            </button>
            <button
              className={activeSection === "analytics" ? "active" : ""}
              onClick={() => {
                setActiveSection("analytics");
                loadAnalytics();
              }}
            >
              <BarChart4 size={16} className="icon" />
              Analytics
            </button>
          </nav>

          {localCenters.length > 0 && (
            <div className="center-selector">
              <h3>Zenoti Center</h3>
              <select value={selectedCenter} onChange={handleCenterChange}>
                {localCenters.map((center) => (
                  <option key={center.code} value={center.code}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sidebar-footer">
            <button
              className="crm-create-contact-btn"
              onClick={() => setShowCreateContact(true)}
              disabled={!connectionStatus?.connected}
            >
              <UserPlus size={16} />
              Create Contact
            </button>

            <button
              className="crm-import-contacts-btn"
              onClick={() => setShowImportModal(true)}
              disabled={!connectionStatus?.connected}
            >
              <FileUp size={16} />
              Import Contacts
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="crm-main">
          {/* Search bar */}
          <div className="crm-search-input-group">
            <Search size={20} className="crm-search-icon" />
            <input
              style={{ paddingLeft: "40px" }}
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
              <span>Search</span>
            </button>
          </div>

          {/* Content sections */}
          {activeSection === "contacts" && (
            <div className="contacts-section">
              <h3 className="contact-options">
                {activeContactView === "all"
                  ? "All Contacts"
                  : activeContactView === "recent"
                  ? "Recent Contacts"
                  : activeContactView === "favorites"
                  ? "Favorite Contacts"
                  : "Search Results"}
              </h3>

              <div className="crm-section-header">
                <div className="contacts-tabs">
                  <button
                    className={activeContactView === "all" ? "active" : ""}
                    onClick={() => {
                      setActiveContactView("all");
                      loadRecentContacts();
                    }}
                  >
                    All Contacts
                  </button>
                  <button
                    className={activeContactView === "recent" ? "active" : ""}
                    onClick={() => {
                      setActiveContactView("recent");
                      loadRecentContacts();
                    }}
                  >
                    Recent
                  </button>
                  <button
                    className={
                      activeContactView === "favorites" ? "active" : ""
                    }
                    onClick={() => setActiveContactView("favorites")}
                  >
                    Favorites
                  </button>
                  {activeContactView === "search" && (
                    <button className="active">Search Results</button>
                  )}
                </div>
                <button
                  onClick={loadRecentContacts}
                  disabled={
                    !connectionStatus?.connected || loadingContactsRef.current
                  }
                >
                  <RefreshCw
                    size={14}
                    style={{ marginBottom: "0px" }}
                    className={loadingContactsRef.current ? "spinning" : ""}
                  />
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
                <div className="crm-loading-message">Loading contacts...</div>
              ) : activeContactView === "search" ? (
                contacts.length === 0 ? (
                  <div className="crm-empty-state">
                    <p>No contacts found matching "{searchTerm}".</p>
                    <button
                      className="crm-create-contact-btn"
                      onClick={() => setShowCreateContact(true)}
                    >
                      <UserPlus size={16} />
                      Create New Contact
                    </button>
                  </div>
                ) : (
                  <div className="crm-contacts-table">
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
                        {contacts.map((contact) => (
                          <tr key={contact.id}>
                            <td>{contact.name}</td>
                            <td>{contact.email || "—"}</td>
                            <td>{contact.phone || "—"}</td>
                            <td>{formatDate(contact.lastContact)}</td>
                            <td>
                              <div className="crm-action-buttons">
                                <button
                                  className="crm-action-button view-button"
                                  onClick={() => handleContactSelect(contact)}
                                  title="View Contact"
                                >
                                  View
                                </button>
                                <button
                                  className="crm-action-button crm-delete-button"
                                  onClick={() => {
                                    setContactToDelete(contact);
                                    setShowDeleteConfirm(true);
                                  }}
                                  title="Delete Contact"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : recentContacts.length === 0 ? (
                <div className="crm-empty-state">
                  <p>No {activeContactView} contacts found.</p>
                  <button
                    className="crm-create-contact-btn"
                    onClick={() => setShowCreateContact(true)}
                  >
                    <UserPlus size={16} />
                    Create New Contact
                  </button>
                </div>
              ) : (
                <div className="crm-contacts-table">
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
                          <td>
                            <div className="flex items-center gap-1">
                              <span>{formatDate(contact.lastContact)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="crm-action-buttons">
                              <button
                                className="crm-action-button view-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleContactSelect(contact);
                                }}
                                title="View Contact"
                              >
                                View
                              </button>
                              <button
                                className="crm-action-button crm-delete-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContactToDelete(contact);
                                  setShowDeleteConfirm(true);
                                }}
                                title="Delete Contact"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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
            <div className="apt-appointments-section">
              <div className="crm-section-header">
                <h3>Appointments</h3>
                <div className="apt-appointment-actions">
                  <button
                    className="crm-create-appointment-btn"
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
                      style={{ marginBottom: "0px" }}
                      className={
                        loadingAppointmentsRef.current ? "spinning" : ""
                      }
                    />
                  </button>
                </div>
              </div>

              {/* Date range selector for appointments */}
              <div className="apt-date-range-selector">
                <div className="apt-date-field">
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
                <div className="apt-date-field">
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
                <div className="apt-filter-field">
                  <label htmlFor="appointmentFilter">Status:</label>
                  <select
                    id="appointmentFilter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="NoShow">No Show</option>
                    <option value="CheckedIn">Checked In</option>
                    <option value="Confirmed">Confirmed</option>
                  </select>
                </div>
                <button
                  className="apt-apply-date-btn"
                  onClick={loadAppointments}
                  disabled={
                    !connectionStatus?.connected ||
                    loadingAppointmentsRef.current
                  }
                >
                  Apply Filters
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
                <div className="crm-loading-message">
                  Loading appointments...
                </div>
              ) : appointments.length === 0 ? (
                <div className="crm-empty-state">
                  <p>
                    No upcoming appointments found for the selected date range.
                  </p>
                  <button
                    className="crm-create-appointment-btn"
                    onClick={() => setShowCreateAppointment(true)}
                  >
                    <Calendar size={16} />
                    Schedule Appointment
                  </button>
                </div>
              ) : (
                <div className="apt-appointments-list">
                  {appointments.map((appointment, index) => (
                    <div
                      key={appointment.id || index}
                      className="apt-appointment-card"
                    >
                      <div className="apt-appointment-header">
                        <div className="apt-appointment-date">
                          <Calendar size={16} />
                          <span>
                            {new Date(
                              appointment.start_time
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="apt-appointment-time">
                          <span>{formatTime(appointment.start_time)}</span>
                        </div>
                        <div
                          className={`apt-appointment-status ${
                            typeof appointment.status === "string"
                              ? appointment.status.toLowerCase()
                              : "booked"
                          }`}
                        >
                          {appointment.status || "Booked"}
                        </div>
                      </div>
                      <div className="apt-appointment-details">
                        <h4>{appointment.service_name}</h4>
                        <p className="client-name">{appointment.client_name}</p>
                        {appointment.therapist &&
                          appointment.therapist !== "Unassigned" && (
                            <p className="therapist-name">
                              Provider: {appointment.therapist}
                            </p>
                          )}
                        {appointment.notes && (
                          <p className="apt-appointment-notes small-text">
                            {appointment.notes}
                          </p>
                        )}
                        <p className="duration">
                          {appointment.duration} minutes
                        </p>
                      </div>
                      <div className="apt-appointment-actions">
                        <button
                          className="apt-view-details-btn"
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setShowAppointmentDetails(true);
                          }}
                        >
                          View Details
                        </button>
                        <button
                          className="apt-reschedule-btn"
                          onClick={() => {
                            // Open reschedule form with the selected appointment
                            setSelectedAppointment(appointment);
                            setShowCreateAppointment(true);
                          }}
                        >
                          Reschedule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === "services" && (
            <ZenotiServicesSection
              selectedCenter={selectedCenter}
              connectionStatus={connectionStatus}
              onRefresh={loadServices}
            />
          )}

          {activeSection === "packages" && (
            <ZenotiPackagesSection
              selectedCenter={selectedCenter}
              connectionStatus={connectionStatus}
              onRefresh={() => console.log("Packages refreshed")}
            />
          )}

          {activeSection === "reports" && (
            <ImprovedReportsSection
              selectedCenter={selectedCenter}
              connectionStatus={connectionStatus}
              onRefresh={loadRecentContacts}
            />
          )}

          {activeSection === "analytics" && (
            <CRMAnalyticsDashboard
              selectedCenter={selectedCenter}
              connectionStatus={connectionStatus}
              onRefresh={loadAnalytics}
            />
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
        <div className="crm-modal-overlay">
          <div className="crm-modal-container">
            <div className="crm-modal-header">
              <h3>Create New Contact</h3>
              <button onClick={() => setShowCreateContact(false)}>×</button>
            </div>
            <div className="crm-modal-content">
              <CreateContactForm
                provider="zenoti"
                onSuccess={handleContactCreated}
                onCancel={() => setShowCreateContact(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create or reschedule appointment modal */}
      {showCreateAppointment && (
        <div className="crm-modal-overlay">
          <div className="crm-modal-container">
            <div className="crm-modal-header">
              <h3>
                {selectedAppointment
                  ? "Reschedule Appointment"
                  : "Schedule Appointment"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateAppointment(false);
                  setSelectedAppointment(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="crm-modal-content">
              <AppointmentForm
                onSuccess={handleAppointmentCreated}
                onCancel={() => {
                  setShowCreateAppointment(false);
                  setSelectedAppointment(null);
                }}
                initialContact={selectedContact}
                centerCode={selectedCenter}
                initialAppointment={selectedAppointment}
                rescheduleMode={!!selectedAppointment}
              />
            </div>
          </div>
        </div>
      )}

      {/* Appointment details modal */}
      {showAppointmentDetails && selectedAppointment && (
        <div className="crm-modal-overlay">
          <div className="crm-modal-container">
            <div className="crm-modal-header">
              <h3>Appointment Details</h3>
              <button
                onClick={() => {
                  setShowAppointmentDetails(false);
                  setSelectedAppointment(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="crm-modal-content">
              <AppointmentDetails
                appointment={selectedAppointment}
                onClose={() => {
                  setShowAppointmentDetails(false);
                  setSelectedAppointment(null);
                }}
                onReschedule={() => {
                  setShowAppointmentDetails(false);
                  setShowCreateAppointment(true);
                  // Keep the selectedAppointment for rescheduling
                }}
                centerCode={selectedCenter}
              />
            </div>
          </div>
        </div>
      )}

      {/* Import contacts modal */}
      {showImportModal && (
        <div className="crm-modal-overlay">
          <div className="crm-modal-container import-modal">
            <ImportContacts
              onClose={() => setShowImportModal(false)}
              onSuccess={handleImportComplete}
              centers={localCenters}
            />
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="crm-modal-overlay">
          <div className="crm-modal-container crm-delete-modal">
            <div className="crm-modal-header">
              <h3>Delete Contact</h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setContactToDelete(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="crm-modal-content">
              <div className="confirmation-message">
                <AlertCircle size={48} />
                <h4>Are you sure you want to delete this contact?</h4>
                <p>
                  This action cannot be undone. The contact will be permanently
                  removed from Zenoti.
                </p>

                {contactToDelete && (
                  <div className="contact-details">
                    <p>
                      <strong>Name:</strong> {contactToDelete.name}
                    </p>
                    <p>
                      <strong>Email:</strong> {contactToDelete.email || "N/A"}
                    </p>
                    <p>
                      <strong>Phone:</strong> {contactToDelete.phone || "N/A"}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="crm-modal-footer">
              <button
                className="crm-cancel-button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setContactToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="crm-delete-button"
                onClick={handleDeleteContact}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Contact
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMDashboard;
