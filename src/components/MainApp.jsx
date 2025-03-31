import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Header from "./Header";
import ChatContainer from "./ChatContainer";
import InputBar from "./InputBar";
import AnalysisResult from "./AnalysisResult";
import AdvancedSearch from "./AdvancedSearch";
import ExportButton from "./ExportButton";
import { useAuth } from "../context/AuthContext";
import { useFeatureFlags, FeatureGate } from "../utils/featureFlags";
import apiService from "../services/apiService";
import UpgradePrompt from "./UpgradePrompt";

import "./MainApp.css";

function MainApp() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();

  const [messages, setMessages] = useState([]);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState("");
  const [currentTheme, setCurrentTheme] = useState("default");

  const messagesEndRef = useRef(null);

  // Auto-scroll to latest messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load saved messages
  useEffect(() => {
    const savedMessages = localStorage.getItem("chatMessages");
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error("Error loading saved messages:", error);
        setMessages([]);
      }
    }
  }, []);

  // Load theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Check for stored theme
        const savedTheme = localStorage.getItem("preferredTheme");
        if (savedTheme) {
          setCurrentTheme(savedTheme);
          loadThemeCSS(savedTheme);
        } else if (currentUser) {
          // Try to get theme from server
          const response = await apiService.themes.getPreference();
          if (response.data && response.data.success) {
            const themeId = response.data.themeId || "default";
            setCurrentTheme(themeId);
            loadThemeCSS(themeId);
            localStorage.setItem("preferredTheme", themeId);
          }
        }
      } catch (error) {
        console.error("Error loading theme:", error);
      }
    };

    loadTheme();
  }, [currentUser]);

  // Save messages when they change
  useEffect(() => {
    localStorage.setItem("chatMessages", JSON.stringify(messages));
  }, [messages]);

  // Handle logout
  const handleLogout = () => {
    logout();
    localStorage.removeItem("chatMessages");
    setMessages([]);
    navigate("/login");
  };

  // Load theme CSS
  const loadThemeCSS = async (themeId) => {
    try {
      const response = await apiService.themes.getCSS(themeId);

      if (response.data) {
        // Create or update style element
        const styleEl =
          document.getElementById("theme-style") ||
          document.createElement("style");
        styleEl.id = "theme-style";
        styleEl.textContent = response.data;

        if (!document.getElementById("theme-style")) {
          document.head.appendChild(styleEl);
        }
      }
    } catch (error) {
      console.error("Error loading theme CSS:", error);
    }
  };

  // Change theme
  const changeTheme = async (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem("preferredTheme", themeId);

    try {
      // Update server preference if user is logged in
      if (currentUser) {
        await apiService.themes.setPreference(themeId);
      }

      // Load theme CSS
      loadThemeCSS(themeId);
    } catch (error) {
      console.error("Error setting theme:", error);
    }
  };

  const [userId] = useState(() => {
    // Generate a persistent user ID or use an existing one
    const savedId = localStorage.getItem("chatUserId");
    if (savedId) return savedId;

    // Create a new ID if none exists
    const newId = `user_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("chatUserId", newId);
    return newId;
  });

  // Connection checking logic
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await apiService.status.check();
        setConnectionError(false); // Even if not "success", if we get a response, consider connected
      } catch (error) {
        console.error("Connection check failed:", error);
        setConnectionError(true);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Retry connection handler
  const retryConnection = async () => {
    try {
      setConnectionError(false);
      await apiService.status.check();
    } catch (error) {
      setConnectionError(true);
    }
  };

  // Advanced search with internet - new function
  const handleAdvancedSearch = async (text) => {
    try {
      setIsLoading(true);

      // Add user message to chat
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Show system message indicating web search
      setMessages((prev) => [
        ...prev,
        {
          sender: "system",
          text: "Searching the web for relevant information...",
          timestamp: new Date().toISOString(),
        },
      ]);

      // Call the advanced search endpoint
      const response = await apiService.chat.advanced(text, userId);

      // Add assistant response to chat
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: response.data.response,
          timestamp: new Date().toISOString(),
          threadId: response.data.threadId,
        },
      ]);
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `Error searching the web: ${error.message || "Unknown error"}`;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: userMessage,
          type: "error",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Image search function
  const handleImageSearch = async (
    imageFile,
    message = "",
    mode = "tensor",
    cloudPath = null
  ) => {
    // Check if image search is available for this user's tier
    if (!isFeatureEnabled("image_search")) {
      setShowUpgradePrompt(true);
      setUpgradeTrigger("image_search");
      return;
    }

    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Create a message to display
      let displayMessage =
        message ||
        `Image search (${mode === "tensor" ? "Full Match" : "Partial Match"})`;

      // If we have a cloud path, include it in the message
      if (cloudPath) {
        displayMessage += ` from ${cloudPath}`;
      }

      // Add user message with the image
      if (cloudPath) {
        // For cloud images, we don't have a blob to create a preview
        setMessages((prev) => [
          ...prev,
          {
            sender: "user",
            text: displayMessage,
            type: "text",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (imageFile) {
        // For file uploads, create a preview
        const filePreview = URL.createObjectURL(imageFile);
        setMessages((prev) => [
          ...prev,
          {
            sender: "user",
            content: filePreview,
            type: "image",
            timestamp: new Date().toISOString(),
            text: displayMessage,
          },
        ]);
      }

      // Determine if this is a follow-up query
      const isFollowUpQuery = message && message.trim().length > 0;

      if (isFollowUpQuery) {
        // Handle follow-up query with the image
        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: "Processing query with image...",
            timestamp: new Date().toISOString(),
          },
        ]);

        let data;
        if (cloudPath) {
          // Use the analyze image path endpoint
          data = await apiService.chat.analyzeImagePath(
            cloudPath,
            message,
            userId
          );
        } else {
          // Use file upload endpoint
          data = await apiService.chat.uploadImage(
            imageFile,
            userId,
            message,
            (progress) => setUploadProgress(progress)
          );
        }

        // Add assistant response to chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: data.response,
            timestamp: new Date().toISOString(),
            threadId: data.threadId,
          },
        ]);
      } else {
        // For visual search
        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: `Searching with ${
              mode === "tensor" ? "Full Image Match" : "Partial Image Match"
            } mode...`,
            timestamp: new Date().toISOString(),
          },
        ]);

        let data;
        if (cloudPath) {
          // Use path-based search
          data = await apiService.search.advanced({
            imagePath: cloudPath,
            mode,
          });
        } else {
          // Use file upload search
          data = await apiService.chat.visualSearch(
            imageFile,
            mode,
            (progress) => setUploadProgress(progress)
          );
        }

        setSearchResults(data);

        // Format the response for chat
        const formattedResponse = formatSearchResults(data, mode);

        // Add search results to chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: formattedResponse,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `Error searching for similar images: ${
            error.message || "Unknown error"
          }`;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: userMessage,
          type: "error",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Format search results function
  const formatSearchResults = (results, mode) => {
    if (
      !results.matches ||
      !Array.isArray(results.matches) ||
      results.matches.length === 0
    ) {
      return `No matching images found using ${
        mode === "tensor" ? "full" : "partial"
      } image search.`;
    }

    // Group by directory
    const groupedByDir = {};
    results.matches.forEach((match) => {
      const pathParts = match.path.split("/");
      const dir = pathParts.slice(0, -1).join("/");
      if (!groupedByDir[dir]) {
        groupedByDir[dir] = [];
      }
      groupedByDir[dir].push(match);
    });

    // Format the response
    let response = `Found ${
      results.matchCount || results.matches.length
    } similar images using ${
      mode === "tensor" ? "full" : "partial"
    } image search:\n\n`;

    // Add top match analysis if available
    if (results.topMatchAnalysis) {
      response += `**Top Match Analysis**\n`;
      response += `${
        results.topMatchAnalysis.description || "No detailed analysis available"
      }\n\n`;
    }

    // Add each directory group
    Object.entries(groupedByDir).forEach(([dir, matches]) => {
      response += `**Directory: ${dir}/**\n`;
      matches.forEach((match) => {
        // Get just the filename
        const filename = match.path.split("/").pop();

        // Remove the numbering from the main text to avoid confusion
        response += `• ${filename}\n`;

        // Handle score property which might be formatted differently
        const score =
          typeof match.score === "string"
            ? parseFloat(match.score)
            : match.score || 0;
        const confidence =
          typeof match.confidence === "string"
            ? parseFloat(match.confidence)
            : match.confidence || 0;

        response += ` - Score: ${score.toFixed(2)}\n`;
        response += ` - Confidence: ${confidence.toFixed(2)}\n`;

        // Create clickable link for the full path
        const encodedPath = encodeURIComponent(match.path);
        response += ` - Full path: <a href="${apiService.utils.getBaseUrl()}/image-viewer?path=${encodedPath}" target="_blank">${
          match.path
        }</a>\n`;

        // Add analyze link with properly escaped data attribute
        const escapedPath = match.path
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
        response += ` - <a href="#" class="analyze-link" data-path="${escapedPath}">Analyze this image</a>\n\n`;
      });
    });

    // Add processing time if available
    if (results.stats && results.stats.processingTime) {
      response += `Search completed in ${(
        results.stats.processingTime / 1000
      ).toFixed(1)} seconds.\n\n`;
    }

    response +=
      "Click on any image path to view it, or use the 'Analyze this image' link for detailed analysis.";

    return response;
  };

  // Analyze image function
  const analyzeImage = async (imagePath) => {
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      setMessages((prev) => [
        ...prev,
        {
          sender: "system",
          text: `Analyzing image at ${imagePath}...`,
          timestamp: new Date().toISOString(),
        },
      ]);

      const response = await apiService.image.analyze(imagePath);
      const data = response.data;

      if (data && data.success) {
        // Add assistant response to chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: data.description,
            timestamp: new Date().toISOString(),
          },
        ]);

        setAnalysisResult(data);
      } else {
        throw new Error(data?.error || "Unknown error analyzing image");
      }
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `Error analyzing image: ${error.message || "Unknown error"}`;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: userMessage,
          type: "error",
          timestamp: new Date().toISOString(),
        },
      ]);

      setAnalysisError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analyze search result function
  const analyzeSearchResult = async (imagePath) => {
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      const response = await apiService.image.analyzeSearchResult(imagePath);
      const data = response.data;

      if (data && data.success) {
        setAnalysisResult(data);

        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: `<strong>Image Analysis: ${imagePath}</strong>\n\n${data.description}`,
            timestamp: new Date().toISOString(),
            type: "text",
          },
        ]);
      }
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `Error analyzing image: ${error.message || "Unknown error"}`;

      setAnalysisError(userMessage);

      setMessages((prev) => [
        ...prev,
        {
          sender: "system",
          text: userMessage,
          timestamp: new Date().toISOString(),
          type: "error",
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // File upload handler - enhanced to handle documents too
  const handleFileUpload = async (file, message = "", cloudPath = null) => {
    // Check if file upload is available for this user's tier
    if (!isFeatureEnabled("file_upload")) {
      setShowUpgradePrompt(true);
      setUpgradeTrigger("file_upload");
      return;
    }

    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Handle file or cloud path
      if (cloudPath) {
        // Add user message with path reference
        setMessages((prev) => [
          ...prev,
          {
            sender: "user",
            text: message || `Analyze file at ${cloudPath}`,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Use analyze path endpoint
        const data = await apiService.chat.analyzeImagePath(
          cloudPath,
          message || "Analyze this file",
          userId
        );

        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: data.response,
            timestamp: new Date().toISOString(),
            threadId: data.threadId,
          },
        ]);
      } else if (file) {
        // Check file size
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(
            "File size exceeds 10MB limit. Please choose a smaller file."
          );
        }

        // Determine file type
        const isImage = file.type.startsWith("image/");

        if (isImage) {
          // Image upload flow
          const filePreview = URL.createObjectURL(file);
          setMessages((prev) => [
            ...prev,
            {
              sender: "user",
              content: filePreview,
              type: "image",
              timestamp: new Date().toISOString(),
              text: message || "Analyze this image",
            },
          ]);

          const data = await apiService.chat.uploadImage(
            file,
            userId,
            message || "Analyze this image",
            (progress) => setUploadProgress(progress)
          );

          setMessages((prev) => [
            ...prev,
            {
              sender: "assistant",
              text: data.response,
              timestamp: new Date().toISOString(),
              threadId: data.threadId,
            },
          ]);
        } else {
          // Document upload flow
          setMessages((prev) => [
            ...prev,
            {
              sender: "user",
              text: message || `Analyze this document: ${file.name}`,
              timestamp: new Date().toISOString(),
            },
          ]);

          // For document uploads, use document endpoint
          const data = await apiService.chat.uploadDocument(
            file,
            userId,
            message || `Analyze this document: ${file.name}`,
            (progress) => setUploadProgress(progress)
          );

          setMessages((prev) => [
            ...prev,
            {
              sender: "assistant",
              text: data.response,
              timestamp: new Date().toISOString(),
              threadId: data.threadId,
            },
          ]);
        }
      }
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `Error processing file: ${error.message || "Unknown error"}`;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: userMessage,
          type: "error",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      setFile(null);
    }
  };

  // Handle text search - regular chat
  const sendMessage = async (text) => {
    try {
      setIsLoading(true);

      // Check if the message contains a file path
      const pathRegex = /(?:\/?)([^\s"']+\.(jpe?g|png|gif|webp))/i;
      const pathMatch = text.match(pathRegex);

      // If the message has a file path and seems to be asking about an image
      if (pathMatch) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "user",
            text,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Extract the file path
        let imagePath = pathMatch[0];

        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: `Analyzing image at ${imagePath}...`,
            timestamp: new Date().toISOString(),
          },
        ]);

        const response = await apiService.chat.analyzeImagePath(
          imagePath,
          text,
          userId
        );
        const data = response.data;

        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: data.response,
            timestamp: new Date().toISOString(),
            threadId: data.threadId,
          },
        ]);

        setIsLoading(false);
        return;
      }

      // Regular message handling
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text,
          timestamp: new Date().toISOString(),
        },
      ]);

      const response = await apiService.chat.sendMessage(text, userId);
      const data = response.data;

      let processedResponse = data.response;

      // Convert image paths to clickable links
      processedResponse = processedResponse.replace(
        /\/(photos|marketing)[^\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
        (match) => {
          const encodedPath = encodeURIComponent(match);
          return `<a href="${apiService.utils.getBaseUrl()}/image-viewer?path=${encodedPath}" target="_blank">${match}</a>`;
        }
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: processedResponse,
          timestamp: new Date().toISOString(),
          threadId: data.threadId,
          isHtml: true,
        },
      ]);
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `I apologize, but I encountered an error: ${
            error.message || "Unknown error"
          }. Please try again with a simpler query.`;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: userMessage,
          type: "error",
          timestamp: new Date().toISOString(),
        },
      ]);
      setConnectionError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Search function - called from AdvancedSearch component
  const handleAnotherSearch = async (query, type, limit) => {
    // Check if advanced search is available for this user's tier
    if (!isFeatureEnabled("advanced_search")) {
      setShowUpgradePrompt(true);
      setUpgradeTrigger("advanced_search");
      return;
    }

    try {
      setIsLoading(true);

      setMessages((prev) => [
        ...prev,
        {
          sender: "system",
          text: `Performing advanced search for "${query}"...`,
          timestamp: new Date().toISOString(),
        },
      ]);

      const response = await apiService.search.advanced(query, type, limit);
      const data = response.data;

      // Format results for display
      let resultsText = `Search results for "${query}":\n\n`;

      if (data.results && data.results.length > 0) {
        data.results.forEach((result, index) => {
          resultsText += `${index + 1}. ${
            result.title || result.path || "Untitled"
          }\n`;

          if (result.path) {
            const encodedPath = encodeURIComponent(result.path);
            resultsText += `Path: <a href="/image-viewer?path=${encodedPath}" target="_blank">${result.path}</a>\n`;
          }

          if (result.text) {
            resultsText += `Content: ${result.text.substring(0, 150)}${
              result.text.length > 150 ? "..." : ""
            }\n`;
          }

          if (result.score) {
            resultsText += `Relevance: ${(result.score * 100).toFixed(1)}%\n`;
          }

          resultsText += "\n";
        });
      } else {
        resultsText +=
          "No results found. Try different search terms or categories.";
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: resultsText,
          timestamp: new Date().toISOString(),
          isHtml: true,
        },
      ]);
    } catch (error) {
      const userMessage = error.isNetworkError
        ? "Network connection error. Please check your internet connection and try again."
        : `Error performing search: ${error.message || "Unknown error"}`;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: userMessage,
          type: "error",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Event listeners for analyze links
  useEffect(() => {
    const handleAnalyzeLinkClick = (event) => {
      const target = event.target;
      if (target.classList.contains("analyze-link")) {
        event.preventDefault();
        const path = target.getAttribute("data-path");
        if (path) {
          analyzeSearchResult(path);
        }
      }
    };

    const messagesContainer = document.querySelector(".chat-container");
    if (messagesContainer) {
      messagesContainer.addEventListener("click", handleAnalyzeLinkClick);
    }

    return () => {
      if (messagesContainer) {
        messagesContainer.removeEventListener("click", handleAnalyzeLinkClick);
      }
    };
  }, []);

  // Expose analyzeSearchResult to window object
  useEffect(() => {
    window.analyzeSearchResult = analyzeSearchResult;
    return () => {
      delete window.analyzeSearchResult;
    };
  }, []);

  return (
    <div className="app">
      <Header
        onLogout={handleLogout}
        currentUser={currentUser}
        currentTheme={currentTheme}
        onChangeTheme={changeTheme}
      />

      {/* Dashboard link - changed to left side with new appearance */}
      <div className="dashboard-link-container">
        <button
          onClick={() => navigate("/admin")}
          className="dashboard-link-button"
        >
          <ArrowLeft size={16} />
          <span>Return to Chatbot Dashboard</span>
        </button>
      </div>

      {connectionError && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4" />
          <p>
            Connection to server lost. Please check your connection and try
            again.{" "}
            <button className="retry-button" onClick={retryConnection}>
              Retry
            </button>
          </p>
        </div>
      )}

      {/* Advanced Search with feature gate */}
      <FeatureGate feature="advanced_search">
        <AdvancedSearch onResults={handleAnotherSearch} />
      </FeatureGate>

      <ChatContainer messages={messages} />

      {isAnalyzing && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Analyzing image...</p>
        </div>
      )}

      {analysisResult && (
        <AnalysisResult
          result={analysisResult}
          onClose={() => setAnalysisResult(null)}
        />
      )}

      {/* Enhanced InputBar with all new features */}
      <InputBar
        onSend={sendMessage}
        onFileUpload={handleFileUpload}
        onImageSearch={handleImageSearch}
        onAdvancedSearch={handleAdvancedSearch}
        setFile={setFile}
        isLoading={isLoading}
        disabled={connectionError}
        uploadProgress={uploadProgress}
        showImageSearch={isFeatureEnabled("image_search")}
      />

      {/* Export feature for Professional and Enterprise tiers */}
      <FeatureGate feature="data_export">
        <ExportButton messages={messages} analysisResult={analysisResult} />
      </FeatureGate>

      <div ref={messagesEndRef} />

      {isLoading && uploadProgress > 0 && (
        <div
          className="upload-progress-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="upload-progress-container">
            <div
              className="upload-progress-bar"
              style={{ width: `${uploadProgress}%` }}
              aria-valuenow={uploadProgress}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
            <span>{uploadProgress}% uploaded</span>
          </div>
        </div>
      )}

      {showUpgradePrompt && (
        <UpgradePrompt
          feature={upgradeTrigger}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </div>
  );
}

export default MainApp;
