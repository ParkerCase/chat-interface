// src/components/admin/TestFunctions.jsx
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

const TestFunctions = () => {
  const [embedResult, setEmbedResult] = useState(null);
  const [extractResult, setExtractResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testFile, setTestFile] = useState(null);

  const testEmbeddingFunction = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-embedding",
        {
          body: { text: "This is a test document for embedding generation" },
        }
      );

      if (error) throw error;
      console.log("Embedding generated successfully:", data);
      setEmbedResult(data);
    } catch (err) {
      console.error("Error testing embedding function:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const testDocumentExtraction = async () => {
    if (!testFile) {
      setError("Please select a file first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Read the file as base64
      const fileContent = await readFileAsBase64(testFile);
      const fileType = testFile.name.split(".").pop().toLowerCase();

      const { data, error } = await supabase.functions.invoke(
        "extract-document-text",
        {
          body: {
            filename: testFile.name,
            fileContent,
            fileType,
          },
        }
      );

      if (error) throw error;
      console.log("Text extracted successfully:", data);
      setExtractResult(data);
    } catch (err) {
      console.error("Error testing document extraction:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to read file as base64
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:text/plain;base64,")
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className="test-functions">
      <h2>Test Supabase Functions</h2>

      <div className="test-section">
        <h3>Test Embedding Generation</h3>
        <button onClick={testEmbeddingFunction} disabled={isLoading}>
          {isLoading ? "Testing..." : "Test Embedding Function"}
        </button>

        {embedResult && (
          <div className="result">
            <h4>Result:</h4>
            <p>Model: {embedResult.model}</p>
            <p>Embedding Length: {embedResult.embedding?.length || 0}</p>
            <p>
              First few values: {embedResult.embedding?.slice(0, 5).join(", ")}
            </p>
          </div>
        )}
      </div>

      <div className="test-section">
        <h3>Test Document Extraction</h3>
        <input type="file" onChange={(e) => setTestFile(e.target.files[0])} />
        <button
          onClick={testDocumentExtraction}
          disabled={isLoading || !testFile}
        >
          {isLoading ? "Testing..." : "Test Extraction Function"}
        </button>

        {extractResult && (
          <div className="result">
            <h4>Extracted Text:</h4>
            <pre>{extractResult.text}</pre>
          </div>
        )}
      </div>

      {error && (
        <div className="error">
          <h4>Error:</h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default TestFunctions;
