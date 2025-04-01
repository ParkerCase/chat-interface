// src/components/admin/ChatbotTabContent.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Loader,
  MessageSquare,
  Settings,
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Globe,
  AlertCircle,
  Download,
  PlusCircle,
  Trash2,
  X,
  FileText,
  Image,
  Eye,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import axios from "axios";
import ChatHistory from "../chat/ChatHistory";
import AdvancedSearch from "../AdvancedSearch";
import ExportButton from "../ExportButton";
import "./ChatbotTabContent.css";

const ChatbotTabContent = () => {
  const { currentUser } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showChatHistory, setShowChatHistory] = useState(true);
  const [useInternet, setUseInternet] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // New state for modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showImageViewerModal, setShowImageViewerModal] = useState(false);
  const [currentViewImage, setCurrentViewImage] = useState(null);
  const [searchMode, setSearchMode] = useState("tensor"); // "tensor" for full, "partial" for partial
  const [uploadType, setUploadType] = useState("document"); // "document" or "image"
  const [searchResults, setSearchResults] = useState(null);

  // State for settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    darkMode: false,
    showTimestamps: true,
    messageSize: "medium",
    autoScroll: true,
    exportFormat: "text",
    showInternetSearch: true,
  });

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Update settings
  const updateSetting = (key, value) => {
    setChatSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  useEffect(() => {
    // Scroll to bottom of messages whenever they update
    if (messagesEndRef.current && chatSettings.autoScroll) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages, chatSettings.autoScroll]);

  // State to track if we're creating a new chat
  const [isNewChat, setIsNewChat] = useState(false);

  // Load chat threads
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const userId = currentUser?.id;
        if (!userId) {
          setIsLoading(false);
          return;
        }

        const response = await apiService.chat.getHistory(userId);

        if (response.data?.success) {
          // Process the messages into threads
          const processedThreads = apiService.chat.processChatHistory(
            response.data.messages
          );
          setThreads(processedThreads);

          // Only auto-select a thread if not in "new chat" mode and no thread is selected
          if (processedThreads.length > 0 && !selectedThreadId && !isNewChat) {
            setSelectedThreadId(processedThreads[0].id);
            loadThreadMessages(processedThreads[0].id);
          }
        } else {
          throw new Error(
            response.data?.error || "Failed to load chat history"
          );
        }
      } catch (err) {
        console.error("Chat history error:", err);
        setError(err.message || "Failed to load chat history");
      } finally {
        setIsLoading(false);
      }
    };

    loadChatHistory();
  }, [currentUser, selectedThreadId, isNewChat]);

  // Load messages for a specific thread
  const loadThreadMessages = async (threadId) => {
    try {
      setIsLoading(true);

      const response = await apiService.chat.getThreadMessages(threadId);

      if (response.data?.success) {
        setCurrentMessages(response.data.messages || []);
      } else {
        throw new Error(
          response.data?.error || "Failed to load thread messages"
        );
      }
    } catch (err) {
      console.error("Thread messages error:", err);
      setError(err.message || "Failed to load thread messages");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle thread selection
  const handleSelectThread = (threadId) => {
    // Turn off new chat mode when a thread is selected
    setIsNewChat(false);
    setSelectedThreadId(threadId);
    loadThreadMessages(threadId);
  };

  // Create a new thread
  const createNewThread = async () => {
    try {
      // Set new chat mode to prevent auto-selection of existing threads
      setIsNewChat(true);

      // Clear all current state related to active conversations
      setSelectedThreadId(null);
      setCurrentMessages([]);
      setInputText("");
      setFile(null);
      setFilePreview(null);

      // Force UI update immediately to show a blank chat
      setTimeout(() => {
        // Get a fresh list of threads after clearing
        const userId = currentUser?.id || "default-user";

        // We don't need to explicitly create a thread - it will be created
        // automatically when the user sends their first message
        apiService.chat.getHistory(userId).then((response) => {
          if (response.data?.success) {
            const processedThreads = apiService.chat.processChatHistory(
              response.data.messages
            );
            setThreads(processedThreads);
          }
        });
      }, 100);
    } catch (err) {
      console.error("Error creating new thread:", err);
      setError("Failed to create new thread. Please try again.");
    }
  };

  // Open the upload modal
  const handleOpenUploadModal = () => {
    setShowUploadModal(true);
  };

  // Handle file type selection
  const handleSelectUploadType = (type) => {
    setUploadType(type);

    // Always close the upload modal first
    setShowUploadModal(false);

    if (type === "image") {
      // For images, show the search modal
      setTimeout(() => {
        setShowSearchModal(true);
      }, 100); // Small delay to ensure first modal closes properly
    } else {
      // For documents, trigger file selection directly
      fileInputRef.current.setAttribute(
        "accept",
        "application/pdf,text/plain,.doc,.docx,.csv,.xls,.xlsx"
      );
      fileInputRef.current.click();
    }
  };

  // Handle search mode selection
  const handleSelectSearchMode = (mode) => {
    setSearchMode(mode);
    setShowSearchModal(false);

    // Trigger file selection with appropriate accept attribute
    fileInputRef.current.setAttribute("accept", "image/*");
    fileInputRef.current.click();
  };

  // Handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    // Check file size (10MB limit)
    const maxFileSize = 10; // MB
    if (selectedFile.size > maxFileSize * 1024 * 1024) {
      setError(`File size exceeds ${maxFileSize}MB limit.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setFile(selectedFile);

    // Create file preview based on upload type
    if (uploadType === "image" || selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      // Generic preview for document files
      setFilePreview("document");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file upload for documents
  const handleDocumentUpload = async () => {
    if (!file) return;

    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Add user message with file
      const newUserMessage = {
        sender: "user",
        message_type: "user",
        content: inputText || `Analyze this document: ${file.name}`,
        created_at: new Date().toISOString(),
        file_type: "document",
        file_name: file.name,
      };

      setCurrentMessages((prev) => [...prev, newUserMessage]);

      // Create system message indicating processing
      const systemMessage = {
        sender: "system",
        message_type: "system",
        content: `Processing document...`,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, systemMessage]);

      // Upload document
      const response = await apiService.chat.uploadDocument(
        file,
        currentUser?.id,
        inputText || `Analyze this document: ${file.name}`,
        (progress) => setUploadProgress(progress)
      );

      // Add assistant response
      const assistantMessage = {
        sender: "assistant",
        message_type: "assistant",
        content: response.data.response,
        created_at: new Date().toISOString(),
        thread_id: response.data.threadId,
      };

      setCurrentMessages((prev) => [...prev, assistantMessage]);

      // Update selected thread ID if this is a new thread
      if (response.data.threadId && !selectedThreadId) {
        setSelectedThreadId(response.data.threadId);
        // Turn off new chat mode once we have a thread ID
        setIsNewChat(false);
      }

      // Clear input and file after sending
      setInputText("");
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      console.error("Document upload error:", err);

      const errorMessage = {
        sender: "system",
        message_type: "error",
        content: `Error uploading document: ${err.message || "Unknown error"}`,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, errorMessage]);
      setError(err.message || "Failed to upload document");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Handle image search
  const handleImageSearch = async () => {
    if (!file) return;

    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Define a default message if none was provided
      const searchMessage =
        inputText ||
        `Search for similar images with ${
          searchMode === "tensor" ? "Full Image Match" : "Partial Image Match"
        } mode`;

      // Add user message with file
      const newUserMessage = {
        sender: "user",
        message_type: "user",
        content: searchMessage,
        created_at: new Date().toISOString(),
        file_type: "image",
        file_url: filePreview,
      };

      setCurrentMessages((prev) => [...prev, newUserMessage]);

      // Create system message indicating processing
      const systemMessage = {
        sender: "system",
        message_type: "system",
        content: `Searching with ${
          searchMode === "tensor" ? "Full Image Match" : "Partial Image Match"
        } mode...`,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, systemMessage]);

      // Create form data for the file upload
      const formData = new FormData();
      formData.append("image", file);
      formData.append("mode", searchMode);
      formData.append("userId", currentUser?.id || "default-user");

      // Always include a message - this is required by your API
      formData.append("message", searchMessage);

      // Perform image search - use the correct endpoint path
      const response = await fetch(
        `${apiService.utils.getBaseUrl()}/api/search/visual`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      setSearchResults(data);

      // Check if we have signatures available
      if (data.stats && data.stats.totalSignaturesSearched === 0) {
        console.warn(
          "No signatures found for image search. This may affect results."
        );

        // Add a warning message
        setCurrentMessages((prev) => [
          ...prev,
          {
            sender: "system",
            message_type: "system",
            content: `Warning: No image signatures were found in the database. This may affect search results. Please contact your administrator to verify the image index.`,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to search for similar images");
      }

      // Analyze the image using Google Vision API
      const analysisResponse = await apiService.chat.uploadImage(
        file,
        currentUser?.id,
        inputText || "Analyze this image",
        (progress) => setUploadProgress(progress)
      );

      // Format search results for display
      let searchResultsText = "### Similar Images Found\n\n";
      if (data.matches && data.matches.length > 0) {
        searchResultsText += `Found ${
          data.matches.length
        } similar images using ${
          searchMode === "tensor" ? "full" : "partial"
        } image search mode.\n\n`;

        // If there's a top match analysis, include it
        if (data.topMatchAnalysis) {
          searchResultsText += `**Top Match Analysis:** ${data.topMatchAnalysis.description}\n\n`;
        }

        // Group by directory
        const groupedByDir = {};
        data.matches.forEach((match) => {
          const pathParts = match.path.split("/");
          const dir = pathParts.slice(0, -1).join("/");
          if (!groupedByDir[dir]) {
            groupedByDir[dir] = [];
          }
          groupedByDir[dir].push(match);
        });

        // Add each directory group
        Object.entries(groupedByDir).forEach(([dir, matches]) => {
          searchResultsText += `**Directory: ${dir}/**\n`;
          matches.forEach((match, index) => {
            // Get just the filename
            const filename = match.path.split("/").pop();

            // Create entry with clickable view link
            searchResultsText += `• **${filename}** (Score: ${parseFloat(
              match.score
            ).toFixed(2)})\n`;
            searchResultsText += `  [View Image](${match.path})\n\n`;
          });
        });

        // Add processing stats
        if (data.stats) {
          searchResultsText += `\n*Search completed in ${(
            data.stats.processingTime / 1000
          ).toFixed(2)} seconds`;
          if (data.stats.totalSignaturesSearched) {
            searchResultsText += ` with ${data.stats.totalSignaturesSearched} signatures searched`;
          }
          searchResultsText += ".*\n";
        }
      } else {
        searchResultsText +=
          "No matching images found. This could be because:\n";
        searchResultsText += "• There are no similar images in the database\n";
        searchResultsText +=
          "• The image signature database may need to be updated\n";
        searchResultsText += "• The search threshold may be too strict\n\n";
        searchResultsText +=
          "Try using the other search mode or contact your administrator if this issue persists.";
      }

      // Add the analysis and search results to the chat
      const assistantMessage = {
        sender: "assistant",
        message_type: "assistant",
        content: analysisResponse.data.response + "\n\n" + searchResultsText,
        created_at: new Date().toISOString(),
        thread_id: analysisResponse.data.threadId,
        isHtml: true,
      };

      setCurrentMessages((prev) => [...prev, assistantMessage]);

      // Update selected thread ID if this is a new thread
      if (analysisResponse.data.threadId && !selectedThreadId) {
        setSelectedThreadId(analysisResponse.data.threadId);
        // Turn off new chat mode once we have a thread ID
        setIsNewChat(false);
      }

      // Clear input and file after sending
      setInputText("");
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      console.error("Image search error:", err);

      const errorMessage = {
        sender: "system",
        message_type: "error",
        content: `Error searching for similar images: ${
          err.message || "Unknown error"
        }`,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, errorMessage]);
      setError(err.message || "Failed to search for similar images");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Handle file upload based on type
  const handleFileUpload = () => {
    if (uploadType === "document" || !file.type.startsWith("image/")) {
      handleDocumentUpload();
    } else {
      handleImageSearch();
    }
  };

  // Handle sending text message
  const handleSendMessage = async () => {
    if (file) {
      return handleFileUpload();
    }

    if (!inputText.trim()) return;

    try {
      setIsLoading(true);

      // Add user message
      const userMessage = {
        sender: "user",
        message_type: "user",
        content: inputText,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, userMessage]);

      // Call API based on whether internet search is enabled
      let response;
      if (useInternet && chatSettings.showInternetSearch) {
        // Use the proper format for the advanced endpoint
        response = await apiService.chat.advanced(inputText, currentUser?.id);
      } else {
        // Fix: Use the proper format for the regular chat endpoint
        response = await axios.post(
          `${apiService.utils.getBaseUrl()}/api/chat`,
          {
            message: inputText,
            userId: currentUser?.id || "default-user",
          }
        );
      }

      // Add assistant response
      const assistantMessage = {
        sender: "assistant",
        message_type: "assistant",
        content: response.data.response,
        created_at: new Date().toISOString(),
        thread_id: response.data.threadId,
      };

      setCurrentMessages((prev) => [...prev, assistantMessage]);

      // Update selected thread ID if this is a new thread
      if (response.data.threadId && !selectedThreadId) {
        setSelectedThreadId(response.data.threadId);
      }

      // Reset input
      setInputText("");
    } catch (err) {
      console.error("Send message error:", err);

      const errorMessage = {
        sender: "system",
        message_type: "error",
        content: `Error sending message: ${err.message || "Unknown error"}`,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, errorMessage]);
      setError(err.message || "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle message from advanced search
  const handleSearchResults = (resultsText) => {
    // Add system message with search results
    const searchMessage = {
      sender: "assistant",
      message_type: "assistant",
      content: resultsText,
      created_at: new Date().toISOString(),
      isHtml: true,
    };

    setCurrentMessages((prev) => [...prev, searchMessage]);
  };

  // Handle key press (Enter to send)
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear file selection
  const clearFileSelection = () => {
    setFile(null);
    setFilePreview(null);
  };

  // Handle image view
  const handleImageView = (imagePath) => {
    setCurrentViewImage(imagePath);
    setShowImageViewerModal(true);
  };

  // Toggle internet search
  const toggleInternet = () => {
    setUseInternet(!useInternet);
  };

  // Toggle chat history sidebar
  const toggleChatHistory = () => {
    setShowChatHistory(!showChatHistory);
  };

  // Delete a thread
  const handleDeleteThread = async (threadId) => {
    if (!threadId) return;

    try {
      const response = await apiService.chat.deleteThread(threadId);

      if (response.data?.success) {
        // Remove thread from list
        setThreads((prev) => prev.filter((thread) => thread.id !== threadId));

        // If the deleted thread was selected, clear messages and select nothing
        if (selectedThreadId === threadId) {
          setSelectedThreadId(null);
          setCurrentMessages([]);
        }
      } else {
        throw new Error(response.data?.error || "Failed to delete thread");
      }
    } catch (err) {
      console.error("Delete thread error:", err);
      setError(err.message || "Failed to delete thread");
    }
  };

  // Render message content
  const renderMessageContent = (message) => {
    // Handle different message types
    if (
      message.message_type === "error" ||
      (message.sender === "system" && message.content.includes("Error"))
    ) {
      return (
        <div className="error-message">
          <AlertCircle className="error-icon" size={16} />
          <span>{message.content}</span>
        </div>
      );
    }

    // Handle image messages
    if (message.file_type === "image" && message.file_url) {
      return (
        <div className="message-with-image">
          <img
            src={message.file_url}
            alt="Uploaded"
            className="message-image"
          />
          <div>{message.content}</div>
        </div>
      );
    }

    // Handle document references
    if (message.file_type === "document" && message.file_name) {
      return (
        <div className="message-with-document">
          <div className="document-icon-container">
            <Download size={20} />
            <span>{message.file_name}</span>
          </div>
          <div>{message.content}</div>
        </div>
      );
    }

    // Handle HTML content
    if (message.isHtml) {
      // Transform the content to make certain parts interactive
      let processedContent = message.content;

      // Make image links clickable for the viewer
      processedContent = processedContent.replace(
        /\[View Image\]\((.*?)\)/g,
        (match, path) => {
          return `<a href="#" class="view-image-link" data-path="${path}" onClick="window.viewImage('${path}')">View Image</a>`;
        }
      );

      return <div dangerouslySetInnerHTML={{ __html: processedContent }} />;
    }

    // Format regular text with line breaks
    return message.content
      .split("\n")
      .map((line, i) => <div key={i}>{line || <br />}</div>);
  };

  // Expose image viewing function to window for link handling
  useEffect(() => {
    window.viewImage = (path) => {
      handleImageView(path);
    };

    return () => {
      delete window.viewImage;
    };
  }, []);

  // Add event listener for image links
  useEffect(() => {
    const handleViewImageClick = (e) => {
      if (e.target.classList.contains("view-image-link")) {
        e.preventDefault();
        const path = e.target.getAttribute("data-path");
        if (path) {
          handleImageView(path);
        }
      }
    };

    document.addEventListener("click", handleViewImageClick);

    return () => {
      document.removeEventListener("click", handleViewImageClick);
    };
  }, []);

  return (
    <div className="chatbot-tab-content">
      <div className="chatbot-container">
        {/* Chat history sidebar */}
        <div
          className={`chat-history-sidebar ${
            !showChatHistory ? "collapsed" : ""
          }`}
        >
          {showChatHistory && (
            <>
              <div className="history-header">
                <h3>Chat History</h3>
                <button className="new-chat-btn" onClick={createNewThread}>
                  <PlusCircle size={14} />
                  New Chat
                </button>
              </div>
              <ChatHistory
                onSelectThread={handleSelectThread}
                selectedThreadId={selectedThreadId}
              />
            </>
          )}
          <button
            className="toggle-history-btn"
            onClick={toggleChatHistory}
            title={showChatHistory ? "Hide chat history" : "Show chat history"}
            aria-label={
              showChatHistory ? "Hide chat history" : "Show chat history"
            }
          >
            {showChatHistory ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>

        {/* Main chat area */}
        <div className="chat-main-area">
          {/* Header toolbar */}
          <div className="chat-toolbar">
            <div className="toolbar-left">
              {/* Empty left side to balance layout */}
            </div>

            <div className="toolbar-right">
              {/* Export button */}
              {isFeatureEnabled("data_export") && (
                <div className="export-button-container">
                  <ExportButton
                    messages={currentMessages}
                    analysisResult={analysisResult}
                  />
                </div>
              )}

              <button
                className="settings-btn"
                onClick={toggleSettings}
                title="Chat settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* Advanced search */}
          {isFeatureEnabled("advanced_search") && (
            <div className="advanced-search-wrapper">
              <AdvancedSearch onResults={handleSearchResults} />
            </div>
          )}

          {/* Chat messages */}
          <div
            className={`chat-messages ${
              chatSettings.darkMode ? "dark-mode" : ""
            }`}
          >
            {currentMessages.length === 0 ? (
              <div className="empty-chat">
                <h3>Welcome to Tatt2Away AI</h3>
                <p>
                  Upload an image of a tattoo or type a question to get started!
                </p>
                <div className="quick-tips-container">
                  <h4>Here's what you can do:</h4>
                  <div className="quick-tips">
                    <div className="tip-item">
                      Upload tattoo images for analysis
                    </div>
                    <div className="tip-item">
                      Ask about tattoo removal processes
                    </div>
                    <div className="tip-item">
                      Search for similar tattoo designs
                    </div>
                    <div className="tip-item">
                      Analyze tattoo colors and features
                    </div>
                    <div className="tip-item">
                      Compare before and after results
                    </div>
                    <div className="tip-item">
                      Get pricing and procedure information
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {currentMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`message ${
                      message.sender === "user"
                        ? "user-message"
                        : message.sender === "assistant"
                        ? "assistant-message"
                        : "system-message"
                    }`}
                  >
                    <div
                      className={`message-content message-size-${chatSettings.messageSize}`}
                    >
                      {renderMessageContent(message)}
                    </div>
                    {message.created_at && chatSettings.showTimestamps && (
                      <div className="message-timestamp">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}

            {/* Upload progress overlay */}
            {isLoading && uploadProgress > 0 && (
              <div className="upload-progress-overlay">
                <div className="upload-progress-container">
                  <div
                    className="upload-progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                  <span>{uploadProgress}% uploaded</span>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            {/* File preview */}
            {filePreview && (
              <div className="file-preview">
                {filePreview === "document" ? (
                  <div className="document-preview">
                    <Download size={20} />
                    <span>{file.name}</span>
                  </div>
                ) : (
                  <img
                    src={filePreview}
                    alt="Upload preview"
                    className="image-preview"
                  />
                )}
                <button className="clear-file-btn" onClick={clearFileSelection}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Internet search toggle */}
            {chatSettings.showInternetSearch && (
              <button
                className={`internet-toggle ${useInternet ? "active" : ""}`}
                onClick={toggleInternet}
                title={
                  useInternet
                    ? "Internet search enabled"
                    : "Enable internet search"
                }
              >
                <Globe size={18} />
              </button>
            )}

            {/* Text input */}
            <div className="input-wrapper">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  useInternet
                    ? "Search the web..."
                    : file
                    ? "Add a message about this file..."
                    : "Type your message here..."
                }
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                rows={1}
              />
            </div>

            {/* File upload button */}
            <button
              className="upload-btn"
              onClick={handleOpenUploadModal}
              disabled={isLoading}
              title="Upload file"
            >
              <Upload size={20} />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </button>

            {/* Send button */}
            <button
              className={`send-btn ${isLoading ? "loading" : ""}`}
              onClick={handleSendMessage}
              disabled={isLoading || (!inputText.trim() && !file)}
            >
              {isLoading ? (
                <Loader className="spinner" size={20} />
              ) : (
                <MessageSquare size={20} />
              )}
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="settings-panel">
            <div className="settings-header">
              <h3>Chat Settings</h3>
              <button className="close-settings" onClick={toggleSettings}>
                <X size={18} />
              </button>
            </div>

            <div className="settings-content">
              <div className="settings-group">
                <h4>Appearance</h4>

                <div className="setting-item">
                  <label htmlFor="darkMode">Dark Mode</label>
                  <input
                    type="checkbox"
                    id="darkMode"
                    checked={chatSettings.darkMode}
                    onChange={(e) =>
                      updateSetting("darkMode", e.target.checked)
                    }
                  />
                </div>

                <div className="setting-item">
                  <label htmlFor="showTimestamps">Show Timestamps</label>
                  <input
                    type="checkbox"
                    id="showTimestamps"
                    checked={chatSettings.showTimestamps}
                    onChange={(e) =>
                      updateSetting("showTimestamps", e.target.checked)
                    }
                  />
                </div>

                <div className="setting-item">
                  <label htmlFor="messageSize">Message Size</label>
                  <select
                    id="messageSize"
                    value={chatSettings.messageSize}
                    onChange={(e) =>
                      updateSetting("messageSize", e.target.value)
                    }
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div className="settings-group">
                <h4>Functionality</h4>

                <div className="setting-item">
                  <label htmlFor="autoScroll">
                    Auto-scroll to New Messages
                  </label>
                  <input
                    type="checkbox"
                    id="autoScroll"
                    checked={chatSettings.autoScroll}
                    onChange={(e) =>
                      updateSetting("autoScroll", e.target.checked)
                    }
                  />
                </div>

                <div className="setting-item">
                  <label htmlFor="showInternetSearch">Internet Search</label>
                  <input
                    type="checkbox"
                    id="showInternetSearch"
                    checked={chatSettings.showInternetSearch}
                    onChange={(e) =>
                      updateSetting("showInternetSearch", e.target.checked)
                    }
                  />
                </div>
              </div>

              <div className="settings-group">
                <h4>Export Settings</h4>

                <div className="setting-item">
                  <label htmlFor="exportFormat">Default Format</label>
                  <select
                    id="exportFormat"
                    value={chatSettings.exportFormat}
                    onChange={(e) =>
                      updateSetting("exportFormat", e.target.value)
                    }
                  >
                    <option value="text">Plain Text</option>
                    <option value="json">JSON</option>
                    <option value="html">HTML</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
              </div>

              <div className="settings-actions">
                <button
                  className="danger-btn"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to clear all messages? This cannot be undone."
                      )
                    ) {
                      setCurrentMessages([]);
                      setSelectedThreadId(null);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Clear Messages
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload type modal */}
        {showUploadModal && (
          <div className="modal-overlay">
            <div className="modal-content upload-modal">
              <div className="modal-header">
                <h3>Choose Upload Type</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowUploadModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="upload-options">
                <button
                  className="upload-option document-option"
                  onClick={() => handleSelectUploadType("document")}
                >
                  <FileText size={32} />
                  <span>Upload Document</span>
                  <p>Upload a PDF, text, or document file for analysis</p>
                </button>
                <button
                  className="upload-option image-option"
                  onClick={() => handleSelectUploadType("image")}
                >
                  <Image size={32} />
                  <span>Upload Image</span>
                  <p>Upload an image for analysis or search</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search mode modal */}
        {showSearchModal && (
          <div className="modal-overlay">
            <div className="modal-content search-modal">
              <div className="modal-header">
                <h3>Choose Search Type</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowSearchModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="search-options">
                <button
                  className="search-option full-match"
                  onClick={() => handleSelectSearchMode("tensor")}
                >
                  <div className="option-icon">
                    <Search size={32} />
                  </div>
                  <span>Full Image Match</span>
                  <p>
                    Find exact or very similar images using tensor signatures
                  </p>
                </button>
                <button
                  className="search-option partial-match"
                  onClick={() => handleSelectSearchMode("partial")}
                >
                  <div className="option-icon">
                    <Search size={32} />
                  </div>
                  <span>Partial Image Match</span>
                  <p>
                    Find images containing parts of this image using Google
                    Vision
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image viewer modal */}
        {showImageViewerModal && currentViewImage && (
          <div className="modal-overlay">
            <div className="modal-content image-viewer-modal">
              <div className="modal-header">
                <h3>Image Viewer</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowImageViewerModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="image-container">
                <img
                  src={`${apiService.utils.getBaseUrl()}/image-viewer?path=${encodeURIComponent(
                    currentViewImage
                  )}`}
                  alt="Viewed image"
                  className="viewed-image"
                />
              </div>
              <div className="modal-footer">
                <p className="image-path">{currentViewImage}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatbotTabContent;
