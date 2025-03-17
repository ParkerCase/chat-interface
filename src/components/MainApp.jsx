// src/components/MainApp.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import Header from "./Header";
import ChatContainer from "./ChatContainer";
import InputBar from "./InputBar";
import AnalysisResult from "./AnalysisResult";
import AdvancedSearch from "./AdvancedSearch";
import { fetchWithTimeout, API_CONFIG } from "../utils/api-utils";

function MainApp() {
  const navigate = useNavigate();
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

  // Save messages when they change
  useEffect(() => {
    localStorage.setItem("chatMessages", JSON.stringify(messages));
  }, [messages]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    setMessages([]);
    navigate("/passcode");
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

  // Connection checking logic (unchanged from App.jsx)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}/status/check`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          },
          10000
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

  // Retry connection handler
  const retryConnection = async () => {
    try {
      setConnectionError(false);
      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/status/check`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
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

  // Image search function
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
      formData.append("mode", mode);

      // Handle follow-up query with the image
      if (isFollowUpQuery) {
        formData.append("message", message);
        formData.append("userId", userId);

        setMessages((prev) => [
          ...prev,
          {
            sender: "system",
            text: "Processing query with image...",
            timestamp: new Date().toISOString(),
          },
        ]);

        // Use XHR for progress tracking
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

      // Track upload progress
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

      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/api/analyze-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagePath }),
        },
        30000
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
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
        throw new Error(data.error || "Unknown error analyzing image");
      }
    } catch (error) {
      const userMessage =
        error.message === "Failed to fetch"
          ? "Network connection error. Please check your internet connection and try again."
          : `Error analyzing image: ${error.message}`;

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

      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/api/analyze-search-result`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagePath }),
        },
        30000
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
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

  // Send message function
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

        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyzePath}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imagePath: imagePath,
              message: text,
              userId: userId,
            }),
          },
          180000
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

      const formData = new FormData();
      formData.append("message", text);
      formData.append("userId", userId);

      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat}`,
        {
          method: "POST",
          body: formData,
        },
        120000
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

  // File upload handler
  const handleFileUpload = async (file) => {
    try {
      setIsLoading(true);
      setUploadProgress(0);

      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          "File size exceeds 10MB limit. Please choose a smaller file."
        );
      }

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

      const formData = new FormData();
      formData.append("image", file);
      formData.append("userId", userId);
      formData.append("message", "Analyze this image");

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

  // Event handler for analyze clicks
  useEffect(() => {
    const handleAnalyzeClick = (event) => {
      if (event.target.classList.contains("analyze-link")) {
        event.preventDefault();
        const imagePath = event.target.getAttribute("data-path");
        if (imagePath) {
          analyzeImage(imagePath);
        }
      }
    };

    document.addEventListener("click", handleAnalyzeClick);
    return () => document.removeEventListener("click", handleAnalyzeClick);
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

export default MainApp;
