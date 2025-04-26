// src/components/crm/CRMReportsSection.jsx - Enhanced
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
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import CRMReportViewer from "./CRMReportViewer";
import ComingSoonOverlay from "../common/ComingSoonOverlay";

/**
 * Enhanced Reports section for the CRM Dashboard
 * Handles report generation, viewing, and export functionality
 */
const CRMReportsSection = ({ selectedCenter, connectionStatus, onRefresh }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [reportType, setReportType] = useState("collections");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState("");

  // New state for packages
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showPackages, setShowPackages] = useState(false);

  // Handle date range change for reports
  const handleDateRangeChange = (type, value) => {
    setDateRange((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  // Check if report type is in development
  const checkReportAvailability = (type) => {
    // We're removing the weekly and client-activity reports as requested
    if (type === "weekly" || type === "client-activity") {
      setComingSoonFeature(
        type === "weekly"
          ? "Weekly Business Reports"
          : "Client Activity Reports"
      );
      setShowComingSoon(true);
      return false;
    }
    return true;
  };

  // Generate report based on selected type
  const generateReport = async () => {
    // First check if this report type is available
    if (!checkReportAvailability(reportType)) {
      return;
    }

    try {
      setGeneratingReport(true);
      setError(null);
      setReportData(null);

      // Define report params based on type
      const reportParams = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        centerCode: selectedCenter,
      };

      // Add debugging before making API call
      console.log(`Generating ${reportType} report with params:`, reportParams);

      let response = null;

      switch (reportType) {
        case "collections":
          console.log(
            "Generating collections report with params:",
            reportParams
          );
          response = await zenotiService.getCollectionsReport(reportParams);
          break;

        case "sales":
          console.log("Generating sales report with params:", reportParams);
          response = await zenotiService.getSalesReport(reportParams);
          break;

        case "invoices":
          // Special case for invoices - use searchInvoices
          console.log("Generating invoice report with params:", reportParams);
          const searchResponse = await zenotiService.searchInvoices(
            reportParams
          );

          if (searchResponse.data?.success) {
            // Transform the invoice search results into a report format
            response = {
              data: {
                success: true,
                report: {
                  summary: {
                    total_amount:
                      searchResponse.data.invoices?.reduce(
                        (sum, inv) => sum + (parseFloat(inv.amount) || 0),
                        0
                      ) || 0,
                    count: searchResponse.data.invoices?.length || 0,
                  },
                  invoices: searchResponse.data.invoices || [],
                  dateRange: searchResponse.data.dateRange,
                },
              },
            };
          } else {
            throw new Error("Failed to retrieve invoice data");
          }
          break;

        case "packages":
          console.log("Generating packages report with params:", reportParams);
          response = await zenotiService.getPackages(reportParams);
          break;

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      if (response?.data?.success) {
        // Handle different response formats
        const reportData =
          response.data.report ||
          response.data.overview ||
          response.data.packages ||
          (response.data.invoices
            ? { invoices: response.data.invoices }
            : null);

        if (reportData) {
          setReportData(reportData);
          console.log("Report data loaded successfully:", reportData);
          setShowReportViewer(true);

          // Track report generation for analytics
          analyticsUtils.trackEvent(
            analyticsUtils.EVENT_TYPES.CRM_REPORT_GENERATE,
            {
              reportType,
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            }
          );
        } else {
          throw new Error("Received successful response but no report data");
        }
      } else {
        throw new Error(response?.data?.error || "Failed to generate report");
      }
    } catch (err) {
      console.error(`Error generating ${reportType} report:`, err);
      setError(`Failed to generate ${reportType} report: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Export report to CSV or PDF
  const exportReport = async (format) => {
    try {
      setIsLoading(true);

      if (!reportData) {
        setError("No report data to export");
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

        // Track export for analytics
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_REPORT_EXPORT,
          {
            reportType,
            format,
            fileName: response.data.result.filename,
          }
        );
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

  // Handle report type selection with coming soon check
  const handleReportTypeChange = (e) => {
    const type = e.target.value;
    setReportType(type);

    // Check if this report type is still in development
    checkReportAvailability(type);
  };

  // Load packages for the selected center
  const loadPackages = async () => {
    if (!selectedCenter || !connectionStatus?.connected) return;

    try {
      setLoadingPackages(true);
      setError(null);

      const response = await zenotiService.getPackages({
        centerCode: selectedCenter,
      });

      if (response.data?.success) {
        setPackages(response.data.packages || []);
        setShowPackages(true);
      } else {
        throw new Error(response.data?.error || "Failed to load packages");
      }
    } catch (err) {
      console.error("Error loading packages:", err);
      setError(`Failed to load packages: ${err.message}`);
    } finally {
      setLoadingPackages(false);
    }
  };

  // Toggle packages display
  const togglePackages = () => {
    if (!showPackages && packages.length === 0) {
      loadPackages();
    } else {
      setShowPackages(!showPackages);
    }
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="reports-section">
      <div className="section-header">
        <h3>Zenoti Reports</h3>
        <div className="report-actions">
          {reportData && (
            <>
              <button
                className="export-csv-btn"
                onClick={() => exportReport("csv")}
                disabled={!reportData || isLoading}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
              <button
                className="print-btn"
                onClick={() => exportReport("pdf")}
                disabled={!reportData || isLoading}
              >
                <Printer size={14} />
                <span>Export PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {!connectionStatus?.connected ? (
        <div className="not-connected-message">
          <Info size={48} />
          <h3>Not Connected to Zenoti</h3>
          <p>Please configure your Zenoti connection to access reports.</p>
        </div>
      ) : (
        <div className="report-controls">
          <div className="report-type-selector">
            <label htmlFor="reportType">Report Type:</label>
            <select
              id="reportType"
              value={reportType}
              onChange={handleReportTypeChange}
            >
              <option value="collections">Collections Report</option>
              <option value="sales">Sales Report</option>
              <option value="invoices">Invoices Report</option>
              <option value="packages">Packages Report</option>
              {/* Removing the non-working report types as requested */}
            </select>
          </div>

          <div className="date-fields">
            <div className="date-field">
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                id="startDate"
                value={dateRange.startDate}
                onChange={(e) =>
                  handleDateRangeChange("startDate", e.target.value)
                }
              />
            </div>
            <div className="date-field">
              <label htmlFor="endDate">End Date:</label>
              <input
                type="date"
                id="endDate"
                value={dateRange.endDate}
                onChange={(e) =>
                  handleDateRangeChange("endDate", e.target.value)
                }
              />
            </div>
          </div>

          <button
            className="generate-report-btn"
            onClick={generateReport}
            disabled={generatingReport}
          >
            {generatingReport ? (
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
        </div>
      )}

      {/* Packages Section */}
      {connectionStatus?.connected && (
        <div className="packages-section">
          <div
            className="packages-header"
            onClick={togglePackages}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              padding: "10px",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              marginTop: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <Package size={18} style={{ marginRight: "8px" }} />
              <h4 style={{ margin: 0 }}>Available Packages</h4>
            </div>
            {showPackages ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          {showPackages && (
            <div className="packages-content" style={{ marginTop: "10px" }}>
              {loadingPackages ? (
                <div className="loading-state">
                  <RefreshCw size={20} className="spinning" />
                  <span>Loading packages...</span>
                </div>
              ) : packages.length > 0 ? (
                <div className="packages-table-container">
                  <table className="packages-table">
                    <thead>
                      <tr>
                        <th>Package Name</th>
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
                          <td>{pkg.validity_days || "N/A"} days</td>
                          <td>
                            <span
                              className={`status-badge ${
                                pkg.status?.toLowerCase() || "active"
                              }`}
                            >
                              {pkg.status || "Active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-packages-message">
                  <AlertCircle size={24} />
                  <p>No packages available for this center.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <Info size={18} />
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Report Viewer Modal */}
      {showReportViewer && reportData && (
        <div className="report-viewer-modal">
          <CRMReportViewer
            reportData={reportData}
            reportType={reportType}
            dateRange={{
              start: dateRange.startDate,
              end: dateRange.endDate,
            }}
            centerCode={selectedCenter}
            onClose={() => setShowReportViewer(false)}
            onExport={exportReport}
          />
        </div>
      )}

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <ComingSoonOverlay
          featureName={comingSoonFeature}
          description="We're working with Zenoti to finalize the API integration for this report type."
          onClose={() => setShowComingSoon(false)}
        />
      )}
    </div>
  );
};

export default CRMReportsSection;
