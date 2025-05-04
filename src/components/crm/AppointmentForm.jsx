import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  Tag,
  AlignLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import "./AppointmentForm.css";

const AppointmentForm = ({
  onSuccess,
  onCancel,
  initialContact = null,
  centerCode = null,
  initialAppointment = null, // For reschedule mode
  rescheduleMode = false, // Flag to indicate reschedule mode
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsFetched, setSlotsFetched] = useState(false);

  // Form state - initialize with appointment data in reschedule mode
  const [formData, setFormData] = useState({
    contactId: initialContact?.id || initialAppointment?.guest_id || "",
    contactName:
      initialContact?.name ||
      (initialAppointment?.guest
        ? `${initialAppointment.guest.first_name || ""} ${
            initialAppointment.guest.last_name || ""
          }`.trim()
        : ""),
    serviceId:
      rescheduleMode && initialAppointment?.service_id
        ? initialAppointment.service_id
        : "",
    staffId:
      rescheduleMode && initialAppointment?.therapist_id
        ? initialAppointment.therapist_id
        : "",
    date:
      rescheduleMode && initialAppointment?.start_time
        ? initialAppointment.start_time.split("T")[0]
        : new Date().toISOString().split("T")[0], // Today's date or appointment date
    time:
      rescheduleMode && initialAppointment?.start_time
        ? initialAppointment.start_time.split("T")[1].substring(0, 5)
        : "",
    notes:
      rescheduleMode && initialAppointment?.notes
        ? initialAppointment.notes
        : "",
  });

  // States for contact lookup
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showContactSearch, setShowContactSearch] = useState(
    !initialContact && !rescheduleMode
  );

  // Fetch services for the selected center
  useEffect(() => {
    const loadServices = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const effectiveCenterCode =
          centerCode || localStorage.getItem("selectedCenterCode");

        if (!effectiveCenterCode) {
          setError("No center selected. Please select a center first.");
          return;
        }

        const response = await zenotiService.getServices({
          centerCode: effectiveCenterCode,
          limit: 50,
        });

        if (response.data?.success) {
          setServices(response.data.services || []);

          if (response.data.services?.length === 0) {
            console.log("No services returned from API");
          }
        } else {
          console.warn("Failed to load services:", response.data);
          setError("Failed to load services. Please try again.");
        }
      } catch (err) {
        console.error("Error loading services:", err);
        setError("Failed to load services. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadServices();
  }, [centerCode]);

  // Fetch staff when service is selected
  useEffect(() => {
    if (!formData.serviceId) return;

    const loadStaff = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const effectiveCenterCode =
          centerCode || localStorage.getItem("selectedCenterCode");

        if (!effectiveCenterCode) {
          setError("No center selected. Please select a center first.");
          return;
        }

        const response = await zenotiService.getStaff({
          centerCode: effectiveCenterCode,
          serviceId: formData.serviceId,
        });

        if (response.data?.success) {
          // Handle different response formats
          const staffList =
            response.data.therapists || response.data.staff || [];

          setStaff(staffList);

          if (staffList.length === 0) {
            console.log("No staff returned for service:", formData.serviceId);
          }
        } else {
          console.warn("Failed to load staff:", response.data);
          setError("Failed to load staff. Please try again.");
        }
      } catch (err) {
        console.error("Error loading staff:", err);
        setError("Failed to load staff. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadStaff();
  }, [formData.serviceId, centerCode]);

  // Fetch available slots when date, service and staff are selected
  useEffect(() => {
    if (!formData.date || !formData.serviceId || !formData.staffId) {
      setAvailableSlots([]);
      setSlotsFetched(false);
      return;
    }

    const loadAvailableSlots = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const effectiveCenterCode =
          centerCode || localStorage.getItem("selectedCenterCode");

        if (!effectiveCenterCode) {
          setError("No center selected. Please select a center first.");
          return;
        }

        const params = {
          date: formData.date,
          serviceId: formData.serviceId,
          staffId: formData.staffId,
          centerCode: effectiveCenterCode,
        };

        console.log("Fetching availability slots with params:", params);
        const slots = await zenotiService.getAvailableSlots(params);
        console.log("Available slots response:", slots);

        // Handle case where slots might be nested in an availability object
        const slotsArray = slots.slots || slots.availability?.slots || [];

        setAvailableSlots(slotsArray);
        setSlotsFetched(true);

        if (slotsArray.length === 0) {
          console.log("No slots available for the selected criteria");
        }
      } catch (err) {
        console.error("Error loading available slots:", err);
        setError("Failed to load available slots. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailableSlots();
  }, [formData.date, formData.serviceId, formData.staffId, centerCode]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle contact search
  const handleContactSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) return;

    try {
      setIsLoading(true);
      setError(null);

      const effectiveCenterCode =
        centerCode || localStorage.getItem("selectedCenterCode");

      const response = await zenotiService.searchClients({
        query: searchTerm,
        centerCode: effectiveCenterCode,
        limit: 5,
      });

      if (response.data?.success) {
        const contacts = response.data.clients || [];

        // Format contacts
        const formattedContacts = contacts.map((client) => {
          // Handle nested personal_info or direct properties
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
          };
        });

        setSearchResults(formattedContacts);
      } else {
        console.warn("Search response unsuccessful:", response.data);
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Error searching contacts:", err);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setFormData((prev) => ({
      ...prev,
      contactId: contact.id,
      contactName: contact.name,
    }));

    setShowContactSearch(false);
  };

  // Format time for display
  const formatTime = (timeString) => {
    try {
      if (!timeString) return "";

      // Handle different possible formats
      let hours, minutes;

      if (timeString.includes("T")) {
        // ISO format like 2023-04-15T14:30:00
        [hours, minutes] = timeString.split("T")[1].split(":").slice(0, 2);
      } else if (timeString.includes(":")) {
        // Simple time format like 14:30
        [hours, minutes] = timeString.split(":");
      } else {
        return timeString; // Return as is if not recognized
      }

      const date = new Date();
      date.setHours(parseInt(hours));
      date.setMinutes(parseInt(minutes));

      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      console.error("Error formatting time:", e);
      return timeString || "";
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.contactId ||
      !formData.serviceId ||
      !formData.date ||
      !formData.time
    ) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const effectiveCenterCode =
        centerCode || localStorage.getItem("selectedCenterCode");

      if (!effectiveCenterCode) {
        setError("No center code available. Please select a center.");
        return;
      }

      // Create appointment data
      const appointmentData = {
        guestId: formData.contactId,
        serviceId: formData.serviceId,
        therapistId: formData.staffId,
        startTime: `${formData.date}T${formData.time}`,
        notes: formData.notes,
      };

      let response;

      if (rescheduleMode && initialAppointment?.id) {
        // Reschedule existing appointment
        console.log("Rescheduling appointment with ID:", initialAppointment.id);
        console.log("Reschedule data:", appointmentData);

        response = await zenotiService.rescheduleAppointment(
          initialAppointment.id,
          appointmentData
        );

        console.log("Appointment reschedule response:", response);
      } else {
        // Book new appointment
        console.log("Booking new appointment with data:", appointmentData);
        console.log("Using center code:", effectiveCenterCode);

        response = await zenotiService.bookAppointment(
          appointmentData,
          effectiveCenterCode
        );

        console.log("Appointment booking response:", response);
      }

      if (response.data?.success) {
        setSuccess(true);

        // Call success callback after a short delay
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(response.data.appointment);
          }
        }, 1500);
      } else {
        setError(
          response.data?.error ||
            `Failed to ${rescheduleMode ? "reschedule" : "create"} appointment.`
        );
      }
    } catch (err) {
      console.error(
        `Error ${rescheduleMode ? "rescheduling" : "creating"} appointment:`,
        err
      );
      setError(
        err.message ||
          `Failed to ${
            rescheduleMode ? "reschedule" : "create"
          } appointment. Please try again.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="aformx-container">
      <h3 className="aformx-title">
        {rescheduleMode ? "Reschedule Appointment" : "Schedule New Appointment"}
      </h3>

      {/* Error message */}
      {error && (
        <div className="aformx-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Success message */}
      {success ? (
        <div className="aformx-success">
          <Check size={16} />
          <span>
            Appointment successfully{" "}
            {rescheduleMode ? "rescheduled" : "scheduled"}!
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="aformx-form">
          {/* Contact selection */}
          <div className="aformx-section">
            <h4 className="aformx-section-title">
              <User size={16} />
              Client Information
            </h4>

            {showContactSearch ? (
              <div className="aformx-contact-search">
                <div className="aformx-search-field">
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleContactSearch()
                    }
                  />
                  <button
                    type="button"
                    className="aformx-search-button"
                    onClick={handleContactSearch}
                    disabled={isLoading || !searchTerm}
                  >
                    Search
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="aformx-search-results">
                    {searchResults.map((contact) => (
                      <div
                        key={contact.id}
                        className="aformx-search-result-item"
                        onClick={() => handleSelectContact(contact)}
                      >
                        <div className="aformx-contact-name">
                          {contact.name}
                        </div>
                        <div className="aformx-contact-details">
                          {contact.email && <span>{contact.email}</span>}
                          {contact.phone && <span>{contact.phone}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm && searchResults.length === 0 && !isLoading && (
                  <div className="aformx-no-results">No contacts found</div>
                )}
              </div>
            ) : (
              <div className="aformx-selected-contact">
                <div className="aformx-contact-info">
                  <span className="aformx-contact-name">
                    {formData.contactName}
                  </span>
                </div>
                <button
                  type="button"
                  className="aformx-change-contact"
                  onClick={() => setShowContactSearch(true)}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Service selection */}
          <div className="aformx-section">
            <h4 className="aformx-section-title">
              <Tag size={16} />
              Service Details
            </h4>

            <div className="aformx-form-group">
              <label htmlFor="serviceId">Service *</label>
              <select
                id="serviceId"
                name="serviceId"
                value={formData.serviceId}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              >
                <option value="">Select a service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.duration} min ($
                    {parseFloat(service.price || 0).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {formData.serviceId && (
              <div className="aformx-form-group">
                <label htmlFor="staffId">Staff *</label>
                <select
                  id="staffId"
                  name="staffId"
                  value={formData.staffId}
                  onChange={handleInputChange}
                  required
                  disabled={isLoading || staff.length === 0}
                >
                  <option value="">Select a staff member</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
                {staff.length === 0 && formData.serviceId && (
                  <div className="aformx-help-text">
                    No staff members available for this service
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date and time selection */}
          <div className="aformx-section">
            <h4 className="aformx-section-title">
              <Calendar size={16} />
              Date & Time
            </h4>

            <div className="aformx-form-group">
              <label htmlFor="date">Date *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
                min={new Date().toISOString().split("T")[0]}
                disabled={isLoading}
              />
            </div>

            {formData.date && formData.serviceId && formData.staffId && (
              <div className="aformx-form-group">
                <label htmlFor="time">Time *</label>
                {slotsFetched && availableSlots.length === 0 ? (
                  <div className="aformx-no-slots">
                    No available slots for the selected date
                  </div>
                ) : (
                  <div className="aformx-time-slots">
                    {isLoading ? (
                      <div className="aformx-loading-slots">
                        Loading available times...
                      </div>
                    ) : (
                      <>
                        {availableSlots.map((slot, index) => {
                          // Handle different slot formats
                          const startTime = slot.start_time || slot.startTime;
                          const timeValue = startTime
                            ? startTime.includes("T")
                              ? startTime.split("T")[1].substring(0, 5)
                              : startTime.substring(0, 5)
                            : "";

                          return (
                            <div
                              key={index}
                              className={`aformx-time-slot ${
                                formData.time === timeValue ? "selected" : ""
                              }`}
                              onClick={() =>
                                handleInputChange({
                                  target: {
                                    name: "time",
                                    value: timeValue,
                                  },
                                })
                              }
                            >
                              <Clock size={14} />
                              <span>{formatTime(startTime)}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="aformx-section">
            <h4 className="aformx-section-title">
              <AlignLeft size={16} />
              Additional Information
            </h4>

            <div className="aformx-form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Add any special requests or notes for this appointment"
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Form actions */}
          <div className="aformx-form-actions">
            <button
              type="button"
              className="aformx-cancel-button"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="aformx-submit-button"
              disabled={
                isLoading ||
                !formData.contactId ||
                !formData.serviceId ||
                !formData.date ||
                !formData.time
              }
            >
              {isLoading
                ? rescheduleMode
                  ? "Rescheduling..."
                  : "Scheduling..."
                : rescheduleMode
                ? "Reschedule Appointment"
                : "Schedule Appointment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AppointmentForm;
