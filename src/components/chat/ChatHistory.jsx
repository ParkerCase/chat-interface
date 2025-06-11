// src/components/chat/ChatHistory.jsx
import React, { useState, useEffect } from "react";
import {
  Loader,
  MessageSquare,
  Calendar,
  Search,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";
import "./ChatHistory.css";

const ChatHistory = ({ onSelectThread, selectedThreadId }) => {
  const { currentUser } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = currentUser?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        const response = await apiService.chat.getHistory(userId);

        if (response.data?.success) {
          // Process the messages into threads
          const processedThreads = apiService.chat.processChatHistory(
            response.data.messages
          );
          setThreads(processedThreads);
        } else {
          throw new Error(
            response.data?.error || "Failed to load chat history"
          );
        }
      } catch (err) {
        console.error("Chat history error:", err);
        setError(err.message || "Failed to load chat history");
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [currentUser]);

  // Filter threads based on search term
  const filteredThreads = threads.filter(
    (thread) =>
      thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.messages.some(
        (msg) =>
          msg.content &&
          msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const getMessagePreview = (thread) => {
    if (!thread.messages || thread.messages.length === 0) return "No messages";

    // Find the most recent user message for preview
    const userMessages = thread.messages.filter(
      (msg) => msg.message_type === "user"
    );
    if (userMessages.length > 0) {
      const message = userMessages[userMessages.length - 1].content;
      return message.length > 60 ? `${message.substring(0, 60)}...` : message;
    }

    // Fall back to first message if no user messages
    const message = thread.messages[0].content;
    return message.length > 60 ? `${message.substring(0, 60)}...` : message;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="chat-history-loading">
        <Loader className="spinner" size={24} />
        <p>Loading chat history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-history-error">
        <AlertCircle size={24} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="chat-history">
      <div className="chat-history-header">
        <h3>Chat History</h3>
        <div className="search-container">
          <Search size={16} />
          <input
            style={{ paddingLeft: "30px" }}
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="thread-list">
        {filteredThreads.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={32} />
            <p>No chat history found</p>
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <div
              key={thread.id}
              className={`thread-item ${
                selectedThreadId === thread.id ? "active" : ""
              }`}
              onClick={() => onSelectThread(thread.id)}
            >
              <div className="thread-icon">
                <MessageSquare size={20} />
              </div>
              <div className="thread-details">
                <h4 className="thread-title">
                  {thread.isClaudeMCP || thread.source === "claude-mcp" ? (
                    <>
                      <span className="telescope-icon">🔭</span>
                      {thread.title}
                    </>
                  ) : (
                    thread.title
                  )}
                </h4>
                <p className="thread-preview">{getMessagePreview(thread)}</p>
              </div>
              <div className="thread-date">
                <Calendar size={14} />
                <span>{formatDate(thread.lastActivity)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
