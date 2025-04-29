// src/components/crm/EnhancedReportsSection.jsx
import React, { useState, useEffect } from "react";
import {
  BarChart2,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  CreditCard,
  Package,
  Tag,
  Clock,
} from "lucide-react";
import CRMReportViewer from "./CRMReportViewer";
import reportsApiService from "../../services/reportsApiService";
import zenotiService from "../../services/zenotiService";
import "./EnhancedReportsSection.css";

/**
 * Enhanced CRM Reports Dashboard with improved UI and error handling
 */
const EnhancedReportsSection = ({
  selectedCenter,
  connectionStatus,
  onRefresh,
}) => {
  // State for centers, loading, errors
  const [centers, setCenters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // State for report options
  const [reportType, setReportType] = useState("sales_accrual");
  const [dateRange, setDateRange] = useState({
    startDate: getDateBefore(30),
    endDate: new Date().toISOString().split("T")[0],
  });

  // State for filters
  const [showFilters, setShowFilters] = useState(false);
  const [itemType, setItemType] = useState("All");
  const [status, setStatus] = useState("All");
  const [paymentMode, setPaymentMode] = useState("All");

  // State for report data and viewer
  const [reportData, setReportData] = useState(null);
  const [showReportViewer, setShowReportViewer] = useState(false);

  // Predefined date ranges
  const DATE_PRESETS = [
    {
      label: "Today",
      getValue: () => [formatDate(new Date()), formatDate(new Date())],
    },
    {
      label: "Yesterday",
      getValue: () => [
        formatDate(getDateBefore(1)),
        formatDate(getDateBefore(1)),
      ],
    },
    {
      label: "Last 7 days",
      getValue: () => [formatDate(getDateBefore(6)), formatDate(new Date())],
    },
    {
      label: "Last 30 days",
      getValue: () => [formatDate(getDateBefore(29)), formatDate(new Date())],
    },
    {
      label: "This month",
      getValue: () => [
        formatDate(getStartOfMonth()),
        formatDate(getEndOfMonth()),
      ],
    },
    {
      label: "Last month",
      getValue: () => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return [
          formatDate(getStartOfMonth(date)),
          formatDate(getEndOfMonth(date)),
        ];
      },
    },
  ];

  // Report types configuration
  const REPORT_TYPES = [
    {
      id: "sales_accrual",
      label: "Sales Report",
      icon: <BarChart2 size={18} />,
      description: "Revenue recognized when services are performed",
    },
    {
      id: "appointments",
      label: "Appointments",
      icon: <Calendar size={18} />,
      description: "List of all appointments in the specified date range",
    },
    {
      id: "packages",
      label: "Packages",
      icon: <Package size={18} />,
      description: "Available service packages and their details",
    },
    {
      id: "collections",
      label: "Collections",
      icon: <CreditCard size={18} />,
      description: "Payment collections broken down by type",
    },
    {
      id: "services",
      label: "Services",
      icon: <Tag size={18} />,
      description: "Available services and their details",
    },
  ];

  // Load centers when component mounts or when connection status/selectedCenter changes
  useEffect(() => {
    if (connectionStatus?.connected) {
      loadCenters();
    }
  }, [connectionStatus?.connected]);

  // Auto-hide success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load centers from API
  const loadCenters = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await zenotiService.getCenters();

      if (response.data?.success) {
        setCenters(response.data.centers || []);
        showNotification(
          `${response.data.centers.length} centers loaded`,
          "success"
        );
      } else {
        setError("Failed to load centers");
      }
    } catch (err) {
      console.error("Error loading centers:", err);
      setError("Failed to load centers");
    } finally {
      setIsLoading(false);
    }
  };

  // Notification handler
  const showNotification = (message, type = "info") => {
    if (type === "error") {
      setError(message);
      setSuccess(null);
    } else {
      setSuccess(message);
      setError(null);
    }
  };

  // Handle date range selection
  const handleDateRangePreset = (preset) => {
    const [start, end] = preset.getValue();
    setDateRange({ startDate: start, endDate: end });
  };

  // Generate report based on selected options
  // Generate report based on selected options
  const generateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);

    try {
      let response;
      // Prepare parameters according to the API documentation
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        centerCode: selectedCenter,
        // Add timestamp to prevent caching
        _t: Date.now(),
      };

      // Add filters if they're not set to "All"
      if (itemType !== "All") params.itemType = itemType;
      if (status !== "All") params.status = status;
      if (paymentMode !== "All") params.paymentMode = paymentMode;

      console.log(`Generating ${reportType} report with params:`, params);

      // Make appropriate API call based on report type
      switch (reportType) {
        case "sales_accrual":
          response = await reportsApiService.getSalesReport(params);
          break;
        case "appointments":
          response = await reportsApiService.getAppointmentsReport(params);
          break;
        case "packages":
          response = await reportsApiService.getPackagesReport(params);
          break;
        case "collections":
          response = await reportsApiService.getCollectionsReport(params);
          break;
        case "services":
          response = await reportsApiService.getServicesReport(params);
          break;
        default:
          response = await reportsApiService.getSalesReport(params);
      }

      console.log(`${reportType} report response:`, response);

      // Check if the response has the expected format
      if (response && response.data) {
        let isSuccess = response.data.success !== false; // Consider undefined as success too

        // Process the report data based on type
        const data = processReportData(response.data, reportType);

        if (data) {
          setReportData(data);
          setShowReportViewer(true);
          showNotification("Report generated successfully", "success");
        } else {
          setError("No data found in report response");
        }
      } else {
        setError(
          response?.data?.error || "Failed to generate report: Invalid response"
        );
      }
    } catch (err) {
      console.error("Error generating report:", err);
      setError(
        "Failed to generate report: " + (err.message || "Unknown error")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Process report data based on type
  const processReportData = (responseData, type) => {
    switch (type) {
      case "sales_accrual":
        return responseData.report || responseData;
      case "appointments":
        return { appointments: responseData.appointments || [] };
      case "packages":
        return responseData.packages || [];
      case "collections":
        return responseData.report || responseData;
      case "services":
        return responseData.services || [];
      default:
        return responseData;
    }
  };

  // Export report
  const handleExport = async (format) => {
    try {
      setIsLoading(true);

      if (!reportData) {
        setError("No report data to export");
        return;
      }

      // Prepare filename with date range
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${reportType}-${selectedCenter}-${timestamp}`;

      await reportsApiService.generateReportFile(reportData, format, filename);

      showNotification(
        `Report exported successfully as ${format.toUpperCase()}`,
        "success"
      );
    } catch (err) {
      console.error("Error exporting report:", err);
      setError("Failed to export report: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="enhanced-reports-section">
      <div className="section-header">
        <h2>
          <BarChart2 className="header-icon" />
          Zenoti Reports
        </h2>
        <div className="header-actions">
          <button
            className="refresh-button"
            onClick={loadCenters}
            disabled={isLoading || !connectionStatus?.connected}
          >
            <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!connectionStatus?.connected ? (
        <div className="not-connected-message">
          <Info size={48} />
          <h3>Not Connected to Zenoti</h3>
          <p>Please configure your Zenoti connection to access reports.</p>
        </div>
      ) : (
        <div className="reports-container">
          {/* Current Center Display */}
          <div className="current-center">
            <strong>Current Center:</strong> {selectedCenter}
          </div>

          {/* Report Type Selection */}
          <div className="report-type-selector">
            <h3>Select Report Type</h3>
            <div className="report-type-buttons">
              {REPORT_TYPES.map((report) => (
                <button
                  key={report.id}
                  className={`report-type-button ${
                    reportType === report.id ? "active" : ""
                  }`}
                  onClick={() => setReportType(report.id)}
                >
                  {report.icon}
                  <span>{report.label}</span>
                </button>
              ))}
            </div>

            <div className="report-description">
              <Info size={14} />
              <p>
                {REPORT_TYPES.find((r) => r.id === reportType)?.description}
              </p>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="date-range-section">
            <h3>Select Date Range</h3>

            <div className="date-range-presets">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="date-preset-button"
                  onClick={() => handleDateRangePreset(preset)}
                >
                  <Calendar size={14} />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="date-range-inputs">
              <div className="date-field">
                <label htmlFor="startDate">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="date-field">
                <label htmlFor="endDate">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="filters-section">
            <button
              className="filter-toggle-button"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              <span>Advanced Filters</span>
              {showFilters ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>

            {showFilters && (
              <div className="filter-controls">
                {/* Show different filters based on report type */}
                {["sales_accrual", "sales_cash"].includes(reportType) && (
                  <div className="filter-group">
                    <label htmlFor="itemType">Item Type</label>
                    <select
                      id="itemType"
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                    >
                      <option value="All">All Item Types</option>
                      <option value="Service">Services</option>
                      <option value="Product">Products</option>
                      <option value="Package">Packages</option>
                      <option value="Membership">Memberships</option>
                    </select>
                  </div>
                )}

                {["appointments"].includes(reportType) && (
                  <div className="filter-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="CheckedIn">Checked In</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="NoShow">No Show</option>
                    </select>
                  </div>
                )}

                {["collections", "sales_cash"].includes(reportType) && (
                  <div className="filter-group">
                    <label htmlFor="paymentMode">Payment Method</label>
                    <select
                      id="paymentMode"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                    >
                      <option value="All">All Payment Methods</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit/Debit Card</option>
                      <option value="GiftCard">Gift Card</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {success && (
            <div className="success-message">
              <Info size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="reports-action-buttons">
            <button
              className="generate-report-btn"
              onClick={generateReport}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spinning" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <BarChart2 size={16} />
                  <span>Generate Report</span>
                </>
              )}
            </button>

            <button
              className="export-btn"
              onClick={() => handleExport("csv")}
              disabled={isLoading || !reportData}
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Report Viewer */}
          {showReportViewer && reportData && (
            <div className="report-viewer-modal">
              <CRMReportViewer
                reportData={reportData}
                reportType={reportType}
                dateRange={dateRange}
                centerCode={selectedCenter}
                onClose={() => setShowReportViewer(false)}
                onExport={handleExport}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper functions for date handling
function formatDate(date) {
  if (!date) return "";

  // Handle string dates that are already in YYYY-MM-DD format
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateBefore(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function getStartOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  return d;
}

function getEndOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

export default EnhancedReportsSection;
