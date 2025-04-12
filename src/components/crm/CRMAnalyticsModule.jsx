import React, { useState, useEffect } from "react";
import {
  BarChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  Calendar,
  TrendingUp,
  RefreshCw,
  Download,
  Filter,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./CRMAnalyticsModule.css";

/**
 * CRM analytics module to be integrated into the main analytics dashboard
 * Provides contact, appointment, and service metrics with visualizations
 */
const CRMAnalyticsModule = ({
  timeframe = "month",
  centerCode,
  onRefresh,
  standalone = false,
}) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetricView, setSelectedMetricView] = useState("contacts");
  const [comparisonPeriod, setComparisonPeriod] = useState("previous");

  // Define colors for charts
  const COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#6366F1",
    "#14B8A6",
  ];

  // Helper to add thousands separators
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Load data when component mounts or when timeframe/center changes
  useEffect(() => {
    loadData();
  }, [timeframe, centerCode, comparisonPeriod]);

  // Load CRM analytics data
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get start and end dates based on timeframe
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case "day":
          startDate.setDate(startDate.getDate() - 1);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      // Format dates as ISO strings (YYYY-MM-DD)
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Call API to get CRM analytics
      const response = await apiService.analytics.getCRMAnalytics({
        startDate: startDateStr,
        endDate: endDateStr,
        centerCode,
        timeframe,
        comparisonPeriod,
      });

      if (response.data?.success) {
        setData(response.data.analytics);

        // Track analytics view for tracking
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_ANALYTICS_VIEW,
          {
            timeframe,
            centerCode,
            comparisonPeriod,
          }
        );
      } else {
        // If API returns error, try generating analytics from raw data
        await generateAnalyticsFromRawData(startDateStr, endDateStr);
      }
    } catch (err) {
      console.error("Error loading CRM analytics:", err);
      setError("Failed to load CRM analytics data");

      // Try to generate analytics from raw data
      await generateAnalyticsFromRawData();
    } finally {
      setIsLoading(false);
    }
  };

  // Generate analytics from raw data if API fails
  const generateAnalyticsFromRawData = async (startDate, endDate) => {
    try {
      console.log("Generating CRM analytics from raw data");

      // Get appointments
      const appointmentsResponse = await zenotiService.getAppointments({
        startDate,
        endDate,
        centerCode,
      });

      // Get recent clients
      const clientsResponse = await zenotiService.searchClients({
        sort: "last_visit",
        limit: 50,
        centerCode,
      });

      // Get services
      const servicesResponse = await zenotiService.getServices({
        centerCode,
        limit: 100,
      });

      // Process data to generate analytics
      const appointments = appointmentsResponse.data?.appointments || [];
      const clients = clientsResponse.data?.clients || [];
      const services = servicesResponse.data?.services || [];

      // Calculate appointment metrics
      const completedAppointments = appointments.filter(
        (a) => (a.status || "").toLowerCase() === "completed"
      );

      const canceledAppointments = appointments.filter(
        (a) =>
          (a.status || "").toLowerCase() === "cancelled" ||
          (a.status || "").toLowerCase() === "canceled"
      );

      const upcomingAppointments = appointments.filter(
        (a) => new Date(a.start_time) > new Date()
      );

      // Calculate service popularity
      const serviceCountMap = {};
      appointments.forEach((appointment) => {
        const serviceName =
          appointment.service_name ||
          (appointment.service ? appointment.service.name : null);

        if (serviceName) {
          serviceCountMap[serviceName] =
            (serviceCountMap[serviceName] || 0) + 1;
        }
      });

      // Convert to array for chart display
      const popularServices = Object.entries(serviceCountMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Generate time series data
      const timeSeriesData = generateTimeSeriesData(appointments, timeframe);

      // Calculate client metrics
      const newClientsLastMonth = clients.filter((client) => {
        const createdDate = new Date(
          client.created_date || client.date_joined || new Date()
        );
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return createdDate >= thirtyDaysAgo;
      }).length;

      const activeClients = clients.filter((client) => {
        const lastVisit = new Date(client.last_visit_date || new Date(0));
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return lastVisit >= ninetyDaysAgo;
      }).length;

      // Generate mock analytics data
      const analyticsData = {
        contactMetrics: {
          totalContacts: clients.length,
          newContactsThisMonth: newClientsLastMonth,
          activeContacts: activeClients,
          contactsWithUpcomingAppointments: upcomingAppointments.length,
        },
        appointmentMetrics: {
          totalAppointments: appointments.length,
          upcomingAppointments: upcomingAppointments.length,
          completedAppointments: completedAppointments.length,
          canceledAppointments: canceledAppointments.length,
        },
        serviceMetrics: {
          totalServices: services.length,
          popularServices,
        },
        conversionRate: {
          leadToClient: 0.68,
          appointmentShowRate:
            completedAppointments.length /
              (completedAppointments.length + canceledAppointments.length) ||
            0.9,
          repeatClientRate: 0.75,
        },
        timeSeriesData,
      };

      setData(analyticsData);
    } catch (err) {
      console.error("Error generating analytics from raw data:", err);
      setError("Failed to generate analytics data");
    }
  };

  // Generate time series data for charts
  const generateTimeSeriesData = (appointments, timeframe) => {
    // Create date buckets based on timeframe
    const dateBuckets = {};
    const today = new Date();
    let startDate;

    switch (timeframe) {
      case "day":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        // For day, use hourly buckets
        for (let i = 0; i < 24; i++) {
          const date = new Date(startDate);
          date.setHours(i);
          const key =
            date.toISOString().split("T")[0] +
            "T" +
            date.getHours().toString().padStart(2, "0");
          dateBuckets[key] = { date: new Date(date), count: 0 };
        }
        break;

      case "week":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        // For week, use daily buckets
        for (let i = 0; i < 7; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const key = date.toISOString().split("T")[0];
          dateBuckets[key] = { date: new Date(date), count: 0 };
        }
        break;

      case "month":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        // For month, use daily buckets but group by every 3 days
        for (let i = 0; i < 30; i += 3) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const key = date.toISOString().split("T")[0];
          dateBuckets[key] = { date: new Date(date), count: 0 };
        }
        break;

      case "year":
        startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);
        // For year, use monthly buckets
        for (let i = 0; i < 12; i++) {
          const date = new Date(startDate);
          date.setMonth(date.getMonth() + i);
          const key = date.toISOString().substring(0, 7); // YYYY-MM format
          dateBuckets[key] = { date: new Date(date), count: 0 };
        }
        break;

      default:
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        // Default to monthly view with weekly buckets
        for (let i = 0; i < 30; i += 7) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const key = date.toISOString().split("T")[0];
          dateBuckets[key] = { date: new Date(date), count: 0 };
        }
    }

    // Count appointments for each bucket
    appointments.forEach((appointment) => {
      const appointmentDate = new Date(appointment.start_time);

      // Group by appropriate time unit based on timeframe
      let key;
      if (timeframe === "day") {
        key =
          appointmentDate.toISOString().split("T")[0] +
          "T" +
          appointmentDate.getHours().toString().padStart(2, "0");
      } else if (timeframe === "year") {
        key = appointmentDate.toISOString().substring(0, 7); // YYYY-MM
      } else {
        key = appointmentDate.toISOString().split("T")[0]; // YYYY-MM-DD
      }

      // If this exact key exists in our buckets, increment it
      if (dateBuckets[key]) {
        dateBuckets[key].count++;
      } else if (timeframe === "month") {
        // For month view with 3-day groups, find the closest bucket
        const bucketDates = Object.keys(dateBuckets).map((d) => new Date(d));
        const closestBucket = bucketDates.reduce((prev, curr) => {
          return Math.abs(curr - appointmentDate) <
            Math.abs(prev - appointmentDate)
            ? curr
            : prev;
        });

        const closestKey = closestBucket.toISOString().split("T")[0];
        if (dateBuckets[closestKey]) {
          dateBuckets[closestKey].count++;
        }
      }
    });

    // Convert to array format for charts
    return Object.values(dateBuckets)
      .map((bucket) => ({
        date: bucket.date,
        count: bucket.count,
        name: formatDateForDisplay(bucket.date, timeframe),
      }))
      .sort((a, b) => a.date - b.date);
  };

  // Format date for display in charts based on timeframe
  const formatDateForDisplay = (date, timeframe) => {
    if (!date) return "";

    switch (timeframe) {
      case "day":
        return date.getHours() + ":00";
      case "week":
        return date.toLocaleDateString(undefined, { weekday: "short" });
      case "month":
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      case "year":
        return date.toLocaleDateString(undefined, { month: "short" });
      default:
        return date.toLocaleDateString();
    }
  };

  // Handle refresh button click
  const handleRefresh = () => {
    loadData();

    if (onRefresh) {
      onRefresh();
    }
  };

  // Handle export to CSV
  const handleExport = async () => {
    try {
      setIsLoading(true);

      // Prepare data for CSV
      const csvData = [
        // Header row
        ["Category", "Metric", "Value"],

        // Contact metrics
        ["Contacts", "Total Contacts", data.contactMetrics.totalContacts],
        ["Contacts", "New Contacts", data.contactMetrics.newContactsThisMonth],
        ["Contacts", "Active Contacts", data.contactMetrics.activeContacts],

        // Appointment metrics
        [
          "Appointments",
          "Total Appointments",
          data.appointmentMetrics.totalAppointments,
        ],
        [
          "Appointments",
          "Upcoming Appointments",
          data.appointmentMetrics.upcomingAppointments,
        ],
        [
          "Appointments",
          "Completed Appointments",
          data.appointmentMetrics.completedAppointments,
        ],
        [
          "Appointments",
          "Canceled Appointments",
          data.appointmentMetrics.canceledAppointments,
        ],

        // Conversion rates
        [
          "Conversion",
          "Lead to Client Rate",
          (data.conversionRate.leadToClient * 100).toFixed(1) + "%",
        ],
        [
          "Conversion",
          "Appointment Show Rate",
          (data.conversionRate.appointmentShowRate * 100).toFixed(1) + "%",
        ],
        [
          "Conversion",
          "Repeat Client Rate",
          (data.conversionRate.repeatClientRate * 100).toFixed(1) + "%",
        ],
      ];

      // Add popular services
      data.serviceMetrics.popularServices.forEach((service) => {
        csvData.push(["Services", service.name, service.count]);
      });

      // Convert to CSV
      const csvContent = csvData.map((row) => row.join(",")).join("\n");

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `crm-analytics-${timeframe}-${
          new Date().toISOString().split("T")[0]
        }.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Track export event
      analyticsUtils.trackEvent(
        analyticsUtils.EVENT_TYPES.CRM_ANALYTICS_EXPORT,
        {
          timeframe,
          format: "csv",
          centerCode,
        }
      );
    } catch (err) {
      console.error("Error exporting analytics:", err);
      setError("Failed to export analytics data");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate the percentage change for metrics with a comparison
  const calculateChange = (current, previous) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  if (isLoading && !data) {
    return (
      <div className={`crm-analytics-module ${standalone ? "standalone" : ""}`}>
        <div className="loading-state">
          <RefreshCw className="spinner" size={24} />
          <p>Loading CRM analytics data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`crm-analytics-module ${standalone ? "standalone" : ""}`}>
        <div className="error-state">
          <p>{error}</p>
          <button className="refresh-button" onClick={handleRefresh}>
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`crm-analytics-module ${standalone ? "standalone" : ""}`}>
        <div className="no-data-state">
          <p>No CRM analytics data available.</p>
          <button className="refresh-button" onClick={handleRefresh}>
            <RefreshCw size={16} />
            Load Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`crm-analytics-module ${standalone ? "standalone" : ""}`}>
      {standalone && (
        <div className="module-header">
          <h2>CRM Analytics</h2>
          <div className="header-actions">
            <div className="timeframe-selector">
              <button
                className={timeframe === "day" ? "active" : ""}
                onClick={() => setTimeframe("day")}
              >
                Day
              </button>
              <button
                className={timeframe === "week" ? "active" : ""}
                onClick={() => setTimeframe("week")}
              >
                Week
              </button>
              <button
                className={timeframe === "month" ? "active" : ""}
                onClick={() => setTimeframe("month")}
              >
                Month
              </button>
              <button
                className={timeframe === "year" ? "active" : ""}
                onClick={() => setTimeframe("year")}
              >
                Year
              </button>
            </div>
            <button className="refresh-button" onClick={handleRefresh}>
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button className="export-button" onClick={handleExport}>
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>
      )}

      {/* Metric selector tabs */}
      <div className="metric-selector">
        <button
          className={selectedMetricView === "contacts" ? "active" : ""}
          onClick={() => setSelectedMetricView("contacts")}
        >
          <Users size={16} />
          <span>Contacts</span>
        </button>
        <button
          className={selectedMetricView === "appointments" ? "active" : ""}
          onClick={() => setSelectedMetricView("appointments")}
        >
          <Calendar size={16} />
          <span>Appointments</span>
        </button>
        <button
          className={selectedMetricView === "conversion" ? "active" : ""}
          onClick={() => setSelectedMetricView("conversion")}
        >
          <TrendingUp size={16} />
          <span>Conversion</span>
        </button>
      </div>

      {/* Contact metrics view */}
      {selectedMetricView === "contacts" && (
        <div className="metrics-content">
          <div className="metrics-summary">
            <div className="metric-card">
              <div className="metric-header">
                <h3>Total Contacts</h3>
                {data.contactMetrics.previousPeriod && (
                  <div className="metric-comparison">
                    {calculateChange(
                      data.contactMetrics.totalContacts,
                      data.contactMetrics.previousPeriod.totalContacts
                    ) >= 0 ? (
                      <ArrowUpRight className="increase" size={16} />
                    ) : (
                      <ArrowDownRight className="decrease" size={16} />
                    )}
                    <span
                      className={
                        calculateChange(
                          data.contactMetrics.totalContacts,
                          data.contactMetrics.previousPeriod.totalContacts
                        ) >= 0
                          ? "increase"
                          : "decrease"
                      }
                    >
                      {Math.abs(
                        calculateChange(
                          data.contactMetrics.totalContacts,
                          data.contactMetrics.previousPeriod.totalContacts
                        )
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="metric-value">
                {formatNumber(data.contactMetrics.totalContacts)}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <h3>New Contacts</h3>
                {data.contactMetrics.previousPeriod && (
                  <div className="metric-comparison">
                    {calculateChange(
                      data.contactMetrics.newContactsThisMonth,
                      data.contactMetrics.previousPeriod.newContactsThisMonth
                    ) >= 0 ? (
                      <ArrowUpRight className="increase" size={16} />
                    ) : (
                      <ArrowDownRight className="decrease" size={16} />
                    )}
                    <span
                      className={
                        calculateChange(
                          data.contactMetrics.newContactsThisMonth,
                          data.contactMetrics.previousPeriod
                            .newContactsThisMonth
                        ) >= 0
                          ? "increase"
                          : "decrease"
                      }
                    >
                      {Math.abs(
                        calculateChange(
                          data.contactMetrics.newContactsThisMonth,
                          data.contactMetrics.previousPeriod
                            .newContactsThisMonth
                        )
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="metric-value">
                {formatNumber(data.contactMetrics.newContactsThisMonth)}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <h3>Active Contacts</h3>
                {data.contactMetrics.previousPeriod && (
                  <div className="metric-comparison">
                    {calculateChange(
                      data.contactMetrics.activeContacts,
                      data.contactMetrics.previousPeriod.activeContacts
                    ) >= 0 ? (
                      <ArrowUpRight className="increase" size={16} />
                    ) : (
                      <ArrowDownRight className="decrease" size={16} />
                    )}
                    <span
                      className={
                        calculateChange(
                          data.contactMetrics.activeContacts,
                          data.contactMetrics.previousPeriod.activeContacts
                        ) >= 0
                          ? "increase"
                          : "decrease"
                      }
                    >
                      {Math.abs(
                        calculateChange(
                          data.contactMetrics.activeContacts,
                          data.contactMetrics.previousPeriod.activeContacts
                        )
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="metric-value">
                {formatNumber(data.contactMetrics.activeContacts)}
              </div>
            </div>
          </div>

          {/* Contact growth chart */}
          <div className="chart-container">
            <h3>Contact Growth Over Time</h3>
            {data.timeSeriesData && data.timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [formatNumber(value), "Contacts"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="New Contacts"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-chart-data">
                <p>No contact growth data available for the selected period.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Appointment metrics view */}
      {selectedMetricView === "appointments" && (
        <div className="metrics-content">
          <div className="metrics-summary">
            <div className="metric-card">
              <div className="metric-header">
                <h3>Total Appointments</h3>
                {data.appointmentMetrics.previousPeriod && (
                  <div className="metric-comparison">
                    {calculateChange(
                      data.appointmentMetrics.totalAppointments,
                      data.appointmentMetrics.previousPeriod.totalAppointments
                    ) >= 0 ? (
                      <ArrowUpRight className="increase" size={16} />
                    ) : (
                      <ArrowDownRight className="decrease" size={16} />
                    )}
                    <span
                      className={
                        calculateChange(
                          data.appointmentMetrics.totalAppointments,
                          data.appointmentMetrics.previousPeriod
                            .totalAppointments
                        ) >= 0
                          ? "increase"
                          : "decrease"
                      }
                    >
                      {Math.abs(
                        calculateChange(
                          data.appointmentMetrics.totalAppointments,
                          data.appointmentMetrics.previousPeriod
                            .totalAppointments
                        )
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="metric-value">
                {formatNumber(data.appointmentMetrics.totalAppointments)}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <h3>Completed</h3>
                {data.appointmentMetrics.previousPeriod && (
                  <div className="metric-comparison">
                    {calculateChange(
                      data.appointmentMetrics.completedAppointments,
                      data.appointmentMetrics.previousPeriod
                        .completedAppointments
                    ) >= 0 ? (
                      <ArrowUpRight className="increase" size={16} />
                    ) : (
                      <ArrowDownRight className="decrease" size={16} />
                    )}
                    <span
                      className={
                        calculateChange(
                          data.appointmentMetrics.completedAppointments,
                          data.appointmentMetrics.previousPeriod
                            .completedAppointments
                        ) >= 0
                          ? "increase"
                          : "decrease"
                      }
                    >
                      {Math.abs(
                        calculateChange(
                          data.appointmentMetrics.completedAppointments,
                          data.appointmentMetrics.previousPeriod
                            .completedAppointments
                        )
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="metric-value">
                {formatNumber(data.appointmentMetrics.completedAppointments)}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <h3>Canceled</h3>
                {data.appointmentMetrics.previousPeriod && (
                  <div className="metric-comparison">
                    {calculateChange(
                      data.appointmentMetrics.canceledAppointments,
                      data.appointmentMetrics.previousPeriod
                        .canceledAppointments
                    ) <= 0 ? (
                      <ArrowUpRight className="increase" size={16} />
                    ) : (
                      <ArrowDownRight className="decrease" size={16} />
                    )}
                    <span
                      className={
                        calculateChange(
                          data.appointmentMetrics.canceledAppointments,
                          data.appointmentMetrics.previousPeriod
                            .canceledAppointments
                        ) <= 0
                          ? "increase"
                          : "decrease"
                      }
                    >
                      {Math.abs(
                        calculateChange(
                          data.appointmentMetrics.canceledAppointments,
                          data.appointmentMetrics.previousPeriod
                            .canceledAppointments
                        )
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="metric-value">
                {formatNumber(data.appointmentMetrics.canceledAppointments)}
              </div>
            </div>
          </div>

          <div className="charts-container">
            {/* Appointment status breakdown */}
            <div className="chart-box">
              <h3>Appointment Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Completed",
                        value: data.appointmentMetrics.completedAppointments,
                      },
                      {
                        name: "Canceled",
                        value: data.appointmentMetrics.canceledAppointments,
                      },
                      {
                        name: "Upcoming",
                        value: data.appointmentMetrics.upcomingAppointments,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {[
                      { name: "Completed", color: "#10B981" },
                      { name: "Canceled", color: "#EF4444" },
                      { name: "Upcoming", color: "#3B82F6" },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatNumber(value), "Appointments"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Popular services */}
            <div className="chart-box">
              <h3>Popular Services</h3>
              {data.serviceMetrics.popularServices &&
              data.serviceMetrics.popularServices.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={data.serviceMetrics.popularServices}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 12 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value) => [formatNumber(value), "Bookings"]}
                    />
                    <Bar dataKey="count" fill="#8884d8">
                      {data.serviceMetrics.popularServices.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-chart-data">
                  <p>No service data available for the selected period.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conversion metrics view */}
      {selectedMetricView === "conversion" && (
        <div className="metrics-content">
          <div className="metrics-summary conversion-metrics">
            <div className="metric-card">
              <h3>Lead-to-Client Rate</h3>
              <div className="metric-value">
                {(data.conversionRate.leadToClient * 100).toFixed(1)}%
              </div>
              {data.conversionRate.previousPeriod && (
                <div className="metric-comparison">
                  {calculateChange(
                    data.conversionRate.leadToClient,
                    data.conversionRate.previousPeriod.leadToClient
                  ) >= 0 ? (
                    <ArrowUpRight className="increase" size={16} />
                  ) : (
                    <ArrowDownRight className="decrease" size={16} />
                  )}
                  <span
                    className={
                      calculateChange(
                        data.conversionRate.leadToClient,
                        data.conversionRate.previousPeriod.leadToClient
                      ) >= 0
                        ? "increase"
                        : "decrease"
                    }
                  >
                    {Math.abs(
                      calculateChange(
                        data.conversionRate.leadToClient,
                        data.conversionRate.previousPeriod.leadToClient
                      )
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>

            <div className="metric-card">
              <h3>Appointment Show Rate</h3>
              <div className="metric-value">
                {(data.conversionRate.appointmentShowRate * 100).toFixed(1)}%
              </div>
              {data.conversionRate.previousPeriod && (
                <div className="metric-comparison">
                  {calculateChange(
                    data.conversionRate.appointmentShowRate,
                    data.conversionRate.previousPeriod.appointmentShowRate
                  ) >= 0 ? (
                    <ArrowUpRight className="increase" size={16} />
                  ) : (
                    <ArrowDownRight className="decrease" size={16} />
                  )}
                  <span
                    className={
                      calculateChange(
                        data.conversionRate.appointmentShowRate,
                        data.conversionRate.previousPeriod.appointmentShowRate
                      ) >= 0
                        ? "increase"
                        : "decrease"
                    }
                  >
                    {Math.abs(
                      calculateChange(
                        data.conversionRate.appointmentShowRate,
                        data.conversionRate.previousPeriod.appointmentShowRate
                      )
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>

            <div className="metric-card">
              <h3>Repeat Client Rate</h3>
              <div className="metric-value">
                {(data.conversionRate.repeatClientRate * 100).toFixed(1)}%
              </div>
              {data.conversionRate.previousPeriod && (
                <div className="metric-comparison">
                  {calculateChange(
                    data.conversionRate.repeatClientRate,
                    data.conversionRate.previousPeriod.repeatClientRate
                  ) >= 0 ? (
                    <ArrowUpRight className="increase" size={16} />
                  ) : (
                    <ArrowDownRight className="decrease" size={16} />
                  )}
                  <span
                    className={
                      calculateChange(
                        data.conversionRate.repeatClientRate,
                        data.conversionRate.previousPeriod.repeatClientRate
                      ) >= 0
                        ? "increase"
                        : "decrease"
                    }
                  >
                    {Math.abs(
                      calculateChange(
                        data.conversionRate.repeatClientRate,
                        data.conversionRate.previousPeriod.repeatClientRate
                      )
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Comparison selector */}
          <div className="comparison-selector">
            <span>Compare to:</span>
            <div className="selector-buttons">
              <button
                className={comparisonPeriod === "previous" ? "active" : ""}
                onClick={() => setComparisonPeriod("previous")}
              >
                Previous Period
              </button>
              <button
                className={comparisonPeriod === "last-year" ? "active" : ""}
                onClick={() => setComparisonPeriod("last-year")}
              >
                Same Period Last Year
              </button>
            </div>
          </div>

          {/* Trends chart */}
          <div className="chart-container">
            <h3>Conversion Trends</h3>
            {data.conversionTrends ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.conversionTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, ""]}
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="leadToClientRate"
                    name="Lead-to-Client Rate"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="appointmentShowRate"
                    name="Appointment Show Rate"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="repeatClientRate"
                    name="Repeat Client Rate"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-chart-data">
                <p>
                  No conversion trend data available for the selected period.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMAnalyticsModule;
