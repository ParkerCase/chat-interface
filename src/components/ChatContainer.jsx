import React, { useEffect, useRef } from "react";
import Message from "./Message";
import "./ChatContainer.css";

function ChatContainer({ messages }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div
      className="chat-container"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.length === 0 ? (
        <div className="empty-chat">
          <h3>Welcome to Tatt2Away AI</h3>
          <p>Upload an image of a tattoo or type a question to get started!</p>
          <ul className="quick-tips">
            <li>Upload tattoo images for analysis</li>
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
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatContainer;
