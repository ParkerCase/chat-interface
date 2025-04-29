import React, { useState, useEffect } from "react";
import {
  Download,
  Printer,
  BarChart4,
  RefreshCw,
  Calendar,
  FileText,
  Info,
  Package,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  List,
  CreditCard,
  DollarSign,
  XCircle,
  Clock,
  User,
  MapPin,
  Tag,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import CRMReportViewer from "./CRMReportViewer";
import "./CRMReportsDashboard.css";

// Date utility functions (no external dependencies)
const dateUtils = {
  // Format date as YYYY-MM-DD
  formatDate: (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  // Subtract days from date
  subDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  },

  // Get first day of month
  startOfMonth: (date) => {
    const result = new Date(date);
    result.setDate(1);
    return result;
  },

  // Get last day of month
  endOfMonth: (date) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    return result;
  },

  // Get first day of week (Sunday)
  startOfWeek: (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return result;
  },

  // Get last day of week (Saturday)
  endOfWeek: (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (6 - day));
    return result;
  },

  // Calculate days between two dates
  daysBetween: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  },
};

// Predefined date ranges
const DATE_RANGES = [
  { label: "Today", getValue: () => [new Date(), new Date()] },
  {
    label: "Yesterday",
    getValue: () => [
      dateUtils.subDays(new Date(), 1),
      dateUtils.subDays(new Date(), 1),
    ],
  },
  {
    label: "Last 7 days",
    getValue: () => [dateUtils.subDays(new Date(), 6), new Date()],
  },
  {
    label: "Last 30 days",
    getValue: () => [dateUtils.subDays(new Date(), 29), new Date()],
  },
  {
    label: "This month",
    getValue: () => [
      dateUtils.startOfMonth(new Date()),
      dateUtils.endOfMonth(new Date()),
    ],
  },
  {
    label: "Last month",
    getValue: () => {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      return [dateUtils.startOfMonth(date), dateUtils.endOfMonth(date)];
    },
  },
  {
    label: "This week",
    getValue: () => [
      dateUtils.startOfWeek(new Date()),
      dateUtils.endOfWeek(new Date()),
    ],
  },
];

// Report types configuration
const REPORT_TYPES = [
  {
    id: "sales_accrual",
    label: "Sales (Accrual Basis)",
    description:
      "Revenue recognized when services are performed, regardless of when payment is received",
    supportedFilters: ["centerIds", "itemTypes", "status"],
    maxDateRange: 31, // 31 days max date range
  },
  {
    id: "sales_cash",
    label: "Sales (Cash Basis)",
    description:
      "Revenue recognized when payment is received, regardless of when services are performed",
    supportedFilters: ["centerIds", "paymentModes", "status"],
    maxDateRange: 31, // 31 days max date range
  },
  {
    id: "appointments",
    label: "Appointments",
    description:
      "Detailed list of all appointments in the specified date range",
    supportedFilters: ["centerIds", "status", "appointmentSources"],
    maxDateRange: 31, // 31 days max date range
  },
  {
    id: "collections",
    label: "Collections",
    description: "Payment collections broken down by type and center",
    supportedFilters: ["centerIds", "paymentModes"],
    maxDateRange: 31, // 31 days max date range
  },
];

// Filter options
const ITEM_TYPES = [
  { value: "All", label: "All Item Types" },
  { value: "Service", label: "Services" },
  { value: "Product", label: "Products" },
  { value: "Package", label: "Packages" },
  { value: "Membership", label: "Memberships" },
  { value: "GiftCard", label: "Gift Cards" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "Booked", label: "Booked" },
  { value: "CheckedIn", label: "Checked In" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "NoShow", label: "No Show" },
];

const PAYMENT_MODES = [
  { value: "All", label: "All Payment Methods" },
  { value: "Cash", label: "Cash" },
  { value: "Credit Card", label: "Credit Card" },
  { value: "Debit Card", label: "Debit Card" },
  { value: "Gift Card", label: "Gift Card" },
  { value: "Mobile Payment", label: "Mobile Payment" },
];

const APPOINTMENT_SOURCES = [
  { value: "All", label: "All Sources" },
  { value: "Website", label: "Website" },
  { value: "MobileApp", label: "Mobile App" },
  { value: "Reception", label: "Reception" },
  { value: "Phone", label: "Phone" },
  { value: "WalkIn", label: "Walk In" },
];

// Known center IDs - hardcoded for reliability
const CENTER_IDS = {
  Clearwater: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
  Chicago: "c359afac-3210-49e5-a930-6676d8bb188a",
  // Add other centers as needed
};

/**
 * Enhanced CRM Reports Dashboard that incorporates the ZenotiReportsDashboard functionality
 * with fixes for center ID handling and date validation
 */
const EnhancedCRMReportsDashboard = ({
  selectedCenter,
  connectionStatus,
  onRefresh,
}) => {
  // State management
  const [centers, setCenters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeReport, setActiveReport] = useState(REPORT_TYPES[0].id);
  const [startDate, setStartDate] = useState(dateUtils.subDays(new Date(), 6));
  const [endDate, setEndDate] = useState(new Date());
  const [reportData, setReportData] = useState(null);
  const [reportTab, setReportTab] = useState(0);
  const [itemType, setItemType] = useState("All");
  const [status, setStatus] = useState("All");
  const [paymentMode, setPaymentMode] = useState("All");
  const [appointmentSource, setAppointmentSource] = useState("All");
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportSize, setReportSize] = useState(100);
  const [hasMoreData, setHasMoreData] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Load centers when component mounts or center code changes
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected) {
      loadCenters();
    }
  }, [selectedCenter, connectionStatus?.connected]);

  // Load centers from API
  const loadCenters = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Fetching Zenoti centers");
      const response = await zenotiService.getCenters();

      if (response.data?.success) {
        setCenters(response.data.centers || []);
        showNotification(
          `Loaded ${response.data.centers.length} centers`,
          "success"
        );
      } else {
        console.warn("Failed to load centers:", response.data);
        setError("Failed to load centers. Please try refreshing the page.");
        showNotification("Failed to load centers", "error");
      }
    } catch (err) {
      console.error("Error loading centers:", err);
      setError("Failed to load centers. Please try refreshing the page.");
      showNotification("Failed to load centers", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Get center ID - using hardcoded IDs for reliability
  const getCenterId = (centerName) => {
    // First, try the hardcoded mapping
    if (CENTER_IDS[centerName]) {
      return CENTER_IDS[centerName];
    }

    // If not found, look through loaded centers
    const center = centers.find(
      (c) => c.name === centerName || c.code === centerName
    );

    if (center && (center.id || center.center_id)) {
      return center.id || center.center_id;
    }

    // If still not found, use the center name directly
    console.warn(
      `Could not find center ID for "${centerName}", using name directly`
    );
    return centerName;
  };

  // Format date for API requests
  const formatDate = (date) => {
    return dateUtils.formatDate(date);
  };

  // Show notification
  const showNotification = (message, type = "info") => {
    if (type === "error") {
      setError(message);
      setSuccess(null);
    } else {
      setSuccess(message);
      setError(null);
    }

    // Auto-hide success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    }
  };

  // Handle date range selection
  const handleDateRangeChange = (range) => {
    const [start, end] = range.getValue();
    setStartDate(start);
    setEndDate(end);
  };

  // Get selected report configuration
  const getSelectedReport = () => {
    return REPORT_TYPES.find((report) => report.id === activeReport);
  };

  // Handle report type change
  const handleReportTypeChange = (reportId) => {
    setActiveReport(reportId);
    setReportData(null);
    setReportPage(1);
    setReportTab(0);
  };

  // Map status values to API values
  const mapStatusToApi = (statusValue) => {
    if (statusValue === "All") return null;

    // For appointments
    if (activeReport === "appointments") {
      switch (statusValue) {
        case "Booked":
          return [1];
        case "CheckedIn":
          return [2];
        case "Completed":
          return [3];
        case "Cancelled":
          return [4];
        case "NoShow":
          return [5];
        default:
          return [-1]; // All statuses
      }
    }

    // For other reports, use the status value directly
    return statusValue;
  };

  // Map appointment source to API values
  const mapAppointmentSourceToApi = (sourceValue) => {
    if (sourceValue === "All") return [-1]; // All sources

    switch (sourceValue) {
      case "Website":
        return [1];
      case "MobileApp":
        return [2];
      case "Reception":
        return [3];
      case "Phone":
        return [4];
      case "WalkIn":
        return [5];
      default:
        return [-1]; // All sources
    }
  };

  // Build report parameters based on selected filters
  const buildReportParams = () => {
    const reportConfig = getSelectedReport();
    const params = {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      page: reportPage,
      size: reportSize,
    };

    // Add center information - try to use center ID if available, otherwise use center code
    const centerId = getCenterId(selectedCenter);
    if (centerId) {
      params.center_ids = [centerId];
      // Also include center code as a fallback
      params.centerCode = selectedCenter;
    } else {
      params.centerCode = selectedCenter;
    }

    // Add filters based on report type
    if (
      reportConfig.supportedFilters.includes("itemTypes") &&
      itemType !== "All"
    ) {
      params.item_type = itemType;
      if (
        reportConfig.id === "sales_cash" ||
        reportConfig.id === "sales_accrual"
      ) {
        // Map to Zenoti's item type IDs
        const itemTypeMap = {
          Service: [1],
          Product: [2],
          Package: [3],
          Membership: [4],
          GiftCard: [5],
        };
        params.item_types = itemTypeMap[itemType] || [-1];
      }
    }

    if (reportConfig.supportedFilters.includes("status") && status !== "All") {
      const mappedStatus = mapStatusToApi(status);
      if (mappedStatus) {
        if (reportConfig.id === "appointments") {
          params.appointment_statuses = mappedStatus;
        } else if (reportConfig.id.startsWith("sales")) {
          params.invoice_statuses = [status === "Completed" ? 2 : 1]; // 2=completed, 1=open
        } else {
          params.status = status;
        }
      }
    }

    if (
      reportConfig.supportedFilters.includes("paymentModes") &&
      paymentMode !== "All"
    ) {
      params.payment_mode = paymentMode;
      if (reportConfig.id === "sales_cash") {
        // Map to Zenoti's payment type IDs
        const paymentTypeMap = {
          Cash: [1],
          "Credit Card": [2],
          "Debit Card": [3],
          "Gift Card": [4],
          "Mobile Payment": [5],
        };
        params.payment_types = paymentTypeMap[paymentMode] || [-1];
      }
    }

    if (
      reportConfig.supportedFilters.includes("appointmentSources") &&
      appointmentSource !== "All"
    ) {
      params.appointment_sources = mapAppointmentSourceToApi(appointmentSource);
    }

    return params;
  };

  // Generate report
  const generateReport = async () => {
    // Always allow date ranges to proceed, removing validation logic
    setIsLoading(true);
    setError(null);
    setReportData(null);

    try {
      const reportConfig = getSelectedReport();
      const params = buildReportParams();

      showNotification(`Generating ${reportConfig.label} report...`, "info");

      let response;

      // Different API calls based on report type
      switch (reportConfig.id) {
        case "sales_accrual":
          response = await zenotiService.getSalesAccrualReport(params);
          break;
        case "sales_cash":
          response = await zenotiService.getSalesCashReport(params);
          break;
        case "appointments":
          response = await zenotiService.getAppointmentsReport(params);
          break;
        default:
          // For other report types, use a generic report endpoint
          response = await zenotiService.getSalesReport(params);
          break;
      }

      if (response.data?.success) {
        // Process the report data
        const reportData =
          response.data.report ||
          response.data.sales ||
          response.data.appointments ||
          response.data.collections ||
          response.data.data ||
          response.data;

        setReportData(reportData);

        // Show the report viewer
        setShowReportViewer(true);

        // Check if there's more data (pagination)
        const total =
          reportData.totalCount ||
          reportData.transactions?.length ||
          reportData.items?.length ||
          reportData.appointments?.length ||
          0;

        setTotalRows(total);
        setHasMoreData(total > reportPage * reportSize);

        showNotification(
          `Report generated successfully with ${total} records`,
          "success"
        );

        // Track event for analytics
        analyticsUtils.trackEvent("zenoti:report_generated", {
          reportType: reportConfig.id,
          centerCode: selectedCenter,
          recordCount: total,
          dateRange: `${params.startDate} to ${params.endDate}`,
        });
      } else {
        setError(response.data?.error || "Failed to generate report");
        showNotification("Failed to generate report", "error");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      setError(
        err.response?.data?.error ||
          "Failed to generate report. Please try again."
      );
      showNotification(
        "Error generating report: " +
          (err.response?.data?.error || err.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Export report
  const exportReport = async (format) => {
    try {
      setDownloadLoading(true);
      setError(null);

      if (!reportData) {
        setError("No report data to export");
        return;
      }

      const fileName = `${activeReport}_${formatDate(
        startDate
      )}_to_${formatDate(endDate)}`;

      await zenotiService.generateReportFile(reportData, format, fileName);

      // Track export event
      analyticsUtils.trackEvent("zenoti:report_exported", {
        reportType: activeReport,
        format,
        dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
      });

      showNotification(
        `Report exported successfully as ${format.toUpperCase()}`,
        "success"
      );
    } catch (err) {
      console.error(`Error exporting report as ${format}:`, err);
      setError(`Failed to export report: ${err.message}`);
      showNotification(`Failed to export report as ${format}`, "error");
    } finally {
      setDownloadLoading(false);
    }
  };

  // Render filter controls
  const renderFilterControls = () => {
    return (
      <div className="filter-controls">
        {/* Basic date range controls */}
        <div className="date-range-controls">
          <div className="date-presets">
            {DATE_RANGES.map((range) => (
              <button
                key={range.label}
                className="date-preset-button"
                onClick={() => handleDateRangeChange(range)}
              >
                <Calendar size={14} />
                <span>{range.label}</span>
              </button>
            ))}
          </div>

          <div className="date-inputs">
            <div className="date-field">
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                id="startDate"
                value={formatDate(startDate)}
                onChange={(e) => setStartDate(new Date(e.target.value))}
              />
            </div>
            <div className="date-field">
              <label htmlFor="endDate">End Date:</label>
              <input
                type="date"
                id="endDate"
                value={formatDate(endDate)}
                onChange={(e) => setEndDate(new Date(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Advanced filters button */}
        <button
          className="advanced-filters-btn"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <Filter size={14} />
          <span>Advanced Filters</span>
          {showAdvancedFilters ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )}
        </button>

        {/* Advanced filters panel */}
        {showAdvancedFilters && (
          <div className="advanced-filters-panel">
            {/* Item Type Filter */}
            {getSelectedReport().supportedFilters.includes("itemTypes") && (
              <div className="filter-group">
                <label htmlFor="itemType">Item Type</label>
                <select
                  id="itemType"
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                >
                  {ITEM_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            {getSelectedReport().supportedFilters.includes("status") && (
              <div className="filter-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Mode Filter */}
            {getSelectedReport().supportedFilters.includes("paymentModes") && (
              <div className="filter-group">
                <label htmlFor="paymentMode">Payment Method</label>
                <select
                  id="paymentMode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  {PAYMENT_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Appointment Source Filter */}
            {getSelectedReport().supportedFilters.includes(
              "appointmentSources"
            ) && (
              <div className="filter-group">
                <label htmlFor="appointmentSource">Appointment Source</label>
                <select
                  id="appointmentSource"
                  value={appointmentSource}
                  onChange={(e) => setAppointmentSource(e.target.value)}
                >
                  {APPOINTMENT_SOURCES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="reports-section">
      <div className="section-header">
        <h3>Zenoti Reports Dashboard</h3>
        <div className="report-actions">
          <button
            className="refresh-button"
            onClick={loadCenters}
            disabled={isLoading}
          >
            <RefreshCw size={14} />
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
        <div className="report-container">
          {/* Current Center Display */}
          <div className="current-center">
            <strong>Current Center:</strong> {selectedCenter}
            {CENTER_IDS[selectedCenter] && (
              <span className="center-id">
                ID: {CENTER_IDS[selectedCenter]}
              </span>
            )}
          </div>

          {/* Report Type Selection */}
          <div className="report-type-selector">
            <h4>Select Report Type</h4>
            <div className="report-type-buttons">
              {REPORT_TYPES.map((report) => (
                <button
                  key={report.id}
                  className={`report-type-button ${
                    activeReport === report.id ? "active" : ""
                  }`}
                  onClick={() => handleReportTypeChange(report.id)}
                >
                  {report.id.startsWith("sales") ? (
                    <DollarSign size={16} />
                  ) : report.id === "appointments" ? (
                    <Calendar size={16} />
                  ) : report.id === "collections" ? (
                    <CreditCard size={16} />
                  ) : (
                    <BarChart4 size={16} />
                  )}
                  <span>{report.label}</span>
                </button>
              ))}
            </div>

            {getSelectedReport() && (
              <div className="report-description">
                <Info size={14} />
                <p>{getSelectedReport().description}</p>
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div className="filters-section">
            <h4>Report Filters</h4>
            {renderFilterControls()}
          </div>

          {/* Error message */}
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="success-message">
              <Info size={16} />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)}>Dismiss</button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="report-actions-container">
            <button
              className="generate-report-btn"
              onClick={generateReport}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spinning" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart4 size={16} />
                  Generate Report
                </>
              )}
            </button>

            <button
              className="export-csv-btn"
              onClick={() => exportReport("csv")}
              disabled={downloadLoading || !reportData}
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>

            <button
              className="export-pdf-btn"
              onClick={() => exportReport("pdf")}
              disabled={downloadLoading || !reportData}
            >
              <Download size={16} />
              <span>Export PDF</span>
            </button>
          </div>

          {/* Report Viewer Modal */}
          {showReportViewer && reportData && (
            <div className="report-viewer-modal">
              <CRMReportViewer
                reportData={reportData}
                reportType={activeReport.replace("_", "-")}
                dateRange={{
                  start: formatDate(startDate),
                  end: formatDate(endDate),
                }}
                centerCode={selectedCenter}
                onClose={() => setShowReportViewer(false)}
                onExport={exportReport}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedCRMReportsDashboard;
