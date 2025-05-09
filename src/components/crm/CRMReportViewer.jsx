// src/components/crm/CRMReportViewer.jsx - Improved version
import React, { useState, useEffect } from "react";
import {
  Download,
  Printer,
  X,
  BarChart2,
  RefreshCw,
  Mail,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  Package,
  Tag,
  Calendar,
  Clock,
  User,
  CreditCard,
  DollarSign,
} from "lucide-react";
import reportsApiService from "../../services/reportsApiService";
import "./ImprovedReportViewer.css";

/**
 * Enhanced CRM Report Viewer component
 */
const CRMReportViewer = ({
  reportData,
  reportType,
  dateRange,
  centerCode,
  onClose,
  onExport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    summary: true, // Start with summary expanded by default
    details: false,
  });
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Auto-hide success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Format currency properly with fallbacks for various data types
  const formatCurrency = (amount) => {
    // Handle string values with dollar signs or commas
    if (typeof amount === "string") {
      amount = parseFloat(amount.replace(/[^0-9.-]+/g, ""));
    }

    // Handle undefined, null, or NaN
    if (amount === undefined || amount === null || isNaN(amount)) {
      return "$0.00";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Handle export action with proper format
  const handleExport = async (format) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!reportData) {
        setError("No report data to export");
        return;
      }

      // If custom export handler is provided, use it
      if (onExport) {
        await onExport(format);
        setShowExportOptions(false);
        return;
      }

      // Default export behavior
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${reportType}-${centerCode}-${timestamp}`;

      await reportsApiService.generateReportFile(reportData, format, filename);

      setSuccess(`Report exported as ${format.toUpperCase()}`);
      setShowExportOptions(false);
    } catch (err) {
      console.error(`Error exporting report as ${format}:`, err);
      setError(`Failed to export report: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Email the report
  const handleEmailReport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Get recipient email
      const recipientEmail = prompt("Enter recipient email address:");

      if (!recipientEmail) {
        setIsLoading(false);
        return; // User cancelled
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        setError("Please enter a valid email address");
        setIsLoading(false);
        return;
      }

      // Prepare email data
      const emailData = {
        report_data: reportData,
        report_type: reportType,
        recipients: [recipientEmail],
        subject: `${getReportTypeLabel(
          reportType
        )} Report - ${formatDateDisplay(
          dateRange.startDate
        )} to ${formatDateDisplay(dateRange.endDate)}`,
        message: `Here is your ${getReportTypeLabel(
          reportType
        )} report for ${centerCode} from ${formatDateDisplay(
          dateRange.startDate
        )} to ${formatDateDisplay(dateRange.endDate)}.`,
      };

      // Send the email
      await reportsApiService.emailReport(emailData);
      setSuccess(`Report emailed to ${recipientEmail}`);
    } catch (err) {
      console.error("Error emailing report:", err);
      setError(`Failed to email report: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Print the report
  const handlePrint = () => {
    window.print();
  };

  // Get human-readable report type label
  const getReportTypeLabel = (type) => {
    const labels = {
      sales_accrual: "Sales",
      sales_cash: "Sales (Cash)",
      packages: "Packages",
      collections: "Collections",
      appointments: "Appointments",
      services: "Services",
    };

    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Format date for display
  const formatDateDisplay = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Render the appropriate report content based on type
  const renderReportContent = () => {
    if (!reportData) {
      return <div className="no-data-message">No report data available</div>;
    }

    try {
      console.log(`Rendering ${reportType} report with data:`, reportData);

      switch (reportType) {
        case "sales_accrual":
        case "sales_cash":
          return renderSalesReport();
        case "packages":
          return renderPackagesReport();
        case "collections":
          return renderCollectionsReport();
        case "appointments":
          return renderAppointmentsReport();
        case "services":
          return renderServicesReport();
        default:
          return (
            <div className="no-data-message">
              Unsupported report type: {reportType}
            </div>
          );
      }
    } catch (error) {
      console.error("Error rendering report content:", error);
      return (
        <div className="error-message">
          <AlertCircle size={24} />
          <p>Error rendering report: {error.message}</p>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      );
    }
  };

  // Render appointments report
  const renderAppointmentsReport = () => {
    const appointments = reportData.appointments || [];

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Appointments</h4>
            <div className="value">{appointments.length}</div>
          </div>
          <div className="summary-card">
            <h4>Date Range</h4>
            <div className="value">
              {formatDateDisplay(dateRange.startDate)} to{" "}
              {formatDateDisplay(dateRange.endDate)}
            </div>
          </div>
        </div>

        <div className="report-section">
          <div
            className="section-header"
            onClick={() => toggleSection("appointments")}
          >
            <h3>Appointment Details</h3>
            {expandedSections.appointments ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>

          {expandedSections.appointments && (
            <div className="section-content">
              {appointments.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Client</th>
                      <th>Service</th>
                      <th>Provider</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment, index) => {
                      // Extract client name with fallbacks
                      const clientName =
                        typeof appointment.client_name === "string"
                          ? appointment.client_name
                          : appointment.client_name &&
                            typeof appointment.client_name === "object"
                          ? appointment.client_name.displayName ||
                            "Unknown Client"
                          : appointment.guest_name || "Unknown Client";

                      // Extract service name with fallbacks
                      const serviceName =
                        typeof appointment.service_name === "string"
                          ? appointment.service_name
                          : appointment.service_name &&
                            typeof appointment.service_name === "object"
                          ? appointment.service_name.name || "Unknown Service"
                          : appointment.service
                          ? appointment.service.name
                          : "Unknown Service";

                      // Extract provider name with fallbacks
                      const providerName =
                        typeof appointment.therapist === "string"
                          ? appointment.therapist
                          : appointment.therapist &&
                            typeof appointment.therapist === "object"
                          ? appointment.therapist.displayName ||
                            (appointment.therapist.firstName &&
                            appointment.therapist.lastName
                              ? `${appointment.therapist.firstName} ${appointment.therapist.lastName}`
                              : "Unknown Provider")
                          : "Unknown Provider";

                      // Extract status with fallbacks
                      const status =
                        typeof appointment.status === "string"
                          ? appointment.status
                          : appointment.status &&
                            typeof appointment.status === "object"
                          ? appointment.status.name || "Booked"
                          : "Booked";

                      // Format date & time
                      const startTime =
                        appointment.start_time ||
                        appointment.startTime ||
                        appointment.start_date;
                      const formattedDateTime = startTime
                        ? `${new Date(
                            startTime
                          ).toLocaleDateString()} ${new Date(
                            startTime
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "N/A";

                      return (
                        <tr key={`appointment-viewer-${appointment.id || ''}-${index}`}>
                          <td>{formattedDateTime}</td>
                          <td>{clientName}</td>
                          <td>{serviceName}</td>
                          <td>{providerName}</td>
                          <td>
                            <span
                              className={`status-badge ${status.toLowerCase()}`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="no-data-message">
                  <p>No appointments found for the selected period</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render packages report
  const renderPackagesReport = () => {
    console.log("Rendering packages report with data:", reportData);

    // Ensure packages is an array with multiple fallbacks
    const packages = Array.isArray(reportData)
      ? reportData
      : reportData.packages || reportData.items || [];

    console.log("Processed packages array:", packages);

    // Calculate summary data with safety checks
    const activePackages = packages.filter(
      (p) => p && p.status && p.status.toLowerCase() === "active"
    ).length;

    const totalPrice = packages.reduce((sum, p) => {
      // Handle various price formats safely
      let price = 0;
      if (p && p.price) {
        if (typeof p.price === "number") {
          price = p.price;
        } else if (typeof p.price === "string") {
          // Remove currency symbols and parse
          price = parseFloat(p.price.replace(/[^0-9.-]+/g, ""));
        }
      }
      return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const avgPrice = packages.length > 0 ? totalPrice / packages.length : 0;

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Packages</h4>
            <div className="value">{packages.length}</div>
          </div>
          <div className="summary-card">
            <h4>Active Packages</h4>
            <div className="value">{activePackages}</div>
          </div>
          <div className="summary-card">
            <h4>Average Price</h4>
            <div className="value">{formatCurrency(avgPrice)}</div>
          </div>
        </div>

        <div className="report-section">
          <div
            className="section-header"
            onClick={() => toggleSection("packageDetails")}
          >
            <h3>Package Details</h3>
            {expandedSections.packageDetails ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>

          {expandedSections.packageDetails && (
            <div className="section-content">
              {packages.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Validity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg, index) => (
                      <tr key={pkg.id || index}>
                        <td>{pkg.name}</td>
                        <td>{pkg.type || "Standard"}</td>
                        <td>{formatCurrency(pkg.price || 0)}</td>
                        <td>
                          {pkg.validity_days || pkg.validity || "N/A"} days
                        </td>
                        <td>
                          <span
                            className={`status-badge ${(
                              pkg.status || ""
                            ).toLowerCase()}`}
                          >
                            {pkg.status || "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data-message">
                  <p>No packages available</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="report-section">
          <div
            className="section-header"
            onClick={() => toggleSection("packageServices")}
          >
            <h3>Package Services</h3>
            {expandedSections.packageServices ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>

          {expandedSections.packageServices && (
            <div className="section-content">
              {packages.some(
                (pkg) => pkg.services && pkg.services.length > 0
              ) ? (
                <div className="package-services-container">
                  {packages.map((pkg, pkgIndex) =>
                    pkg.services && pkg.services.length > 0 ? (
                      <div
                        key={`pkg-services-${pkgIndex}`}
                        className="package-services-group"
                      >
                        <h4>{pkg.name}</h4>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Service</th>
                              <th>Quantity</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pkg.services.map((service, svcIndex) => (
                              <tr key={`service-${service.id || service.name}-${pkgIndex}-${svcIndex}`}>
                                <td>{service.name}</td>
                                <td>{service.quantity || 1}</td>
                                <td>{formatCurrency(service.value || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <div className="no-data-message">
                  <p>No service details available for these packages</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render collections report
  const renderCollectionsReport = () => {
    const summary = reportData.summary || {};
    const paymentTypes = reportData.payment_types || {};
    const transactions = reportData.transactions || [];

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Collected</h4>
            <div className="value">
              {formatCurrency(summary.total_collected || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Cash Collections</h4>
            <div className="value">
              {formatCurrency(summary.total_collected_cash || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Non-Cash Collections</h4>
            <div className="value">
              {formatCurrency(summary.total_collected_non_cash || 0)}
            </div>
          </div>
        </div>

        <div className="report-section">
          <div
            className="section-header"
            onClick={() => toggleSection("paymentTypes")}
          >
            <h3>Payment Types</h3>
            {expandedSections.paymentTypes ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>

          {expandedSections.paymentTypes && (
            <div className="section-content">
              {Object.keys(paymentTypes).length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment Type</th>
                      <th>Amount</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(paymentTypes)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, amount], index) => {
                        const percentage = summary.total_collected
                          ? (amount / summary.total_collected) * 100
                          : 0;

                        return (
                          <tr key={`payment-type-${type}`}>
                            <td>{type}</td>
                            <td>{formatCurrency(amount)}</td>
                            <td>{percentage.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              ) : (
                <div className="no-data-message">
                  <p>No payment type breakdown available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("transactions")}
            >
              <h3>Transactions</h3>
              {expandedSections.transactions ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.transactions && (
              <div className="section-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt #</th>
                      <th>Client</th>
                      <th>Payment Type</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => {
                      const date =
                        transaction.date || transaction.transaction_date;
                      
                      // Create a more reliable key by combining id with index
                      const transactionKey = transaction.id || transaction.receipt_number || `trans-${date}-${index}`;

                      return (
                        <tr key={transactionKey}>
                          <td>
                            {date ? new Date(date).toLocaleDateString() : "N/A"}
                          </td>
                          <td>
                            {transaction.receipt_number ||
                              transaction.id ||
                              "-"}
                          </td>
                          <td>
                            {transaction.client_name ||
                              transaction.guest_name ||
                              "-"}
                          </td>
                          <td>
                            {transaction.payment_type ||
                              transaction.payment_method ||
                              "-"}
                          </td>
                          <td>{formatCurrency(transaction.amount || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render sales report
  const renderSalesReport = () => {
    console.log("Rendering sales report with data:", reportData);

    // Make sure we have valid data with appropriate fallbacks
    const summary = reportData?.summary || {};
    const items = reportData?.items || [];
    const centers = reportData?.centers || {};

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Sales</h4>
            <div className="value">
              {formatCurrency(summary.total_sales || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Total Refunds</h4>
            <div className="value">
              {formatCurrency(summary.total_refunds || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Net Sales</h4>
            <div className="value">
              {formatCurrency(summary.net_sales || 0)}
            </div>
          </div>
        </div>

        <div className="report-section">
          <div
            className="section-header"
            onClick={() => toggleSection("items")}
          >
            <h3>Sales by Item</h3>
            {expandedSections.items ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>

          {expandedSections.items && (
            <div className="section-content">
              {items.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Total Amount</th>
                      <th>Refunds</th>
                      <th>Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .sort((a, b) => (b.net_amount || 0) - (a.net_amount || 0))
                      .map((item, index) => (
                        <tr key={item.id || `item-${item.name}-${index}`}>
                          <td>{item.name}</td>
                          <td>{item.quantity || 0}</td>
                          <td>{formatCurrency(item.total_amount || 0)}</td>
                          <td>{formatCurrency(item.refund_amount || 0)}</td>
                          <td>{formatCurrency(item.net_amount || 0)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data-message">
                  <p>No item breakdown available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {Object.keys(centers).length > 0 && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("centers")}
            >
              <h3>Sales by Center</h3>
              {expandedSections.centers ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.centers && (
              <div className="section-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Center</th>
                      <th>Total Sales</th>
                      <th>Refunds</th>
                      <th>Net Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(centers).map(([center, data], index) => (
                      <tr key={`center-${center}`}>
                        <td>{center}</td>
                        <td>{formatCurrency(data.total_sales || 0)}</td>
                        <td>{formatCurrency(data.total_refunds || 0)}</td>
                        <td>{formatCurrency(data.net_sales || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render services report
  const renderServicesReport = () => {
    // Ensure services is an array
    const services = Array.isArray(reportData)
      ? reportData
      : reportData.services || [];

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Services</h4>
            <div className="value">{services.length}</div>
          </div>
          <div className="summary-card">
            <h4>Center</h4>
            <div className="value">{centerCode}</div>
          </div>
          <div className="summary-card">
            <h4>Average Price</h4>
            <div className="value">
              {formatCurrency(
                services.length > 0
                  ? services.reduce(
                      (sum, s) => sum + (parseFloat(s.price) || 0),
                      0
                    ) / services.length
                  : 0
              )}
            </div>
          </div>
        </div>

        <div className="report-section">
          <div
            className="section-header"
            onClick={() => toggleSection("serviceDetails")}
          >
            <h3>Service Details</h3>
            {expandedSections.serviceDetails ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>

          {expandedSections.serviceDetails && (
            <div className="section-content">
              {services.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Duration</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service, index) => (
                      <tr key={service.id || `service-${service.name}-${index}`}>
                        <td>{service.name}</td>
                        <td>{service.category || "Uncategorized"}</td>
                        <td>{formatDuration(service.duration)}</td>
                        <td>{formatCurrency(service.price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data-message">
                  <p>No services available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Format duration helper
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

  // Main rendering
  return (
    <div className="report-viewer">
      <div className="report-viewer-header">
        <div className="report-title">
          <FileText size={20} />
          <h2>{getReportTypeLabel(reportType)} Report</h2>
        </div>

        <div className="report-date-range">
          <Calendar size={16} />
          <span>
            {formatDateDisplay(dateRange.startDate)} —{" "}
            {formatDateDisplay(dateRange.endDate)}
          </span>
        </div>

        <div className="report-actions">
          <div className="export-dropdown">
            <button
              className="action-button"
              onClick={() => setShowExportOptions(!showExportOptions)}
              title="Export Report"
            >
              <Download size={18} />
              <span>Export</span>
              <ChevronDown size={14} />
            </button>

            {showExportOptions && (
              <div className="export-options">
                <button onClick={() => handleExport("csv")}>CSV</button>
                <button onClick={() => handleExport("pdf")}>PDF</button>
                <button onClick={() => handleExport("xlsx")}>Excel</button>
              </div>
            )}
          </div>

          <button
            className="action-button"
            onClick={handlePrint}
            title="Print Report"
          >
            <Printer size={18} />
            <span>Print</span>
          </button>

          <button
            className="action-button"
            onClick={handleEmailReport}
            title="Email Report"
          >
            <Mail size={18} />
            <span>Email</span>
          </button>

          <button
            className="close-button"
            onClick={onClose}
            title="Close Report"
          >
            <X size={18} />
          </button>
        </div>
      </div>

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
          <button onClick={() => setSuccess(null)}>Dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <RefreshCw className="spinning" size={24} />
          <span>Loading report data...</span>
        </div>
      ) : (
        <div className="report-viewer-content">{renderReportContent()}</div>
      )}
    </div>
  );
};

export default CRMReportViewer;
