import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Divider,
  Stack,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  Download,
  Refresh,
  AttachMoney,
  Event,
  TrendingUp,
  Assessment,
  DateRange,
  Receipt,
  AccountBalance,
  EventAvailable,
} from "@mui/icons-material";
import jsPDF from "jspdf";

const CRMAnalyticsDashboard = ({
  selectedCenter,
  centerMapping = {},
  onRefresh,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportType, setReportType] = useState("accrual");
  const [dateRange, setDateRange] = useState("30days");

  // Custom date range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useCustomDates, setUseCustomDates] = useState(false);

  // Data states
  const [accrualReports, setAccrualReports] = useState([]);
  const [cashReports, setCashReports] = useState([]);
  const [appointmentReports, setAppointmentReports] = useState([]);

  // Processed data states
  const [chartData, setChartData] = useState([]);
  const [rawReportData, setRawReportData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0,
    totalRefunds: 0,
    netSales: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    cancellationRate: 0,
    averageValue: 0,
    topService: "",
    totalRevenue: 0,
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Chart colors
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
    "#FFC658",
  ];

  // Memoized center mapping
  const centerCodeToId = useMemo(() => {
    const mapping = {};
    Object.entries(centerMapping).forEach(([key, value]) => {
      if (key.length < 10) {
        mapping[key] = value;
      }
    });
    return mapping;
  }, [centerMapping]);

  const centerIdToCode = useMemo(() => {
    const mapping = {};
    Object.entries(centerMapping).forEach(([key, value]) => {
      if (key.length > 10) {
        mapping[key] = value;
      }
    });
    return mapping;
  }, [centerMapping]);

  // Utility to safely parse JSON data
  const safeJsonParse = useCallback((jsonString) => {
    if (!jsonString) return [];
    if (Array.isArray(jsonString)) return jsonString;
    if (typeof jsonString === "object") return [jsonString];

    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return [];
    }
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate date range
  const getDateRange = useCallback(() => {
    if (useCustomDates && startDate && endDate) {
      return { startDate, endDate };
    }

    const now = new Date();
    const start = new Date();

    switch (dateRange) {
      case "7days":
        start.setDate(now.getDate() - 7);
        break;
      case "30days":
        start.setDate(now.getDate() - 30);
        break;
      case "90days":
        start.setDate(now.getDate() - 90);
        break;
      case "1year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  }, [dateRange, useCustomDates, startDate, endDate]);

  // Fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { startDate: filterStartDate, endDate: filterEndDate } =
        getDateRange();

      console.log("Fetching analytics data:", {
        reportType,
        selectedCenter,
        dateRange: { filterStartDate, filterEndDate },
      });

      // Build base queries
      let accrualQuery = supabase
        .from("zenoti_sales_accrual_reports")
        .select("*")
        .gte("start_date", filterStartDate)
        .lte("end_date", filterEndDate)
        .order("start_date", { ascending: false });

      let cashQuery = supabase
        .from("zenoti_sales_cash_reports")
        .select("*")
        .gte("start_date", filterStartDate)
        .lte("end_date", filterEndDate)
        .order("start_date", { ascending: false });

      let appointmentQuery = supabase
        .from("zenoti_appointments_reports")
        .select("*")
        .gte("start_date", filterStartDate)
        .lte("end_date", filterEndDate)
        .order("start_date", { ascending: false });

      // Apply center filter if selected
      if (selectedCenter !== "ALL") {
        const centerCode = selectedCenter.split(" - ")[0];
        const centerId = centerCodeToId[centerCode];

        if (centerId) {
          accrualQuery = accrualQuery.eq("center_id", centerId);
          cashQuery = cashQuery.eq("center_id", centerId);
          appointmentQuery = appointmentQuery.eq("center_id", centerId);
        }
      }

      // Execute queries
      const [accrualResult, cashResult, appointmentResult] = await Promise.all([
        accrualQuery,
        cashQuery,
        appointmentQuery,
      ]);

      if (accrualResult.error) throw accrualResult.error;
      if (cashResult.error) throw cashResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      console.log("Query results:", {
        accrual: accrualResult.data?.length,
        cash: cashResult.data?.length,
        appointments: appointmentResult.data?.length,
      });

      setAccrualReports(accrualResult.data || []);
      setCashReports(cashResult.data || []);
      setAppointmentReports(appointmentResult.data || []);

      // Process the data based on selected report type
      processReportData(
        accrualResult.data || [],
        cashResult.data || [],
        appointmentResult.data || []
      );
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError(`Failed to fetch analytics data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCenter, centerCodeToId, getDateRange, reportType]);

  // Process report data based on selected report type
  const processReportData = useCallback(
    (accrualData, cashData, appointmentData) => {
      let processedData = [];
      let stats = {
        totalSales: 0,
        totalRefunds: 0,
        netSales: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        cancellationRate: 0,
        averageValue: 0,
        topService: "",
        totalRevenue: 0,
      };

      let serviceCount = {};
      let dailyData = {};

      // Process based on report type
      if (reportType === "accrual") {
        // Process accrual data only
        accrualData.forEach((report) => {
          const salesItems = safeJsonParse(report.data);
          salesItems.forEach((item) => {
            // Apply center filter at item level if needed
            if (selectedCenter !== "ALL") {
              const centerCode = selectedCenter.split(" - ")[0];
              const centerId = centerCodeToId[centerCode];
              if (item.center_id !== centerId) {
                return;
              }
            }

            const saleAmount = parseFloat(item.sales_inc_tax || 0);
            const isRefund = saleAmount < 0;

            if (isRefund) {
              stats.totalRefunds += Math.abs(saleAmount);
            } else {
              stats.totalSales += saleAmount;
              stats.totalRevenue += saleAmount;
            }

            // Track services
            const serviceName = item.item_name || "Unknown";
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;

            // Track daily data
            const date =
              item.sale_date?.split("T")[0] ||
              new Date().toISOString().split("T")[0];
            if (!dailyData[date]) {
              dailyData[date] = { date, sales: 0, refunds: 0, transactions: 0 };
            }
            if (isRefund) {
              dailyData[date].refunds += Math.abs(saleAmount);
            } else {
              dailyData[date].sales += saleAmount;
            }
            dailyData[date].transactions += 1;

            processedData.push({
              sale_date: item.sale_date,
              guest_name: item.guest_name,
              item_name: item.item_name,
              sales_inc_tax: saleAmount,
              center_name: item.center_name,
              invoice_no: item.invoice_no,
              payment_type: item.payment_type || "",
              status: item.status,
              sold_by: item.sold_by || item.created_by,
              report_type: "Accrual",
            });
          });
        });
        stats.netSales = stats.totalSales - stats.totalRefunds;
        stats.averageValue =
          processedData.length > 0
            ? stats.totalSales / processedData.length
            : 0;
      } else if (reportType === "cash_basis") {
        // Process cash data only
        cashData.forEach((report) => {
          const salesItems = safeJsonParse(report.data);
          salesItems.forEach((item) => {
            // Apply center filter at item level if needed
            if (selectedCenter !== "ALL") {
              const centerCode = selectedCenter.split(" - ")[0];
              const centerId = centerCodeToId[centerCode];
              if (item.center_id !== centerId) {
                return;
              }
            }

            const collectedAmount = parseFloat(
              item.sales_collected_inc_tax || 0
            );
            stats.totalSales += collectedAmount;
            stats.totalRevenue += collectedAmount;

            // Track services
            const serviceName = item.item_name || "Unknown";
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;

            // Track daily data
            const date =
              item.sale_date?.split("T")[0] ||
              new Date().toISOString().split("T")[0];
            if (!dailyData[date]) {
              dailyData[date] = { date, collected: 0, transactions: 0 };
            }
            dailyData[date].collected += collectedAmount;
            dailyData[date].transactions += 1;

            processedData.push({
              sale_date: item.sale_date,
              guest_name: item.guest_name,
              item_name: item.item_name,
              sales_collected_inc_tax: collectedAmount,
              center_name: item.center_name,
              invoice_no: item.invoice_no,
              payment_type: item.payment_type || "",
              created_by: item.created_by,
              report_type: "Cash Basis",
            });
          });
        });
        stats.netSales = stats.totalSales;
        stats.averageValue =
          processedData.length > 0
            ? stats.totalSales / processedData.length
            : 0;
      } else if (reportType === "appointments") {
        // Process appointment data only
        appointmentData.forEach((report) => {
          const appointments = safeJsonParse(report.data);
          appointments.forEach((appointment) => {
            // Apply center filter at item level if needed
            if (selectedCenter !== "ALL") {
              const centerCode = selectedCenter.split(" - ")[0];
              const centerId = centerCodeToId[centerCode];
              if (appointment.center_id !== centerId) {
                return;
              }
            }

            stats.totalAppointments++;
            if (appointment.status === "Closed") {
              stats.completedAppointments++;
            }

            // Track services
            const serviceName = appointment.service_name || "Unknown";
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;

            // Track daily data
            const date =
              appointment.appointment_date?.split("T")[0] ||
              new Date().toISOString().split("T")[0];
            if (!dailyData[date]) {
              dailyData[date] = {
                date,
                appointments: 0,
                completed: 0,
                cancelled: 0,
              };
            }
            dailyData[date].appointments += 1;
            if (appointment.status === "Closed") {
              dailyData[date].completed += 1;
            } else if (
              appointment.status === "Deleted" ||
              appointment.status === "Cancelled"
            ) {
              dailyData[date].cancelled += 1;
            }

            processedData.push({
              appointment_date: appointment.appointment_date,
              guest_name: appointment.guest_name,
              service_name: appointment.service_name,
              serviced_by: appointment.serviced_by,
              status: appointment.status,
              center_name: appointment.center_name,
              start_time: appointment.start_time,
              end_time: appointment.end_time,
              guest_code: appointment.guest_code,
              report_type: "Appointments",
            });
          });
        });
        stats.cancellationRate =
          stats.totalAppointments > 0
            ? ((stats.totalAppointments - stats.completedAppointments) /
                stats.totalAppointments) *
              100
            : 0;
      }

      // Find top service
      const topServiceEntry = Object.entries(serviceCount).sort(
        ([, a], [, b]) => b - a
      )[0];
      stats.topService = topServiceEntry ? topServiceEntry[0] : "N/A";

      // Create chart data
      let chartData = Object.values(dailyData).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setRawReportData(processedData);
      setSummaryStats(stats);
      setChartData(chartData);

      console.log("Processed data:", {
        records: processedData.length,
        stats,
        chartPoints: chartData.length,
      });
    },
    [reportType, selectedCenter, centerCodeToId, safeJsonParse]
  );

  // Load data on mount and when dependencies change
  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Reprocess data when report type changes
  useEffect(() => {
    if (
      accrualReports.length > 0 ||
      cashReports.length > 0 ||
      appointmentReports.length > 0
    ) {
      processReportData(accrualReports, cashReports, appointmentReports);
    }
  }, [
    reportType,
    processReportData,
    accrualReports,
    cashReports,
    appointmentReports,
  ]);

  // Reset page when report type changes
  useEffect(() => {
    setPage(0);
  }, [reportType]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    fetchAnalyticsData();
    if (onRefresh) {
      onRefresh();
    }
  }, [fetchAnalyticsData, onRefresh]);

  // Export to PDF
  const exportToPDF = useCallback(() => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("CRM Analytics Report", 20, 30);

    doc.setFontSize(12);
    const { startDate: reportStartDate, endDate: reportEndDate } =
      getDateRange();
    doc.text(`Report Period: ${reportStartDate} to ${reportEndDate}`, 20, 50);
    doc.text(
      `Center: ${selectedCenter === "ALL" ? "All Centers" : selectedCenter}`,
      20,
      60
    );
    doc.text(`Report Type: ${reportType}`, 20, 70);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 80);

    // Summary section
    doc.setFontSize(16);
    doc.text("Summary", 20, 100);

    doc.setFontSize(12);
    if (reportType === "appointments") {
      doc.text(
        `Total Appointments: ${summaryStats.totalAppointments}`,
        20,
        120
      );
      doc.text(
        `Completed Appointments: ${summaryStats.completedAppointments}`,
        20,
        130
      );
      doc.text(
        `Cancellation Rate: ${summaryStats.cancellationRate.toFixed(1)}%`,
        20,
        140
      );
      doc.text(`Most Popular Service: ${summaryStats.topService}`, 20, 150);
    } else {
      doc.text(
        `Total Sales: ${formatCurrency(summaryStats.totalSales)}`,
        20,
        120
      );
      if (reportType === "accrual") {
        doc.text(
          `Total Refunds: ${formatCurrency(summaryStats.totalRefunds)}`,
          20,
          130
        );
      }
      doc.text(`Net Sales: ${formatCurrency(summaryStats.netSales)}`, 20, 140);
      doc.text(
        `Average Transaction: ${formatCurrency(summaryStats.averageValue)}`,
        20,
        150
      );
      doc.text(`Most Popular Service: ${summaryStats.topService}`, 20, 160);
    }

    doc.save(
      `crm-analytics-report-${reportType}-${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );
  }, [summaryStats, selectedCenter, reportType, getDateRange]);

  // Get columns for raw report data based on report type
  const getReportColumns = () => {
    switch (reportType) {
      case "accrual":
        return [
          { key: "sale_date", label: "Sale Date", format: "date" },
          { key: "guest_name", label: "Guest" },
          { key: "item_name", label: "Item" },
          {
            key: "sales_inc_tax",
            label: "Sales (Inc. Tax)",
            format: "currency",
          },
          { key: "center_name", label: "Center" },
          { key: "invoice_no", label: "Invoice" },
          { key: "payment_type", label: "Payment Type" },
          { key: "sold_by", label: "Sold By" },
          { key: "status", label: "Status" },
        ];
      case "cash_basis":
        return [
          { key: "sale_date", label: "Sale Date", format: "date" },
          { key: "guest_name", label: "Guest" },
          { key: "item_name", label: "Item" },
          {
            key: "sales_collected_inc_tax",
            label: "Collected (Inc. Tax)",
            format: "currency",
          },
          { key: "center_name", label: "Center" },
          { key: "invoice_no", label: "Invoice" },
          { key: "payment_type", label: "Payment Type" },
          { key: "created_by", label: "Created By" },
        ];
      case "appointments":
        return [
          { key: "appointment_date", label: "Date", format: "date" },
          { key: "guest_name", label: "Guest" },
          { key: "service_name", label: "Service" },
          { key: "serviced_by", label: "Therapist" },
          { key: "status", label: "Status" },
          { key: "center_name", label: "Center" },
          { key: "start_time", label: "Start Time", format: "datetime" },
          { key: "guest_code", label: "Guest Code" },
        ];
      default:
        return [];
    }
  };

  // Format cell value based on column type
  const formatCellValue = (value, format) => {
    if (!value && value !== 0) return "N/A";

    switch (format) {
      case "currency":
        return formatCurrency(parseFloat(value));
      case "date":
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return value;
        }
      case "datetime":
        try {
          return new Date(value).toLocaleString();
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  // Get current page data for tables
  const getCurrentPageData = (data) => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  };

  // Get the appropriate chart based on report type
  const renderChart = () => {
    if (reportType === "appointments") {
      // Show status distribution pie chart
      const statusData = rawReportData.reduce((acc, item) => {
        const status = item.status || "Unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const pieData = Object.entries(statusData).map(([status, count]) => ({
        name: status,
        value: count,
      }));

      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    } else {
      // Show daily trend line chart for sales
      const dataKey = reportType === "cash_basis" ? "collected" : "sales";
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.3}
              name={reportType === "cash_basis" ? "Collected" : "Sales"}
            />
            {reportType === "accrual" && (
              <Area
                type="monotone"
                dataKey="refunds"
                stroke="#ff7300"
                fill="#ff7300"
                fillOpacity={0.3}
                name="Refunds"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 0, flexShrink: 0 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography variant="h4" fontWeight="bold" color="primary">
            Analytics Dashboard
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={exportToPDF}
              size="medium"
            >
              Export PDF
            </Button>
            <IconButton
              onClick={handleRefresh}
              disabled={isLoading}
              size="large"
            >
              <Refresh />
            </IconButton>
          </Stack>
        </Box>

        {/* Controls */}
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <FormControl size="medium" sx={{ minWidth: 180 }}>
            <InputLabel>Report Type</InputLabel>
            <Select
              value={reportType}
              label="Report Type"
              onChange={(e) => setReportType(e.target.value)}
            >
              <MenuItem value="accrual">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Receipt fontSize="small" />
                  Accrual Report
                </Box>
              </MenuItem>
              <MenuItem value="cash_basis">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccountBalance fontSize="small" />
                  Cash Basis Report
                </Box>
              </MenuItem>
              <MenuItem value="appointments">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <EventAvailable fontSize="small" />
                  Appointments Report
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <FormControl size="medium" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={dateRange}
              label="Period"
              onChange={(e) => {
                setDateRange(e.target.value);
                setUseCustomDates(false);
              }}
            >
              <MenuItem value="7days">Last 7 days</MenuItem>
              <MenuItem value="30days">Last 30 days</MenuItem>
              <MenuItem value="90days">Last 90 days</MenuItem>
              <MenuItem value="1year">Last year</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>

          {dateRange === "custom" && (
            <>
              <TextField
                type="date"
                label="Start Date"
                size="medium"
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setUseCustomDates(true);
                }}
              />
              <TextField
                type="date"
                label="End Date"
                size="medium"
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setUseCustomDates(true);
                }}
              />
            </>
          )}
        </Stack>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2, flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ ml: 2 }}>
              Loading analytics data...
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3} sx={{ p: 2, height: "100%", overflow: "auto" }}>
            {/* Summary Cards */}
            <Box sx={{ flexShrink: 0 }}>
              <Grid container spacing={2}>
                {reportType === "appointments" ? (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <Event sx={{ fontSize: 40, color: "primary.main" }} />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              Total Appointments
                            </Typography>
                            <Typography
                              variant="h3"
                              fontWeight="bold"
                              color="primary"
                            >
                              {summaryStats.totalAppointments.toLocaleString()}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <Assessment
                            sx={{ fontSize: 40, color: "success.main" }}
                          />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              Completed
                            </Typography>
                            <Typography
                              variant="h3"
                              fontWeight="bold"
                              color="success.main"
                            >
                              {summaryStats.completedAppointments.toLocaleString()}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <TrendingUp
                            sx={{
                              fontSize: 40,
                              color:
                                summaryStats.cancellationRate < 20
                                  ? "success.main"
                                  : "warning.main",
                            }}
                          />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              Completion Rate
                            </Typography>
                            <Typography
                              variant="h3"
                              fontWeight="bold"
                              color={
                                summaryStats.cancellationRate < 20
                                  ? "success.main"
                                  : "warning.main"
                              }
                            >
                              {(
                                (summaryStats.completedAppointments /
                                  summaryStats.totalAppointments) *
                                  100 || 0
                              ).toFixed(1)}
                              %
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <Assessment
                            sx={{ fontSize: 40, color: "primary.main" }}
                          />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              Top Service
                            </Typography>
                            <Typography
                              variant="h6"
                              fontWeight="bold"
                              color="primary"
                              sx={{ wordBreak: "break-word" }}
                            >
                              {summaryStats.topService.length > 20
                                ? `${summaryStats.topService.substring(
                                    0,
                                    20
                                  )}...`
                                : summaryStats.topService}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </>
                ) : (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <AttachMoney
                            sx={{ fontSize: 40, color: "primary.main" }}
                          />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              {reportType === "accrual"
                                ? "Total Sales"
                                : "Total Collected"}
                            </Typography>
                            <Typography
                              variant="h4"
                              fontWeight="bold"
                              color="primary"
                            >
                              {formatCurrency(summaryStats.totalSales)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          {reportType === "accrual" ? (
                            <AttachMoney
                              sx={{ fontSize: 40, color: "error.main" }}
                            />
                          ) : (
                            <TrendingUp
                              sx={{ fontSize: 40, color: "success.main" }}
                            />
                          )}
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              {reportType === "accrual"
                                ? "Total Refunds"
                                : "Net Revenue"}
                            </Typography>
                            <Typography
                              variant="h4"
                              fontWeight="bold"
                              color={
                                reportType === "accrual"
                                  ? "error.main"
                                  : "success.main"
                              }
                            >
                              {formatCurrency(
                                reportType === "accrual"
                                  ? summaryStats.totalRefunds
                                  : summaryStats.netSales
                              )}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <TrendingUp
                            sx={{ fontSize: 40, color: "success.main" }}
                          />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              {reportType === "accrual"
                                ? "Net Revenue"
                                : "Average Transaction"}
                            </Typography>
                            <Typography
                              variant="h4"
                              fontWeight="bold"
                              color="success.main"
                            >
                              {formatCurrency(
                                reportType === "accrual"
                                  ? summaryStats.netSales
                                  : summaryStats.averageValue
                              )}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card elevation={2} sx={{ height: 160 }}>
                        <CardContent
                          sx={{
                            textAlign: "center",
                            p: 3,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <Assessment
                            sx={{ fontSize: 40, color: "primary.main" }}
                          />
                          <Box>
                            <Typography
                              color="textSecondary"
                              variant="body2"
                              gutterBottom
                            >
                              {reportType === "accrual"
                                ? "Average Transaction"
                                : "Top Service"}
                            </Typography>
                            <Typography
                              variant={reportType === "accrual" ? "h5" : "h6"}
                              fontWeight="bold"
                              color="primary"
                              sx={{ wordBreak: "break-word" }}
                            >
                              {reportType === "accrual"
                                ? formatCurrency(summaryStats.averageValue)
                                : summaryStats.topService.length > 20
                                ? `${summaryStats.topService.substring(
                                    0,
                                    20
                                  )}...`
                                : summaryStats.topService}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>

            {/* Charts Section */}
            <Box sx={{ flexShrink: 0 }}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom fontWeight="bold">
                  Visual Analysis
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ height: 300, minHeight: 250 }}>{renderChart()}</Box>
              </Paper>
            </Box>

            {/* Data Table */}
            <Box sx={{ flex: 1, minHeight: 400 }}>
              <Paper
                elevation={2}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box
                  sx={{
                    p: 3,
                    borderBottom: 1,
                    borderColor: "divider",
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="h5" fontWeight="bold">
                    {reportType === "accrual"
                      ? "Accrual"
                      : reportType === "cash_basis"
                      ? "Cash Basis"
                      : "Appointments"}{" "}
                    Report Data
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    {rawReportData.length.toLocaleString()} records found
                  </Typography>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <TableContainer sx={{ flex: 1, overflow: "auto" }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          {getReportColumns().map((column) => (
                            <TableCell
                              key={column.key}
                              align={
                                column.format === "currency" ? "right" : "left"
                              }
                              sx={{
                                fontWeight: "bold",
                                backgroundColor: "#f8f9fa",
                                fontSize: "0.9rem",
                              }}
                            >
                              {column.label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rawReportData.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={getReportColumns().length}
                              sx={{ textAlign: "center", py: 4 }}
                            >
                              <Typography
                                variant="h6"
                                color="textSecondary"
                                gutterBottom
                              >
                                No report data found
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {selectedCenter !== "ALL"
                                  ? `No ${reportType} data found for ${selectedCenter} center in the selected date range.`
                                  : `No ${reportType} data found for the selected date range.`}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                sx={{ mt: 1 }}
                              >
                                Try adjusting your date range or selecting a
                                different center.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          getCurrentPageData(rawReportData).map(
                            (row, index) => (
                              <TableRow
                                key={index}
                                hover
                                sx={{
                                  "&:hover": { backgroundColor: "#f5f5f5" },
                                }}
                              >
                                {getReportColumns().map((column) => (
                                  <TableCell
                                    key={column.key}
                                    align={
                                      column.format === "currency"
                                        ? "right"
                                        : "left"
                                    }
                                    sx={{ fontSize: "0.85rem" }}
                                  >
                                    {column.key === "status" ? (
                                      <Chip
                                        label={row[column.key]}
                                        size="small"
                                        color={
                                          row[column.key] === "Closed"
                                            ? "success"
                                            : row[column.key] === "Deleted" ||
                                              row[column.key] === "Cancelled"
                                            ? "error"
                                            : "default"
                                        }
                                      />
                                    ) : (
                                      formatCellValue(
                                        row[column.key],
                                        column.format
                                      )
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Pagination - Ensure it's always visible */}
                  <Box
                    sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider" }}
                  >
                    <TablePagination
                      component="div"
                      count={rawReportData.length}
                      page={page}
                      onPageChange={(e, newPage) => setPage(newPage)}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                      }}
                      rowsPerPageOptions={[10, 25, 50, 100, 250]}
                      labelDisplayedRows={({ from, to, count }) =>
                        `${from}–${to} of ${
                          count !== -1
                            ? count.toLocaleString()
                            : `more than ${to}`
                        }`
                      }
                      showFirstButton
                      showLastButton
                    />
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default CRMAnalyticsDashboard;
