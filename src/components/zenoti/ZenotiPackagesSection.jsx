import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Divider,
} from "@mui/material";
import {
  Search,
  Refresh,
  Visibility,
  AttachMoney,
  Schedule,
  Category,
  CalendarToday,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";

const ZenotiPackagesSection = ({
  selectedCenter,
  centerMapping = {},
  onRefresh,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalPackages, setTotalPackages] = useState(0);

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

  // Utility to extract data from details JSON
  const extractFromDetails = useCallback((details, path, fallback = null) => {
    if (!details || typeof details !== "object") return fallback;

    const pathArray = path.split(".");
    let current = details;

    for (const key of pathArray) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return fallback;
      }
    }

    return current !== null && current !== undefined ? current : fallback;
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format duration/time
  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  // Get package type label
  const getPackageTypeLabel = (type) => {
    const typeMap = {
      1: "Standard",
      2: "Series",
      3: "Membership",
      4: "Subscription",
    };
    return typeMap[type] || `Type ${type}`;
  };

  // Fetch packages from Supabase
  const fetchPackages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching packages for center:", selectedCenter);
      console.log("Center mapping:", centerMapping);

      let query = supabase
        .from("zenoti_packages")
        .select("*", { count: "exact" });

      // Apply center filter if a specific center is selected
      if (selectedCenter !== "ALL" && centerCodeToId[selectedCenter]) {
        const targetCenterId = centerCodeToId[selectedCenter];
        console.log("Filtering packages by center ID:", targetCenterId);
        query = query.eq("center_id", targetCenterId);
      }

      // Apply search filter if provided
      if (searchTerm.trim()) {
        const search = searchTerm.trim();
        query = query.or(
          `name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      // Apply pagination
      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      // Order by name
      query = query.order("name", { ascending: true });

      const { data, error, count } = await query;

      if (error) throw error;

      console.log("Packages query result:", {
        data: data?.length,
        count,
        selectedCenter,
        targetCenterId: centerCodeToId[selectedCenter],
      });

      // Process packages data
      const processedPackages = (data || []).map((row) => {
        const details = row.details || {};
        const seriesPackage = details.series_package || {};
        const validity = seriesPackage.validity || {};

        // Calculate price from series package if available
        let packagePrice = 0;
        if (seriesPackage.regular && seriesPackage.regular.price) {
          packagePrice = seriesPackage.regular.price;
        }

        return {
          id: row.id,
          code: row.code || details.code || "N/A",
          name: row.name || details.name || "Unknown Package",
          description: row.description || details.description || "",
          type: row.type || details.type || 1,
          type_label: getPackageTypeLabel(row.type || details.type),
          time: row.time || details.time || 0,
          center_id: row.center_id,
          center_code: centerIdToCode[row.center_id] || "Unknown",
          is_active: details.active !== false,
          booking_start_date:
            row.booking_start_date || details.booking_start_date,
          booking_end_date: row.booking_end_date || details.booking_end_date,

          // Series package specific details
          validity_expiry: validity.expiry || 0,
          validity_expiry_date: validity.expiry_date,
          freeze_count: seriesPackage.freeze_count || 0,
          cost_to_center: seriesPackage.cost_to_center || 0,
          terms_and_conditions: seriesPackage.terms_and_conditions || "",
          price: packagePrice,

          // Commission details
          commission: details.commission || {},

          _raw: details,
        };
      });

      setPackages(processedPackages);
      setTotalPackages(count || 0);

      if (processedPackages.length === 0 && selectedCenter !== "ALL") {
        console.warn("No packages found for center:", selectedCenter);
      }
    } catch (err) {
      console.error("Error fetching packages:", err);
      setError(`Failed to fetch packages: ${err.message}`);
      setPackages([]);
      setTotalPackages(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchTerm,
    page,
    rowsPerPage,
    selectedCenter,
    centerCodeToId,
    centerIdToCode,
  ]);

  // Load packages on mount and when dependencies change
  useEffect(() => {
    // Add a small delay to ensure center mapping is available
    const timer = setTimeout(() => {
      fetchPackages();
    }, 100);

    return () => clearTimeout(timer);
  }, [fetchPackages]);

  // Reset page when search or center changes
  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedCenter]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    fetchPackages();
    if (onRefresh) {
      onRefresh();
    }
  }, [fetchPackages, onRefresh]);

  // Get summary statistics
  const summaryStats = useMemo(() => {
    const totalActive = packages.filter((p) => p.is_active).length;
    const typeGroups = packages.reduce((acc, pkg) => {
      acc[pkg.type_label] = (acc[pkg.type_label] || 0) + 1;
      return acc;
    }, {});

    return {
      total: totalPackages, // Use total from query, not filtered results
      active: totalActive,
      inactive: packages.length - totalActive,
      types: Object.keys(typeGroups).length,
      typeGroups,
    };
  }, [packages, totalPackages]);

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
          <Typography variant="h6">Packages</Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Debug Info */}
        {process.env.NODE_ENV === "development" && (
          <Box sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="caption" display="block">
              Debug: Selected Center: {selectedCenter} | Center ID:{" "}
              {centerCodeToId[selectedCenter] || "N/A"} | Packages Found:{" "}
              {packages.length} | Total Count: {totalPackages}
            </Typography>
          </Box>
        )}

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Packages
                </Typography>
                <Typography variant="h6">
                  {summaryStats.total.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Packages
                </Typography>
                <Typography variant="h6" color="success.main">
                  {summaryStats.active}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Inactive Packages
                </Typography>
                <Typography variant="h6" color="error.main">
                  {summaryStats.inactive}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Package Types
                </Typography>
                <Typography variant="h6">{summaryStats.types}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search packages by name, code, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ width: "100%", maxWidth: 400 }}
        />
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Packages Table */}
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
        ) : packages.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h6" color="textSecondary">
              No packages found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {searchTerm
                ? "Try adjusting your search criteria"
                : selectedCenter !== "ALL"
                ? `No packages are available for ${selectedCenter} center`
                : "No packages are available"}
            </Typography>
            {selectedCenter !== "ALL" && (
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchTerm("");
                  // This would trigger the parent to change selectedCenter to "ALL"
                  // You might need to add a callback prop for this
                }}
              >
                View All Centers
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ height: "100%" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 0.5,
                      }}
                    >
                      <Schedule fontSize="small" />
                      Time
                    </Box>
                  </TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Booking Period</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {pkg.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {pkg.name}
                        </Typography>
                        {pkg.description && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            noWrap
                          >
                            {pkg.description.length > 50
                              ? `${pkg.description.substring(0, 50)}...`
                              : pkg.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pkg.type_label}
                        size="small"
                        variant="outlined"
                        color={pkg.type === 2 ? "primary" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatDuration(pkg.time)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(pkg.price)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pkg.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={pkg.is_active ? "success" : "default"}
                        icon={
                          pkg.is_active ? (
                            <CheckCircle fontSize="small" />
                          ) : (
                            <Cancel fontSize="small" />
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        {pkg.booking_start_date && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            display="block"
                          >
                            From: {formatDate(pkg.booking_start_date)}
                          </Typography>
                        )}
                        {pkg.booking_end_date && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            display="block"
                          >
                            To: {formatDate(pkg.booking_end_date)}
                          </Typography>
                        )}
                        {!pkg.booking_start_date && !pkg.booking_end_date && (
                          <Typography variant="caption" color="textSecondary">
                            No restrictions
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pkg.center_code}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedPackage(pkg)}
                        color="primary"
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalPackages}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />

      {/* Package Detail Modal */}
      <Dialog
        open={!!selectedPackage}
        onClose={() => setSelectedPackage(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Package Details: {selectedPackage?.name}</DialogTitle>
        <DialogContent>
          {selectedPackage && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Basic Information */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Package Code
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedPackage.code}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Type
                    </Typography>
                    <Chip
                      label={selectedPackage.type_label}
                      size="small"
                      color="primary"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Time Allocation
                    </Typography>
                    <Typography variant="body1">
                      {formatDuration(selectedPackage.time)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Price
                    </Typography>
                    <Typography variant="body1">
                      {formatCurrency(selectedPackage.price)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedPackage.is_active ? "Active" : "Inactive"}
                      size="small"
                      color={selectedPackage.is_active ? "success" : "default"}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Center
                    </Typography>
                    <Typography variant="body1">
                      {selectedPackage.center_code}
                    </Typography>
                  </Grid>
                  {selectedPackage.description && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {selectedPackage.description}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Booking Period */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Booking Period
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Start Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedPackage.booking_start_date
                        ? formatDate(selectedPackage.booking_start_date)
                        : "No restriction"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      End Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedPackage.booking_end_date
                        ? formatDate(selectedPackage.booking_end_date)
                        : "No restriction"}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Validity Information */}
              {(selectedPackage.validity_expiry > 0 ||
                selectedPackage.validity_expiry_date) && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Validity Information
                  </Typography>
                  <Grid container spacing={2}>
                    {selectedPackage.validity_expiry > 0 && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Validity Days
                        </Typography>
                        <Typography variant="body1">
                          {selectedPackage.validity_expiry} days
                        </Typography>
                      </Grid>
                    )}
                    {selectedPackage.validity_expiry_date && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Expiry Date
                        </Typography>
                        <Typography variant="body1">
                          {formatDate(selectedPackage.validity_expiry_date)}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}

              {/* Commission Information */}
              {selectedPackage.commission &&
                Object.keys(selectedPackage.commission).length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Commission Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Commission Type
                        </Typography>
                        <Typography variant="body1">
                          {selectedPackage.commission.type || "N/A"}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Commission Value
                        </Typography>
                        <Typography variant="body1">
                          {selectedPackage.commission.value || "N/A"}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

              {/* Terms and Conditions */}
              {selectedPackage.terms_and_conditions && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Terms and Conditions
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                    {selectedPackage.terms_and_conditions}
                  </Typography>
                </Box>
              )}

              <Divider />

              {/* Raw Data */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Raw Package Data
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: "#f5f5f5",
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: "auto",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                >
                  {JSON.stringify(selectedPackage._raw, null, 2)}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPackage(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ZenotiPackagesSection;
