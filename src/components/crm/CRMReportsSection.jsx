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
  const [reportType, setReportType] = useState("sales");
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
  
  // Also update center ID when the component is first rendered
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected && !centerId) {
      console.log("Initial center ID loading for center code:", selectedCenter);
      getCenterId();
    }
  }, []);

  // Get center ID from center code
  const getCenterId = async () => {
    try {
      if (!selectedCenter) {
        console.warn("No center selected");
        return;
      }

      // First, try to get from local cache
      const cachedCenterId = localStorage.getItem(
        `zenoti_center_id_${selectedCenter}`
      );
      if (cachedCenterId) {
        console.log(
          `Using cached center ID for ${selectedCenter}: ${cachedCenterId}`
        );
        setCenterId(cachedCenterId);
        return;
      }

      // If not in cache, use the direct API method
      console.log("Fetching center ID for center code:", selectedCenter);
      const directResult = await zenotiService.getCenterIdFromCode(selectedCenter);
      
      if (directResult.success && directResult.centerId) {
        console.log("Successfully retrieved center ID:", directResult.centerId);
        setCenterId(directResult.centerId);
        return;
      }
      
      // If direct method fails, try using centers list as fallback
      console.log("Direct method failed, trying fallback with centers list");
      const response = await zenotiService.getCenters();

      if (response.data?.success) {
        const centers = response.data.centers || [];
        console.log(`Found ${centers.length} centers in response`);
        
        const center = centers.find((c) => c.code === selectedCenter);

        if (center && (center.id || center.center_id)) {
          const id = center.id || center.center_id;
          setCenterId(id);

          // Cache for future use
          localStorage.setItem(`zenoti_center_id_${selectedCenter}`, id);
          console.log(
            `Retrieved and cached center ID for ${selectedCenter}: ${id}`
          );
        } else {
          console.warn(
            `Center with code ${selectedCenter} not found or has no ID in centers list`
          );
          
          // Last resort - check if there's a defaultCenter in the response
          if (response.data.defaultCenter && response.data.defaultCenterId) {
            console.log("Using default center ID as fallback:", response.data.defaultCenterId);
            setCenterId(response.data.defaultCenterId);
            localStorage.setItem(`zenoti_center_id_${selectedCenter}`, response.data.defaultCenterId);
          } else {
            setCenterId(null);
          }
        }
      } else {
        throw new Error(response.data?.error || "Failed to get centers");
      }
    } catch (err) {
      console.error("Error getting center ID:", err);
      setCenterId(null);
      
      // Show user-friendly error
      setError("Failed to get center ID. Please try selecting a different center or refreshing the page.");
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
        case "sales":
          response = await zenotiService.getSalesReport(baseParams);
          break;

        case "packages":
          response = await zenotiService.getPackages(baseParams);
          break;

        case "appointments-report":
          try {
            // Always try to get a fresh centerId before making report calls
            const centerResult = await zenotiService.getCenterIdFromCode(
              selectedCenter
            );
            
            // If we get a center ID (which we should with our robust fallbacks), use it
            if (centerResult.success) {
              console.log(`Using center ID for appointments report: ${centerResult.centerId} (source: ${centerResult.source || "unknown"})`);
              setCenterId(centerResult.centerId);
              
              response = await zenotiService.getAppointmentsReport({
                center_ids: [centerResult.centerId],
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                date_type: advancedFilters.appointment.date_type,
                appointment_statuses:
                  advancedFilters.appointment.appointment_statuses,
                appointment_sources:
                  advancedFilters.appointment.appointment_sources,
              });
              
              // Log success
              console.log("Successfully retrieved appointments report with center ID");
            } else {
              // This should never happen with our failsafe mechanism, but just in case
              console.warn("Failed to get center ID, falling back to direct appointments API");
              
              // Fallback to direct appointments API
              response = await zenotiService.getAppointments({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                centerCode: selectedCenter,
                includeDetails: true,
                limit: 200,
              });

              if (response.data?.success) {
                setReportData({
                  appointments: response.data.appointments || [],
                  total: response.data.appointments?.length || 0,
                });
                setShowReportViewer(true);
                return;
              } else {
                throw new Error(
                  response.data?.error || "Failed to load appointments"
                );
              }
            }
          } catch (err) {
            console.error("Error generating appointments report:", err);
            throw err;
          }
          break;

        case "sales-accrual":
          try {
            // Always try to get a fresh centerId before making report calls
            const centerResult = await zenotiService.getCenterIdFromCode(
              selectedCenter
            );
            
            // If we get a center ID (which we should with our robust fallbacks), use it
            if (centerResult.success) {
              console.log(`Using center ID for sales accrual report: ${centerResult.centerId} (source: ${centerResult.source || "unknown"})`);
              setCenterId(centerResult.centerId);
              
              response = await zenotiService.getSalesAccrualReport({
                center_ids: [centerResult.centerId],
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
              });
              
              // Log success
              console.log("Successfully retrieved sales accrual report with center ID");
            } else {
              // This should never happen with our failsafe mechanism
              throw new Error("Failed to get center ID despite failsafe mechanisms. Please try again.");
            }
          } catch (err) {
            console.error("Error generating sales accrual report:", err);
            throw err;
          }
          break;

        case "sales-cash":
          try {
            // Always try to get a fresh centerId before making report calls
            const centerResult = await zenotiService.getCenterIdFromCode(
              selectedCenter
            );
            
            // If we get a center ID (which we should with our robust fallbacks), use it
            if (centerResult.success) {
              console.log(`Using center ID for sales cash report: ${centerResult.centerId} (source: ${centerResult.source || "unknown"})`);
              setCenterId(centerResult.centerId);
              
              response = await zenotiService.getSalesCashReport({
                center_ids: [centerResult.centerId],
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                level_of_detail: advancedFilters.sales.level_of_detail,
                item_types: advancedFilters.sales.item_types,
                payment_types: advancedFilters.sales.payment_types,
                sale_types: advancedFilters.sales.sale_types,
                invoice_statuses: advancedFilters.sales.invoice_statuses,
              });
              
              // Log success
              console.log("Successfully retrieved sales cash report with center ID");
            } else {
              // This should never happen with our failsafe mechanism
              throw new Error("Failed to get center ID despite failsafe mechanisms. Please try again.");
            }
          } catch (err) {
            console.error("Error generating sales cash report:", err);
            throw err;
          }
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
                <option value="sales">Sales Report</option>
                <option value="packages">Packages Report</option>
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

          <div>
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
            
            {/* Hidden button to refresh center ID if needed */}
            <button 
              onClick={getCenterId}
              style={{display: 'none'}}
              id="refresh-center-id-button"
            >
              Refresh Center ID
            </button>
          </div>
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
