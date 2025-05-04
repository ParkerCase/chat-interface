// src/components/zenoti/ZenotiPackagesSection.jsx
import React, { useState, useEffect } from "react";
import {
  Package,
  RefreshCw,
  Tag,
  Calendar,
  AlertCircle,
  Info,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./ZenotiPackagesSection.css";

/**
 * Component for displaying and managing Zenoti packages
 */
const ZenotiPackagesSection = ({
  selectedCenter,
  connectionStatus,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [packages, setPackages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPackageId, setExpandedPackageId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageDetails, setPackageDetails] = useState(null);

  // Load packages when the component mounts or center changes
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected) {
      loadPackages();
    }
  }, [selectedCenter, connectionStatus?.connected]);

  // Load packages from the API
  const loadPackages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Reset any selected package
      setSelectedPackage(null);
      setPackageDetails(null);

      console.log(`Loading packages for center: ${selectedCenter}`);
      const response = await zenotiService.getPackages({
        centerCode: selectedCenter,
      });

      if (response.data?.success) {
        const packagesData = response.data.packages || [];
        setPackages(packagesData);

        // Track for analytics
        analyticsUtils.trackEvent("zenoti:packages_loaded", {
          centerCode: selectedCenter,
          count: packagesData.length,
        });
      } else {
        throw new Error(response.data?.error || "Failed to load packages");
      }
    } catch (err) {
      console.error("Error loading packages:", err);
      setError(`Failed to load packages: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Get details for a specific package
  const loadPackageDetails = async (packageId) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`Loading package details for ID: ${packageId}`);
      const response = await zenotiService.getPackageDetails(
        packageId,
        selectedCenter
      );

      if (response.data?.success) {
        const packageData = response.data.package;
        setPackageDetails(packageData);

        // Track for analytics
        analyticsUtils.trackEvent("zenoti:package_details_loaded", {
          packageId,
          centerCode: selectedCenter,
        });
      } else {
        throw new Error(
          response.data?.error || "Failed to load package details"
        );
      }
    } catch (err) {
      console.error("Error loading package details:", err);
      setError(`Failed to load package details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle package selection
  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    loadPackageDetails(pkg.id);
  };

  // Toggle expanded state for a package
  const togglePackageExpansion = (packageId) => {
    setExpandedPackageId(expandedPackageId === packageId ? null : packageId);
  };

  // Filter packages by type
  const filterPackages = (packages) => {
    if (!packages) return [];

    // Apply search filter
    let filtered = packages;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((pkg) => {
        return (
          pkg.name?.toLowerCase().includes(term) ||
          pkg.description?.toLowerCase().includes(term) ||
          pkg.type?.toLowerCase().includes(term)
        );
      });
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((pkg) => {
        // Handle status filter
        if (filterType === "active") {
          return pkg.status?.toLowerCase() === "active";
        } else if (filterType === "inactive") {
          return pkg.status?.toLowerCase() !== "active";
        }

        // Handle type filter
        return pkg.type?.toLowerCase() === filterType.toLowerCase();
      });
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
          aValue = parseInt(a.validity_days) || 0;
          bValue = parseInt(b.validity_days) || 0;
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
  };

  // Get filtered packages
  const filteredPackages = filterPackages(packages);

  return (
    <div className="zp-packages-section">
      <div className="zp-packages-header">
        <h3>
          <Package size={20} className="zp-header-icon" />
          Zenoti Packages
        </h3>
        <div className="zp-header-actions">
          <button
            className="zp-refresh-button"
            onClick={loadPackages}
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
          <p>Please configure your Zenoti connection to access packages.</p>
        </div>
      ) : (
        <>
          <div className="zp-packages-toolbar">
            <div className="zp-search-container">
              <div className="zp-search-input-group">
                <Search size={16} className="zp-search-icon" />
                <input
                  type="text"
                  placeholder="Search packages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                  <label>Package Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="membership">Membership</option>
                    <option value="prepaid">Prepaid</option>
                    <option value="package">Package</option>
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

          {/* Packages display */}
          <div className="zp-packages-content">
            {isLoading && !packages.length ? (
              <div className="zp-loading-state">
                <RefreshCw size={24} className="zp-spinning" />
                <span>Loading packages...</span>
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="zp-empty-state">
                {searchTerm ? (
                  <p>No packages found matching "{searchTerm}"</p>
                ) : (
                  <p>No packages available for this center</p>
                )}
              </div>
            ) : (
              <div className="zp-packages-grid">
                {filteredPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`zp-package-card ${
                      selectedPackage?.id === pkg.id ? "selected" : ""
                    }`}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    <div className="zp-package-header">
                      <h4 className="zp-package-name">{pkg.name}</h4>
                      <span
                        className={`zp-package-status ${(
                          pkg.status || "active"
                        ).toLowerCase()}`}
                      >
                        {pkg.status || "Active"}
                      </span>
                    </div>

                    <div className="zp-package-details">
                      <div className="zp-package-detail">
                        <Tag size={14} />
                        <span>{pkg.type || "Standard Package"}</span>
                      </div>
                      <div className="zp-package-detail">
                        <DollarSign size={14} />
                        <span>{formatCurrency(pkg.price || 0)}</span>
                      </div>
                      <div className="zp-package-detail">
                        <Calendar size={14} />
                        <span>
                          {pkg.validity_days || pkg.validity || "N/A"} days
                        </span>
                      </div>
                    </div>

                    {pkg.description && (
                      <div className="zp-package-description">
                        <p>{pkg.description}</p>
                      </div>
                    )}

                    <div
                      className="zp-package-actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePackageExpansion(pkg.id);
                      }}
                    >
                      <button className="zp-view-details-button">
                        {expandedPackageId === pkg.id
                          ? "Hide Details"
                          : "View Details"}
                        {expandedPackageId === pkg.id ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </div>

                    {expandedPackageId === pkg.id && (
                      <div className="zp-expanded-details">
                        <h5>Package Contents</h5>
                        {pkg.services && pkg.services.length > 0 ? (
                          <div className="zp-services-list">
                            {pkg.services.map((service, index) => (
                              <div key={index} className="zp-service-item">
                                <div className="zp-service-name">
                                  {service.name}
                                </div>
                                <div className="zp-service-info">
                                  <span>Qty: {service.quantity || 1}</span>
                                  <span>
                                    Value: {formatCurrency(service.value || 0)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="zp-no-services-message">
                            No services information available
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected package details */}
          {selectedPackage && (
            <div className="zp-selected-package-panel">
              <div className="zp-panel-header">
                <h3>Package Details</h3>
                <button
                  className="zp-close-button"
                  onClick={() => setSelectedPackage(null)}
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
                ) : packageDetails ? (
                  <div className="zp-package-full-details">
                    <div className="zp-detail-section">
                      <h4>Basic Information</h4>
                      <div className="zp-details-grid">
                        <div className="zp-detail-item">
                          <span className="label">Name:</span>
                          <span className="value">{packageDetails.name}</span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Price:</span>
                          <span className="value">
                            {formatCurrency(packageDetails.price || 0)}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Type:</span>
                          <span className="value">
                            {packageDetails.type || "Standard"}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Status:</span>
                          <span
                            className={`value status ${(
                              packageDetails.status || "active"
                            ).toLowerCase()}`}
                          >
                            {packageDetails.status || "Active"}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Validity:</span>
                          <span className="value">
                            {packageDetails.validity_days ||
                              packageDetails.validity ||
                              "N/A"}{" "}
                            days
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">Start Date:</span>
                          <span className="value">
                            {packageDetails.start_date
                              ? new Date(
                                  packageDetails.start_date
                                ).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                        <div className="zp-detail-item">
                          <span className="label">End Date:</span>
                          <span className="value">
                            {packageDetails.end_date
                              ? new Date(
                                  packageDetails.end_date
                                ).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {packageDetails.description && (
                      <div className="zp-detail-section">
                        <h4>Description</h4>
                        <p className="zp-description-text">
                          {packageDetails.description}
                        </p>
                      </div>
                    )}

                    <div className="zp-detail-section">
                      <h4>Included Services</h4>
                      {packageDetails.services &&
                      packageDetails.services.length > 0 ? (
                        <table className="zp-services-table">
                          <thead>
                            <tr>
                              <th>Service Name</th>
                              <th>Quantity</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packageDetails.services.map((service, index) => (
                              <tr key={index}>
                                <td>{service.name}</td>
                                <td>{service.quantity || 1}</td>
                                <td>{formatCurrency(service.value || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="zp-no-data-message">
                          No services information available
                        </p>
                      )}
                    </div>

                    <div className="zp-detail-section">
                      <h4>Terms & Conditions</h4>
                      {packageDetails.terms_and_conditions ? (
                        <div className="zp-terms-content">
                          <p>{packageDetails.terms_and_conditions}</p>
                        </div>
                      ) : (
                        <p className="zp-no-data-message">
                          No terms and conditions available
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="zp-no-details-message">
                    <AlertCircle size={20} />
                    <p>Failed to load package details</p>
                    <button
                      onClick={() => loadPackageDetails(selectedPackage.id)}
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ZenotiPackagesSection;
