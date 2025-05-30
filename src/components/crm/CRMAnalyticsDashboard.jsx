import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";

const CRMAnalyticsDashboard = ({ selectedCenter }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accrualReports, setAccrualReports] = useState([]);
  const [cashReports, setCashReports] = useState([]);
  const [appointmentsReports, setAppointmentsReports] = useState([]);
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalAppointments: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [debugLogs, setDebugLogs] = useState([]);

  const logDebug = (msg, data) => {
    setDebugLogs((logs) => [
      { timestamp: new Date().toISOString(), msg, data },
      ...logs.slice(0, 49),
    ]);
    if (process.env.NODE_ENV === "development") {
      console.debug("[Analytics DEBUG]", msg, data);
    }
  };

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setError(null);
      try {
        logDebug("Fetching accrual reports", { selectedCenter });
        const accrual = await supabase
          .from("zenoti_sales_accrual_reports")
          .select("*")
          .eq("center_code", selectedCenter);
        if (accrual.error)
          logDebug("Accrual reports query error", {
            error: accrual.error,
            selectedCenter,
          });
        if (!accrual.data || accrual.data.length === 0)
          logDebug("Accrual reports query returned empty", { selectedCenter });
        logDebug("Fetching cash reports", { selectedCenter });
        const cash = await supabase
          .from("zenoti_sales_cash_reports")
          .select("*")
          .eq("center_code", selectedCenter);
        if (cash.error)
          logDebug("Cash reports query error", {
            error: cash.error,
            selectedCenter,
          });
        if (!cash.data || cash.data.length === 0)
          logDebug("Cash reports query returned empty", { selectedCenter });
        logDebug("Fetching appointments reports", { selectedCenter });
        const appts = await supabase
          .from("zenoti_appointments_reports")
          .select("*")
          .eq("center_code", selectedCenter);
        if (appts.error)
          logDebug("Appointments reports query error", {
            error: appts.error,
            selectedCenter,
          });
        if (!appts.data || appts.data.length === 0)
          logDebug("Appointments reports query returned empty", {
            selectedCenter,
          });
        setAccrualReports(accrual.data || []);
        setCashReports(cash.data || []);
        setAppointmentsReports(appts.data || []);
        // Build summary and chart data
        let totalSales = 0;
        let totalAppointments = 0;
        const chart = (accrual.data || []).map((r, i) => {
          const appt = (appts.data || [])[i];
          totalSales += r.details?.total_sales || r.details?.total || 0;
          totalAppointments +=
            appt?.details?.total_appointments || appt?.details?.total || 0;
          return {
            date: r.report_date,
            sales: r.details?.total_sales || r.details?.total || 0,
            appointments:
              appt?.details?.total_appointments || appt?.details?.total || 0,
          };
        });
        setSummary({ totalSales, totalAppointments });
        setChartData(chart);
      } catch (err) {
        setError(err.message || "Failed to load analytics");
        logDebug("Analytics fetch error", { error: err, selectedCenter });
      } finally {
        setIsLoading(false);
      }
    };
    if (selectedCenter) fetchReports();
  }, [selectedCenter]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("CRM Analytics Report", 10, 10);
    doc.text(`Total Sales: $${summary.totalSales.toLocaleString()}`, 10, 20);
    doc.text(
      `Total Appointments: ${summary.totalAppointments.toLocaleString()}`,
      10,
      30
    );
    doc.save("crm-analytics-report.pdf");
  };

  // Helper to flatten and parse report data arrays
  const flattenReportRows = (reportRows) =>
    reportRows.flatMap((r) => {
      let arr = [];
      if (Array.isArray(r.data)) arr = r.data;
      else if (typeof r.data === "string") {
        try {
          arr = JSON.parse(r.data);
        } catch (e) {
          arr = [];
          console.error("Failed to parse report row data JSON:", e, r.data);
        }
      }
      // For each item, flatten all fields from nested objects into top-level
      return arr.map((item) => ({
        ...item,
        ...(item.details && typeof item.details === "object"
          ? item.details
          : {}),
        ...(item.guest && typeof item.guest === "object" ? item.guest : {}),
        ...(item.service && typeof item.service === "object"
          ? item.service
          : {}),
        ...(item.therapist && typeof item.therapist === "object"
          ? item.therapist
          : {}),
      }));
    });

  const accrualRows = flattenReportRows(accrualReports);
  const cashRows = flattenReportRows(cashReports);
  const apptRows = flattenReportRows(appointmentsReports);

  const accrualColumns = [
    { field: "sale_date", headerName: "Sale Date", width: 120 },
    { field: "invoice_no", headerName: "Invoice #", width: 120 },
    { field: "guest_name", headerName: "Guest Name", width: 160 },
    { field: "item_name", headerName: "Item Name", width: 180 },
    { field: "item_type", headerName: "Item Type", width: 120 },
    { field: "qty", headerName: "Qty", width: 80 },
    { field: "sales_inc_tax", headerName: "Sales (Inc Tax)", width: 140 },
    { field: "payment_type", headerName: "Payment Type", width: 120 },
    { field: "status", headerName: "Status", width: 120 },
    // Add more fields as needed
  ];
  const cashColumns = [
    { field: "sale_date", headerName: "Sale Date", width: 120 },
    { field: "invoice_no", headerName: "Invoice #", width: 120 },
    { field: "guest_name", headerName: "Guest Name", width: 160 },
    { field: "item_name", headerName: "Item Name", width: 180 },
    { field: "item_type", headerName: "Item Type", width: 120 },
    { field: "qty", headerName: "Qty", width: 80 },
    {
      field: "sales_collected_inc_tax",
      headerName: "Collected (Inc Tax)",
      width: 160,
    },
    { field: "payment_type", headerName: "Payment Type", width: 120 },
    { field: "status", headerName: "Status", width: 120 },
    // Add more fields as needed
  ];
  const apptColumns = [
    { field: "start_time", headerName: "Start Time", width: 160 },
    { field: "end_time", headerName: "End Time", width: 160 },
    { field: "guest_name", headerName: "Guest Name", width: 160 },
    { field: "service_name", headerName: "Service Name", width: 180 },
    { field: "status", headerName: "Status", width: 120 },
    { field: "provider_id", headerName: "Therapist ID", width: 120 },
    { field: "invoice_no", headerName: "Invoice #", width: 120 },
    // Add more fields as needed
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h5">CRM Analytics (Read Only)</Typography>
        <Button variant="contained" onClick={exportPDF}>
          Export PDF
        </Button>
      </Box>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Total Sales</Typography>
                  <Typography variant="h4" color="primary">
                    ${summary.totalSales.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Total Appointments</Typography>
                  <Typography variant="h4" color="primary">
                    {summary.totalAppointments.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Box sx={{ width: "100%", height: 350, mb: 4 }}>
            <Typography variant="h6">Sales & Appointments Over Time</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="sales"
                  fill="#8884d8"
                  name="Sales"
                />
                <Bar
                  yAxisId="right"
                  dataKey="appointments"
                  fill="#82ca9d"
                  name="Appointments"
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Accrual Reports" />
            <Tab label="Cash Reports" />
            <Tab label="Appointments Reports" />
          </Tabs>
          {tab === 0 && (
            <DataGrid
              autoHeight
              rows={accrualRows.map((r, i) => ({ id: i, ...r }))}
              columns={accrualColumns}
              pageSize={10}
              rowsPerPageOptions={[10, 20, 50]}
              getRowId={(row) =>
                row.invoice_no +
                row.sale_date +
                row.guest_name +
                row.item_name +
                (row.id || "")
              }
            />
          )}
          {tab === 1 && (
            <DataGrid
              autoHeight
              rows={cashRows.map((r, i) => ({ id: i, ...r }))}
              columns={cashColumns}
              pageSize={10}
              rowsPerPageOptions={[10, 20, 50]}
              getRowId={(row) =>
                row.invoice_no +
                row.sale_date +
                row.guest_name +
                row.item_name +
                (row.id || "")
              }
            />
          )}
          {tab === 2 && (
            <DataGrid
              autoHeight
              rows={apptRows.map((r, i) => ({ id: i, ...r }))}
              columns={apptColumns}
              pageSize={10}
              rowsPerPageOptions={[10, 20, 50]}
              getRowId={(row) =>
                row.invoice_no +
                row.start_time +
                row.guest_name +
                (row.id || "")
              }
            />
          )}
          {/* Debug log UI */}
          <Box
            sx={{
              mt: 4,
              bgcolor: "#222",
              color: "#fff",
              p: 2,
              borderRadius: 2,
              fontSize: 12,
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            <b>Debug Logs</b>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {debugLogs.map((log, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <span style={{ color: "#aaa" }}>{log.timestamp}</span> -{" "}
                  <b>{log.msg}</b>
                  <pre style={{ margin: 0, color: "#8ff" }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </Box>
        </>
      )}
      {error && (
        <pre style={{ color: "red", marginTop: 16 }}>Error: {error}</pre>
      )}
    </Box>
  );
};

export default CRMAnalyticsDashboard;
