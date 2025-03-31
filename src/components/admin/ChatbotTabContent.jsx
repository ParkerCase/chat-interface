// src/components/admin/ChatbotTabContent.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";
import {
  Loader,
  RefreshCw,
  Send,
  Plus,
  MessageSquare,
  Calendar,
  Search,
  AlertCircle,
} from "lucide-react";
import "./ChatbotTabContent.css";

const ChatbotTabContent = () => {
  const { currentUser } = useAuth();
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);

  // Load user's threads
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!currentUser?.id) return;

      try {
        setThreadsLoading(true);
        setError(null);

        const response = await apiService.chat.getHistory(currentUser.id);

        if (response.data?.success) {
          // Process messages into thread groups
          const processedThreads = apiService.chat.processChatHistory(
            response.data.messages
          );
          setThreads(processedThreads);

          // If we have threads and none is selected, select the first one
          if (processedThreads.length > 0 && !selectedThreadId) {
            setSelectedThreadId(processedThreads[0].id);
          }
        } else {
          console.error("Failed to load chat history:", response.data?.error);
        }
      } catch (err) {
        console.error("Chat history loading error:", err);
        setError("Failed to load chat history. Please try again.");
      } finally {
        setThreadsLoading(false);
      }
    };

    loadChatHistory();
  }, [currentUser]);

  // Load thread messages when selected thread changes
  useEffect(() => {
    const loadThreadMessages = async () => {
      if (!selectedThreadId) return;

      try {
        setThreadLoading(true);

        const response = await apiService.chat.getThreadMessages(
          selectedThreadId
        );

        if (response.data?.success) {
          // Sort messages by timestamp
          const sortedMessages = (response.data.messages || []).sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );

          setMessages(sortedMessages);
        } else {
          console.error(
            "Failed to load thread messages:",
            response.data?.error
          );
          setMessages([]);
        }
      } catch (error) {
        console.error("Error loading thread:", error);
        setMessages([]);
      } finally {
        setThreadLoading(false);
      }
    };

    loadThreadMessages();
  }, [selectedThreadId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    try {
      setLoading(true);

      // Add message to UI immediately for better UX
      const userMessage = {
        id: `temp-${Date.now()}`,
        message_type: "user",
        content: inputMessage,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputMessage("");

      let response;

      // If we have a selected thread, continue it
      if (selectedThreadId) {
        response = await apiService.chat.continueThread(
          selectedThreadId,
          inputMessage,
          currentUser?.id
        );
      } else {
        // Otherwise start a new thread
        response = await apiService.chat.sendMessage(
          inputMessage,
          currentUser?.id || "default-user"
        );

        // If this is a new thread, update the selected thread ID
        if (response.data?.threadId) {
          setSelectedThreadId(response.data.threadId);

          // Add to threads list
          const newThread = {
            id: response.data.threadId,
            title:
              inputMessage.length > 30
                ? inputMessage.substring(0, 30) + "..."
                : inputMessage,
            lastActivity: new Date().toISOString(),
            messages: [userMessage],
          };

          setThreads((prev) => [newThread, ...prev]);
        }
      }

      if (response.data?.response) {
        // Add assistant response
        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          message_type: "assistant",
          content: response.data.response,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update thread in the list with new message
        if (selectedThreadId) {
          setThreads((prev) =>
            prev.map((thread) =>
              thread.id === selectedThreadId
                ? {
                    ...thread,
                    lastActivity: new Date().toISOString(),
                    messages: [
                      ...(thread.messages || []),
                      userMessage,
                      assistantMessage,
                    ],
                  }
                : thread
            )
          );
        }
      } else if (response.data?.error) {
        // Handle error
        const errorMessage = {
          id: `error-${Date.now()}`,
          message_type: "error",
          content: response.data.error,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Send message error:", error);

      // Add error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        message_type: "error",
        content:
          error.message || "An error occurred while sending your message",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setSelectedThreadId(null);
    setMessages([]);
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Filter threads based on search term
  const filteredThreads = threads.filter(
    (thread) =>
      thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (thread.messages &&
        thread.messages.some(
          (msg) =>
            msg.content &&
            msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        ))
  );

  return (
    <div className="chatbot-tab-content">
      <div className="chat-container">
        {/* Chat History Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-history-header">
            <h3>Chat History</h3>
            <div className="search-container">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="thread-list">
            {threadsLoading ? (
              <div className="loading-state">
                <Loader className="spinner" size={24} />
                <p>Loading chats...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <AlertCircle size={24} />
                <p>{error}</p>
              </div>
            ) : filteredThreads.length === 0 ? (
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
                  onClick={() => setSelectedThreadId(thread.id)}
                >
                  <div className="thread-icon">
                    <MessageSquare size={20} />
                  </div>
                  <div className="thread-details">
                    <h4 className="thread-title">{thread.title}</h4>
                    <p className="thread-preview">
                      {thread.messages && thread.messages.length > 0
                        ? thread.messages[
                            thread.messages.length - 1
                          ].content.substring(0, 60) +
                          (thread.messages[thread.messages.length - 1].content
                            .length > 60
                            ? "..."
                            : "")
                        : "No messages"}
                    </p>
                  </div>
                  <div className="thread-date">
                    <Calendar size={14} />
                    <span>
                      {new Date(thread.lastActivity).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          <div className="chat-header">
            <h3>
              {selectedThreadId ? "Continue Conversation" : "New Conversation"}
            </h3>
            <button
              className="new-chat-button"
              onClick={handleNewChat}
              title="Start new chat"
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>
          </div>

          <div className="messages-container">
            {threadLoading ? (
              <div className="loading-container">
                <Loader className="spinner" size={24} />
                <p>Loading conversation...</p>
              </div>
            ) : messages.length > 0 ? (
              <>
                <div className="messages-list">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message ${message.message_type}`}
                    >
                      <div className="message-content">{message.content}</div>
                      <div className="message-time">
                        {formatMessageTime(message.created_at)}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </>
            ) : (
              <div className="empty-chat">
                <h3>Start a conversation</h3>
                <p>
                  Type a message below to begin chatting with the AI assistant.
                </p>
              </div>
            )}
          </div>

          <div className="chat-input-container">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              disabled={loading}
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !inputMessage.trim()}
              className="send-button"
            >
              {loading ? (
                <Loader className="spinner" size={16} />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotTabContent;
