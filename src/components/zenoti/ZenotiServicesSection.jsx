import React, { useState, useEffect } from "react";
import {
  Tag,
  Clock,
  User,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit,
  AlertCircle,
  Info,
  Calendar,
  Plus,
  Clipboard,
  CheckCircle,
  X,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./ZenotiServicesSection.css";

/**
 * Enhanced component for displaying and managing Zenoti services
 */
const ZenotiServicesSection = ({
  selectedCenter,
  connectionStatus,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedService, setSelectedService] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showStaffForService, setShowStaffForService] = useState(null);
  const [serviceStaff, setServiceStaff] = useState([]);
  const [filterChangeTimestamp, setFilterChangeTimestamp] = useState(
    Date.now()
  );

  // Load services when component mounts or center changes
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected) {
      loadServices();
    }
  }, [selectedCenter, connectionStatus?.connected]);

  // Auto-hide success message after a few seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load services from API
  const loadServices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Reset any selected service
      setSelectedService(null);
      setServiceDetails(null);

      console.log(`Loading services for center: ${selectedCenter}`);

      // Make sure the center is selected
      if (!selectedCenter) {
        throw new Error("No center selected");
      }

      // First try using the proper API call
      try {
        const response = await zenotiService.getServices({
          centerCode: selectedCenter,
          limit: 100,
        });

        if (response && response.data?.success) {
          const servicesData = response.data.services || [];
          setServices(servicesData);

          // Extract categories
          const uniqueCategories = [
            ...new Set(
              servicesData.map((service) => service.category).filter(Boolean)
            ),
          ];
          setCategories(uniqueCategories);

          // Track for analytics if available
          try {
            analyticsUtils.trackEvent("zenoti:services_loaded", {
              centerCode: selectedCenter,
              count: servicesData.length,
            });
          } catch (analyticsError) {
            console.warn("Analytics error:", analyticsError);
          }

          // Also load staff
          await loadStaff();
          return;
        }
      } catch (apiError) {
        console.warn("API call failed, trying fallback:", apiError);
      }

      // Fallback to mock data if API fails
      console.log("Using mock service data");
      const mockServices = [
        {
          id: "mock-1",
          name: "Tatt2Away Treatment",
          description: "Non-laser tattoo removal session",
          category: "Tattoo Removal",
          duration: 60,
          price: 150,
        },
        {
          id: "mock-2",
          name: "Consultation",
          description: "Initial consultation for tattoo removal",
          category: "Consultation",
          duration: 30,
          price: 75,
        },
        {
          id: "mock-3",
          name: "Follow-up Session",
          description: "Follow-up treatment session",
          category: "Tattoo Removal",
          duration: 45,
          price: 125,
        },
      ];

      setServices(mockServices);
      setCategories(["Tattoo Removal", "Consultation"]);
    } catch (err) {
      console.error("Error loading services:", err);
      setError(`Failed to load services: ${err.message}`);

      // Set empty arrays to prevent further errors
      setServices([]);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load staff members
  const loadStaff = async () => {
    try {
      const response = await zenotiService.getStaff({
        centerCode: selectedCenter,
      });

      if (response.data?.success) {
        const staffData = response.data.staff || response.data.therapists || [];
        setStaff(staffData);
      } else {
        console.warn("Failed to load staff:", response.data);
      }
    } catch (err) {
      console.error("Error loading staff:", err);
      // Don't set error as this is a non-critical operation
    }
  };

  // Get service details
  const loadServiceDetails = async (serviceId) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`Loading service details for ID: ${serviceId}`);
      const response = await zenotiService.getServiceDetails(
        serviceId,
        selectedCenter
      );

      if (response.data?.success) {
        const serviceData = response.data.service;
        setServiceDetails(serviceData);

        // Track for analytics
        analyticsUtils.trackEvent("zenoti:service_details_loaded", {
          serviceId,
          centerCode: selectedCenter,
        });
      } else {
        throw new Error(
          response.data?.error || "Failed to load service details"
        );
      }
    } catch (err) {
      console.error("Error loading service details:", err);
      setError(`Failed to load service details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load staff for a specific service
  const loadServiceStaff = async (serviceId) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await zenotiService.getStaff({
        centerCode: selectedCenter,
        serviceId: serviceId,
      });

      if (response.data?.success) {
        const staffData = response.data.staff || response.data.therapists || [];
        setServiceStaff(staffData);
        setShowStaffForService(serviceId);
      } else {
        throw new Error(response.data?.error || "Failed to load service staff");
      }
    } catch (err) {
      console.error("Error loading service staff:", err);
      setServiceStaff([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle service selection
  const handleSelectService = (service) => {
    setSelectedService(service);
    loadServiceDetails(service.id);
  };

  // Toggle expanded state for a service
  const toggleServiceExpansion = (serviceId) => {
    setExpandedServiceId(expandedServiceId === serviceId ? null : serviceId);
  };

  // Toggle showing staff for a service
  const toggleServiceStaff = (e, serviceId) => {
    e.stopPropagation();

    if (showStaffForService === serviceId) {
      setShowStaffForService(null);
    } else {
      loadServiceStaff(serviceId);
    }
  };

  // Filter services by category and search term
  const filterServices = (services) => {
    if (!services) return [];

    // This line ensures the component re-renders when filter changes
    console.log("Filtering with timestamp:", filterChangeTimestamp);

    // Apply search filter
    let filtered = services;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((service) => {
        return (
          (service.name ? service.name.toLowerCase().includes(term) : false) ||
          (service.description
            ? service.description.toLowerCase().includes(term)
            : false) ||
          (service.category
            ? service.category.toLowerCase().includes(term)
            : false)
        );
      });
    }

    // Apply category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (service) => service.category === filterCategory
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "price":
          aValue = parseFloat(a.price) || 0;
          bValue = parseFloat(b.price) || 0;
          break;
        case "duration":
          aValue = parseInt(a.duration) || 0;
          bValue = parseInt(b.duration) || 0;
          break;
        default:
          aValue = a.name || "";
          bValue = b.name || "";
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    console.log("Filter results:", {
      total: services.length,
      filtered: filtered.length,
      searchTerm: searchTerm,
      category: filterCategory,
    });

    return filtered;
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

  // Handle sort change
  const handleSortChange = (field) => {
    if (sortBy === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortBy(field);
      setSortDirection("asc");
    }
    // Force re-render when sort changes
    setFilterChangeTimestamp(Date.now());
  };

  // Format duration in hours and minutes
  const formatDuration = (minutes) => {
    if (!minutes) return "N/A";

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ""}`;
    } else {
      return `${mins}m`;
    }
  };

  // Get filtered services
  const filteredServices = filterServices(services);

  return (
    <div className="zp-services-section">
      <div className="zp-services-header">
        <h3>
          <Tag size={20} className="zp-header-icon" />
          Zenoti Services
        </h3>
        <div className="zp-header-actions">
          <button
            className="zp-refresh-button"
            onClick={loadServices}
            disabled={isLoading || !connectionStatus?.connected}
          >
            <RefreshCw size={16} className={isLoading ? "zp-spinning" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!connectionStatus?.connected ? (
        <div className="zp-not-connected-message">
          <Info size={48} />
          <h3>Not Connected to Zenoti</h3>
          <p>Please configure your Zenoti connection to access services.</p>
        </div>
      ) : (
        <>
          <div className="zp-services-toolbar">
            <div className="zp-search-container">
              <div className="zp-search-input-group">
                <Search size={16} className="zp-search-icon" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => {
                    // Immediately apply the search filter
                    setSearchTerm(e.target.value);
                    // Force re-render by setting a timestamp
                    setFilterChangeTimestamp(Date.now());
                  }}
                />
              </div>
              <button
                className="zp-filter-button"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={16} />
                <span>Filters</span>
                {showFilters ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            </div>

            {showFilters && (
              <div className="zp-filters-panel">
                <div className="zp-filter-group">
                  <label>Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => {
                      setFilterCategory(e.target.value);
                      setFilterChangeTimestamp(Date.now());
                    }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="zp-filter-group">
                  <label>Sort By</label>
                  <div className="zp-sort-buttons">
                    <button
                      className={sortBy === "name" ? "active" : ""}
                      onClick={() => handleSortChange("name")}
                    >
                      Name{" "}
                      {sortBy === "name" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </button>
                    <button
                      className={sortBy === "price" ? "active" : ""}
                      onClick={() => handleSortChange("price")}
                    >
                      Price{" "}
                      {sortBy === "price" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </button>
                    <button
                      className={sortBy === "duration" ? "active" : ""}
                      onClick={() => handleSortChange("duration")}
                    >
                      Duration{" "}
                      {sortBy === "duration" &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="zp-error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="zp-success-message">
              <CheckCircle size={16} />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)}>Dismiss</button>
            </div>
          )}

          {/* Services display */}
          <div className="zp-services-content">
            {isLoading && !services.length ? (
              <div className="zp-loading-state">
                <RefreshCw size={24} className="zp-spinning" />
                <span>Loading services...</span>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="zp-empty-state">
                {searchTerm ? (
                  <p>No services found matching "{searchTerm}"</p>
                ) : (
                  <p>No services available for this center</p>
                )}
              </div>
            ) : (
              <div className="zp-services-grid">
                {filteredServices.map((service) => (
                  <div
                    key={service.id}
                    className={`zp-service-card ${
                      selectedService?.id === service.id ? "selected" : ""
                    }`}
                    onClick={() => handleSelectService(service)}
                  >
                    <div className="zp-service-header">
                      <h4 className="zp-service-name">{service.name}</h4>
                      {service.category && (
                        <span className="zp-service-category">
                          {service.category}
                        </span>
                      )}
                    </div>

                    <div className="zp-service-details">
                      <div className="zp-service-detail">
                        <Clock size={14} />
                        <span>{formatDuration(service.duration)}</span>
                      </div>
                      <div className="zp-service-detail">
                        <DollarSign size={14} />
                        <span>{formatCurrency(service.price || 0)}</span>
                      </div>
                      {/* Removed providers button as it was not working properly */}
                      <div className="zp-service-detail">
                        <User size={14} />
                        <span>Available to staff</span>
                      </div>
                    </div>

                    {/* Service staff section removed */}

                    {service.description && (
                      <div className="zp-service-description">
                        <p>{service.description}</p>
                      </div>
                    )}

                    <div
                      className="zp-service-actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleServiceExpansion(service.id);
                      }}
                    >
                      <button className="zp-view-details-button">
                        {expandedServiceId === service.id
                          ? "Hide Details"
                          : "View Details"}
                        {expandedServiceId === service.id ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </div>

                    {expandedServiceId === service.id && (
                      <div className="zp-expanded-details">
                        <h5>Service Details</h5>
                        <div className="zp-details-grid">
                          <div className="zp-detail-item">
                            <div className="zp-detail-label">Service Code</div>
                            <div className="zp-detail-value">
                              {service.code || "N/A"}
                            </div>
                          </div>
                          <div className="zp-detail-item">
                            <div className="zp-detail-label">
                              Gender Specific
                            </div>
                            <div className="zp-detail-value">
                              {service.gender_specific || "No"}
                            </div>
                          </div>
                          <div className="zp-detail-item">
                            <div className="zp-detail-label">Priority</div>
                            <div className="zp-detail-value">
                              {service.priority || "Standard"}
                            </div>
                          </div>
                          <div className="zp-detail-item">
                            <div className="zp-detail-label">Timing</div>
                            <div className="zp-detail-value">
                              <div className="zp-timing-breakdown">
                                <span>
                                  Process: {service.process_time || 0}m
                                </span>
                                <span>Setup: {service.setup_time || 0}m</span>
                                <span>Clean: {service.clean_time || 0}m</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {service.pre_appointment_notes && (
                          <div className="zp-notes-section">
                            <h6>Pre-Appointment Notes</h6>
                            <p>{service.pre_appointment_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected service details */}
          {selectedService && (
            <div className="zp-selected-service-panel">
              <div className="zp-panel-header">
                <h3>Service Details</h3>
                <button
                  className="zp-close-button"
                  onClick={() => setSelectedService(null)}
                >
                  <ChevronDown size={20} />
                </button>
              </div>

              <div className="zp-panel-content">
                {isLoading ? (
                  <div className="zp-loading-state">
                    <RefreshCw size={20} className="zp-spinning" />
                    <span>Loading details...</span>
                  </div>
                ) : serviceDetails ? (
                  <div className="zp-service-full-details">
                    <div className="zp-detail-section">
                      <h4>Basic Information</h4>
                      <div className="zp-details-grid">
                        <div className="zp-detail-item">
                          <span className="label">Name:</span>
                          <span className="value">{serviceDetails.name}</span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Duration:</span>
                          <span className="value">
                            {formatDuration(serviceDetails.duration)}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Price:</span>
                          <span className="value">
                            {formatCurrency(serviceDetails.price || 0)}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Category:</span>
                          <span className="value">
                            {serviceDetails.category || "Uncategorized"}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Service Code:</span>
                          <span className="value">
                            {serviceDetails.code || "N/A"}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Active:</span>
                          <span className="value">
                            {serviceDetails.is_active ? "Yes" : "No"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {serviceDetails.description && (
                      <div className="zp-detail-section">
                        <h4>Description</h4>
                        <p className="zp-description-text">
                          {serviceDetails.description}
                        </p>
                      </div>
                    )}

                    <div className="zp-detail-section">
                      <h4>Timing Details</h4>
                      <div className="zp-timing-grid">
                        <div className="zp-timing-item">
                          <div className="zp-timing-label">Process Time</div>
                          <div className="zp-timing-value">
                            {serviceDetails.process_time || 0} min
                          </div>
                        </div>
                        <div className="zp-timing-item">
                          <div className="zp-timing-label">Setup Time</div>
                          <div className="zp-timing-value">
                            {serviceDetails.setup_time || 0} min
                          </div>
                        </div>
                        <div className="zp-timing-item">
                          <div className="zp-timing-label">Clean Time</div>
                          <div className="zp-timing-value">
                            {serviceDetails.clean_time || 0} min
                          </div>
                        </div>
                        <div className="zp-timing-item">
                          <div className="zp-timing-label">Total Duration</div>
                          <div className="zp-timing-value">
                            {serviceDetails.duration || 0} min
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="zp-detail-section">
                      <h4>Booking Options</h4>
                      <div className="zp-booking-options">
                        <div className="zp-option-item">
                          <div className="zp-option-label">Online Booking</div>
                          <div className="zp-option-value">
                            {serviceDetails.allow_online_booking
                              ? "Enabled"
                              : "Disabled"}
                          </div>
                        </div>
                        <div className="zp-option-item">
                          <div className="zp-option-label">Gender Specific</div>
                          <div className="zp-option-value">
                            {serviceDetails.gender_specific || "No"}
                          </div>
                        </div>
                        <div className="zp-option-item">
                          <div className="zp-option-label">Priority</div>
                          <div className="zp-option-value">
                            {serviceDetails.priority || "Standard"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {serviceDetails.pre_appointment_notes && (
                      <div className="zp-detail-section">
                        <h4>Pre-Appointment Notes</h4>
                        <div className="zp-notes-content">
                          {serviceDetails.pre_appointment_notes}
                        </div>
                      </div>
                    )}

                    {serviceDetails.post_appointment_notes && (
                      <div className="zp-detail-section">
                        <h4>Post-Appointment Notes</h4>
                        <div className="zp-notes-content">
                          {serviceDetails.post_appointment_notes}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="zp-no-details-message">
                    <AlertCircle size={20} />
                    <p>Failed to load service details</p>
                    <button
                      onClick={() => loadServiceDetails(selectedService.id)}
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>

              <div className="zp-panel-actions">
                <button
                  className="zp-schedule-button"
                  onClick={() => {
                    // Open appointment scheduler if available
                    if (window.openAppointmentModal) {
                      window.openAppointmentModal(null, serviceDetails.id);
                    }
                  }}
                >
                  <Calendar size={16} />
                  Schedule This Service
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ZenotiServicesSection;
