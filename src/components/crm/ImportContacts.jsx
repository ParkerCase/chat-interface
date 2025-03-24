import React, { useState, useRef } from "react";
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
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import Papa from "papaparse";
import "./ImportContacts.css";

const ImportContacts = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [mappedData, setMappedData] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState("");
  const [centers, setCenters] = useState([]);
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
  React.useEffect(() => {
    const loadCenters = async () => {
      try {
        const response = await zenotiService.getCenters();
        if (response.data?.success) {
          setCenters(response.data.centers || []);

          // Set default center if available
          if (response.data.centers?.length > 0) {
            setSelectedCenter(response.data.centers[0].code);
          }
        }
      } catch (err) {
        console.error("Error loading centers:", err);
        setError(
          "Failed to load Zenoti centers. Please check your connection settings."
        );
      }
    };

    loadCenters();
  }, []);

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    // Parse CSV file
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setError("The selected file contains no data.");
          setFile(null);
          return;
        }

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
          mappedRow[zenotiField] = row[csvColumn];
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
    ];
    const sampleData = [
      ["John", "Doe", "john@example.com", "555-123-4567", "Male", "1985-01-15"],
      [
        "Jane",
        "Smith",
        "jane@example.com",
        "555-987-6543",
        "Female",
        "1990-05-20",
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
    link.setAttribute("download", "sample_contacts.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="import-contacts">
      <div className="import-header">
        <h2>Import Contacts</h2>
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
                  separators and include a header row.
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
              <button className="cancel-button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="next-button"
                disabled={!file}
                onClick={() => setStep(2)}
              >
                Next: Map Fields
              </button>
            </div>
          </div>
        )}

        {step === 2 && parsedData && (
          <div className="mapping-step">
            <h3>Map CSV Columns to Contact Fields</h3>
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
                {centers.map((center) => (
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
                                {row[csvColumn] || "—"}
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
                          <td key={field.key}>{row[field.key] || "—"}</td>
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
                {isLoading ? "Importing..." : "Import Contacts"}
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
