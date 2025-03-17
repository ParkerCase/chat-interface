import React from "react";
import { AlertCircle } from "lucide-react";
import "./Message.css";

function Message({ sender, text, content, type = "text", timestamp }) {
  // Function to render message content with line breaks and formatting
  const formatMessageText = (text) => {
    if (!text) return null;

    // Convert directories in bold
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Replace image paths with clickable links (if not already HTML links)
    // This is a safety measure in case server-side processing didn't handle links
    if (!formattedText.includes("<a href=")) {
      formattedText = formattedText.replace(
        /\/(photos|marketing)[^\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
        (match) => {
          const encodedPath = encodeURIComponent(match);
          return `<a href="http://147.182.247.128:4000/image-viewer?path=${encodedPath}" target="_blank">${match}</a>`;
        }
      );
    }

    // Split by newlines and create paragraphs
    return formattedText.split("\n").map((line, i) => {
      // Skip empty lines
      if (!line.trim()) return <br key={i} />;

      // Check if line starts with a bullet point
      if (line.trim().startsWith("•")) {
        return (
          <div
            key={i}
            className="bullet-point"
            dangerouslySetInnerHTML={{ __html: line }}
          />
        );
      }

      // Return regular paragraph
      return <div key={i} dangerouslySetInnerHTML={{ __html: line }} />;
    });
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
