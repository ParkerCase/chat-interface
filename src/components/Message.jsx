import React from "react";
import { AlertCircle } from "lucide-react";
import "./Message.css";

function Message({ sender, text, content, type = "text", timestamp }) {
  // Function to render message content with line breaks and formatting
  const formatMessageText = (text) => {
    if (!text) return null;

    // Split by newlines and create paragraphs first
    return text.split("\n").map((line, i) => {
      // Skip empty lines
      if (!line.trim()) return <br key={i} />;

      // Convert directories in bold - safer approach
      const boldPattern = /\*\*(.*?)\*\*/g;
      let parts = [];
      let lastIndex = 0;
      let match;

      // Process bold text patterns
      while ((match = boldPattern.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(
            <span key={`${i}-text-${lastIndex}`}>
              {renderImageLinks(line.substring(lastIndex, match.index))}
            </span>
          );
        }
        parts.push(<strong key={`${i}-bold-${match.index}`}>{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < line.length) {
        parts.push(
          <span key={`${i}-text-${lastIndex}`}>
            {renderImageLinks(line.substring(lastIndex))}
          </span>
        );
      }

      // If no bold patterns were found, process the whole line
      if (parts.length === 0) {
        parts.push(
          <span key={`${i}-text-0`}>{renderImageLinks(line)}</span>
        );
      }

      // Check if line starts with a bullet point
      if (line.trim().startsWith("•")) {
        return (
          <div key={i} className="bullet-point">
            {parts}
          </div>
        );
      }

      // Return regular paragraph
      return <div key={i}>{parts}</div>;
    });
  };

  // Helper function to safely render image links
  const renderImageLinks = (text) => {
    if (!text.includes("/photos") && !text.includes("/marketing")) {
      return text;
    }

    const imgPattern = /\/(photos|marketing)[^\s"']+\.(jpg|jpeg|png|gif|webp)/gi;
    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imgPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const encodedPath = encodeURIComponent(match[0]);
      parts.push(
        <a 
          key={`link-${match.index}`}
          href={`http://147.182.247.128:4000/image-viewer?path=${encodedPath}`} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          {match[0]}
        </a>
      );
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`message ${sender}`}>
      {type === "text" && (
        <div className="message-content">
          {formatMessageText(text || content)}
        </div>
      )}
      {type === "image" && (
        <div className="message-content">
          <img src={content} alt="Uploaded" className="uploaded-image" />
          {text && <div className="image-caption">{text}</div>}
        </div>
      )}
      {type === "error" && (
        <div className="message-error">
          <AlertCircle className="h-4 w-4" />
          <p>{text || content}</p>
        </div>
      )}
      {timestamp && (
        <div className="message-timestamp">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}

export default Message;
