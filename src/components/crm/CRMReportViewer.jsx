import React, { useState, useEffect } from "react";
import {
  Download,
  Printer,
  FileText,
  X,
  BarChart,
  RefreshCw,
  Share2,
  Mail,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./CRMReportViewer.css";

/**
 * Component for viewing CRM reports with download, print, and sharing capabilities
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
  const [expandedSections, setExpandedSections] = useState({});
  const [exportFormat, setExportFormat] = useState("csv");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(
    reportType === "weekly" || reportType === "client-activity"
  );

  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Check if report type is in development
  useEffect(() => {
    if (reportType === "weekly" || reportType === "client-activity") {
      setShowComingSoonModal(true);
    } else {
      setShowComingSoonModal(false);
    }
  }, [reportType]);

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Export report to selected format
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

      const response = await zenotiService.generateReportFile(
        reportData,
        format,
        `${reportType}-report-${new Date().toISOString().split("T")[0]}`
      );

      if (response.data?.success) {
        // Create download link
        const downloadLink = document.createElement("a");
        downloadLink.href =
          response.data.result.downloadUrl || response.data.result.fileUrl;
        downloadLink.download = response.data.result.filename;
        downloadLink.click();

        // Track export event
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_REPORT_EXPORT,
          {
            reportType,
            format,
            dateRange,
            centerCode,
          }
        );

        setShowExportOptions(false);
      } else {
        throw new Error(`Failed to export report as ${format}`);
      }
    } catch (err) {
      console.error(`Error exporting report as ${format}:`, err);
      setError(`Failed to export report: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Email report
  const handleEmailReport = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Prepare email data
      const emailData = {
        report_data: reportData,
        report_type: reportType,
        recipients: [], // Would come from a form in a production app
        subject: `${reportType.toUpperCase()} Report - ${dateRange.start} to ${
          dateRange.end
        }`,
        message: `Here is your ${reportType} report for the period ${dateRange.start} to ${dateRange.end}.`,
      };

      const response = await zenotiService.emailReport(emailData);

      if (response.data?.success) {
        // Track email event
        analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_REPORT_SHARE, {
          reportType,
          method: "email",
          dateRange,
        });
      } else {
        throw new Error(response.data?.error || "Failed to email report");
      }
    } catch (err) {
      console.error("Error emailing report:", err);
      setError(`Failed to email report: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle printing
  const handlePrint = () => {
    window.print();

    // Track print event
    analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_REPORT_SHARE, {
      reportType,
      method: "print",
      dateRange,
    });
  };

  // Render different report types
  const renderReportContent = () => {
    if (!reportData)
      return <div className="no-data">No report data available</div>;

    switch (reportType) {
      case "weekly":
        return renderWeeklyReport();
      case "collections":
        return renderCollectionsReport();
      case "sales":
        return renderSalesReport();
      case "client-activity":
        return renderClientActivityReport();
      case "invoices":
        return renderInvoicesReport();
      default:
        return <div className="no-data">Unknown report type: {reportType}</div>;
    }
  };

  // Weekly business report renderer
  const renderWeeklyReport = () => {
    if (showComingSoonModal) return null;

    return (
      <div className="report-content weekly-report">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Revenue</h4>
            <div className="value">
              {formatCurrency(reportData.totalRevenue || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Appointments</h4>
            <div className="value">{reportData.appointmentCount || 0}</div>
          </div>
          <div className="summary-card">
            <h4>New Clients</h4>
            <div className="value">{reportData.newClients || 0}</div>
          </div>
        </div>

        {/* Comparison section */}
        {reportData.comparison && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("comparison")}
            >
              <h3>Comparison to Previous Week</h3>
              {expandedSections.comparison ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.comparison && (
              <div className="section-content">
                <div className="comparison-grid">
                  <div
                    className={`comparison-item ${
                      (reportData.comparison.revenueChange || 0) >= 0
                        ? "positive"
                        : "negative"
                    }`}
                  >
                    <div className="label">Revenue</div>
                    <div className="value">
                      {(reportData.comparison.revenueChange || 0) >= 0
                        ? "+"
                        : ""}
                      {reportData.comparison.revenueChange || 0}%
                    </div>
                  </div>
                  <div
                    className={`comparison-item ${
                      (reportData.comparison.appointmentChange || 0) >= 0
                        ? "positive"
                        : "negative"
                    }`}
                  >
                    <div className="label">Appointments</div>
                    <div className="value">
                      {(reportData.comparison.appointmentChange || 0) >= 0
                        ? "+"
                        : ""}
                      {reportData.comparison.appointmentChange || 0}%
                    </div>
                  </div>
                  <div
                    className={`comparison-item ${
                      (reportData.comparison.clientChange || 0) >= 0
                        ? "positive"
                        : "negative"
                    }`}
                  >
                    <div className="label">New Clients</div>
                    <div className="value">
                      {(reportData.comparison.clientChange || 0) >= 0
                        ? "+"
                        : ""}
                      {reportData.comparison.clientChange || 0}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Service breakdown section */}
        {reportData.serviceBreakdown && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("services")}
            >
              <h3>Service Breakdown</h3>
              {expandedSections.services ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.services && (
              <div className="section-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Appointments</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reportData.serviceBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([service, count], index) => (
                        <tr key={index}>
                          <td>{service}</td>
                          <td>{count}</td>
                          <td>
                            {formatCurrency(
                              reportData.serviceRevenue?.[service] || 0
                            )}
                          </td>
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

  // Collections report renderer
  const renderCollectionsReport = () => {
    return (
      <div className="report-content collections-report">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Collected</h4>
            <div className="value">
              {formatCurrency(reportData.summary?.total_collected || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Cash Collections</h4>
            <div className="value">
              {formatCurrency(reportData.summary?.total_collected_cash || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Non-Cash Collections</h4>
            <div className="value">
              {formatCurrency(
                reportData.summary?.total_collected_non_cash || 0
              )}
            </div>
          </div>
        </div>

        {/* Payment types section */}
        {reportData.payment_types && (
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
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment Type</th>
                      <th>Amount</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reportData.payment_types)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, amount], index) => {
                        const percentage =
                          (amount / reportData.summary.total_collected) * 100;
                        return (
                          <tr key={index}>
                            <td>{type}</td>
                            <td>{formatCurrency(amount)}</td>
                            <td>{percentage.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Transactions section - only if available */}
        {reportData.transactions && reportData.transactions.length > 0 && (
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
                    {reportData.transactions.map((transaction, index) => (
                      <tr key={index}>
                        <td>
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td>
                          {transaction.receipt_number || transaction.id || "-"}
                        </td>
                        <td>{transaction.client_name || "-"}</td>
                        <td>{transaction.payment_type || "-"}</td>
                        <td>{formatCurrency(transaction.amount || 0)}</td>
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

  // Sales report renderer
  const renderSalesReport = () => {
    return (
      <div className="report-content sales-report">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Sales</h4>
            <div className="value">
              {formatCurrency(reportData.summary?.total_sales || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Total Refunds</h4>
            <div className="value">
              {formatCurrency(reportData.summary?.total_refunds || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Net Sales</h4>
            <div className="value">
              {formatCurrency(reportData.summary?.net_sales || 0)}
            </div>
          </div>
        </div>

        {/* Items breakdown section */}
        {reportData.items && reportData.items.length > 0 && (
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
                    {reportData.items
                      .sort((a, b) => (b.net_amount || 0) - (a.net_amount || 0))
                      .map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.quantity || 0}</td>
                          <td>{formatCurrency(item.total_amount || 0)}</td>
                          <td>{formatCurrency(item.refund_amount || 0)}</td>
                          <td>{formatCurrency(item.net_amount || 0)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Centers section - if multiple centers */}
        {reportData.centers && Object.keys(reportData.centers).length > 0 && (
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
                    {Object.entries(reportData.centers).map(
                      ([center, data], index) => (
                        <tr key={index}>
                          <td>{center}</td>
                          <td>{formatCurrency(data.total_sales || 0)}</td>
                          <td>{formatCurrency(data.total_refunds || 0)}</td>
                          <td>{formatCurrency(data.net_sales || 0)}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Client activity report renderer
  const renderClientActivityReport = () => {
    if (showComingSoonModal) return null;

    return (
      <div className="report-content client-activity-report">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Clients</h4>
            <div className="value">
              {reportData.totalClients || reportData.total_clients || 0}
            </div>
          </div>
          <div className="summary-card">
            <h4>New Clients</h4>
            <div className="value">
              {reportData.newClients || reportData.new_clients || 0}
            </div>
          </div>
          <div className="summary-card">
            <h4>Returning Clients</h4>
            <div className="value">
              {reportData.returningClients || reportData.returning_clients || 0}
            </div>
          </div>
          <div className="summary-card">
            <h4>Avg. Spend</h4>
            <div className="value">
              {formatCurrency(
                reportData.averageSpend || reportData.average_spend || 0
              )}
            </div>
          </div>
        </div>

        {/* Top clients section */}
        {(reportData.topClients || reportData.top_clients) && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("topClients")}
            >
              <h3>Top Clients by Spend</h3>
              {expandedSections.topClients ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.topClients && (
              <div className="section-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Visits</th>
                      <th>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      reportData.topClients ||
                      reportData.top_clients ||
                      []
                    ).map((client, index) => (
                      <tr key={index}>
                        <td>{client.name}</td>
                        <td>{client.visits || 0}</td>
                        <td>
                          {formatCurrency(
                            client.totalSpend || client.total_spend || 0
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Popular services section */}
        {(reportData.popularServices || reportData.popular_services) && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("popularServices")}
            >
              <h3>Popular Services</h3>
              {expandedSections.popularServices ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.popularServices && (
              <div className="section-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Bookings</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      reportData.popularServices ||
                      reportData.popular_services ||
                      []
                    ).map((service, index) => (
                      <tr key={index}>
                        <td>{service.name}</td>
                        <td>{service.bookings || 0}</td>
                        <td>{formatCurrency(service.revenue || 0)}</td>
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

  // Invoices report renderer
  const renderInvoicesReport = () => {
    return (
      <div className="report-content invoices-report">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Amount</h4>
            <div className="value">
              {formatCurrency(reportData.summary?.total_amount || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Invoice Count</h4>
            <div className="value">
              {reportData.summary?.count || reportData.invoices?.length || 0}
            </div>
          </div>
          <div className="summary-card">
            <h4>Avg. Invoice</h4>
            <div className="value">
              {formatCurrency(
                reportData.summary?.count
                  ? (reportData.summary.total_amount || 0) /
                      reportData.summary.count
                  : 0
              )}
            </div>
          </div>
        </div>

        {/* Invoices list section */}
        {reportData.invoices && reportData.invoices.length > 0 && (
          <div className="report-section">
            <div
              className="section-header"
              onClick={() => toggleSection("invoices")}
            >
              <h3>Invoices</h3>
              {expandedSections.invoices ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>

            {expandedSections.invoices && (
              <div className="section-content">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.invoices.map((invoice, index) => (
                      <tr key={index}>
                        <td>
                          {invoice.invoice_number || invoice.number || "—"}
                        </td>
                        <td>
                          {new Date(
                            invoice.invoice_date ||
                              invoice.date ||
                              invoice.created_date
                          ).toLocaleDateString()}
                        </td>
                        <td>
                          {invoice.client_name || invoice.guest_name || "—"}
                        </td>
                        <td>
                          {formatCurrency(
                            invoice.amount || invoice.total_amount || 0
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              invoice.status?.toLowerCase() || "paid"
                            }`}
                          >
                            {invoice.status || "Paid"}
                          </span>
                        </td>
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

  // Main render
  return (
    <div className="report-viewer">
      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="coming-soon-overlay">
          <div className="coming-soon-modal">
            <div className="coming-soon-header">
              <h3>Feature Coming Soon!</h3>
              <button className="close-button" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
            <div className="coming-soon-content">
              <AlertCircle size={48} className="coming-soon-icon" />
              <p>
                {reportType === "weekly"
                  ? "Weekly Business Reports"
                  : "Client Activity Reports"}{" "}
                are currently in development.
              </p>
              <p>
                We're working with Zenoti to finalize this feature and it will
                be available soon.
              </p>
            </div>
            <div className="coming-soon-footer">
              <button className="primary-button" onClick={onClose}>
                OK, I'll check back later
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="report-viewer-header">
        <div className="report-title">
          <FileText size={20} />
          <h2>
            {reportType.charAt(0).toUpperCase() +
              reportType.slice(1).replace(/-/g, " ")}{" "}
            Report
          </h2>
        </div>

        <div className="report-date-range">
          {dateRange && (
            <span>
              {new Date(dateRange.start).toLocaleDateString()} —
              {new Date(dateRange.end).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="report-actions">
          <div className="export-dropdown">
            <button
              className="action-button"
              onClick={() => setShowExportOptions(!showExportOptions)}
              title="Export Report"
              disabled={showComingSoonModal}
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
            disabled={showComingSoonModal}
          >
            <Printer size={18} />
            <span>Print</span>
          </button>

          <button
            className="action-button"
            onClick={handleEmailReport}
            title="Email Report"
            disabled={showComingSoonModal}
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
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <RefreshCw className="spinner" size={24} />
          <span>Loading report data...</span>
        </div>
      ) : (
        <div className="report-viewer-content">{renderReportContent()}</div>
      )}
    </div>
  );
};

export default CRMReportViewer;
