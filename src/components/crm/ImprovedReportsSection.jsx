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
  // Use a historical date range where we know data exists (2023)
  const [dateRange, setDateRange] = useState({
    startDate: "2023-11-01",
    endDate: "2023-12-01",
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

  // Hardcoded center IDs mapping (same as in zenotiService)
  // This is essential for reports that require center IDs
  const CENTER_ID_MAP = {
    AUS: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
    CHI: "c359afac-3210-49e5-a930-6676d8bb188a",
    CW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7",
    Draper: "5da78932-c7e1-48b2-a099-9c302c75d7e1",
    HTN: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12",
    TRA: "ca3dc432-280b-4cdb-86ea-6e582f3182a9", // Same as AUS
    TRC: "c359afac-3210-49e5-a930-6676d8bb188a", // Same as CHI
    TRW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7", // Same as CW
    TRD: "5da78932-c7e1-48b2-a099-9c302c75d7e1", // Same as Draper
    TRH: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12", // Same as HTN
    Houston: "8ae56789-f213-4cd7-9e34-10a2bc45d678",
    // Fall back center ID for any unknown center
    DEFAULT: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
  };

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

  // Get center ID from the center code (using hardcoded mapping)
  const getCenterIdFromCode = (centerCode) => {
    if (!centerCode) return null;

    // Check our hardcoded mapping first
    if (CENTER_ID_MAP[centerCode]) {
      return CENTER_ID_MAP[centerCode];
    }

    // If not found in mapping, look through loaded centers
    const center = centers.find((c) => c.code === centerCode);
    if (center && center.id) {
      return center.id;
    }

    // Last resort: use our default ID
    console.warn(`Center ID for ${centerCode} not found, using default ID`);
    return CENTER_ID_MAP.DEFAULT;
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

      // Get center ID using our helper function - this is critical!
      const centerId = getCenterIdFromCode(selectedCenter);

      // Validate center ID
      if (!centerId && ["sales_accrual", "sales_cash"].includes(reportType)) {
        setError(
          `Cannot find valid center ID for ${selectedCenter}. Sales reports require a valid center ID.`
        );
        setIsLoading(false);
        return;
      }

      // Add timestamp to prevent caching
      const timestamp = Date.now();

      // Make appropriate API call based on report type
      switch (reportType) {
        case "sales_accrual": {
          // Prepare parameters for accrual basis sales report
          const salesParams = {
            start_date: formattedStartDate,
            end_date: formattedEndDate,
            center_ids: [centerId], // Use the retrieved center ID
            page: 1,
            size: 100,
            _t: timestamp,
          };

          console.log("Using center ID for sales report:", centerId);

          // Call the accrual basis report API
          console.log(
            "Generating accrual basis sales report with:",
            salesParams
          );

          // Try the API call without falling back immediately
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
            center_ids: [centerId], // Use the retrieved center ID
            level_of_detail: "1", // Detailed level
            _t: timestamp,
          };

          console.log("Using center ID for cash sales report:", centerId);

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

          // If we still have issues with the API, let's try the fallback method
          try {
            response = await reportsApiService.getSalesCashBasisReport(
              salesParams
            );
          } catch (err) {
            console.warn("Sales cash API failed, using fallback:", err.message);
            // Use fallback method - getRegularSalesReport
            response = await reportsApiService.getSalesReport({
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
              centerCode: selectedCenter,
              itemType: itemType !== "All" ? itemType : null,
              paymentMode: paymentMode !== "All" ? paymentMode : null,
              _t: timestamp,
            });
          }
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
        console.log(`Processing ${type} report data:`, data);

        // Check which format we're dealing with
        const isCashBasis = type === "sales_cash";

        // Handle the flat file format from the new API endpoints
        let totalSales = 0;
        let totalRefunds = 0;
        let items = [];

        // Extract data from the report response with additional fallbacks
        // for the specific Zenoti response format we're seeing
        let reportItems = [];

        // Try different data locations based on the API response structure
        if (data.data && Array.isArray(data.data)) {
          reportItems = data.data;
        } else if (
          data.report &&
          data.report.sales &&
          Array.isArray(data.report.sales)
        ) {
          reportItems = data.report.sales;
        } else if (data.items && Array.isArray(data.items)) {
          reportItems = data.items;
        }

        console.log("Report items for processing:", reportItems);

        if (reportItems && reportItems.length > 0) {
          // Group by item name/type for summary
          const itemsMap = {};

          reportItems.forEach((item) => {
            try {
              // Extract values with extensive fallbacks for all possible field names
              const itemName =
                item.item_name ||
                item.service_name ||
                item.product_name ||
                item.name ||
                item["Item Name"] || // CSV format
                "Unknown";

              const itemType =
                item.item_type ||
                item.type ||
                item["Item Type"] || // CSV format
                "Unknown";

              // Handle different price field names and formats
              let amount = 0;
              if (item.final_sale_price !== undefined)
                amount = parseFloat(item.final_sale_price);
              else if (item.amount !== undefined)
                amount = parseFloat(item.amount);
              else if (item.price !== undefined)
                amount = parseFloat(item.price);
              else if (item["Sales(Inc. Tax)"] !== undefined)
                amount = parseFloat(item["Sales(Inc. Tax)"]);
              else if (item["Sales (Exc. Tax)"] !== undefined)
                amount = parseFloat(item["Sales (Exc. Tax)"]);

              // Parse refund status from various fields
              const isRefund =
                item.is_refund === true ||
                item.is_refund === "true" ||
                item.is_refund === 1 ||
                item.is_refund === "1" ||
                amount < 0 ||
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
            } catch (itemError) {
              console.error("Error processing sales item:", itemError, item);
            }
          });

          // Convert map to array
          items = Object.values(itemsMap);
        }

        // If we already have summary data in the response, use it
        // First check different possible summary locations
        let existingSummary = null;
        if (data.summary) {
          existingSummary = data.summary;
        } else if (data.report && data.report.total) {
          existingSummary = {
            total_sales: data.report.total.sales || 0,
            total_refunds: data.report.total.refunds || 0,
            net_sales:
              (data.report.total.sales || 0) - (data.report.total.refunds || 0),
          };
        }

        if (existingSummary) {
          console.log("Using existing summary data:", existingSummary);
          return {
            summary: existingSummary,
            items,
            totalCount: items.length,
            reportType: "sales",
            basis: isCashBasis ? "cash" : "accrual",
          };
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

        console.log("Generated sales report summary:", summary);
        console.log("Processed sales items:", items);

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
            : appt.guest_name || appt.clientName || "Unknown Client";

          // Extract service name with fallbacks
          const serviceName = appt.service
            ? appt.service.name
            : appt.parentServiceName ||
              appt.serviceName ||
              appt.service_name ||
              "Unknown Service";

          // Extract therapist name with fallbacks
          const therapistName = appt.therapist
            ? `${appt.therapist.firstName || ""} ${
                appt.therapist.lastName || ""
              }`.trim()
            : appt.therapistName || appt.therapist_name || "Unknown Therapist";

          // Map status codes to readable strings
          const statusMap = {
            0: "Booked",
            1: "Confirmed",
            2: "Checked In",
            3: "Completed",
            4: "Cancelled",
            5: "No Show",
          };

          const status =
            typeof appt.status === "number"
              ? statusMap[appt.status] || "Unknown"
              : appt.status || "Unknown";

          return {
            id: appt.appointmentId || appt.id,
            date: appt.startTime ? new Date(appt.startTime) : null,
            startTime: appt.startTime || appt.start_time,
            endTime: appt.endTime || appt.end_time,
            clientName,
            serviceName,
            therapistName,
            status,
            rawStatus: appt.status,
            centerCode: selectedCenter,
          };
        });

        return {
          items: processedAppointments,
          totalCount: processedAppointments.length,
          summary: {
            totalCount: processedAppointments.length,
            booked: processedAppointments.filter((a) => a.status === "Booked")
              .length,
            checkedIn: processedAppointments.filter(
              (a) => a.status === "Checked In"
            ).length,
            completed: processedAppointments.filter(
              (a) => a.status === "Completed"
            ).length,
            cancelled: processedAppointments.filter(
              (a) => a.status === "Cancelled"
            ).length,
            noShow: processedAppointments.filter((a) => a.status === "No Show")
              .length,
          },
          reportType: "appointments",
        };
      }

      case "packages": {
        // Process packages data
        const packages = data.packages || Array.isArray(data) ? data : [];

        return {
          items: packages,
          totalCount: packages.length,
          summary: {
            totalCount: packages.length,
            activeCount: packages.filter(
              (p) => p.active || p.status === "Active"
            ).length,
          },
          reportType: "packages",
        };
      }

      case "services": {
        // Process services data
        const services = data.services || Array.isArray(data) ? data : [];

        return {
          items: services,
          totalCount: services.length,
          summary: {
            totalCount: services.length,
            averagePrice: services.length
              ? services.reduce(
                  (sum, svc) =>
                    sum + (svc.price_info?.sale_price || svc.price || 0),
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
      <div className="rpt-report-viewer-modal">
        <div className="rpt-report-viewer">
          <div className="rpt-report-viewer-header">
            <div className="rpt-report-title">
              <File size={20} />
              <h2>{getReportTypeName(reportType)} Report</h2>
            </div>

            <div className="rpt-report-date-range">
              <Calendar size={16} />
              <span>
                {formatDisplayDate(dateRange.startDate)} —{" "}
                {formatDisplayDate(dateRange.endDate)}
              </span>
            </div>

            <div className="rpt-report-actions">
              <button
                className="rpt-action-button"
                onClick={() => handleExport("csv")}
                disabled={isExporting}
                title="Export to CSV"
              >
                <Download size={18} />
                <span>CSV</span>
              </button>

              <button
                className="rpt-action-button"
                onClick={() => handleExport("json")}
                disabled={isExporting}
                title="Export to JSON"
              >
                <Download size={18} />
                <span>JSON</span>
              </button>

              <button
                className="rpt-action-button"
                onClick={() => window.print()}
                title="Print Report"
              >
                <Printer size={18} />
                <span>Print</span>
              </button>

              <button
                className="rpt-close-button"
                onClick={() => setShowReportViewer(false)}
                title="Close Report"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          <div className="rpt-report-viewer-content">
            {renderReportContent()}
          </div>
        </div>
      </div>
    );
  };

  // Render the appropriate report content based on type
  const renderReportContent = () => {
    if (!processedReportData) {
      return (
        <div className="rpt-no-data-message">No report data available</div>
      );
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
          <div className="rpt-no-data-message">
            Unsupported report type: {processedReportData.reportType}
          </div>
        );
    }
  };

  // Render sales report
  const renderSalesReport = () => {
    const { summary, items, basis } = processedReportData;

    return (
      <div className="rpt-report-content">
        <div className="rpt-report-summary">
          <div className="rpt-summary-card">
            <h4>Total Sales</h4>
            <div className="value">
              {formatCurrency(summary.totalSales || 0)}
            </div>
          </div>
          <div className="rpt-summary-card">
            <h4>Refunds</h4>
            <div className="value">
              {formatCurrency(summary.totalRefunds || 0)}
            </div>
          </div>
          <div className="rpt-summary-card">
            <h4>Net Sales</h4>
            <div className="value">{formatCurrency(summary.netSales || 0)}</div>
          </div>
        </div>

        <div className="rpt-report-section">
          <div className="rpt-section-header">
            <h3>
              Sales by Item{" "}
              {basis
                ? `(${basis === "cash" ? "Cash Basis" : "Accrual Basis"})`
                : ""}
            </h3>
          </div>

          <div className="rpt-section-content">
            {items && items.length > 0 ? (
              <table className="rpt-data-table">
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
              <div className="rpt-no-data-message">
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
      <div className="rpt-report-content">
        <div className="rpt-report-summary">
          <div className="rpt-summary-card">
            <h4>Total Appointments</h4>
            <div className="value">{summary.totalCount}</div>
          </div>
          <div className="rpt-summary-card">
            <h4>Completed</h4>
            <div className="value">{summary.completed || 0}</div>
          </div>
          <div className="rpt-summary-card">
            <h4>Cancelled</h4>
            <div className="value">{summary.cancelled || 0}</div>
          </div>
        </div>

        <div className="rpt-report-section">
          <div className="rpt-section-header">
            <h3>Appointment Details</h3>
          </div>

          <div className="rpt-section-content">
            {items && items.length > 0 ? (
              <table className="rpt-data-table">
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
                          className={`rpt-status-badge ${appt.status.toLowerCase()}`}
                        >
                          {appt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rpt-no-data-message">
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
      <div className="rpt-report-content">
        <div className="rpt-report-summary">
          <div className="rpt-summary-card">
            <h4>Total Packages</h4>
            <div className="value">{summary.totalCount}</div>
          </div>
          <div className="rpt-summary-card">
            <h4>Active Packages</h4>
            <div className="value">{summary.activeCount}</div>
          </div>
        </div>

        <div className="rpt-report-section">
          <div className="rpt-section-header">
            <h3>Package Details</h3>
          </div>

          <div className="rpt-section-content">
            {items && items.length > 0 ? (
              <table className="rpt-data-table">
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
                          className={`rpt-status-badge ${
                            pkg.active || pkg.status === "Active"
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {pkg.active || pkg.status === "Active"
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rpt-no-data-message">
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
      <div className="rpt-report-content">
        <div className="rpt-report-summary">
          <div className="rpt-summary-card">
            <h4>Total Services</h4>
            <div className="value">{summary.totalCount}</div>
          </div>
          <div className="rpt-summary-card">
            <h4>Average Price</h4>
            <div className="value">{formatCurrency(summary.averagePrice)}</div>
          </div>
        </div>

        <div className="rpt-report-section">
          <div className="rpt-section-header">
            <h3>Service Details</h3>
          </div>

          <div className="rpt-section-content">
            {items && items.length > 0 ? (
              <table className="rpt-data-table">
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
                        {formatCurrency(
                          service.price_info?.sale_price || service.price || 0
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rpt-no-data-message">
                <p>No services available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rpt-reports-section">
      <div className="rpt-section-header">
        <h2 style={{ marginBottom: "0" }}>
          <BarChart2 className="rpt-header-icon" />
          Zenoti Reports
        </h2>
        <div className="rpt-header-actions">
          <button
            className="rpt-refresh-button"
            onClick={loadCenters}
            disabled={isLoading || !connectionStatus?.connected}
          >
            <RefreshCw size={16} className={isLoading ? "rpt-spinning" : ""} />
          </button>
        </div>
      </div>

      {!connectionStatus?.connected ? (
        <div className="rpt-not-connected-message">
          <Info size={48} />
          <h3>Not Connected to Zenoti</h3>
          <p>Please configure your Zenoti connection to access reports.</p>
        </div>
      ) : (
        <div className="rpt-reports-container">
          {/* Current Center Display */}
          <div className="rpt-current-center">
            <strong>Current Center:</strong> {selectedCenter}
            {CENTER_ID_MAP[selectedCenter] && (
              <span className="rpt-center-id-debug">
                (ID: {CENTER_ID_MAP[selectedCenter].substr(0, 8)}...)
              </span>
            )}
          </div>

          {/* Report Type Selection */}
          <div className="rpt-report-type-selector">
            <h3>Select Report Type</h3>
            <div className="rpt-report-type-buttons">
              {REPORT_TYPES.map((report) => (
                <button
                  key={report.id}
                  className={`rpt-report-type-button ${
                    reportType === report.id ? "active" : ""
                  }`}
                  onClick={() => setReportType(report.id)}
                >
                  {report.icon}
                  <span>{report.label}</span>
                </button>
              ))}
            </div>

            <div className="rpt-report-description">
              <Info size={14} />
              <p>
                {REPORT_TYPES.find((r) => r.id === reportType)?.description}
              </p>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="rpt-date-range-section">
            <h3>Select Date Range</h3>

            <div className="rpt-date-range-presets">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="rpt-date-preset-button"
                  onClick={() => handleDateRangePreset(preset)}
                >
                  <Calendar size={14} />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="rpt-date-range-inputs">
              <div className="rpt-date-field">
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
              <div className="rpt-date-field">
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
          <div className="rpt-filters-section">
            <button
              className="rpt-filter-toggle-button"
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
              <div className="rpt-filter-controls">
                {/* Show different filters based on report type */}
                {["sales_accrual", "sales_cash"].includes(reportType) && (
                  <>
                    <div className="rpt-filter-group">
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

                    <div className="rpt-filter-group">
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

                    <div className="rpt-filter-group">
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
                  <div className="rpt-filter-group">
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
            <div className="rpt-error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {success && (
            <div className="rpt-success-message">
              <Info size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="rpt-reports-action-buttons">
            <button
              className="rpt-generate-report-btn"
              onClick={generateReport}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="rpt-spinning" />
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
              className="rpt-export-btn"
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
