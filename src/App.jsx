import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import AdminPanel from "./components/admin/AdminPanel";
import Register from "./components/admin/Register";

import Header from "./components/Header";
import ChatContainer from "./components/ChatContainer";
import InputBar from "./components/InputBar";
import { AlertCircle, Loader2 } from "lucide-react";
import AnalysisResult from "./components/AnalysisResult";
import ExportButton from "./components/ExportButton";
import AdvancedSearch from "./components/AdvancedSearch";
import ErrorBoundary from "./components/ErrorBoundary";

import "./App.css";

// Configuration - Using environment variables with fallbacks
const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  endpoints: {
    chat: "/api/chat",
    search: "/api/search/image",
    visualSearch: "/search/visual",
    analyzePath: "/api/analyze/path",
    status: "/status/check",
  },
};

// Use environment variable for security
const TEAM_PASSCODE = process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$";

// Enhanced utility function for API calls with timeout and retry
const fetchWithTimeout = async (url, options, timeout = 60000) => {
  // Use a longer timeout for image-related endpoints
  if (url.includes("/image") || url.includes("/search/visual")) {
    timeout = 300000; // 5 minutes for image processing
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. The server is taking too long to respond."
      );
    }

    throw error;
  }
};

function App() {
  // State Management
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    setIsAuthenticated(true);
  }, []);
  const [passcode, setPasscode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const messagesEndRef = useRef(null);

  // Auto-scroll to latest messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load saved messages and auth status
  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated");
    const savedMessages = localStorage.getItem("chatMessages");

    if (authStatus === "true") {
      setIsAuthenticated(true);
    }

    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error("Error loading saved messages:", error);
        // Silently recover with empty messages
        setMessages([]);
      }
    }
  }, []);

  // Save messages when they change
  useEffect(() => {
    localStorage.setItem("chatMessages", JSON.stringify(messages));
  }, [messages]);

  // Enhanced connection check with retry logic
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}/status/check`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
          10000 // 10 second timeout for health check
        );

        if (response.ok) {
          setConnectionError(false);
        } else {
          throw new Error("Server returned error status");
        }
      } catch (error) {
        console.error("Connection check failed:", error);
        setConnectionError(true);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setConnectionError(false);
      // Verify connection is really back
      fetchWithTimeout(
        `${API_CONFIG.baseUrl}/status/check`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
        5000
      ).catch(() => setConnectionError(true));
    };

    const handleOffline = () => {
      setConnectionError(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Handle passcode submission
  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();

    // Try to verify with server first
    try {
      const isServerReachable = await checkServerStatus();

      if (isServerReachable) {
        // Server is online, use normal authentication
        if (passcode === TEAM_PASSCODE) {
          localStorage.setItem("isAuthenticated", "true");
          setIsAuthenticated(true);
          setError("");
        } else {
          setError("Incorrect passcode");
          setPasscode("");
        }
      } else {
        // Server is offline, use fallback authentication
        // This allows offline login with the correct password
        if (passcode === TEAM_PASSCODE) {
          localStorage.setItem("isAuthenticated", "true");
          setIsAuthenticated(true);
          setError("");

          // Show warning about offline mode
          setMessages([
            {
              sender: "system",
              text: "Server connection unavailable. Some features may be limited until connection is restored.",
              timestamp: new Date().toISOString(),
              type: "error",
            },
          ]);
        } else {
          setError("Incorrect passcode");
          setPasscode("");
        }
      }
    } catch (error) {
      // Error checking server status
      console.error("Error checking server status:", error);

      // Still allow login with correct password
      if (passcode === TEAM_PASSCODE) {
        localStorage.setItem("isAuthenticated", "true");
        setIsAuthenticated(true);
        setError("");
      } else {
        setError("Incorrect passcode");
        setPasscode("");
      }
    }
  };

  // Helper function to check if server is reachable
  const checkServerStatus = async () => {
    try {
      // Use a simple HEAD request with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_CONFIG.baseUrl}/status/check`, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    setIsAuthenticated(false);
    setMessages([]);
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

  // Retry connection handler
  const retryConnection = async () => {
    try {
      setConnectionError(false);
      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/status/check`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        10000
      );

      if (!response.ok) {
        setConnectionError(true);
      }
    } catch (error) {
      setConnectionError(true);
    }
  };

  // New function to handle image search with mode
  const handleImageSearch = async (
    imageFile,
    message = "",
    mode = "tensor"
  ) => {
    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Create file preview
      const filePreview = URL.createObjectURL(imageFile);

      // Determine if this is an initial search or a follow-up query
      const isFollowUpQuery = message && message.trim().length > 0;

      // Add user message with the image
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          content: filePreview,
          type: "image",
          timestamp: new Date().toISOString(),
          text: isFollowUpQuery
            ? message
            : `Image search (${
                mode === "tensor" ? "Full Match" : "Partial Match"
              })`,
        },
      ]);

      // Create form data
      const formData = new FormData();
      formData.append("image", imageFile);

      // IMPORTANT: Always add the search mode even for chat
      formData.append("mode", mode);

      // Handle follow-up query with the image
      if (isFollowUpQuery) {
        formData.append("message", message);
        formData.append("userId", userId);

        // Add system message about what's happening
        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: "Processing query with image...",
            timestamp: new Date().toISOString(),
          },
        ]);

        // Create custom XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        const promise = new Promise((resolve, reject) => {
          xhr.open("POST", `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat}`);

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(progress);
            }
          });

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              try {
                reject(JSON.parse(xhr.responseText));
              } catch (e) {
                reject({ error: `Server error: ${xhr.status}` });
              }
            }
          };

          xhr.onerror = () => reject({ error: "Network error" });
          xhr.send(formData);
        });

        const chatData = await promise;

        // Add assistant response to chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: chatData.response,
            timestamp: new Date().toISOString(),
            threadId: chatData.threadId,
          },
        ]);

        return;
      }

      // Otherwise, perform a visual search
      // Add system message about search mode
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

      // Create custom XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      const promise = new Promise((resolve, reject) => {
        xhr.open(
          "POST",
          `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.visualSearch}`
        );

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              reject(JSON.parse(xhr.responseText));
            } catch (e) {
              reject({ error: `Server error: ${xhr.status}` });
            }
          }
        };

        xhr.onerror = () => reject({ error: "Network error" });
        xhr.send(formData);
      });

      const data = await promise;
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
    } catch (error) {
      // Provide user-friendly error message
      const userMessage =
        error.message === "Network error"
          ? "Network connection error. Please check your internet connection and try again."
          : `Error searching for similar images: ${error.message}`;

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

  const analyzeImage = async (imagePath) => {
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      // Add system message about what's happening
      setMessages((prev) => [
        ...prev,
        {
          sender: "system",
          text: `Analyzing image at ${imagePath}...`,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Use the direct analysis endpoint
      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/api/analyze-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imagePath: imagePath,
          }),
        },
        30000 // 30-second timeout
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Add analysis to chat
        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: data.description,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Store result for potential display in UI
        setAnalysisResult(data);
      } else {
        throw new Error(data.error || "Unknown error analyzing image");
      }
    } catch (error) {
      // Provide user-friendly error message
      const userMessage =
        error.message === "Failed to fetch"
          ? "Network connection error. Please check your internet connection and try again."
          : `Error analyzing image: ${error.message}`;

      // Add error message to chat
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

  // Update the formatSearchResults function
  const formatSearchResults = (results, mode) => {
    // Check for no matches
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
      // Extract directory from path
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

        // Create clickable link for the full path - FIXED PATH ENCODING
        const encodedPath = encodeURIComponent(match.path);
        response += ` - Full path: <a href="${API_CONFIG.baseUrl}/image-viewer?path=${encodedPath}" target="_blank">${match.path}</a>\n`;

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

  // Add this function to your frontend code
  const analyzeSearchResult = async (imagePath) => {
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/api/analyze-search-result`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imagePath }),
        },
        30000 // 30-second timeout
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Show the analysis in the UI
        setAnalysisResult(data);

        // You can also add it as a system message to the conversation
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
      // Provide user-friendly error message
      const userMessage =
        error.message === "Failed to fetch"
          ? "Network connection error. Please check your internet connection and try again."
          : `Error analyzing image: ${error.message}`;

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

  // Updated sendMessage function to handle image path inquiries
  const sendMessage = async (text) => {
    try {
      setIsLoading(true);

      // Check if the message contains a file path - look for paths with or without leading slash
      const pathRegex = /(?:\/?)([^\s"']+\.(jpe?g|png|gif|webp))/i;
      const pathMatch = text.match(pathRegex);

      // If the message has a file path and seems to be asking about an image
      if (pathMatch) {
        // Add user message immediately
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

        // Add system message about what's happening
        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: `Analyzing image at ${imagePath}...`,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Use the direct image path analysis endpoint
        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyzePath}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imagePath: imagePath,
              message: text,
              userId: userId,
            }),
          },
          180000 // 3-minute timeout
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: `Server error: ${response.status}` }));
          throw new Error(
            errorData.error || `Server error: ${response.status}`
          );
        }

        const data = await response.json();

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

        setIsLoading(false);
        return;
      }

      // Regular message handling (unchanged)
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Create form data for API request
      const formData = new FormData();
      formData.append("message", text);
      formData.append("userId", userId);

      // Use a longer timeout for complex requests (2 minutes)
      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat}`,
        {
          method: "POST",
          body: formData,
        },
        120000 // 2-minute timeout
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      let processedResponse = data.response;

      // Convert image paths to clickable links
      processedResponse = processedResponse.replace(
        /\/(photos|marketing)[^\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
        (match) => {
          const encodedPath = encodeURIComponent(match);
          return `<a href="${API_CONFIG.baseUrl}/image-viewer?path=${encodedPath}" target="_blank">${match}</a>`;
        }
      );

      // Add assistant response to chat
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: processedResponse,
          timestamp: new Date().toISOString(),
          threadId: data.threadId,
          isHtml: true, // Add this flag to indicate HTML content
        },
      ]);
    } catch (error) {
      // Provide user-friendly error message
      const userMessage =
        error.message === "Failed to fetch"
          ? "Network connection error. Please check your internet connection and try again."
          : `I apologize, but I encountered an error: ${error.message}. Please try again with a simpler query.`;

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

  // Enhanced file upload handler with better error handling and progress tracking
  const handleFileUpload = async (file) => {
    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Validate file size
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        throw new Error(
          "File size exceeds 10MB limit. Please choose a smaller file."
        );
      }

      // Create file preview
      const filePreview = URL.createObjectURL(file);
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          content: filePreview,
          type: "image",
          timestamp: new Date().toISOString(),
        },
      ]);

      // Prepare form data
      const formData = new FormData();
      formData.append("image", file);
      formData.append("userId", userId);
      formData.append("message", "Analyze this image");

      // Create custom XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      const promise = new Promise((resolve, reject) => {
        xhr.open("POST", `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat}`);

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              reject(JSON.parse(xhr.responseText));
            } catch (e) {
              reject({ error: `Server error: ${xhr.status}` });
            }
          }
        };

        xhr.onerror = () => reject({ error: "Network error" });
        xhr.send(formData);
      });

      const data = await promise;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: data.response,
          timestamp: new Date().toISOString(),
          threadId: data.threadId,
        },
      ]);
    } catch (error) {
      // Provide user-friendly error message
      const userMessage =
        error.message === "Network error"
          ? "Network connection error. Please check your internet connection and try again."
          : `Error processing image: ${error.message}`;

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

  useEffect(() => {
    // Function to handle clicks on analyze links
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

    // Add event listener to the messages container
    const messagesContainer = document.querySelector(".chat-container");
    if (messagesContainer) {
      messagesContainer.addEventListener("click", handleAnalyzeLinkClick);
    }

    // Cleanup
    return () => {
      if (messagesContainer) {
        messagesContainer.removeEventListener("click", handleAnalyzeLinkClick);
      }
    };
  }, []);

  useEffect(() => {
    // Handle clicks on analyze links
    const handleAnalyzeClick = (event) => {
      // Check if it's an analyze link
      if (event.target.classList.contains("analyze-link")) {
        event.preventDefault();
        const imagePath = event.target.getAttribute("data-path");
        if (imagePath) {
          analyzeImage(imagePath);
        }
      }
    };

    // Add the event listener
    document.addEventListener("click", handleAnalyzeClick);

    // Clean up
    return () => {
      document.removeEventListener("click", handleAnalyzeClick);
    };
  }, []);

  useEffect(() => {
    // Expose the analyzeSearchResult function to the window object
    window.analyzeSearchResult = analyzeSearchResult;

    // Cleanup on unmount
    return () => {
      delete window.analyzeSearchResult;
    };
  }, []);

  // Clear connection error after 5 seconds
  useEffect(() => {
    if (connectionError) {
      const timer = setTimeout(() => {
        setConnectionError(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionError]);

  return !isAuthenticated ? (
    <div className="login-container">
      <form onSubmit={handlePasscodeSubmit} className="login-form">
        <h2>Enter Team Passcode</h2>
        {error && <p className="error-message">{error}</p>}

        {/* Hidden username field for accessibility */}
        <input
          type="text"
          id="username"
          name="username"
          autoComplete="username"
          className="hidden-username"
          aria-hidden="true"
          tabIndex="-1"
        />

        <div className="password-input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            className="password-input"
            autoComplete="current-password"
            id="current-password"
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <button type="submit" className="login-button">
          Enter
        </button>
      </form>
    </div>
  ) : (
    <div className="app">
      <Header onLogout={handleLogout} />
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

      {/* Add AdvancedSearch component above ChatContainer */}
      <AdvancedSearch
        onResults={(results) => {
          setMessages((prev) => [
            ...prev,
            {
              sender: "system",
              text: "Advanced search results:",
              timestamp: new Date().toISOString(),
            },
            {
              sender: "assistant",
              text: results,
              timestamp: new Date().toISOString(),
            },
          ]);
        }}
      />
      <ChatContainer messages={messages} />

      {/* Add the AnalysisResult component here */}
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

      <InputBar
        onSend={sendMessage}
        onFileUpload={handleFileUpload}
        onImageSearch={handleImageSearch}
        setFile={setFile}
        isLoading={isLoading}
        disabled={connectionError}
        uploadProgress={uploadProgress}
      />
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
    </div>
  );
}

export default App;
