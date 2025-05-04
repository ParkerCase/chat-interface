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
      <div className="apt-appointment-details-container">
        <div className="apt-loading-state">
          <RefreshCw className="apt-spinner" size={24} />
          <p>Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error && !appointmentDetails) {
    return (
      <div className="apt-appointment-details-container">
        <div className="apt-error-state">
          <AlertCircle size={32} />
          <h3>Error Loading Details</h3>
          <p>{error}</p>
          <div className="apt-error-actions">
            <button className="apt-refresh-button" onClick={handleRefresh}>
              <RefreshCw size={16} />
              Try Again
            </button>
            <button className="apt-close-button" onClick={onClose}>
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
      <div className="apt-appointment-details-container">
        <div className="apt-not-found-state">
          <AlertCircle size={32} />
          <h3>Appointment Not Found</h3>
          <p>The requested appointment could not be found.</p>
          <button className="apt-close-button" onClick={onClose}>
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
    <div className="apt-appointment-details-container">
      <div className="apt-appointment-details-header">
        <div className="apt-title-section">
          <h2>Appointment Details</h2>
          <div
            className={`apt-status-badge ${(
              appointmentDetails.status || ""
            ).toLowerCase()}`}
          >
            {appointmentDetails.status || "Booked"}
          </div>
        </div>

        <div className="apt-header-actions">
          <button
            className="apt-action-button"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="apt-action-button"
            onClick={handlePrint}
            title="Print Details"
          >
            <Printer size={16} />
          </button>
          <button className="apt-close-button" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Success/Error messages */}
      {error && (
        <div className="apt-error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="apt-success-message">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="apt-details-tabs">
        <button
          className={activeTab === "details" ? "active" : ""}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>
        <button
          className={activeTab === "client" ? "active" : ""}
          onClick={() => setActiveTab("client")}
        >
          Client
        </button>
        <button
          className={activeTab === "service" ? "active" : ""}
          onClick={() => setActiveTab("service")}
        >
          Service
        </button>
        <button
          className={activeTab === "notes" ? "active" : ""}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
      </div>

      <div className="apt-appointment-details-content">
        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="apt-details-section apt-appointment-info">
            <h3>Appointment Information</h3>

            <div className="apt-info-grid">
              <div className="apt-info-item">
                <div className="apt-info-label">
                  <Calendar size={16} />
                  <span>Date</span>
                </div>
                <div className="apt-info-value">
                  {formatDate(appointmentDetails.start_time)}
                </div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <Clock size={16} />
                  <span>Time</span>
                </div>
                <div className="apt-info-value">
                  {formatTime(appointmentDetails.start_time)}
                </div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <Clock size={16} />
                  <span>End Time</span>
                </div>
                <div className="apt-info-value">
                  {appointmentDetails.end_time
                    ? formatTime(appointmentDetails.end_time)
                    : calculateEndTime(
                        appointmentDetails.start_time,
                        appointmentDetails.duration || 60
                      )}
                </div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <Tag size={16} />
                  <span>Service</span>
                </div>
                <div className="apt-info-value">{serviceName}</div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <Clock size={16} />
                  <span>Duration</span>
                </div>
                <div className="apt-info-value">
                  {appointmentDetails.duration ||
                    (appointmentDetails.service
                      ? appointmentDetails.service.duration
                      : "60")}{" "}
                  minutes
                </div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <DollarSign size={16} />
                  <span>Price</span>
                </div>
                <div className="apt-info-value">
                  {formatCurrency(servicePrice)}
                </div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <User size={16} />
                  <span>Provider</span>
                </div>
                <div className="apt-info-value">
                  {appointmentDetails.therapist ||
                    (appointmentDetails.provider
                      ? `${appointmentDetails.provider.first_name || ""} ${
                          appointmentDetails.provider.last_name || ""
                        }`.trim()
                      : staffDetails
                      ? `${staffDetails.first_name || ""} ${
                          staffDetails.last_name || ""
                        }`.trim()
                      : "Not Assigned")}
                </div>
              </div>

              <div className="apt-info-item">
                <div className="apt-info-label">
                  <MapPin size={16} />
                  <span>Center</span>
                </div>
                <div className="apt-info-value">
                  {appointmentDetails.center
                    ? appointmentDetails.center.name
                    : centerCode || "Unknown Center"}
                </div>
              </div>
            </div>

            <div className="apt-appointment-timeline">
              <h4>Appointment Timeline</h4>
              <div className="apt-timeline-steps">
                <div className="apt-timeline-step completed">
                  <div className="apt-step-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="apt-step-content">
                    <div className="apt-step-title">Booked</div>
                    <div className="apt-step-time">
                      {appointmentDetails.created_date
                        ? formatDate(appointmentDetails.created_date) +
                          " at " +
                          formatTime(appointmentDetails.created_date)
                        : "Date unknown"}
                    </div>
                  </div>
                </div>

                {isCancelled ? (
                  <div className="apt-timeline-step cancelled">
                    <div className="apt-step-icon">
                      <X size={16} />
                    </div>
                    <div className="apt-step-content">
                      <div className="apt-step-title">Cancelled</div>
                      <div className="apt-step-time">
                        {appointmentDetails.modified_date
                          ? formatDate(appointmentDetails.modified_date) +
                            " at " +
                            formatTime(appointmentDetails.modified_date)
                          : "Date unknown"}
                      </div>
                      {appointmentDetails.cancel_reason && (
                        <div className="apt-step-note">
                          Reason: {appointmentDetails.cancel_reason}
                        </div>
                      )}
                    </div>
                  </div>
                ) : isPastAppointment &&
                  (appointmentDetails.status || "").toLowerCase() ===
                    "completed" ? (
                  <div className="apt-timeline-step completed">
                    <div className="apt-step-icon">
                      <CheckCircle size={16} />
                    </div>
                    <div className="apt-step-content">
                      <div className="apt-step-title">Completed</div>
                      <div className="apt-step-time">
                        {formatDate(
                          appointmentDetails.end_time ||
                            appointmentDetails.start_time
                        )}
                      </div>
                    </div>
                  </div>
                ) : isPastAppointment ? (
                  <div className="apt-timeline-step">
                    <div className="apt-step-icon">
                      <Clock size={16} />
                    </div>
                    <div className="apt-step-content">
                      <div className="apt-step-title">
                        {(appointmentDetails.status || "").toLowerCase() ===
                        "noshow"
                          ? "No Show"
                          : "Appointment Time Passed"}
                      </div>
                      <div className="apt-step-time">
                        {formatDate(appointmentDetails.start_time)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="apt-timeline-step upcoming">
                    <div className="apt-step-icon">
                      <Clock size={16} />
                    </div>
                    <div className="apt-step-content">
                      <div className="apt-step-title">Upcoming</div>
                      <div className="apt-step-time">
                        {formatDate(appointmentDetails.start_time) +
                          " at " +
                          formatTime(appointmentDetails.start_time)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Client Tab */}
        {activeTab === "client" && (
          <div className="apt-details-section apt-client-info">
            <div className="apt-section-header-with-action">
              <h3>Client Information</h3>
              <div className="apt-section-actions">
                {client.id && !showClientHistory && (
                  <button
                    className="apt-view-history-button"
                    onClick={() => loadClientHistory(client.id)}
                    title="View Client History"
                  >
                    <Clock size={14} />
                    View History
                  </button>
                )}
                {client.id && (
                  <button
                    className="apt-view-client-button"
                    onClick={handleViewClient}
                    title="View Client Details"
                  >
                    <User size={14} />
                    Full Profile
                  </button>
                )}
              </div>
            </div>

            {!showClientHistory ? (
              <div className="apt-info-grid">
                <div className="apt-info-item">
                  <div className="apt-info-label">
                    <User size={16} />
                    <span>Name</span>
                  </div>
                  <div className="apt-info-value">{clientName}</div>
                </div>

                {client.email && (
                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <Mail size={16} />
                      <span>Email</span>
                    </div>
                    <div className="apt-info-value">{client.email}</div>
                  </div>
                )}

                {(client.mobile || client.phone) && (
                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <Phone size={16} />
                      <span>Phone</span>
                    </div>
                    <div className="apt-info-value">
                      {client.mobile || client.phone}
                    </div>
                  </div>
                )}

                {client.gender && (
                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <User size={16} />
                      <span>Gender</span>
                    </div>
                    <div className="apt-info-value">{client.gender}</div>
                  </div>
                )}

                {client.date_of_birth && (
                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <Calendar size={16} />
                      <span>Date of Birth</span>
                    </div>
                    <div className="apt-info-value">
                      {formatDate(client.date_of_birth)}
                    </div>
                  </div>
                )}

                {(client.membership || client.membership_id) && (
                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <Tag size={16} />
                      <span>Membership</span>
                    </div>
                    <div className="apt-info-value">
                      {client.membership?.name || "Active Membership"}
                    </div>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="apt-loading-state">
                <RefreshCw className="apt-spinner" size={20} />
                <p>Loading client history...</p>
              </div>
            ) : clientHistory && clientHistory.length > 0 ? (
              <div className="apt-client-history">
                <button
                  className="apt-back-button"
                  onClick={() => setShowClientHistory(false)}
                >
                  <ArrowRight size={14} className="apt-back-icon" />
                  Back to Client Details
                </button>

                <h4>Client History</h4>
                <div className="apt-history-items">
                  {clientHistory.map((item, index) => (
                    <div key={index} className="apt-history-item">
                      <div className="apt-history-item-date">
                        <Calendar size={14} />
                        {formatDate(item.date)}
                      </div>
                      <div className="apt-history-item-type">
                        {item.type === "appointment" ? (
                          <Clock size={14} />
                        ) : item.type === "purchase" ? (
                          <DollarSign size={14} />
                        ) : (
                          <Tag size={14} />
                        )}
                        {item.type || "Activity"}
                      </div>
                      <div className="apt-history-item-details">
                        <p className="apt-item-description">
                          {item.description || item.name || "Unknown activity"}
                        </p>
                        {item.amount && (
                          <p className="apt-item-amount">
                            {formatCurrency(item.amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="apt-no-history">
                <p>No history available for this client.</p>
                <button
                  className="apt-back-button"
                  onClick={() => setShowClientHistory(false)}
                >
                  Back to Client Details
                </button>
              </div>
            )}
          </div>
        )}

        {/* Service Tab */}
        {activeTab === "service" && (
          <div className="apt-details-section apt-service-info">
            <h3>Service Information</h3>

            {isLoading && !serviceDetails ? (
              <div className="apt-loading-state">
                <RefreshCw className="apt-spinner" size={20} />
                <p>Loading service details...</p>
              </div>
            ) : serviceDetails ? (
              <div className="apt-service-details">
                <div className="apt-info-grid">
                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <Tag size={16} />
                      <span>Service Name</span>
                    </div>
                    <div className="apt-info-value">{serviceDetails.name}</div>
                  </div>

                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <Clock size={16} />
                      <span>Duration</span>
                    </div>
                    <div className="apt-info-value">
                      {serviceDetails.duration || 60} minutes
                    </div>
                  </div>

                  <div className="apt-info-item">
                    <div className="apt-info-label">
                      <DollarSign size={16} />
                      <span>Price</span>
                    </div>
                    <div className="apt-info-value">
                      {formatCurrency(serviceDetails.price || 0)}
                    </div>
                  </div>

                  {serviceDetails.category && (
                    <div className="apt-info-item">
                      <div className="apt-info-label">
                        <Tag size={16} />
                        <span>Category</span>
                      </div>
                      <div className="apt-info-value">
                        {serviceDetails.category}
                      </div>
                    </div>
                  )}
                </div>

                {serviceDetails.description && (
                  <div className="apt-service-description">
                    <h4>Description</h4>
                    <p>{serviceDetails.description}</p>
                  </div>
                )}

                {staffDetails && (
                  <div className="apt-staff-details">
                    <h4>Service Provider</h4>
                    <div className="apt-staff-card">
                      <div className="apt-staff-avatar">
                        <User size={32} />
                      </div>
                      <div className="apt-staff-info">
                        <div className="apt-staff-name">
                          {staffDetails.first_name} {staffDetails.last_name}
                        </div>
                        <div className="apt-staff-title">
                          {staffDetails.title ||
                            staffDetails.designation ||
                            "Service Provider"}
                        </div>
                        {staffDetails.expertise && (
                          <div className="apt-staff-expertise">
                            {staffDetails.expertise}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="apt-no-service-details">
                <p>No detailed service information available.</p>
                <div className="apt-basic-service-info">
                  <div className="apt-info-item">
                    <div className="apt-info-label">Service:</div>
                    <div className="apt-info-value">{serviceName}</div>
                  </div>
                  <div className="apt-info-item">
                    <div className="apt-info-label">Duration:</div>
                    <div className="apt-info-value">
                      {appointmentDetails.duration || "60"} minutes
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="apt-details-section apt-notes-info">
            <h3>Appointment Notes</h3>

            {/* Notes section */}
            {appointmentDetails.notes ? (
              <div className="apt-notes-section">
                <div className="apt-notes-content">
                  {appointmentDetails.notes}
                </div>
              </div>
            ) : (
              <div className="apt-no-notes">
                <p>No notes have been added to this appointment.</p>
                {!isPastAppointment && !isCancelled && (
                  <div className="apt-add-note-placeholder">
                    <Clipboard size={32} />
                    <p>You can add notes for this appointment.</p>
                    <textarea
                      placeholder="Add notes here..."
                      disabled={isLoading}
                      rows={4}
                    ></textarea>
                    <button
                      className="apt-save-note-button"
                      disabled={isLoading}
                    >
                      Save Notes
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Special instructions or follow-up notes if available */}
            {appointmentDetails.special_instructions && (
              <div className="apt-special-instructions">
                <h4>Special Instructions</h4>
                <div className="apt-instructions-content">
                  {appointmentDetails.special_instructions}
                </div>
              </div>
            )}

            {appointmentDetails.follow_up_notes && (
              <div className="apt-follow-up-notes">
                <h4>Follow-up Notes</h4>
                <div className="apt-follow-up-content">
                  {appointmentDetails.follow_up_notes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Appointment actions */}
        <div className="apt-appointment-actions">
          {!isPastAppointment && !isCancelled && (
            <>
              <button
                className="apt-reschedule-button"
                onClick={handleReschedule}
                disabled={isLoading}
              >
                <Edit size={16} />
                <span>Reschedule</span>
              </button>

              <button
                className="apt-cancel-button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 size={16} />
                <span>Cancel Appointment</span>
              </button>
            </>
          )}

          <button
            className="apt-message-button"
            onClick={() => {
              /* Would integrate with messaging system */
            }}
            disabled={isLoading}
          >
            <MessageSquare size={16} />
            <span>Send Message</span>
          </button>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="apt-modal-overlay">
          <div className="apt-modal-container">
            <div className="apt-modal-header">
              <h3>Cancel Appointment</h3>
              <button
                className="apt-close-modal-button"
                onClick={() => setShowCancelConfirm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="apt-modal-content">
              <div className="apt-warning-message">
                <AlertCircle size={24} />
                <p>Are you sure you want to cancel this appointment?</p>
              </div>

              <div className="apt-appointment-summary">
                <p>
                  <strong>Client:</strong> {clientName}
                </p>
                <p>
                  <strong>Service:</strong> {serviceName}
                </p>
                <p>
                  <strong>Date/Time:</strong>{" "}
                  {formatDate(appointmentDetails.start_time)} at{" "}
                  {formatTime(appointmentDetails.start_time)}
                </p>
              </div>

              <div className="apt-form-group">
                <label htmlFor="cancelReason">Cancellation Reason</label>
                <textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancellation"
                  rows={3}
                />
              </div>
            </div>

            <div className="apt-modal-footer">
              <button
                className="apt-secondary-button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isLoading}
              >
                Keep Appointment
              </button>

              <button
                className="apt-primary-button apt-cancel-confirm-button"
                onClick={handleCancelAppointment}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="apt-spinner" size={16} />
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
