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
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./AppointmentDetails.css";

/**
 * Component for viewing detailed appointment information
 * Including client details, service information, and appointment actions
 */
const AppointmentDetails = ({
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
      <div className="appointment-details-container">
        <div className="loading-state">
          <RefreshCw className="spinner" size={24} />
          <p>Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error && !appointmentDetails) {
    return (
      <div className="appointment-details-container">
        <div className="error-state">
          <AlertCircle size={32} />
          <h3>Error Loading Details</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button className="refresh-button" onClick={handleRefresh}>
              <RefreshCw size={16} />
              Try Again
            </button>
            <button className="close-button" onClick={onClose}>
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
      <div className="appointment-details-container">
        <div className="not-found-state">
          <AlertCircle size={32} />
          <h3>Appointment Not Found</h3>
          <p>The requested appointment could not be found.</p>
          <button className="close-button" onClick={onClose}>
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
      : "Unknown Service");

  // Determine if the appointment is in the past
  const isPastAppointment =
    new Date(appointmentDetails.start_time) < new Date();

  // Determine if the appointment is cancelled
  const isCancelled =
    (appointmentDetails.status || "").toLowerCase() === "cancelled" ||
    (appointmentDetails.status || "").toLowerCase() === "canceled";

  return (
    <div className="appointment-details-container">
      <div className="appointment-details-header">
        <div className="title-section">
          <h2>Appointment Details</h2>
          <div
            className={`status-badge ${(
              appointmentDetails.status || ""
            ).toLowerCase()}`}
          >
            {appointmentDetails.status || "Booked"}
          </div>
        </div>

        <div className="header-actions">
          <button
            className="action-button"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="action-button"
            onClick={handlePrint}
            title="Print Details"
          >
            <Printer size={16} />
          </button>
          <button className="close-button" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Success/Error messages */}
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="success-message">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className="appointment-details-content">
        <div className="details-section appointment-info">
          <h3>Appointment Information</h3>

          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">
                <Calendar size={16} />
                <span>Date</span>
              </div>
              <div className="info-value">
                {formatDate(appointmentDetails.start_time)}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <Clock size={16} />
                <span>Time</span>
              </div>
              <div className="info-value">
                {formatTime(appointmentDetails.start_time)}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <Tag size={16} />
                <span>Service</span>
              </div>
              <div className="info-value">{serviceName}</div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <Clock size={16} />
                <span>Duration</span>
              </div>
              <div className="info-value">
                {appointmentDetails.duration ||
                  (appointmentDetails.service
                    ? appointmentDetails.service.duration
                    : "60")}{" "}
                minutes
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <User size={16} />
                <span>Provider</span>
              </div>
              <div className="info-value">
                {appointmentDetails.therapist ||
                  (appointmentDetails.provider
                    ? `${appointmentDetails.provider.first_name || ""} ${
                        appointmentDetails.provider.last_name || ""
                      }`.trim()
                    : "Not Assigned")}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <MapPin size={16} />
                <span>Center</span>
              </div>
              <div className="info-value">
                {appointmentDetails.center
                  ? appointmentDetails.center.name
                  : centerCode || "Unknown Center"}
              </div>
            </div>
          </div>

          {/* Notes section */}
          {appointmentDetails.notes && (
            <div className="notes-section">
              <div className="notes-header">
                <FileText size={16} />
                <h4>Notes</h4>
              </div>
              <div className="notes-content">{appointmentDetails.notes}</div>
            </div>
          )}
        </div>

        {/* Client information section */}
        <div className="details-section client-info">
          <div className="section-header-with-action">
            <h3>Client Information</h3>
            {client.id && (
              <button
                className="view-client-button"
                onClick={handleViewClient}
                title="View Client Details"
              >
                View Full Profile
              </button>
            )}
          </div>

          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">
                <User size={16} />
                <span>Name</span>
              </div>
              <div className="info-value">{clientName}</div>
            </div>

            {client.email && (
              <div className="info-item">
                <div className="info-label">
                  <Mail size={16} />
                  <span>Email</span>
                </div>
                <div className="info-value">{client.email}</div>
              </div>
            )}

            {(client.mobile || client.phone) && (
              <div className="info-item">
                <div className="info-label">
                  <Phone size={16} />
                  <span>Phone</span>
                </div>
                <div className="info-value">
                  {client.mobile || client.phone}
                </div>
              </div>
            )}

            {client.gender && (
              <div className="info-item">
                <div className="info-label">
                  <User size={16} />
                  <span>Gender</span>
                </div>
                <div className="info-value">{client.gender}</div>
              </div>
            )}
          </div>
        </div>

        {/* Appointment actions */}
        <div className="appointment-actions">
          {!isPastAppointment && !isCancelled && (
            <>
              <button
                className="reschedule-button"
                onClick={handleReschedule}
                disabled={isLoading}
              >
                <Edit size={16} />
                <span>Reschedule</span>
              </button>

              <button
                className="cancel-button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 size={16} />
                <span>Cancel Appointment</span>
              </button>
            </>
          )}

          <button
            className="message-button"
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
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Cancel Appointment</h3>
              <button
                className="close-modal-button"
                onClick={() => setShowCancelConfirm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              <div className="warning-message">
                <AlertCircle size={24} />
                <p>Are you sure you want to cancel this appointment?</p>
              </div>

              <div className="appointment-summary">
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

              <div className="form-group">
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

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isLoading}
              >
                Keep Appointment
              </button>

              <button
                className="primary-button cancel-confirm-button"
                onClick={handleCancelAppointment}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="spinner" size={16} />
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

export default AppointmentDetails;
