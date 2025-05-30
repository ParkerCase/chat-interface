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
  Tabs,
  Tab,
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
} from "recharts";
import {
  Download,
  Refresh,
  AttachMoney,
  Event,
  TrendingUp,
  Assessment,
  DateRange,
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
  const [activeTab, setActiveTab] = useState(0);
  const [dateRange, setDateRange] = useState("30days");
  const [reportType, setReportType] = useState("accrual");

  // Custom date range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useCustomDates, setUseCustomDates] = useState(false);

  // Data states
  const [accrualReports, setAccrualReports] = useState([]);
  const [cashReports, setCashReports] = useState([]);
  const [appointmentReports, setAppointmentReports] = useState([]);

  // Processed data states
  const [salesData, setSalesData] = useState([]);
  const [appointmentData, setAppointmentData] = useState([]);
  const [rawReportData, setRawReportData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0,
    totalRefunds: 0,
    netSales: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    cancellationRate: 0,
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Chart colors
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  // Memoized center mapping
  const centerCodeToId = useMemo(() => {
    const mapping = {};
    Object.entries(centerMapping).forEach(([key, value]) => {
      if (key.length < 10) {
        // This is a code
        mapping[key] = value;
      }
    });
    return mapping;
  }, [centerMapping]);

  const centerIdToCode = useMemo(() => {
    const mapping = {};
    Object.entries(centerMapping).forEach(([key, value]) => {
      if (key.length > 10) {
        // This is an ID
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

  // Fetch all analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { startDate: filterStartDate, endDate: filterEndDate } =
        getDateRange();

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
      if (selectedCenter !== "ALL" && centerCodeToId[selectedCenter]) {
        const centerId = centerCodeToId[selectedCenter];
        accrualQuery = accrualQuery.eq("center_id", centerId);
        cashQuery = cashQuery.eq("center_id", centerId);
        appointmentQuery = appointmentQuery.eq("center_id", centerId);
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

      setAccrualReports(accrualResult.data || []);
      setCashReports(cashResult.data || []);
      setAppointmentReports(appointmentResult.data || []);

      // Process the data for charts and summaries
      processAnalyticsData(
        accrualResult.data,
        cashResult.data,
        appointmentResult.data
      );
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError(`Failed to fetch analytics data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCenter, centerCodeToId, getDateRange, safeJsonParse]);

  // Process analytics data with proper filtering
  const processAnalyticsData = useCallback(
    (accrualData, cashData, appointmentData) => {
      // Process sales data
      const processedSalesData = [];
      const rawSalesData = [];
      let totalSales = 0;
      let totalRefunds = 0;

      // Process accrual reports
      accrualData.forEach((report) => {
        const salesItems = safeJsonParse(report.data);

        salesItems.forEach((item) => {
          // Apply center filter if needed
          if (selectedCenter !== "ALL" && centerCodeToId[selectedCenter]) {
            const targetCenterId = centerCodeToId[selectedCenter];
            if (item.center_id !== targetCenterId) {
              return; // Skip this item
            }
          }

          const saleAmount = parseFloat(item.sales_inc_tax || 0);
          const isRefund = saleAmount < 0;

          if (isRefund) {
            totalRefunds += Math.abs(saleAmount);
          } else {
            totalSales += saleAmount;
          }

          const processedItem = {
            date: item.sale_date,
            amount: saleAmount,
            item_name: item.item_name,
            guest_name: item.guest_name,
            center: item.center_name || item.center_code,
            type: "accrual",
            is_refund: isRefund,
            invoice_no: item.invoice_no,
            payment_type: item.payment_type,
          };

          processedSalesData.push(processedItem);

          // Add to raw data if this is the selected report type
          if (reportType === "accrual") {
            rawSalesData.push({
              ...item,
              report_type: "Accrual",
            });
          }
        });
      });

      // Process cash reports
      cashData.forEach((report) => {
        const salesItems = safeJsonParse(report.data);

        salesItems.forEach((item) => {
          // Apply center filter if needed
          if (selectedCenter !== "ALL" && centerCodeToId[selectedCenter]) {
            const targetCenterId = centerCodeToId[selectedCenter];
            if (item.center_id !== targetCenterId) {
              return; // Skip this item
            }
          }

          const collectedAmount = parseFloat(item.sales_collected_inc_tax || 0);

          processedSalesData.push({
            date: item.sale_date,
            amount: collectedAmount,
            item_name: item.item_name,
            guest_name: item.guest_name,
            center: item.center_name || item.center_code,
            type: "cash",
            payment_type: item.payment_type,
            invoice_no: item.invoice_no,
          });

          // Add to raw data if this is the selected report type
          if (reportType === "cash_basis") {
            rawSalesData.push({
              ...item,
              report_type: "Cash Basis",
            });
          }
        });
      });

      // Process appointment data
      const processedAppointmentData = [];
      const rawAppointmentData = [];
      let totalAppointments = 0;
      let completedAppointments = 0;

      appointmentData.forEach((report) => {
        const appointments = safeJsonParse(report.data);

        appointments.forEach((appointment) => {
          // Apply center filter if needed
          if (selectedCenter !== "ALL" && centerCodeToId[selectedCenter]) {
            const targetCenterId = centerCodeToId[selectedCenter];
            if (appointment.center_id !== targetCenterId) {
              return; // Skip this appointment
            }
          }

          totalAppointments++;

          const isCompleted = appointment.status === "Closed";
          if (isCompleted) {
            completedAppointments++;
          }

          const processedAppointment = {
            date: appointment.appointment_date,
            guest_name: appointment.guest_name,
            service_name: appointment.service_name,
            status: appointment.status,
            center: appointment.center_name,
            therapist: appointment.serviced_by,
          };

          processedAppointmentData.push(processedAppointment);

          // Add to raw data if this is the selected report type
          if (reportType === "appointments") {
            rawAppointmentData.push({
              ...appointment,
              report_type: "Appointments",
            });
          }
        });
      });

      // Calculate summary stats
      const cancellationRate =
        totalAppointments > 0
          ? ((totalAppointments - completedAppointments) / totalAppointments) *
            100
          : 0;

      setSalesData(processedSalesData);
      setAppointmentData(processedAppointmentData);
      setSummaryStats({
        totalSales,
        totalRefunds,
        netSales: totalSales - totalRefunds,
        totalAppointments,
        completedAppointments,
        cancellationRate,
      });

      // Set raw report data based on selected report type
      if (reportType === "accrual" || reportType === "cash_basis") {
        setRawReportData(rawSalesData);
      } else if (reportType === "appointments") {
        setRawReportData(rawAppointmentData);
      }
    },
    [safeJsonParse, selectedCenter, centerCodeToId, reportType]
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
      processAnalyticsData(accrualReports, cashReports, appointmentReports);
    }
  }, [
    reportType,
    processAnalyticsData,
    accrualReports,
    cashReports,
    appointmentReports,
  ]);

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
    doc.text(
      `Total Sales: ${formatCurrency(summaryStats.totalSales)}`,
      20,
      120
    );
    doc.text(
      `Total Refunds: ${formatCurrency(summaryStats.totalRefunds)}`,
      20,
      130
    );
    doc.text(`Net Sales: ${formatCurrency(summaryStats.netSales)}`, 20, 140);
    doc.text(`Total Appointments: ${summaryStats.totalAppointments}`, 20, 150);
    doc.text(
      `Completed Appointments: ${summaryStats.completedAppointments}`,
      20,
      160
    );
    doc.text(
      `Cancellation Rate: ${summaryStats.cancellationRate.toFixed(1)}%`,
      20,
      170
    );

    doc.save(
      `crm-analytics-report-${reportType}-${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );
  }, [summaryStats, selectedCenter, reportType, getDateRange]);

  // Create chart data for daily sales
  const dailySalesData = useMemo(() => {
    const dailyTotals = {};

    salesData.forEach((sale) => {
      const date = sale.date;
      if (!dailyTotals[date]) {
        dailyTotals[date] = { date, sales: 0, refunds: 0 };
      }

      if (sale.is_refund) {
        dailyTotals[date].refunds += Math.abs(sale.amount);
      } else {
        dailyTotals[date].sales += sale.amount;
      }
    });

    return Object.values(dailyTotals).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }, [salesData]);

  // Create pie chart data for appointment statuses
  const appointmentStatusData = useMemo(() => {
    const statusCounts = {};

    appointmentData.forEach((appointment) => {
      const status = appointment.status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  }, [appointmentData]);

  // Get current page data for tables
  const getCurrentPageData = (data) => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  };

  // Get columns for raw report data based on report type
  const getReportColumns = () => {
    switch (reportType) {
      case "accrual":
        return [
          { key: "sale_date", label: "Sale Date" },
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
        ];
      case "cash_basis":
        return [
          { key: "sale_date", label: "Sale Date" },
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
        ];
      case "appointments":
        return [
          { key: "appointment_date", label: "Date" },
          { key: "guest_name", label: "Guest" },
          { key: "service_name", label: "Service" },
          { key: "serviced_by", label: "Therapist" },
          { key: "status", label: "Status" },
          { key: "center_name", label: "Center" },
          { key: "start_time", label: "Start Time", format: "datetime" },
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
      case "datetime":
        return new Date(value).toLocaleString();
      default:
        return value;
    }
  };

  return (
    <Paper
      elevation={1}
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6">Analytics Dashboard</Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportType}
                label="Report Type"
                onChange={(e) => setReportType(e.target.value)}
              >
                <MenuItem value="accrual">Accrual Report</MenuItem>
                <MenuItem value="cash_basis">Cash Basis Report</MenuItem>
                <MenuItem value="appointments">Appointments Report</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
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
                  size="small"
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
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setUseCustomDates(true);
                  }}
                />
              </>
            )}
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={exportToPDF}
              size="small"
            >
              Export PDF
            </Button>
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AttachMoney color="primary" />
                  <Typography color="textSecondary" variant="body2">
                    Total Sales
                  </Typography>
                </Box>
                <Typography variant="h6" color="primary">
                  {formatCurrency(summaryStats.totalSales)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TrendingUp color="success" />
                  <Typography color="textSecondary" variant="body2">
                    Net Sales
                  </Typography>
                </Box>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(summaryStats.netSales)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AttachMoney color="error" />
                  <Typography color="textSecondary" variant="body2">
                    Refunds
                  </Typography>
                </Box>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(summaryStats.totalRefunds)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Event color="info" />
                  <Typography color="textSecondary" variant="body2">
                    Appointments
                  </Typography>
                </Box>
                <Typography variant="h6" color="info.main">
                  {summaryStats.totalAppointments}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Assessment color="success" />
                  <Typography color="textSecondary" variant="body2">
                    Completed
                  </Typography>
                </Box>
                <Typography variant="h6" color="success.main">
                  {summaryStats.completedAppointments}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" variant="body2">
                  Cancel Rate
                </Typography>
                <Typography
                  variant="h6"
                  color={
                    summaryStats.cancellationRate > 20
                      ? "error.main"
                      : "success.main"
                  }
                >
                  {summaryStats.cancellationRate.toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            {/* Charts */}
            <Box sx={{ p: 2, minHeight: 400 }}>
              <Grid container spacing={2} sx={{ height: "100%" }}>
                {/* Daily Sales Chart */}
                <Grid item xs={12} md={8}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Daily Sales Trend
                      </Typography>
                      <Box sx={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                          <LineChart data={dailySalesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip
                              formatter={(value) => formatCurrency(value)}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="sales"
                              stroke="#8884d8"
                              name="Sales"
                            />
                            <Line
                              type="monotone"
                              dataKey="refunds"
                              stroke="#ff7300"
                              name="Refunds"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Appointment Status Pie Chart */}
                <Grid item xs={12} md={4}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Appointment Status
                      </Typography>
                      <Box sx={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={appointmentStatusData}
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
                              {appointmentStatusData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Data Tables */}
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{ borderBottom: 1, borderColor: "divider" }}
              >
                <Tab label={`Sales Data (${salesData.length})`} />
                <Tab label={`Appointments (${appointmentData.length})`} />
                <Tab
                  label={`${reportType.toUpperCase()} Report (${
                    rawReportData.length
                  })`}
                />
              </Tabs>

              {/* Sales Data Tab */}
              {activeTab === 0 && (
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <TableContainer sx={{ flex: 1 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Guest</TableCell>
                          <TableCell>Item</TableCell>
                          <TableCell>Center</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getCurrentPageData(salesData).map((sale, index) => (
                          <TableRow key={index}>
                            <TableCell>{sale.date}</TableCell>
                            <TableCell>{sale.guest_name}</TableCell>
                            <TableCell>{sale.item_name}</TableCell>
                            <TableCell>{sale.center}</TableCell>
                            <TableCell align="right">
                              <Typography
                                color={
                                  sale.is_refund ? "error.main" : "inherit"
                                }
                                fontWeight="medium"
                              >
                                {formatCurrency(sale.amount)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  sale.type === "accrual" ? "Accrual" : "Cash"
                                }
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={sale.is_refund ? "Refund" : "Sale"}
                                size="small"
                                color={sale.is_refund ? "error" : "success"}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={salesData.length}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </Box>
              )}

              {/* Appointments Data Tab */}
              {activeTab === 1 && (
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <TableContainer sx={{ flex: 1 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Guest</TableCell>
                          <TableCell>Service</TableCell>
                          <TableCell>Therapist</TableCell>
                          <TableCell>Center</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getCurrentPageData(appointmentData).map(
                          (appointment, index) => (
                            <TableRow key={index}>
                              <TableCell>{appointment.date}</TableCell>
                              <TableCell>{appointment.guest_name}</TableCell>
                              <TableCell>{appointment.service_name}</TableCell>
                              <TableCell>{appointment.therapist}</TableCell>
                              <TableCell>{appointment.center}</TableCell>
                              <TableCell>
                                <Chip
                                  label={appointment.status}
                                  size="small"
                                  color={
                                    appointment.status === "Closed"
                                      ? "success"
                                      : appointment.status === "Deleted"
                                      ? "error"
                                      : "default"
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={appointmentData.length}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </Box>
              )}

              {/* Raw Report Data Tab */}
              {activeTab === 2 && (
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <TableContainer sx={{ flex: 1 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          {getReportColumns().map((column) => (
                            <TableCell
                              key={column.key}
                              align={
                                column.format === "currency" ? "right" : "left"
                              }
                            >
                              {column.label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getCurrentPageData(rawReportData).map((row, index) => (
                          <TableRow key={index}>
                            {getReportColumns().map((column) => (
                              <TableCell
                                key={column.key}
                                align={
                                  column.format === "currency"
                                    ? "right"
                                    : "left"
                                }
                              >
                                {formatCellValue(
                                  row[column.key],
                                  column.format
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
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
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default CRMAnalyticsDashboard;
