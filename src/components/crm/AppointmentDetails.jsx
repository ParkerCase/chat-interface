import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  Tag,
  AlertCircle,
  FileText,
  CheckCircle,
  Edit,
  Trash2,
  MessageSquare,
  X,
  RefreshCw,
  Printer,
  Download,
  ArrowRight,
  DollarSign,
  Clipboard,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./AppointmentDetails.css";

/**
 * Enhanced component for viewing detailed appointment information
 * Including client details, service information, and appointment actions
 */
const EnhancedAppointmentDetails = ({
  appointment,
  appointmentId,
  centerCode,
  onClose,
  onReschedule,
  onCancel,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [serviceDetails, setServiceDetails] = useState(null);
  const [staffDetails, setStaffDetails] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showClientHistory, setShowClientHistory] = useState(false);
  const [clientHistory, setClientHistory] = useState(null);

  // Load appointment details if appointmentId is provided but not appointment object
  useEffect(() => {
    if (appointmentId && !appointment) {
      loadAppointmentDetails();
    } else if (appointment) {
      setAppointmentDetails(appointment);

      // If appointment has a guest/client, load their details
      if (appointment.guest && appointment.guest.id) {
        loadClientDetails(appointment.guest.id);
      } else if (appointment.client_id || appointment.guest_id) {
        loadClientDetails(appointment.client_id || appointment.guest_id);
      }

      // Load service details if service_id is available
      if (appointment.service_id) {
        loadServiceDetails(appointment.service_id);
      }

      // Load staff details if therapist_id is available
      if (appointment.therapist_id || appointment.provider_id) {
        loadStaffDetails(appointment.therapist_id || appointment.provider_id);
      }
    }
  }, [appointmentId, appointment]);

  // Load appointment details from API
  const loadAppointmentDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await zenotiService.getAppointmentDetails(
        appointmentId,
        centerCode
      );

      if (response.data?.success) {
        setAppointmentDetails(response.data.appointment);

        // If appointment has a guest/client, load their details
        if (
          response.data.appointment.guest &&
          response.data.appointment.guest.id
        ) {
          loadClientDetails(response.data.appointment.guest.id);
        } else if (
          response.data.appointment.client_id ||
          response.data.appointment.guest_id
        ) {
          loadClientDetails(
            response.data.appointment.client_id ||
              response.data.appointment.guest_id
          );
        }

        // Load service details if service_id is available
        if (response.data.appointment.service_id) {
          loadServiceDetails(response.data.appointment.service_id);
        }

        // Load staff details if therapist_id is available
        if (
          response.data.appointment.therapist_id ||
          response.data.appointment.provider_id
        ) {
          loadStaffDetails(
            response.data.appointment.therapist_id ||
              response.data.appointment.provider_id
          );
        }

        // Track view for analytics
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_APPOINTMENT_VIEW,
          {
            appointmentId,
            centerCode,
            serviceId: response.data.appointment.service_id,
            status: response.data.appointment.status,
          }
        );
      } else {
        throw new Error(
          response.data?.error || "Failed to load appointment details"
        );
      }
    } catch (err) {
      console.error("Error loading appointment details:", err);
      setError(`Failed to load appointment details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load client details from API
  const loadClientDetails = async (clientId) => {
    if (!clientId) return;

    try {
      const response = await zenotiService.getClient(clientId, centerCode);

      if (response.data?.success) {
        setClientDetails(response.data.client);
      }
    } catch (err) {
      console.error("Error loading client details:", err);
      // Don't set error state as this is a non-critical operation
    }
  };

  // Load service details
  const loadServiceDetails = async (serviceId) => {
    if (!serviceId) return;

    try {
      const response = await zenotiService.getServiceDetails(
        serviceId,
        centerCode
      );

      if (response.data?.success) {
        setServiceDetails(response.data.service);
      }
    } catch (err) {
      console.error("Error loading service details:", err);
      // Don't set error state as this is a non-critical operation
    }
  };

  // Load staff details
  const loadStaffDetails = async (staffId) => {
    if (!staffId) return;

    try {
      const response = await zenotiService.getStaffDetails(staffId);

      if (response.data?.success) {
        setStaffDetails(response.data.staff);
      }
    } catch (err) {
      console.error("Error loading staff details:", err);
      // Don't set error state as this is a non-critical operation
    }
  };

  // Load client history
  const loadClientHistory = async (clientId) => {
    if (!clientId) return;

    try {
      setIsLoading(true);
      const response = await zenotiService.getClientHistory(clientId, {
        centerCode,
        limit: 10,
      });

      if (response.data?.success) {
        setClientHistory(response.data.history || []);
        setShowClientHistory(true);
      } else {
        throw new Error("Failed to load client history");
      }
    } catch (err) {
      console.error("Error loading client history:", err);
      setError("Failed to load client history");
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format time for display
  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return "N/A";
    return new Date(dateTimeString).toLocaleTimeString(undefined, {
      hour: "numeric",
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

  // Handle appointment cancellation
  const handleCancelAppointment = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const response = await zenotiService.cancelAppointment(
        appointmentDetails.id || appointmentId,
        {
          reason: cancelReason || "Cancelled by staff",
          centerCode,
        }
      );

      if (response.data?.success) {
        setSuccess("Appointment successfully cancelled");
        setShowCancelConfirm(false);

        // Update the appointment status locally
        setAppointmentDetails((prev) => ({
          ...prev,
          status: "Cancelled",
        }));

        // Track cancellation for analytics
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_APPOINTMENT_CANCEL,
          {
            appointmentId: appointmentDetails.id || appointmentId,
            centerCode,
            reason: cancelReason,
          }
        );

        // Notify parent component
        if (onCancel) {
          setTimeout(() => {
            onCancel(response.data.result);
          }, 1500);
        }
      } else {
        throw new Error(response.data?.error || "Failed to cancel appointment");
      }
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      setError(`Failed to cancel appointment: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    if (appointmentId) {
      await loadAppointmentDetails();
    }

    if (onRefresh) {
      onRefresh();
    }
  };

  // Handle print appointment details
  const handlePrint = () => {
    window.print();

    // Track print event
    analyticsUtils.trackEvent(
      analyticsUtils.EVENT_TYPES.CRM_APPOINTMENT_PRINT,
      {
        appointmentId: appointmentDetails?.id || appointmentId,
        serviceId: appointmentDetails?.service_id,
      }
    );
  };

  // Handle appointment rescheduling
  const handleReschedule = () => {
    if (onReschedule && appointmentDetails) {
      onReschedule(appointmentDetails);
    }
  };

  // Handle client details click
  const handleViewClient = () => {
    // Open client details in CRM
    if (appointmentDetails.guest && appointmentDetails.guest.id) {
      window.openClientDetails &&
        window.openClientDetails({
          id: appointmentDetails.guest.id,
          name: `${appointmentDetails.guest.first_name || ""} ${
            appointmentDetails.guest.last_name || ""
          }`.trim(),
          email: appointmentDetails.guest.email,
          phone:
            appointmentDetails.guest.mobile || appointmentDetails.guest.phone,
          centerCode,
        });
    }
  };

  if (isLoading && !appointmentDetails) {
    return (
      <div className="aptdt-container">
        <div className="aptdt-loading-state">
          <RefreshCw className="aptdt-spinner" size={24} />
          <p>Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error && !appointmentDetails) {
    return (
      <div className="aptdt-container">
        <div className="aptdt-error-state">
          <AlertCircle size={32} />
          <h3>Error Loading Details</h3>
          <p>{error}</p>
          <div className="aptdt-error-actions">
            <button className="aptdt-refresh-button" onClick={handleRefresh}>
              <RefreshCw size={16} />
              Try Again
            </button>
            <button className="aptdt-close-button" onClick={onClose}>
              <X size={16} />
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!appointmentDetails) {
    return (
      <div className="aptdt-container">
        <div className="aptdt-not-found-state">
          <AlertCircle size={32} />
          <h3>Appointment Not Found</h3>
          <p>The requested appointment could not be found.</p>
          <button className="aptdt-close-button" onClick={onClose}>
            <X size={16} />
            Close
          </button>
        </div>
      </div>
    );
  }

  // Get client/guest info
  const client = appointmentDetails.guest || clientDetails || {};
  const clientName =
    client.first_name && client.last_name
      ? `${client.first_name} ${client.last_name}`
      : appointmentDetails.client_name || "Unknown Client";

  // Get service info
  const serviceName =
    appointmentDetails.service_name ||
    (appointmentDetails.service
      ? appointmentDetails.service.name
      : serviceDetails?.name || "Unknown Service");

  const servicePrice =
    (appointmentDetails.service && appointmentDetails.service.price) ||
    (serviceDetails && serviceDetails.price) ||
    0;

  // Determine if the appointment is in the past
  const isPastAppointment =
    new Date(appointmentDetails.start_time) < new Date();

  // Determine if the appointment is cancelled
  const isCancelled =
    (appointmentDetails.status || "").toLowerCase() === "cancelled" ||
    (appointmentDetails.status || "").toLowerCase() === "canceled";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "800px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              Appointment Details
            </h2>
            <div
              style={{
                padding: "4px 12px",
                borderRadius: "16px",
                backgroundColor:
                  appointmentDetails.status === "Booked"
                    ? "#DBEAFE"
                    : "#F3F4F6",
                color:
                  appointmentDetails.status === "Booked"
                    ? "#1E40AF"
                    : "#6B7280",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              {appointmentDetails.status || "Booked"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleRefresh}
              style={{
                padding: "8px",
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#374151",
              }}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handlePrint}
              style={{
                padding: "8px",
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#374151",
              }}
              title="Print Details"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "8px",
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#DC2626",
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "12px",
              backgroundColor: "#FEE2E2",
              color: "#991B1B",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "12px",
              backgroundColor: "#D1FAE5",
              color: "#065F46",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e5e7eb",
            padding: "0 24px",
          }}
        >
          {["details", "client", "service", "notes"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 20px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: "500",
                color: activeTab === tab ? "#2563EB" : "#6B7280",
                borderBottom:
                  activeTab === tab
                    ? "2px solid #2563EB"
                    : "2px solid transparent",
                marginBottom: "-1px",
                transition: "all 0.2s",
                fontSize: "0.875rem",
                textTransform: "capitalize",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Details Tab */}
          {activeTab === "details" && (
            <div>
              <h3
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                Appointment Information
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <Calendar size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Date</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {formatDate(appointmentDetails.start_time)}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <Clock size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Time</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {formatTime(appointmentDetails.start_time)}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <Clock size={16} />
                    <span style={{ fontSize: "0.875rem" }}>End Time</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {appointmentDetails.end_time
                      ? formatTime(appointmentDetails.end_time)
                      : calculateEndTime(
                          appointmentDetails.start_time,
                          appointmentDetails.duration || 60
                        )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <Tag size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Service</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {serviceName}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <Clock size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Duration</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {appointmentDetails.duration || 60} minutes
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <DollarSign size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Price</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {formatCurrency(servicePrice)}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <User size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Provider</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {appointmentDetails.therapist || "Not Assigned"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <MapPin size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Center</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {appointmentDetails.center?.name ||
                      centerCode ||
                      "Unknown Center"}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ marginTop: "32px" }}>
                <h4
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "1.125rem",
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  Appointment Timeline
                </h4>
                <div style={{ position: "relative", paddingLeft: "32px" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "20px",
                      bottom: "20px",
                      width: "2px",
                    }}
                  />

                  {/* Timeline items */}
                  <div style={{ position: "relative", paddingBottom: "20px" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: "-20px",
                        top: "4px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#10B981",
                        display: "flex",
                        alignSelf: "center",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCircle size={14} color="white" />
                    </div>
                    <div
                      style={{
                        marginLeft: "15px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "500",
                          color: "#111827",
                          marginBottom: "4px",
                        }}
                      >
                        Booked
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                        {appointmentDetails.created_date
                          ? formatDate(appointmentDetails.created_date) +
                            " at " +
                            formatTime(appointmentDetails.created_date)
                          : "Date unknown"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Client Tab */}
          {activeTab === "client" && (
            <div>
              <h3
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                Client Information
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#6B7280",
                    }}
                  >
                    <User size={16} />
                    <span style={{ fontSize: "0.875rem" }}>Name</span>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "#111827",
                    }}
                  >
                    {clientName}
                  </div>
                </div>

                {client.email && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#6B7280",
                      }}
                    >
                      <Mail size={16} />
                      <span style={{ fontSize: "0.875rem" }}>Email</span>
                    </div>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: "500",
                        color: "#111827",
                      }}
                    >
                      {client.email}
                    </div>
                  </div>
                )}

                {(client.mobile || client.phone) && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#6B7280",
                      }}
                    >
                      <Phone size={16} />
                      <span style={{ fontSize: "0.875rem" }}>Phone</span>
                    </div>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: "500",
                        color: "#111827",
                      }}
                    >
                      {client.mobile || client.phone}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Service Tab */}
          {activeTab === "service" && (
            <div>
              <h3
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                Service Information
              </h3>
              {/* Service content */}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div>
              <h3
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                Appointment Notes
              </h3>
              {appointmentDetails.notes ? (
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                    color: "#374151",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {appointmentDetails.notes}
                </div>
              ) : (
                <p style={{ color: "#6B7280" }}>
                  No notes have been added to this appointment.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: "20px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            backgroundColor: "#F9FAFB",
            borderRadius: "0 0 25px 25px",
          }}
        >
          {!isPastAppointment && !isCancelled && (
            <>
              <button
                onClick={handleReschedule}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "var(--color-primary, #2563EB)",
                  color: "white",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                <Edit size={16} />
                <span>Reschedule</span>
              </button>

              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  border: "1px solid var(--color-error, #DC2626)",
                  borderRadius: "6px",
                  backgroundColor: "var(--color-background, white)",
                  color: "var(--color-error, #DC2626)",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                <Trash2 size={16} />
                <span>Cancel Appointment</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              width: "90%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                Cancel Appointment
              </h3>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                backgroundColor: "#FEE2E2",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              <AlertCircle size={24} color="#991B1B" />
              <p style={{ margin: 0, color: "#991B1B" }}>
                Are you sure you want to cancel this appointment?
              </p>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <p style={{ margin: "8px 0" }}>
                <strong>Client:</strong> {clientName}
              </p>
              <p style={{ margin: "8px 0" }}>
                <strong>Service:</strong> {serviceName}
              </p>
              <p style={{ margin: "8px 0" }}>
                <strong>Date/Time:</strong>{" "}
                {formatDate(appointmentDetails.start_time)} at{" "}
                {formatTime(appointmentDetails.start_time)}
              </p>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Cancellation Reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation"
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  color: "#374151",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                Keep Appointment
              </button>

              <button
                onClick={handleCancelAppointment}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "#DC2626",
                  color: "white",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="spinning" size={16} />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Cancel Appointment</span>
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

// Helper function to calculate end time
function calculateEndTime(startTime, durationMinutes) {
  if (!startTime) return "N/A";

  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  return end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default EnhancedAppointmentDetails;
