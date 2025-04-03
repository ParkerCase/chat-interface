import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  FileText,
  Clock,
  CreditCard,
  Tag,
  Info,
  AlertCircle,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import "./ClientDetailModal.css";

const ClientDetailModal = ({ client, onClose, centerCode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (client && client.id) {
      loadClientData();
    }
  }, [client]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load full client details
      const detailsResponse = await zenotiService.getClient(
        client.id,
        centerCode
      );

      if (detailsResponse.data?.success) {
        setClientDetails(detailsResponse.data.client);

        // Load appointments for this client
        try {
          // Get current date and date 3 months from now
          const today = new Date();
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(today.getMonth() - 3);
          const threeMonthsFromNow = new Date();
          threeMonthsFromNow.setMonth(today.getMonth() + 3);

          const appointmentsResponse = await zenotiService.getAppointments({
            startDate: threeMonthsAgo.toISOString().split("T")[0],
            endDate: threeMonthsFromNow.toISOString().split("T")[0],
            centerCode,
            guestId: client.id,
          });

          if (appointmentsResponse.data?.success) {
            setAppointments(appointmentsResponse.data.appointments || []);
          }
        } catch (appointmentError) {
          console.error("Error loading client appointments:", appointmentError);
        }

        // Load purchase history
        try {
          const historyResponse = await zenotiService.getClientPurchaseHistory(
            client.id,
            {
              centerCode,
            }
          );

          if (historyResponse?.data?.success) {
            setPurchaseHistory(historyResponse.data.history || []);
          }
        } catch (historyError) {
          console.error("Error loading purchase history:", historyError);
        }
      } else {
        setError("Failed to load client details");
      }
    } catch (err) {
      console.error("Error loading client data:", err);
      setError("Error loading client data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  // Format time for display
  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return "—";
    return new Date(dateTimeString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle scheduling an appointment for this client
  const handleScheduleAppointment = () => {
    // Close this modal first
    onClose();

    // Here you would typically open the appointment scheduling modal
    // and pre-select this client
    if (
      window.openAppointmentModal &&
      typeof window.openAppointmentModal === "function"
    ) {
      window.openAppointmentModal(client);
    } else {
      // Fallback if the global function isn't available
      console.log("Schedule appointment for client:", client);
      // You could dispatch an event that the parent component listens for
      const event = new CustomEvent("scheduleAppointment", {
        detail: { client },
      });
      window.dispatchEvent(event);
    }
  };

  if (loading) {
    return (
      <div className="client-detail-modal">
        <div className="modal-content loading">
          <div className="loading-spinner"></div>
          <p>Loading client details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-detail-modal">
        <div className="modal-content error">
          <div className="modal-header">
            <h2>Error</h2>
            <button className="close-button" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="error-message">
            <AlertCircle size={24} />
            <p>{error}</p>
          </div>
          <div className="modal-actions">
            <button onClick={onClose}>Close</button>
            <button onClick={loadClientData}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const personalInfo = clientDetails?.personal_info || clientDetails || {};

  return (
    <div className="client-detail-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>
            {personalInfo.first_name || ""} {personalInfo.last_name || ""}
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="client-tabs">
          <button
            className={activeTab === "details" ? "active" : ""}
            onClick={() => setActiveTab("details")}
          >
            Details
          </button>
          <button
            className={activeTab === "appointments" ? "active" : ""}
            onClick={() => setActiveTab("appointments")}
          >
            Appointments
          </button>
          <button
            className={activeTab === "purchases" ? "active" : ""}
            onClick={() => setActiveTab("purchases")}
          >
            Purchase History
          </button>
        </div>

        {activeTab === "details" && (
          <div className="client-details-content">
            <div className="info-section">
              <h3>Contact Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <Mail size={16} />
                  <span className="label">Email:</span>
                  <span className="value">{personalInfo.email || "—"}</span>
                </div>
                <div className="info-item">
                  <Phone size={16} />
                  <span className="label">Phone:</span>
                  <span className="value">
                    {personalInfo.mobile ||
                      personalInfo.mobile_phone?.number ||
                      personalInfo.phone ||
                      "—"}
                  </span>
                </div>
                <div className="info-item">
                  <Calendar size={16} />
                  <span className="label">Date of Birth:</span>
                  <span className="value">
                    {personalInfo.date_of_birth
                      ? formatDate(personalInfo.date_of_birth)
                      : "—"}
                  </span>
                </div>
                <div className="info-item">
                  <User size={16} />
                  <span className="label">Gender:</span>
                  <span className="value">{personalInfo.gender || "—"}</span>
                </div>
              </div>
            </div>

            {(personalInfo.address ||
              personalInfo.city ||
              personalInfo.state) && (
              <div className="info-section">
                <h3>Address</h3>
                <div className="address-info">
                  <MapPin size={16} />
                  <div>
                    {personalInfo.address && <p>{personalInfo.address}</p>}
                    {(personalInfo.city || personalInfo.state) && (
                      <p>
                        {personalInfo.city}
                        {personalInfo.city && personalInfo.state ? ", " : ""}
                        {personalInfo.state}{" "}
                        {personalInfo.postal_code || personalInfo.zip}
                      </p>
                    )}
                    {personalInfo.country && <p>{personalInfo.country}</p>}
                  </div>
                </div>
              </div>
            )}

            {clientDetails.preferences && (
              <div className="info-section">
                <h3>Preferences</h3>
                <div className="preferences-info">
                  {Object.entries(clientDetails.preferences).map(
                    ([key, value]) => (
                      <div className="preference-item" key={key}>
                        <Tag size={16} />
                        <span className="label">
                          {key
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                          :
                        </span>
                        <span className="value">
                          {typeof value === "boolean"
                            ? value
                              ? "Yes"
                              : "No"
                            : value || "—"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {clientDetails.notes && (
              <div className="info-section">
                <h3>Notes</h3>
                <div className="notes-content">
                  <FileText size={16} />
                  <p>{clientDetails.notes}</p>
                </div>
              </div>
            )}

            <div className="info-section">
              <h3>Account Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <Calendar size={16} />
                  <span className="label">Customer Since:</span>
                  <span className="value">
                    {clientDetails.created_date
                      ? formatDate(clientDetails.created_date)
                      : "—"}
                  </span>
                </div>
                <div className="info-item">
                  <Clock size={16} />
                  <span className="label">Last Visit:</span>
                  <span className="value">
                    {clientDetails.last_visit_date
                      ? formatDate(clientDetails.last_visit_date)
                      : "—"}
                  </span>
                </div>
                {clientDetails.memberships &&
                  clientDetails.memberships.length > 0 && (
                    <div className="info-item">
                      <CreditCard size={16} />
                      <span className="label">Memberships:</span>
                      <span className="value">
                        {clientDetails.memberships
                          .map((m) => m.name)
                          .join(", ")}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="appointments-content">
            <h3>Client Appointments</h3>
            {appointments.length > 0 ? (
              <div className="appointments-list">
                {appointments.map((appointment, index) => (
                  <div
                    key={appointment.id || index}
                    className="appointment-card"
                  >
                    <div className="appointment-header">
                      <div className="appointment-date">
                        <Calendar size={16} />
                        <span>{formatDate(appointment.start_time)}</span>
                      </div>
                      <div className="appointment-time">
                        <Clock size={16} />
                        <span>{formatTime(appointment.start_time)}</span>
                      </div>
                      <div
                        className={`appointment-status ${
                          appointment.status?.toLowerCase() || "booked"
                        }`}
                      >
                        {appointment.status || "Booked"}
                      </div>
                    </div>
                    <div className="appointment-details">
                      <h4>
                        {appointment.service_name ||
                          appointment.service?.name ||
                          "Service"}
                      </h4>
                      {appointment.therapist && (
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
                        {appointment.duration || "60"} minutes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-appointments">
                <Calendar size={48} />
                <p>No appointments found for this client.</p>
                <button
                  className="schedule-button"
                  onClick={handleScheduleAppointment}
                >
                  Schedule Appointment
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "purchases" && (
          <div className="purchases-content">
            <h3>Purchase History</h3>
            {purchaseHistory.length > 0 ? (
              <div className="purchase-history-list">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseHistory.map((item, index) => (
                      <tr key={index}>
                        <td>{formatDate(item.date)}</td>
                        <td>{item.description || item.name}</td>
                        <td>{item.quantity || 1}</td>
                        <td>${parseFloat(item.price || 0).toFixed(2)}</td>
                        <td>
                          $
                          {parseFloat(item.total || item.price || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-purchases">
                <CreditCard size={48} />
                <p>No purchase history found for this client.</p>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button
            className="schedule-button"
            onClick={handleScheduleAppointment}
          >
            Schedule Appointment
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal;
