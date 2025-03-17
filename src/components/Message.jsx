import React from "react";
import "./Message.css";

function Message({ sender, text, content, type, isHtml }) {
  const renderContent = () => {
    if (type === "image" && content) {
      return (
        <img src={content} alt="User uploaded" className="message-image" />
      );
    } else if (isHtml && text) {
      return <div dangerouslySetInnerHTML={{ __html: text }} />;
    } else if (text) {
      // Handle links in plain text
      const linkedText = text.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      if (linkedText !== text) {
        return <div dangerouslySetInnerHTML={{ __html: linkedText }} />;
      }

      return <div>{text}</div>;
    }

    return null;
  };

  return (
    <div
      className={`message ${sender}`}
      role={sender === "assistant" ? "region" : ""}
    >
      <div className="message-sender">
        {sender === "user"
          ? "You"
          : sender === "assistant"
          ? "AI Assistant"
          : "System"}
      </div>
      <div className={`message-content ${type === "error" ? "error" : ""}`}>
        {renderContent()}
      </div>
    </div>
  );
}

export default Message;
