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
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import CRMReportViewer from "./CRMReportViewer";

/**
 * Enhanced Reports section with additional Zenoti reports
 */
const EnhancedCRMReportsSection = ({
  selectedCenter,
  connectionStatus,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [reportType, setReportType] = useState("collections");
  const [advancedFilters, setAdvancedFilters] = useState({
    appointment: {
      date_type: 0, // Appointment date
      appointment_statuses: [-1], // All statuses
      appointment_sources: [-1], // All sources
    },
    sales: {
      level_of_detail: "1",
      item_types: [-1],
      payment_types: [-1],
      sale_types: [-1],
      invoice_statuses: [-1],
    },
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [centerId, setCenterId] = useState(null);

  // Load center ID when center code changes
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected) {
      getCenterId();
    }
  }, [selectedCenter, connectionStatus?.connected]);

  // Get center ID from center code
  const getCenterId = async () => {
    try {
      const result = await zenotiService.getCenterIdFromCode(selectedCenter);
      if (result.success) {
        setCenterId(result.centerId);
      } else {
        console.warn("Could not get center ID from code:", result.error);
        setCenterId(null);
      }
    } catch (err) {
      console.error("Error getting center ID:", err);
      setCenterId(null);
    }
  };

  // Handle date range change for reports
  const handleDateRangeChange = (type, value) => {
    setDateRange((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  // Handle advanced filter change
  const handleAdvancedFilterChange = (reportCategory, filterName, value) => {
    setAdvancedFilters((prev) => ({
      ...prev,
      [reportCategory]: {
        ...prev[reportCategory],
        [filterName]: value,
      },
    }));
  };

  // Generate report based on selected type
  const generateReport = async () => {
    try {
      setGeneratingReport(true);
      setError(null);
      setReportData(null);

      // Basic params with date range
      const baseParams = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        centerCode: selectedCenter,
      };

      let response = null;

      switch (reportType) {
        case "collections":
          response = await zenotiService.getCollectionsReport(baseParams);
          break;

        case "sales":
          response = await zenotiService.getSalesReport(baseParams);
          break;

        case "invoices":
          response = await zenotiService.searchInvoices(baseParams);
          break;

        case "packages":
          response = await zenotiService.getPackages(baseParams);
          break;

        case "appointments-report":
          if (!centerId) {
            throw new Error("Center ID is required. Please try again.");
          }

          response = await zenotiService.getAppointmentsReport({
            center_ids: [centerId],
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
            date_type: advancedFilters.appointment.date_type,
            appointment_statuses:
              advancedFilters.appointment.appointment_statuses,
            appointment_sources:
              advancedFilters.appointment.appointment_sources,
          });
          break;

        case "sales-accrual":
          if (!centerId) {
            throw new Error("Center ID is required. Please try again.");
          }

          response = await zenotiService.getSalesAccrualReport({
            center_ids: [centerId],
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
          });
          break;

        case "sales-cash":
          if (!centerId) {
            throw new Error("Center ID is required. Please try again.");
          }

          response = await zenotiService.getSalesCashReport({
            center_ids: [centerId],
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
            level_of_detail: advancedFilters.sales.level_of_detail,
            item_types: advancedFilters.sales.item_types,
            payment_types: advancedFilters.sales.payment_types,
            sale_types: advancedFilters.sales.sale_types,
            invoice_statuses: advancedFilters.sales.invoice_statuses,
          });
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
          response.data.appointments ||
          response.data.sales ||
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
              onChange={(e) => {
                setReportType(e.target.value);
                // Reset advanced filters when changing report type
                setShowAdvancedFilters(false);
              }}
            >
              {/* Standard Reports */}
              <optgroup label="Standard Reports">
                <option value="collections">Collections Report</option>
                <option value="sales">Sales Report</option>
                <option value="invoices">Invoices Report</option>
                <option value="packages">Packages Report</option>
              </optgroup>

              {/* Enhanced Reports */}
              <optgroup label="Enhanced Reports">
                <option value="appointments-report">Appointments Report</option>
                <option value="sales-accrual">Sales Accrual Report</option>
                <option value="sales-cash">Sales Cash Report</option>
              </optgroup>
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

          {/* Advanced filters button - only show for enhanced reports */}
          {(reportType === "appointments-report" ||
            reportType === "sales-accrual" ||
            reportType === "sales-cash") && (
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
          )}

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

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="advanced-filters-panel">
          <h4>Advanced Filters</h4>

          {reportType === "appointments-report" && (
            <div className="filter-groups">
              <div className="filter-group">
                <label>Date Type</label>
                <select
                  value={advancedFilters.appointment.date_type}
                  onChange={(e) =>
                    handleAdvancedFilterChange(
                      "appointment",
                      "date_type",
                      parseInt(e.target.value)
                    )
                  }
                >
                  <option value={0}>Appointment Date</option>
                  <option value={1}>Booking Date</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Appointment Status</label>
                <select
                  value={advancedFilters.appointment.appointment_statuses[0]}
                  onChange={(e) =>
                    handleAdvancedFilterChange(
                      "appointment",
                      "appointment_statuses",
                      [e.target.value]
                    )
                  }
                >
                  <option value={-1}>All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="NoShow">No Show</option>
                  <option value="CheckedIn">Checked In</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Deleted">Deleted</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Appointment Source</label>
                <select
                  value={advancedFilters.appointment.appointment_sources[0]}
                  onChange={(e) =>
                    handleAdvancedFilterChange(
                      "appointment",
                      "appointment_sources",
                      [parseInt(e.target.value)]
                    )
                  }
                >
                  <option value={-1}>All Sources</option>
                  <option value={0}>Zenoti</option>
                  <option value={1}>Mobile CMA</option>
                  <option value={2}>Online</option>
                  <option value={14}>Zenoti Mobile</option>
                  <option value={16}>POS</option>
                  <option value={24}>Kiosk</option>
                  <option value={26}>Kiosk Web</option>
                </select>
              </div>
            </div>
          )}

          {reportType === "sales-cash" && (
            <div className="filter-groups">
              <div className="filter-group">
                <label>Level of Detail</label>
                <select
                  value={advancedFilters.sales.level_of_detail}
                  onChange={(e) =>
                    handleAdvancedFilterChange(
                      "sales",
                      "level_of_detail",
                      e.target.value
                    )
                  }
                >
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                  <option value="3">Level 3</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Item Type</label>
                <select
                  value={advancedFilters.sales.item_types[0]}
                  onChange={(e) =>
                    handleAdvancedFilterChange("sales", "item_types", [
                      parseInt(e.target.value),
                    ])
                  }
                >
                  <option value={-1}>All Item Types</option>
                  <option value={0}>Service</option>
                  <option value={2}>Product</option>
                  <option value={3}>Membership</option>
                  <option value={4}>Package</option>
                  <option value={5}>Day Promo Package</option>
                  <option value={6}>Prepaid Card</option>
                  <option value={61}>Gift Card</option>
                  <option value={11}>Class</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Payment Type</label>
                <select
                  value={advancedFilters.sales.payment_types[0]}
                  onChange={(e) =>
                    handleAdvancedFilterChange("sales", "payment_types", [
                      parseInt(e.target.value),
                    ])
                  }
                >
                  <option value={-1}>All Payment Types</option>
                  <option value={0}>Cash</option>
                  <option value={1}>Card</option>
                  <option value={2}>Check</option>
                  <option value={3}>Custom Financial</option>
                  <option value={4}>Custom Non-Financial</option>
                  <option value={5}>Membership</option>
                  <option value={7}>Package</option>
                  <option value={8}>Gift Card</option>
                  <option value={9}>Prepaid Card</option>
                  <option value={10}>Loyalty Points</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Sale Type</label>
                <select
                  value={advancedFilters.sales.sale_types[0]}
                  onChange={(e) =>
                    handleAdvancedFilterChange("sales", "sale_types", [
                      parseInt(e.target.value),
                    ])
                  }
                >
                  <option value={-1}>All Sale Types</option>
                  <option value={0}>Sale</option>
                  <option value={1}>Refund</option>
                  <option value={2}>Recurring</option>
                  <option value={3}>Charges</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Report Cards - shows when no report is generated yet */}
      {!reportData && !isLoading && !error && (
        <div className="report-cards">
          <div
            className="report-card"
            onClick={() => setReportType("appointments-report")}
          >
            <Calendar size={24} />
            <h4>Appointments Report</h4>
            <p>View detailed appointment data with filtering options</p>
          </div>

          <div
            className="report-card"
            onClick={() => setReportType("sales-cash")}
          >
            <DollarSign size={24} />
            <h4>Sales Cash Report</h4>
            <p>Analyze sales data on a cash basis with multiple filters</p>
          </div>

          <div
            className="report-card"
            onClick={() => setReportType("sales-accrual")}
          >
            <CreditCard size={24} />
            <h4>Sales Accrual Report</h4>
            <p>View sales data on an accrual basis by center</p>
          </div>

          <div
            className="report-card"
            onClick={() => setReportType("collections")}
          >
            <List size={24} />
            <h4>Collections Report</h4>
            <p>Analyze payment collections and payment types</p>
          </div>
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
    </div>
  );
};

export default EnhancedCRMReportsSection;
