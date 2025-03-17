import React, { useState } from "react";
import { Download, Clipboard, FileText, FileImage } from "lucide-react";
import "./ExportButton.css";

function ExportButton({ messages, analysisResult }) {
  const [showOptions, setShowOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format) => {
    try {
      setIsExporting(true);

      // Determine the type of export
      const exportType = analysisResult ? "analysis" : "chat";
      const content = analysisResult || messages;

      const response = await fetch("http://147.182.247.128:4000/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format,
          content,
          type: exportType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Handle different types of responses
      if (format === "txt" || format === "csv" || format === "json") {
        const text = await response.text();

        // Create a download link
        const blob = new Blob([text], {
          type: response.headers.get("Content-Type"),
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          response.headers
            .get("Content-Disposition")
            ?.split("filename=")[1]
            .replace(/"/g, "") || `export-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        // For PDF, get as blob and create download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "clipboard") {
        // For clipboard, we just copy the text
        const text = messages
          .map((msg) => `${msg.sender}: ${msg.text || ""}`)
          .join("\n\n");

        await navigator.clipboard.writeText(text);
        alert("Content copied to clipboard");
      }

      setShowOptions(false);
    } catch (error) {
      console.error("Export error:", error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // If there's nothing to export, don't render
  if ((!messages || messages.length === 0) && !analysisResult) {
    return null;
  }

  return (
    <div className="export-container">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="export-button"
        aria-expanded={showOptions}
        disabled={isExporting}
      >
        <Download size={16} />
        <span>Export</span>
      </button>

      {showOptions && (
        <div className="export-options">
          <button onClick={() => handleExport("pdf")} disabled={isExporting}>
            <FileText size={16} />
            <span>Export as PDF</span>
          </button>

          <button onClick={() => handleExport("txt")} disabled={isExporting}>
            <FileText size={16} />
            <span>Export as Text</span>
          </button>

          {analysisResult && (
            <button onClick={() => handleExport("csv")} disabled={isExporting}>
              <FileText size={16} />
              <span>Export as CSV</span>
            </button>
          )}

          <button
            onClick={() => handleExport("clipboard")}
            disabled={isExporting}
          >
            <Clipboard size={16} />
            <span>Copy to Clipboard</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportButton;
