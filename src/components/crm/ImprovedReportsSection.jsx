// src/components/crm/ImprovedReportsSection.jsx
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
  DollarSign,
  File,
  Printer,
} from "lucide-react";
import reportsApiService from "../../services/reportsApiService";
import zenotiService from "../../services/zenotiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./EnhancedReportsSection.css";

/**
 * Fixed CRM Reports Dashboard that properly integrates with the API
 */
const ImprovedReportsSection = ({
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
  const [processedReportData, setProcessedReportData] = useState(null);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
      label: "Sales (Accrual Basis)",
      icon: <BarChart2 size={18} />,
      description: "Revenue recognized when services are performed",
    },
    {
      id: "sales_cash",
      label: "Sales (Cash Basis)",
      icon: <CreditCard size={18} />,
      description: "Revenue recognized when payments are received",
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
      id: "services",
      label: "Services",
      icon: <Tag size={18} />,
      description: "Available services and their details",
    },
  ];

  // Load centers when component mounts or when connection status changes
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
          `${response.data.centers?.length || 0} centers loaded`,
          "success"
        );
      } else {
        setError("Failed to load centers. Please check your connection.");
      }
    } catch (err) {
      console.error("Error loading centers:", err);
      setError("Failed to load centers: " + (err.message || "Unknown error"));
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
  const generateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);
    setProcessedReportData(null);

    try {
      // Check if a center is selected
      if (!selectedCenter) {
        setError("Please select a center to generate reports");
        setIsLoading(false);
        return;
      }

      let response;

      // Format datetime range for sales reports
      const formattedStartDate = `${dateRange.startDate} 00:00:00`;
      const formattedEndDate = `${dateRange.endDate} 23:59:59`;

      // Find selected center ID - needed for sales reports
      const centerInfo = centers.find(
        (center) => center.code === selectedCenter
      );
      const centerId = centerInfo?.id || "";

      // Add timestamp to prevent caching
      const timestamp = Date.now();

      // Make appropriate API call based on report type
      switch (reportType) {
        case "sales_accrual": {
          // Prepare parameters for accrual basis sales report
          const salesParams = {
            start_date: formattedStartDate,
            end_date: formattedEndDate,
            center_ids: [centerId],
            _t: timestamp,
          };

          // Add filters if they're not set to "All"
          if (itemType !== "All") {
            salesParams.item_types = [mapItemTypeToCode(itemType)];
          } else {
            salesParams.item_types = [-1]; // All item types
          }

          // Payment types filter
          if (paymentMode !== "All") {
            salesParams.payment_types = [mapPaymentTypeToCode(paymentMode)];
          } else {
            salesParams.payment_types = [-1]; // All payment types
          }

          // Invoice status filter
          if (status !== "All") {
            salesParams.invoice_statuses = [mapStatusToCode(status)];
          } else {
            salesParams.invoice_statuses = [-1]; // All statuses
          }

          // Call the accrual basis report API
          console.log(
            "Generating accrual basis sales report with:",
            salesParams
          );
          response = await reportsApiService.getSalesAccrualBasisReport(
            salesParams
          );
          break;
        }
        case "sales_cash": {
          // Prepare parameters for cash basis sales report
          const salesParams = {
            start_date: formattedStartDate,
            end_date: formattedEndDate,
            center_ids: [centerId],
            level_of_detail: "1", // Detailed level
            _t: timestamp,
          };

          // Add filters if they're not set to "All"
          if (itemType !== "All") {
            salesParams.item_types = [mapItemTypeToCode(itemType)];
          } else {
            salesParams.item_types = [-1]; // All item types
          }

          // Payment types filter
          if (paymentMode !== "All") {
            salesParams.payment_types = [mapPaymentTypeToCode(paymentMode)];
          } else {
            salesParams.payment_types = [-1]; // All payment types
          }

          // Sale types filter (for cash basis)
          if (status !== "All") {
            salesParams.sale_types = [mapSaleTypeToCode(status)];
          } else {
            salesParams.sale_types = [-1]; // All sale types
          }

          // Set empty arrays for unused filters to avoid API issues
          salesParams.sold_by_ids = [];

          // Call the cash basis report API
          console.log("Generating cash basis sales report with:", salesParams);
          response = await reportsApiService.getSalesCashBasisReport(
            salesParams
          );
          break;
        }
        case "appointments":
          // Prepare parameters for appointments
          const appointmentParams = {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            centerCode: selectedCenter,
            _t: timestamp,
          };
          // Add status filter if set
          if (status !== "All") appointmentParams.status = status;

          response = await reportsApiService.getAppointmentsReport(
            appointmentParams
          );
          break;
        case "packages":
          response = await reportsApiService.getPackagesReport({
            centerCode: selectedCenter,
            _t: timestamp,
          });
          break;
        case "services":
          response = await reportsApiService.getServicesReport({
            centerCode: selectedCenter,
            _t: timestamp,
          });
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      console.log(`${reportType} report response:`, response);

      // Check if we got a successful response
      if (response?.data) {
        setReportData(response.data); // Store raw response

        // Process data for display
        const processed = processReportData(response.data, reportType);
        setProcessedReportData(processed);

        showNotification("Report generated successfully", "success");

        // Open the report viewer
        setShowReportViewer(true);

        // Track event for analytics
        try {
          analyticsUtils.trackEvent("zenoti:report_generated", {
            reportType,
            centerCode: selectedCenter,
            dateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
          });
        } catch (analyticsError) {
          console.warn("Analytics tracking error:", analyticsError);
        }
      } else {
        setError("No data returned from API. Please try again.");
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

  // Mapping functions for API codes
  function mapItemTypeToCode(itemType) {
    const itemTypeMap = {
      All: -1,
      Service: 0,
      Product: 2,
      Membership: 3,
      Package: 4,
      DayPromoPackage: 5,
      PrepaidCard: 6,
      GiftCard: 61,
      Class: 11,
    };
    return itemTypeMap[itemType] !== undefined ? itemTypeMap[itemType] : -1;
  }

  function mapPaymentTypeToCode(paymentType) {
    const paymentTypeMap = {
      All: -1,
      Cash: 0,
      Card: 1,
      Check: 2,
      CustomFinancial: 3,
      CustomNonFinancial: 4,
      Membership: 5,
      MembershipService: 6,
      Package: 7,
      GiftCard: 8,
      PrepadCard: 9,
      LoyaltyPoints: 10,
      Custom: 11,
      Cashback: 16,
    };
    return paymentTypeMap[paymentType] !== undefined
      ? paymentTypeMap[paymentType]
      : -1;
  }

  function mapStatusToCode(status) {
    // For invoice statuses
    return -1; // Default to All
  }

  function mapSaleTypeToCode(saleType) {
    const saleTypeMap = {
      All: -1,
      Sale: 0,
      Refund: 1,
      Recurring: 2,
      Charges: 3,
    };
    return saleTypeMap[saleType] !== undefined ? saleTypeMap[saleType] : -1;
  }

  // Process report data based on type
  const processReportData = (data, type) => {
    // If data is falsy, return empty data
    if (!data) return { items: [], summary: { totalCount: 0 } };

    switch (type) {
      case "sales_accrual":
      case "sales_cash": {
        // Process sales report data
        // Check which format we're dealing with
        const isCashBasis = type === "sales_cash";

        // Handle the flat file format from the new API endpoints
        let totalSales = 0;
        let totalRefunds = 0;
        let items = [];

        // Extract data from the report response
        const reportItems = data.data || [];

        if (reportItems && reportItems.length > 0) {
          // Group by item name/type for summary
          const itemsMap = {};

          reportItems.forEach((item) => {
            // Extract values
            const itemName =
              item.item_name ||
              item.service_name ||
              item.product_name ||
              "Unknown";
            const itemType = item.item_type || "Unknown";
            const amount = parseFloat(
              item.final_sale_price || item.amount || 0
            );
            const isRefund =
              item.is_refund === true ||
              item.is_refund === "true" ||
              item.is_refund === 1 ||
              item.is_refund === "1" ||
              (item.invoice_status &&
                (item.invoice_status.toLowerCase() === "refunded" ||
                  item.invoice_status.toLowerCase().includes("refund")));

            // Add to totals
            if (isRefund) {
              totalRefunds += Math.abs(amount);
            } else {
              totalSales += amount;
            }

            // Group items
            const key = `${itemName}-${itemType}`;
            if (!itemsMap[key]) {
              itemsMap[key] = {
                name: itemName,
                type: itemType,
                quantity: 0,
                totalAmount: 0,
                refundAmount: 0,
                netAmount: 0,
              };
            }

            // Update item data
            itemsMap[key].quantity += 1;
            if (isRefund) {
              itemsMap[key].refundAmount += Math.abs(amount);
            } else {
              itemsMap[key].totalAmount += amount;
            }
            itemsMap[key].netAmount =
              itemsMap[key].totalAmount - itemsMap[key].refundAmount;
          });

          // Convert map to array
          items = Object.values(itemsMap);
        }

        // Calculate net sales
        const netSales = totalSales - totalRefunds;

        // Create summary
        const summary = {
          totalSales: totalSales,
          totalRefunds: totalRefunds,
          netSales: netSales,
          reportType: isCashBasis ? "Cash Basis" : "Accrual Basis",
        };

        return {
          summary,
          items,
          totalCount: items.length,
          reportType: "sales",
          basis: isCashBasis ? "cash" : "accrual",
        };
      }

      case "appointments": {
        // Process appointments data
        const appointments = data.appointments || [];

        // Process each appointment to ensure consistent format
        const processedAppointments = appointments.map((appt) => {
          // Extract client name with fallbacks
          const clientName = appt.guest
            ? `${appt.guest.firstName || ""} ${
                appt.guest.lastName || ""
              }`.trim()
            : "Unknown Client";

          // Extract service name with fallbacks
          const serviceName = appt.service
            ? appt.service.name
            : appt.parentServiceName || "Unknown Service";

          // Extract therapist name with fallbacks
          const therapistName = appt.therapist
            ? `${appt.therapist.firstName || ""} ${
                appt.therapist.lastName || ""
              }`.trim()
            : "Unknown Therapist";

          // Map status codes to readable strings
          const statusMap = {
            0: "Booked",
            1: "Confirmed",
            2: "Checked In",
            3: "Completed",
            4: "Cancelled",
            5: "No Show",
          };

          return {
            id: appt.appointmentId,
            date: appt.startTime ? new Date(appt.startTime) : null,
            startTime: appt.startTime,
            endTime: appt.endTime,
            clientName,
            serviceName,
            therapistName,
            status: statusMap[appt.status] || "Unknown",
            rawStatus: appt.status,
            centerCode: selectedCenter,
          };
        });

        return {
          items: processedAppointments,
          totalCount: processedAppointments.length,
          summary: {
            totalCount: processedAppointments.length,
            booked: processedAppointments.filter((a) => a.rawStatus === 0)
              .length,
            checkedIn: processedAppointments.filter((a) => a.rawStatus === 2)
              .length,
            completed: processedAppointments.filter((a) => a.rawStatus === 3)
              .length,
            cancelled: processedAppointments.filter((a) => a.rawStatus === 4)
              .length,
            noShow: processedAppointments.filter((a) => a.rawStatus === 5)
              .length,
          },
          reportType: "appointments",
        };
      }

      case "packages": {
        // Process packages data
        const packages = data.packages || [];

        return {
          items: packages,
          totalCount: packages.length,
          summary: {
            totalCount: packages.length,
            activeCount: packages.filter((p) => p.active).length,
          },
          reportType: "packages",
        };
      }

      case "services": {
        // Process services data
        const services = data.services || [];

        return {
          items: services,
          totalCount: services.length,
          summary: {
            totalCount: services.length,
            averagePrice: services.length
              ? services.reduce(
                  (sum, svc) => sum + (svc.price_info?.sale_price || 0),
                  0
                ) / services.length
              : 0,
          },
          reportType: "services",
        };
      }

      default:
        return {
          items: [],
          summary: { totalCount: 0 },
          reportType: type,
        };
    }
  };

  // Export report
  const handleExport = async (format) => {
    try {
      setIsExporting(true);
      setError(null);

      if (!reportData) {
        setError("No report data to export");
        return;
      }

      // Prepare filename with date range
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${reportType}-${selectedCenter}-${timestamp}`;

      // Use our improved reportsApiService for export
      await reportsApiService.generateReportFile(reportData, format, filename);

      showNotification(
        `Report exported successfully as ${format.toUpperCase()}`,
        "success"
      );

      // Track export event
      try {
        analyticsUtils.trackEvent("zenoti:report_exported", {
          reportType,
          format,
          centerCode: selectedCenter,
        });
      } catch (error) {
        console.warn("Analytics error:", error);
      }
    } catch (err) {
      console.error("Error exporting report:", err);
      setError("Failed to export report: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Render the report viewer
  const renderReportViewer = () => {
    if (!showReportViewer || !processedReportData) return null;

    return (
      <div className="report-viewer-modal">
        <div className="report-viewer">
          <div className="report-viewer-header">
            <div className="report-title">
              <File size={20} />
              <h2>{getReportTypeName(reportType)} Report</h2>
            </div>

            <div className="report-date-range">
              <Calendar size={16} />
              <span>
                {formatDisplayDate(dateRange.startDate)} —{" "}
                {formatDisplayDate(dateRange.endDate)}
              </span>
            </div>

            <div className="report-actions">
              <button
                className="action-button"
                onClick={() => handleExport("csv")}
                disabled={isExporting}
                title="Export to CSV"
              >
                <Download size={18} />
                <span>CSV</span>
              </button>

              <button
                className="action-button"
                onClick={() => handleExport("json")}
                disabled={isExporting}
                title="Export to JSON"
              >
                <Download size={18} />
                <span>JSON</span>
              </button>

              <button
                className="action-button"
                onClick={() => window.print()}
                title="Print Report"
              >
                <Printer size={18} />
                <span>Print</span>
              </button>

              <button
                className="close-button"
                onClick={() => setShowReportViewer(false)}
                title="Close Report"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          <div className="report-viewer-content">{renderReportContent()}</div>
        </div>
      </div>
    );
  };

  // Render the appropriate report content based on type
  const renderReportContent = () => {
    if (!processedReportData) {
      return <div className="no-data-message">No report data available</div>;
    }

    switch (processedReportData.reportType) {
      case "sales":
        return renderSalesReport();
      case "appointments":
        return renderAppointmentsReport();
      case "packages":
        return renderPackagesReport();
      case "services":
        return renderServicesReport();
      default:
        return (
          <div className="no-data-message">
            Unsupported report type: {processedReportData.reportType}
          </div>
        );
    }
  };

  // Render sales report
  const renderSalesReport = () => {
    const { summary, items, basis } = processedReportData;

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Sales</h4>
            <div className="value">
              {formatCurrency(summary.totalSales || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Refunds</h4>
            <div className="value">
              {formatCurrency(summary.totalRefunds || 0)}
            </div>
          </div>
          <div className="summary-card">
            <h4>Net Sales</h4>
            <div className="value">{formatCurrency(summary.netSales || 0)}</div>
          </div>
        </div>

        <div className="report-section">
          <div className="section-header">
            <h3>
              Sales by Item{" "}
              {basis
                ? `(${basis === "cash" ? "Cash Basis" : "Accrual Basis"})`
                : ""}
            </h3>
          </div>

          <div className="section-content">
            {items && items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Total Amount</th>
                    <th>Refunds</th>
                    <th>Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.type}</td>
                      <td>{item.quantity || 0}</td>
                      <td>{formatCurrency(item.totalAmount || 0)}</td>
                      <td>{formatCurrency(item.refundAmount || 0)}</td>
                      <td>{formatCurrency(item.netAmount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data-message">
                <p>No sales data available for the selected period</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render appointments report
  const renderAppointmentsReport = () => {
    const { items, summary } = processedReportData;

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Appointments</h4>
            <div className="value">{summary.totalCount}</div>
          </div>
          <div className="summary-card">
            <h4>Completed</h4>
            <div className="value">{summary.completed || 0}</div>
          </div>
          <div className="summary-card">
            <h4>Cancelled</h4>
            <div className="value">{summary.cancelled || 0}</div>
          </div>
        </div>

        <div className="report-section">
          <div className="section-header">
            <h3>Appointment Details</h3>
          </div>

          <div className="section-content">
            {items && items.length > 0 ? (
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
                  {items.map((appt, index) => (
                    <tr key={appt.id || index}>
                      <td>
                        {appt.startTime
                          ? new Date(appt.startTime).toLocaleString([], {
                              year: "2-digit",
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </td>
                      <td>{appt.clientName}</td>
                      <td>{appt.serviceName}</td>
                      <td>{appt.therapistName}</td>
                      <td>
                        <span
                          className={`status-badge ${appt.status.toLowerCase()}`}
                        >
                          {appt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data-message">
                <p>No appointments found for the selected period</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render packages report
  const renderPackagesReport = () => {
    const { items, summary } = processedReportData;

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Packages</h4>
            <div className="value">{summary.totalCount}</div>
          </div>
          <div className="summary-card">
            <h4>Active Packages</h4>
            <div className="value">{summary.activeCount}</div>
          </div>
        </div>

        <div className="report-section">
          <div className="section-header">
            <h3>Package Details</h3>
          </div>

          <div className="section-content">
            {items && items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((pkg, index) => (
                    <tr key={pkg.id || index}>
                      <td>{pkg.name}</td>
                      <td>{pkg.type === 2 ? "Regular" : pkg.type}</td>
                      <td>{pkg.description || "N/A"}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            pkg.active ? "active" : "inactive"
                          }`}
                        >
                          {pkg.active ? "Active" : "Inactive"}
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
        </div>
      </div>
    );
  };

  // Render services report
  const renderServicesReport = () => {
    const { items, summary } = processedReportData;

    return (
      <div className="report-content">
        <div className="report-summary">
          <div className="summary-card">
            <h4>Total Services</h4>
            <div className="value">{summary.totalCount}</div>
          </div>
          <div className="summary-card">
            <h4>Average Price</h4>
            <div className="value">{formatCurrency(summary.averagePrice)}</div>
          </div>
        </div>

        <div className="report-section">
          <div className="section-header">
            <h3>Service Details</h3>
          </div>

          <div className="section-content">
            {items && items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Duration</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((service, index) => (
                    <tr key={service.id || index}>
                      <td>{service.name}</td>
                      <td>{formatDuration(service.duration)}</td>
                      <td>
                        {formatCurrency(service.price_info?.sale_price || 0)}
                      </td>
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
        </div>
      </div>
    );
  };

  return (
    <div className="reports-section">
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
                  <>
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
                        <option value="GiftCard">Gift Cards</option>
                        <option value="PrepaidCard">Prepaid Cards</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label htmlFor="paymentMode">Payment Mode</label>
                      <select
                        id="paymentMode"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                      >
                        <option value="All">All Payment Modes</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Check">Check</option>
                        <option value="GiftCard">Gift Card</option>
                        <option value="Membership">Membership</option>
                        <option value="Package">Package</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label htmlFor="status">
                        {reportType === "sales_cash" ? "Sale Type" : "Status"}
                      </label>
                      <select
                        id="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="All">
                          All{" "}
                          {reportType === "sales_cash"
                            ? "Sale Types"
                            : "Statuses"}
                        </option>
                        {reportType === "sales_cash" ? (
                          <>
                            <option value="Sale">Sales</option>
                            <option value="Refund">Refunds</option>
                            <option value="Recurring">Recurring</option>
                            <option value="Charges">Charges</option>
                          </>
                        ) : (
                          <>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Refunded">Refunded</option>
                          </>
                        )}
                      </select>
                    </div>
                  </>
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
          {renderReportViewer()}
        </div>
      )}
    </div>
  );
};

// Helper functions

// Format currency display
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

// Format duration display
function formatDuration(minutes) {
  if (!minutes) return "N/A";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ""}`;
  } else {
    return `${mins}m`;
  }
}

// Format date for API
function formatDate(date) {
  if (!date) return "";

  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

// Format date for display
function formatDisplayDate(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Get date before given days
function getDateBefore(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

// Get start of month
function getStartOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  return d;
}

// Get end of month
function getEndOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

// Get human-readable report type name
function getReportTypeName(type) {
  const names = {
    sales_accrual: "Sales (Accrual Basis)",
    sales_cash: "Sales (Cash Basis)",
    appointments: "Appointments",
    packages: "Packages",
    services: "Services",
  };

  return names[type] || type;
}

export default ImprovedReportsSection;
