import React, { useState, useRef } from "react";
import Message from "./Message";
import ResearchButton from "./ResearchButton";
import ClaudeResearchModal from "./ClaudeResearchModal";
import ResearchResultsCache from "./ResearchResultsCache";
import IntegrationStatusIndicators from "./IntegrationStatusIndicators";
import "./ChatContainer.css";

function ChatContainer({ messages, userId }) {
  const [researchOpen, setResearchOpen] = useState(false);
  const [mode, setMode] = useState("quick");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div
      className="chat-container"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <div className="chatbot-header">
        <button
          className={mode === "quick" ? "active" : ""}
          onClick={() => setMode("quick")}
        >
          Quick Chat
        </button>
        <button
          className={mode === "deep" ? "active" : ""}
          onClick={() => setMode("deep")}
        >
          Deep Research
        </button>
        <IntegrationStatusIndicators />
      </div>
      {mode === "quick" ? (
        messages.length === 0 ? (
          <div className="empty-chat">
            <h3>Welcome to Tatt2Away AI</h3>
            <ul className="quick-tips">
              <li>Ask about tattoo removal processes</li>
              <li>Search for similar tattoo designs</li>
              <li>Analyze tattoo colors and features</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, index) => (
            <Message
              key={index}
              sender={msg.sender}
              text={msg.text}
              content={msg.content}
              type={msg.type || "text"}
              isHtml={msg.isHtml}
            />
          ))
        )
      ) : (
        <div>
          <ResearchButton onClick={() => setResearchOpen(true)} />
          <ResearchResultsCache userId={userId} />
        </div>
      )}
      <div ref={messagesEndRef} />
      <ClaudeResearchModal
        open={researchOpen}
        onClose={() => setResearchOpen(false)}
        context="You have access to Zenoti, Close.io, Google Drive, Dropbox, and Slack integrations."
      />
    </div>
  );
}

export default ChatContainer;
