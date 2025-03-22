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
          type: response.headers.get("Content-Type") || getContentType(format),
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = getFileName(format);
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        // For PDF, get as blob and create download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = getFileName("pdf");
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "image") {
        // For image, get as blob and create download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        // Extract file extension from the image path
        let extension = ".jpg"; // Default extension
        if (content.imagePath) {
          const imagePath = content.imagePath;
          const lastDotIndex = imagePath.lastIndexOf(".");
          if (lastDotIndex !== -1) {
            extension = imagePath.substring(lastDotIndex);
          }
        }

        a.download = `image-export-${Date.now()}${extension}`;
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

  // Helper function to get appropriate content type
  const getContentType = (format) => {
    switch (format) {
      case "txt":
        return "text/plain";
      case "csv":
        return "text/csv";
      case "json":
        return "application/json";
      case "pdf":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  };

  // Helper function to get appropriate filename
  const getFileName = (format) => {
    const prefix = analysisResult ? "analysis" : "chat";
    const timestamp = Date.now();
    return `${prefix}-export-${timestamp}.${format}`;
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
          {analysisResult && analysisResult.imagePath && (
            <button
              onClick={() => handleExport("image")}
              disabled={isExporting}
            >
              <FileImage size={16} />
              <span>Export as Image</span>
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
