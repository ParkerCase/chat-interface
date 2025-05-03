import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  AlertCircle,
  CheckCircle,
  File,
  FileText,
  Table as TableIcon,
  Database,
  X,
  HelpCircle,
  Download,
  CloudUpload,
  Loader,
  Info,
  BarChart,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import Papa from "papaparse";
import analyticsUtils from "../../utils/analyticsUtils";
import "./ImportContacts.css";

const ImportContacts = ({ onClose, onSuccess, centers = [] }) => {
  const [file, setFile] = useState(null);
  const [mappedData, setMappedData] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState("");
  const [localCenters, setLocalCenters] = useState([]);
  const [importStats, setImportStats] = useState({
    total: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    details: [],
  });
  const fileInputRef = useRef(null);

  // Required fields in Zenoti
  const requiredFields = ["first_name", "last_name"];

  // Available fields for mapping
  const availableFields = [
    { key: "first_name", label: "First Name", required: true },
    { key: "last_name", label: "Last Name", required: true },
    { key: "email", label: "Email", required: false },
    { key: "mobile", label: "Mobile Phone", required: false },
    { key: "phone", label: "Home Phone", required: false },
    { key: "gender", label: "Gender", required: false },
    { key: "date_of_birth", label: "Date of Birth", required: false },
    { key: "address_line1", label: "Address Line 1", required: false },
    { key: "address_line2", label: "Address Line 2", required: false },
    { key: "city", label: "City", required: false },
    { key: "state", label: "State", required: false },
    { key: "postal_code", label: "Postal Code", required: false },
    { key: "country", label: "Country", required: false },
    { key: "notes", label: "Notes", required: false },
  ];

  // Load centers when component mounts
  useEffect(() => {
    const loadCenters = async () => {
      try {
        setIsLoading(true);

        // First try to use the centers passed as props
        if (centers && centers.length > 0) {
          setLocalCenters(centers);
          // Set default center if available
          if (centers.length > 0 && !selectedCenter) {
            setSelectedCenter(centers[0].code);
          }
          setIsLoading(false);
          return;
        }

        // If no centers were passed, fetch them
        const response = await zenotiService.getCenters();
        if (response.data?.success) {
          // Handle different response formats
          const centersData =
            response.data.centers || response.data.centerMapping || [];
          setLocalCenters(centersData);

          // Set default center if available
          if (centersData.length > 0 && !selectedCenter) {
            setSelectedCenter(centersData[0].code);
          }
        } else {
          throw new Error(response.data?.error || "Failed to load centers");
        }
      } catch (err) {
        console.error("Error loading centers:", err);
        setError(
          "Failed to load Zenoti centers. Please check your connection settings."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadCenters();
  }, [centers, selectedCenter]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Check file size (10MB limit)
    const maxFileSize = 10; // MB
    if (selectedFile.size > maxFileSize * 1024 * 1024) {
      setError(`File size exceeds ${maxFileSize}MB limit.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Parse CSV file
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setError("The selected file contains no data.");
          setFile(null);
          return;
        }

        // Track file upload for analytics
        analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_FILE_UPLOAD, {
          fileType: "csv",
          fileSize: selectedFile.size,
          rowCount: results.data.length,
        });

        setParsedData(results.data);

        // Auto-map columns based on headers
        const headers = results.meta.fields || [];
        const mapping = {};

        headers.forEach((header) => {
          // Try to match headers to available fields
          const normalizedHeader = header.toLowerCase().trim();

          // Check for exact matches or fuzzy matches
          const match = availableFields.find(
            (field) =>
              field.key === normalizedHeader ||
              field.label.toLowerCase() === normalizedHeader ||
              normalizedHeader.includes(field.key) ||
              normalizedHeader.includes(field.label.toLowerCase())
          );

          if (match) {
            mapping[header] = match.key;
          }
        });

        setColumnMapping(mapping);
        setStep(2);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setError("Failed to parse the CSV file. Please check the file format.");
        setFile(null);
      },
    });
  };

  // Handle column mapping change
  const handleMappingChange = (csvColumn, zenotiField) => {
    setColumnMapping((prev) => ({
      ...prev,
      [csvColumn]: zenotiField || "",
    }));
  };

  // Handle preview generation
  const handlePreviewData = () => {
    if (!parsedData) return;

    // Check if required fields are mapped
    const mappedRequiredFields = requiredFields.filter((field) =>
      Object.values(columnMapping).includes(field)
    );

    if (mappedRequiredFields.length < requiredFields.length) {
      setError(
        `Missing required fields: ${requiredFields
          .filter((field) => !mappedRequiredFields.includes(field))
          .map((field) => availableFields.find((f) => f.key === field)?.label)
          .join(", ")}`
      );
      return;
    }

    // Map the data
    const mapped = parsedData.map((row) => {
      const mappedRow = {};

      // Apply column mapping
      Object.entries(columnMapping).forEach(([csvColumn, zenotiField]) => {
        if (zenotiField && row[csvColumn] !== undefined) {
          // Perform some data cleansing
          let value = row[csvColumn];

          // Format date_of_birth if needed (MM/DD/YYYY to YYYY-MM-DD)
          if (zenotiField === "date_of_birth" && value) {
            // Check if it's a string in MM/DD/YYYY format
            if (
              typeof value === "string" &&
              value.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
            ) {
              const parts = value.split("/");
              value = `${parts[2]}-${parts[0].padStart(
                2,
                "0"
              )}-${parts[1].padStart(2, "0")}`;
            }
          }

          // Format phone numbers if needed
          if ((zenotiField === "mobile" || zenotiField === "phone") && value) {
            // Remove non-digit characters
            if (typeof value === "string") {
              value = value.replace(/\D/g, "");
            }
          }

          mappedRow[zenotiField] = value;
        }
      });

      return mappedRow;
    });

    setMappedData(mapped);
    setStep(3);
  };

  // Reset the form
  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setMappedData(null);
    setColumnMapping({});
    setError(null);
    setSuccess(null);
    setStep(1);
    setImportStats({
      total: 0,
      success: 0,
      errors: 0,
      skipped: 0,
      details: [],
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Import contacts
  const handleImport = async () => {
    if (!mappedData || mappedData.length === 0 || !selectedCenter) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const stats = {
      total: mappedData.length,
      success: 0,
      errors: 0,
      skipped: 0,
      details: [],
    };

    // Track import start for analytics
    analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_IMPORT_START, {
      contactCount: mappedData.length,
      centerCode: selectedCenter,
    });

    // Process each contact sequentially
    for (let i = 0; i < mappedData.length; i++) {
      const contact = mappedData[i];

      // Skip empty contacts
      if (!contact.first_name && !contact.last_name) {
        stats.skipped++;
        stats.details.push({
          index: i,
          status: "skipped",
          message: "Missing required fields (first name or last name)",
          data: contact,
        });
        continue;
      }

      try {
        // Add processing delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Set progress indicator
        const progress = Math.round((i / mappedData.length) * 100);
        setImportStats((prevStats) => ({
          ...prevStats,
          total: mappedData.length,
          progress,
        }));

        // Call the API to create contact
        const response = await zenotiService.createClient(
          contact,
          selectedCenter
        );

        if (response.data?.success) {
          stats.success++;
          stats.details.push({
            index: i,
            status: "success",
            contactId: response.data.client?.id,
            data: contact,
          });
        } else {
          stats.errors++;
          stats.details.push({
            index: i,
            status: "error",
            message: response.data?.error || "Unknown error",
            data: contact,
          });
        }
      } catch (err) {
        console.error("Error creating contact:", err);
        stats.errors++;
        stats.details.push({
          index: i,
          status: "error",
          message: err.message || "Failed to create contact",
          data: contact,
        });
      }
    }

    setImportStats(stats);
    setIsLoading(false);

    // Track import completion for analytics
    analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_IMPORT_COMPLETE, {
      totalContacts: stats.total,
      successCount: stats.success,
      errorCount: stats.errors,
      skippedCount: stats.skipped,
      centerCode: selectedCenter,
    });

    if (stats.success > 0) {
      setSuccess(
        `Successfully imported ${stats.success} out of ${stats.total} contacts.`
      );
      setStep(4);

      if (onSuccess) {
        onSuccess(stats);
      }
    } else {
      setError(
        "No contacts were imported successfully. Please check the errors and try again."
      );
    }
  };

  // Download sample CSV
  const handleDownloadSample = () => {
    const headers = [
      "first_name",
      "last_name",
      "email",
      "mobile",
      "gender",
      "date_of_birth",
      "address_line1",
      "city",
      "state",
      "postal_code",
      "country",
      "notes",
    ];
    const sampleData = [
      [
        "John",
        "Doe",
        "john@example.com",
        "555-123-4567",
        "Male",
        "1985-01-15",
        "123 Main St",
        "Austin",
        "TX",
        "78701",
        "USA",
        "First treatment scheduled",
      ],
      [
        "Jane",
        "Smith",
        "jane@example.com",
        "555-987-6543",
        "Female",
        "1990-05-20",
        "456 Oak Ave",
        "Dallas",
        "TX",
        "75201",
        "USA",
        "Interested in full sleeve removal",
      ],
      [
        "Alex",
        "Johnson",
        "alex@example.com",
        "555-456-7890",
        "Other",
        "1988-09-30",
        "789 Pine Blvd",
        "Houston",
        "TX",
        "77002",
        "USA",
        "Referred by Jane Smith",
      ],
    ];

    const csv = Papa.unparse({
      fields: headers,
      data: sampleData,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tatt2away_sample_contacts.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Track download for analytics
    analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_SAMPLE_DOWNLOAD, {
      fileType: "csv",
      template: "contacts",
    });
  };

  // Export results to CSV
  const handleExportResults = () => {
    if (!importStats.details || importStats.details.length === 0) return;

    const exportData = importStats.details.map((detail) => ({
      Index: detail.index + 1,
      Name: `${detail.data.first_name || ""} ${
        detail.data.last_name || ""
      }`.trim(),
      Email: detail.data.email || "",
      Phone: detail.data.mobile || detail.data.phone || "",
      Status: detail.status,
      Message: detail.message || "",
      ContactID: detail.contactId || "",
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `import_results_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="import-contacts">
      <div className="import-header">
        <h2>Import Contacts to Zenoti</h2>
        <button className="close-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="success-message">
          <CheckCircle size={16} />
          <p>{success}</p>
        </div>
      )}

      <div className="import-steps">
        <div
          className={`step ${step >= 1 ? "active" : ""} ${
            step > 1 ? "completed" : ""
          }`}
        >
          <span className="step-number">1</span>
          <span className="step-text">Upload File</span>
        </div>
        <div
          className={`step ${step >= 2 ? "active" : ""} ${
            step > 2 ? "completed" : ""
          }`}
        >
          <span className="step-number">2</span>
          <span className="step-text">Map Fields</span>
        </div>
        <div
          className={`step ${step >= 3 ? "active" : ""} ${
            step > 3 ? "completed" : ""
          }`}
        >
          <span className="step-number">3</span>
          <span className="step-text">Preview</span>
        </div>
        <div
          className={`step ${step >= 4 ? "active" : ""} ${
            step > 4 ? "completed" : ""
          }`}
        >
          <span className="step-number">4</span>
          <span className="step-text">Results</span>
        </div>
      </div>

      <div className="import-content">
        {step === 1 && (
          <div className="upload-step">
            <div className="upload-description">
              <div className="upload-icon">
                <FileText size={40} />
              </div>
              <h3>Upload CSV File</h3>
              <p>
                Upload a CSV file containing your contacts. The file should have
                headers for each column.
              </p>

              <div className="upload-notes">
                <HelpCircle size={16} />
                <span>
                  <strong>Format Notes:</strong> CSV files should use commas as
                  separators and include a header row. Required fields are First
                  Name and Last Name.
                </span>
              </div>

              <button className="sample-button" onClick={handleDownloadSample}>
                <Download size={16} />
                Download Sample CSV
              </button>
            </div>

            <div className="file-upload-area">
              {file ? (
                <div className="selected-file">
                  <div className="file-icon">
                    <File size={24} />
                  </div>
                  <div className="file-details">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">
                      {(file.size / 1024).toFixed(2)} KB
                    </div>
                  </div>
                  <button className="remove-file" onClick={handleReset}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="upload-container">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="file-input"
                  />
                  <div className="upload-placeholder">
                    <Upload size={32} />
                    <p>Drag and drop your CSV file here or click to browse</p>
                    <button className="browse-button">Browse Files</button>
                  </div>
                </div>
              )}
            </div>

            <div className="upload-actions">
              <button
                className="next-button"
                disabled={!file}
                onClick={() => setStep(2)}
              >
                Next: Map Fields
              </button>
              <button className="cancel-button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 2 && parsedData && (
          <div className="mapping-step">
            <h3>Map CSV Columns to Zenoti Contact Fields</h3>
            <p>
              Select which Zenoti field each CSV column should be mapped to.
            </p>

            <div className="center-selection">
              <label htmlFor="centerCode">Select Center:</label>
              <select
                id="centerCode"
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                required
              >
                <option value="">-- Select a center --</option>
                {localCenters.map((center) => (
                  <option key={center.code} value={center.code}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mapping-table">
              <table>
                <thead>
                  <tr>
                    <th>CSV Column</th>
                    <th>Sample Data</th>
                    <th>Map to Zenoti Field</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.length > 0 &&
                    Object.keys(parsedData[0]).map((csvColumn, index) => (
                      <tr key={index}>
                        <td>{csvColumn}</td>
                        <td>
                          <div className="sample-data">
                            {parsedData.slice(0, 3).map((row, i) => (
                              <span key={i}>
                                {row[csvColumn] !== null &&
                                row[csvColumn] !== undefined
                                  ? String(row[csvColumn])
                                  : "—"}
                                {i < 2 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <select
                            value={columnMapping[csvColumn] || ""}
                            onChange={(e) =>
                              handleMappingChange(csvColumn, e.target.value)
                            }
                            className={
                              requiredFields.includes(columnMapping[csvColumn])
                                ? "required-field"
                                : ""
                            }
                          >
                            <option value="">-- Do not import --</option>
                            {availableFields.map((field) => (
                              <option
                                key={field.key}
                                value={field.key}
                                disabled={
                                  Object.values(columnMapping).includes(
                                    field.key
                                  ) && columnMapping[csvColumn] !== field.key
                                }
                              >
                                {field.label}
                                {field.required ? " (Required)" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="mapping-actions">
              <button className="back-button" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="preview-button"
                onClick={handlePreviewData}
                disabled={!selectedCenter}
              >
                Preview Data
              </button>
            </div>
          </div>
        )}

        {step === 3 && mappedData && (
          <div className="preview-step">
            <h3>Preview Import Data</h3>
            <p>
              Review the data below before importing to Zenoti.{" "}
              {mappedData.length} records will be imported.
            </p>

            <div className="import-warning">
              <Info size={18} />
              <div>
                <strong>Important:</strong> This action will create new contacts
                in Zenoti. Please verify the data before proceeding. The import
                process may take several minutes for large datasets.
              </div>
            </div>

            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    {availableFields
                      .filter((field) =>
                        Object.values(columnMapping).includes(field.key)
                      )
                      .map((field) => (
                        <th key={field.key}>
                          {field.label}
                          {field.required && (
                            <span className="required">*</span>
                          )}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedData.slice(0, 10).map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      {availableFields
                        .filter((field) =>
                          Object.values(columnMapping).includes(field.key)
                        )
                        .map((field) => (
                          <td key={field.key}>
                            {row[field.key] !== null &&
                            row[field.key] !== undefined
                              ? String(row[field.key])
                              : "—"}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappedData.length > 10 && (
                <div className="more-records">
                  {mappedData.length - 10} more records not shown
                </div>
              )}
            </div>

            <div className="preview-actions">
              <button className="back-button" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="import-button"
                onClick={handleImport}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="spinner" size={16} />
                    <span>Importing... {importStats.progress || 0}%</span>
                  </>
                ) : (
                  <>
                    <CloudUpload size={16} />
                    <span>Import Contacts</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="results-step">
            <div className="results-summary">
              <h3>Import Results</h3>
              <div className="stats-container">
                <div className="stat-card">
                  <div className="stat-value">{importStats.total}</div>
                  <div className="stat-label">Total Records</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-value">{importStats.success}</div>
                  <div className="stat-label">Successful</div>
                </div>
                <div className="stat-card error">
                  <div className="stat-value">{importStats.errors}</div>
                  <div className="stat-label">Failed</div>
                </div>
                <div className="stat-card skipped">
                  <div className="stat-value">{importStats.skipped}</div>
                  <div className="stat-label">Skipped</div>
                </div>
              </div>

              {/* Results chart */}
              <div className="results-chart">
                <BarChart size={28} />
                <div className="chart-bars">
                  {importStats.success > 0 && (
                    <div
                      className="chart-bar success"
                      style={{
                        width: `${
                          (importStats.success / importStats.total) * 100
                        }%`,
                      }}
                    >
                      {importStats.success > 0 &&
                        Math.round(
                          (importStats.success / importStats.total) * 100
                        ) + "%"}
                    </div>
                  )}
                  {importStats.errors > 0 && (
                    <div
                      className="chart-bar error"
                      style={{
                        width: `${
                          (importStats.errors / importStats.total) * 100
                        }%`,
                      }}
                    >
                      {importStats.errors > 0 &&
                        Math.round(
                          (importStats.errors / importStats.total) * 100
                        ) + "%"}
                    </div>
                  )}
                  {importStats.skipped > 0 && (
                    <div
                      className="chart-bar skipped"
                      style={{
                        width: `${
                          (importStats.skipped / importStats.total) * 100
                        }%`,
                      }}
                    >
                      {importStats.skipped > 0 &&
                        Math.round(
                          (importStats.skipped / importStats.total) * 100
                        ) + "%"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {importStats.details.length > 0 && (
              <div className="results-details">
                <h4>Import Details</h4>
                <div className="details-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importStats.details.map((detail) => (
                        <tr key={detail.index} className={detail.status}>
                          <td>{detail.index + 1}</td>
                          <td>
                            {detail.data.first_name || ""}{" "}
                            {detail.data.last_name || ""}
                          </td>
                          <td>
                            <span className={`status-badge ${detail.status}`}>
                              {detail.status}
                            </span>
                          </td>
                          <td>{detail.message || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="export-results">
                  <button onClick={handleExportResults}>
                    <Download size={16} />
                    Export Results
                  </button>
                </div>
              </div>
            )}

            <div className="results-actions">
              <button className="done-button" onClick={onClose}>
                Done
              </button>
              <button className="import-more-button" onClick={handleReset}>
                Import More Contacts
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportContacts;
