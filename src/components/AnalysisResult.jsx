import React from "react";
import { X } from "lucide-react";
import "./AnalysisResult.css";

function AnalysisResult({ result, onClose }) {
  if (!result) return null;

  return (
    <div
      className="analysis-container"
      role="dialog"
      aria-labelledby="analysis-title"
    >
      <div className="analysis-header">
        <h3 id="analysis-title">Image Analysis</h3>
        <button
          onClick={onClose}
          className="close-button"
          aria-label="Close analysis"
        >
          <X size={20} />
        </button>
      </div>

      <div className="analysis-content">
        {result.description ? (
          <div className="analysis-description">
            {result.description.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <div>
            <p>
              <strong>Path:</strong> {result.path}
            </p>

            {result.insights && (
              <div className="insights-section">
                <h4>Insights:</h4>
                <ul>
                  {result.insights.isTattoo !== undefined && (
                    <li>
                      Identified as tattoo:{" "}
                      {result.insights.isTattoo ? "Yes" : "No"}
                    </li>
                  )}
                  {result.insights.bodyPart && (
                    <li>Body part: {result.insights.bodyPart}</li>
                  )}
                  {result.insights.removalStage && (
                    <li>Removal stage: {result.insights.removalStage}</li>
                  )}
                  {result.insights.fadingPercentage && (
                    <li>Fading: {result.insights.fadingPercentage}%</li>
                  )}
                  {result.insights.colors &&
                    result.insights.colors.length > 0 && (
                      <li>
                        Colors:{" "}
                        {result.insights.colors.map((c) => c.name).join(", ")}
                      </li>
                    )}
                </ul>
              </div>
            )}

            {result.analysis && result.analysis.labels && (
              <div className="labels-section">
                <h4>Content Labels:</h4>
                <ul>
                  {result.analysis.labels.slice(0, 5).map((label, index) => (
                    <li key={index}>
                      {label.description} ({(label.confidence * 100).toFixed(1)}
                      %)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisResult;
