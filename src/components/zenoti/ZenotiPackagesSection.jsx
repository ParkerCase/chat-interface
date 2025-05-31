import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
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

const ZenotiPackagesSection = ({ onRefresh }) => {
  // Hardcoded packages data based on your SQL
  const allPackages = [
    {
      id: "a447ce61-ad06-4c78-b391-50034ea6eb14",
      code: "Pkg1",
      name: "(Large-2tx) Removal Package",
      description: "2 Templates",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 730,
      validity_expiry_date: null,
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0, // Price not specified in source data
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 12,
      payment_frequency: 30,
    },
    {
      id: "91a39ae0-bfad-4a44-b3c2-f88cde7d681d",
      code: "Pkg2",
      name: "(Large-4tx) Removal Package",
      description: "2 templates",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 730,
      validity_expiry_date: null,
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 18,
      payment_frequency: 30,
    },
    {
      id: "e887cf78-e008-45e9-a1d0-b574be64c680",
      code: "Pkg3",
      name: "(Medium-2tx) Removal Package",
      description: "",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 730,
      validity_expiry_date: null,
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 12,
      payment_frequency: 30,
    },
    {
      id: "a390244e-f380-42a8-ac84-345b647238d6",
      code: "Pkg4",
      name: "(Medium-4tx) Removal Package",
      description: "1.5 templates, 4 treatments",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 730,
      validity_expiry_date: null,
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 18,
      payment_frequency: 30,
    },
    {
      id: "2e1ee9c3-742f-4a06-8b7e-2443231137eb",
      code: "Pkg5",
      name: "(Small-2tx) Removal Package",
      description: "1 template, 2 treatments",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 0,
      validity_expiry_date: "2100-01-01",
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 6,
      payment_frequency: 30,
    },
    {
      id: "f36451a0-391b-4d4a-85da-ee895186ac99",
      code: "Pkg6",
      name: "(Small-4tx) Removal Package",
      description: "1 template, 4 treatments",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 0,
      validity_expiry_date: "2100-01-01",
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 12,
      payment_frequency: 30,
    },
    {
      id: "e99adfb0-7dc3-48c3-bdd4-466b6475f984",
      code: "Pkg7",
      name: "(XS-2tx) Removal Package",
      description: "1/2 template, 2 treatments",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 730,
      validity_expiry_date: null,
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 6,
      payment_frequency: 30,
    },
    {
      id: "c45543a3-8acb-40a9-84d5-ff784f7fc124",
      code: "Pkg8",
      name: "(XS-4tx) Removal Package",
      description: "1/2 template, 4 treatments",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 0,
      validity_expiry_date: "2100-01-01",
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 12,
      payment_frequency: 30,
    },
    {
      id: "3713d7aa-bf42-499f-9c4a-9ba8296a358b",
      code: "Pkg9",
      name: "(XXS-2tx) Removal Package",
      description: "Minimum pricing, 20 dots or less",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 0,
      validity_expiry_date: "2100-01-01",
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 6,
      payment_frequency: 30,
    },
    {
      id: "8bfd92d1-72c2-469e-a8d5-9e9a346742e7",
      code: "Pkg11",
      name: "(Brows-2tx) Removal Package",
      description: "Two treatments on brows",
      type: 2,
      type_label: "Series",
      time: 15,
      is_active: true,
      validity_expiry: 365,
      validity_expiry_date: null,
      freeze_count: -2,
      cost_to_center: 0,
      terms_and_conditions: "",
      price: 0,
      commission: { type: 0, value: 0, factor: 100, eligible: false },
      instalments: 6,
      payment_frequency: 30,
    },
  ];

  // State management
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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

  // Filter packages based on search term
  const filteredPackages = useMemo(() => {
    if (!searchTerm.trim()) return allPackages;

    const search = searchTerm.toLowerCase().trim();
    return allPackages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(search) ||
        pkg.code.toLowerCase().includes(search) ||
        pkg.description.toLowerCase().includes(search)
    );
  }, [searchTerm]);

  // Get paginated packages
  const paginatedPackages = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredPackages.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPackages, page, rowsPerPage]);

  // Reset page when search changes
  React.useEffect(() => {
    setPage(0);
  }, [searchTerm]);

  // Get summary statistics
  const summaryStats = useMemo(() => {
    const totalActive = allPackages.filter((p) => p.is_active).length;
    const typeGroups = allPackages.reduce((acc, pkg) => {
      acc[pkg.type_label] = (acc[pkg.type_label] || 0) + 1;
      return acc;
    }, {});

    return {
      total: allPackages.length,
      active: totalActive,
      inactive: allPackages.length - totalActive,
      types: Object.keys(typeGroups).length,
      typeGroups,
    };
  }, []);

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
            <IconButton onClick={onRefresh}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

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

      {/* Packages Table */}
      <Box sx={{ flex: 1, overflow: "hidden" }}>
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
                <TableCell>Validity</TableCell>
                <TableCell>Payments</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedPackages.map((pkg) => (
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
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatDuration(pkg.time)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {pkg.validity_expiry > 0
                        ? `${pkg.validity_expiry} days`
                        : "No expiry"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {pkg.instalments} installments
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Every {pkg.payment_frequency} days
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
                    <Chip
                      label="All Centers"
                      size="small"
                      variant="outlined"
                      color="primary"
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
      </Box>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={filteredPackages.length}
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
                      Availability
                    </Typography>
                    <Typography variant="body1">All Centers</Typography>
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

              {/* Validity Information */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Validity Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Validity Days
                    </Typography>
                    <Typography variant="body1">
                      {selectedPackage.validity_expiry > 0
                        ? `${selectedPackage.validity_expiry} days`
                        : "No expiry"}
                    </Typography>
                  </Grid>
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
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Freeze Count
                    </Typography>
                    <Typography variant="body1">
                      {selectedPackage.freeze_count === -2
                        ? "Unlimited"
                        : selectedPackage.freeze_count}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Payment Information */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Payment Schedule
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Number of Installments
                    </Typography>
                    <Typography variant="body1">
                      {selectedPackage.instalments}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Payment Frequency
                    </Typography>
                    <Typography variant="body1">
                      Every {selectedPackage.payment_frequency} days
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

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
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Eligible
                        </Typography>
                        <Typography variant="body1">
                          {selectedPackage.commission.eligible ? "Yes" : "No"}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="textSecondary">
                          Factor
                        </Typography>
                        <Typography variant="body1">
                          {selectedPackage.commission.factor || "N/A"}
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
