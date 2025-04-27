// src/components/ChatWithImageSearch.jsx
import React, { useState } from "react";
import { useChatWithImageSearch } from "../hooks/useChatWithImageSearch";
import ChatImageResults from "./ChatImageResults";

/**
 * Example chat component with integrated image search
 * You'll need to adapt this to work with your existing chat component
 */
const ChatWithImageSearch = () => {
  const [inputValue, setInputValue] = useState("");
  const { messages, isTyping, isSearching, sendMessage, clearChat } =
    useChatWithImageSearch({
      initialMessages: [
        {
          id: "welcome",
          type: "assistant",
          content:
            "Hi there! I can help you find tattoo images. Try asking something like 'show me arm tattoos' or 'find images with faded tattoos'.",
          timestamp: new Date().toISOString(),
        },
      ],
    });

  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    sendMessage(inputValue);
    setInputValue("");
  };

  /**
   * Render a chat message based on its type
   * @param {Object} message - Chat message to render
   * @returns {JSX.Element} Rendered message
   */
  const renderMessage = (message) => {
    switch (message.type) {
      case "user":
        return (
          <div className="user-message" key={message.id}>
            <div className="message-content">{message.content}</div>
            {message.processing && (
              <div className="message-status">Processing...</div>
            )}
          </div>
        );

      case "assistant":
        // For messages with image results
        if (message.images && message.images.length > 0) {
          return (
            <div className="assistant-message" key={message.id}>
              <ChatImageResults
                images={message.images}
                responseText={message.content}
                searchParams={message.searchParams}
                onImageClick={(image) => {
                  console.log("Image clicked:", image);
                  // Handle image click
                }}
              />
            </div>
          );
        }

        // Regular text messages
        return (
          <div className="assistant-message" key={message.id}>
            <div className="message-content">{message.content}</div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Tattoo Image Search Assistant</h2>
        <button className="clear-chat-btn" onClick={clearChat}>
          Clear Chat
        </button>
      </div>

      <div className="chat-messages">
        {messages.map(renderMessage)}

        {isTyping && (
          <div className="assistant-message typing">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask me to find tattoo images..."
          disabled={isSearching}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={isSearching || !inputValue.trim()}
          className="send-button"
        >
          {isSearching ? "Searching..." : "Send"}
        </button>
      </form>

      <div className="chat-footer">
        <p>
          Try asking: "Show me arm tattoos" or "Find images with faded tattoos"
        </p>
      </div>
    </div>
  );
};

export default ChatWithImageSearch;
