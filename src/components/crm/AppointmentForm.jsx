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
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsFetched, setSlotsFetched] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    contactId: initialContact?.id || "",
    contactName: initialContact?.name || "",
    serviceId: "",
    staffId: "",
    date: new Date().toISOString().split("T")[0], // Today's date
    time: "",
    notes: "",
  });

  // States for contact lookup
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showContactSearch, setShowContactSearch] = useState(!initialContact);

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

        const slots = await zenotiService.getAvailableSlots(params);

        setAvailableSlots(slots.slots || []);
        setSlotsFetched(true);

        if (!slots.slots || slots.slots.length === 0) {
          console.log("No slots available for the selected criteria:", params);
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

      // Create appointment data
      const appointmentData = {
        guestId: formData.contactId,
        serviceId: formData.serviceId,
        therapistId: formData.staffId,
        startTime: `${formData.date}T${formData.time}`,
        notes: formData.notes,
      };

      // Book appointment
      const response = await zenotiService.bookAppointment(
        appointmentData,
        effectiveCenterCode
      );

      if (response.data?.success) {
        setSuccess(true);

        // Call success callback after a short delay
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(response.data.appointment);
          }
        }, 1500);
      } else {
        setError(response.data?.error || "Failed to create appointment.");
      }
    } catch (err) {
      console.error("Error creating appointment:", err);
      setError(
        err.message || "Failed to create appointment. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="appointment-form-container">
      {/* Error message */}
      {error && (
        <div className="form-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Success message */}
      {success ? (
        <div className="form-success">
          <Check size={16} />
          <span>Appointment successfully scheduled!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="appointment-form">
          {/* Contact selection */}
          <div className="form-section">
            <h4 className="section-title">
              <User size={16} />
              Client Information
            </h4>

            {showContactSearch ? (
              <div className="contact-search">
                <div className="search-field">
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
                    className="search-button"
                    onClick={handleContactSearch}
                    disabled={isLoading || !searchTerm}
                  >
                    Search
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((contact) => (
                      <div
                        key={contact.id}
                        className="search-result-item"
                        onClick={() => handleSelectContact(contact)}
                      >
                        <div className="contact-name">{contact.name}</div>
                        <div className="contact-details">
                          {contact.email && <span>{contact.email}</span>}
                          {contact.phone && <span>{contact.phone}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm && searchResults.length === 0 && !isLoading && (
                  <div className="no-results">No contacts found</div>
                )}
              </div>
            ) : (
              <div className="selected-contact">
                <div className="contact-info">
                  <span className="contact-name">{formData.contactName}</span>
                </div>
                <button
                  type="button"
                  className="change-contact"
                  onClick={() => setShowContactSearch(true)}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Service selection */}
          <div className="form-section">
            <h4 className="section-title">
              <Tag size={16} />
              Service Details
            </h4>

            <div className="form-group">
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
              <div className="form-group">
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
                  <div className="help-text">
                    No staff members available for this service
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date and time selection */}
          <div className="form-section">
            <h4 className="section-title">
              <Calendar size={16} />
              Date & Time
            </h4>

            <div className="form-group">
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
              <div className="form-group">
                <label htmlFor="time">Time *</label>
                {slotsFetched && availableSlots.length === 0 ? (
                  <div className="no-slots">
                    No available slots for the selected date
                  </div>
                ) : (
                  <div className="time-slots">
                    {isLoading ? (
                      <div className="loading-slots">
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
                              className={`time-slot ${
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
          <div className="form-section">
            <h4 className="section-title">
              <AlignLeft size={16} />
              Additional Information
            </h4>

            <div className="form-group">
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
          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={
                isLoading ||
                !formData.contactId ||
                !formData.serviceId ||
                !formData.date ||
                !formData.time
              }
            >
              {isLoading ? "Scheduling..." : "Schedule Appointment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AppointmentForm;
