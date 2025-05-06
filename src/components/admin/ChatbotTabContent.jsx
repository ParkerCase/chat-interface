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
  Clipboard,
  Calendar, // Add this line to import the Calendar icon
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import apiService from "../../services/apiService";
import axios from "axios";
import ChatHistory from "../chat/ChatHistory";
import AdvancedSearch from "../AdvancedSearch";
import ExportButton from "../ExportButton";
import { useChatImageSearch } from "../../hooks/useChatImageSearch";
import { supabase } from "../../lib/supabase";
import ChatImageResults from "../../components/ChatImageResults";
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
  const [useZenoti, setUseZenoti] = useState(false);

  // State for settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    darkMode: false,
    showTimestamps: true,
    messageSize: "medium",
    autoScroll: true,
    exportFormat: "text",
    showInternetSearch: true,
    showZenotiIntegration: true, // Add this new line
  });

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const { processImageSearchRequest } = useChatImageSearch();

  const toggleZenoti = () => {
    const newValue = !useZenoti;
    setUseZenoti(newValue);

    // Also update the settings
    updateSetting("showZenotiIntegration", newValue);
  };

  // Update settings
  const updateSetting = (key, value) => {
    setChatSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Save settings to localStorage
    const updatedSettings = { ...chatSettings, [key]: value };
    localStorage.setItem("chatSettings", JSON.stringify(updatedSettings));
  };

  // Load settings from localStorage on initial load
  useEffect(() => {
    const savedSettings = localStorage.getItem("chatSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setChatSettings(parsedSettings);

        // Initialize useZenoti from settings
        if (parsedSettings.showZenotiIntegration !== undefined) {
          setUseZenoti(parsedSettings.showZenotiIntegration);
        }
      } catch (e) {
        console.error("Error loading chat settings:", e);
      }
    }
  }, []);

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

      const response = await apiService.chat.getThreadMessages(threadId, {
        limit: 100,
      }); // Increase limit

      if (response.data?.success) {
        // Ensure we're getting all messages by sorting them correctly
        const allMessages = response.data.messages || [];

        // Sort messages by timestamp to ensure proper order
        allMessages.sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          return timeA - timeB;
        });

        setCurrentMessages(allMessages);
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

      // Hide all modals
      setShowUploadModal(false);
      setShowSearchModal(false);
      setShowImageViewerModal(false);

      // Force immediate UI update to prevent any race conditions
      await new Promise((resolve) => setTimeout(resolve, 10));

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
      // For images, show the search modal after a slight delay
      setTimeout(() => {
        setShowSearchModal(true);
      }, 100); // Small delay to ensure first modal closes properly
    } else {
      // For documents, trigger file selection directly after a slight delay
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.setAttribute(
            "accept",
            "application/pdf,text/plain,.doc,.docx,.csv,.xls,.xlsx"
          );
          fileInputRef.current.click();
        }
      }, 100);
    }
  };

  // Handle search mode selection
  const handleSelectSearchMode = (mode) => {
    setSearchMode(mode);
    // Close the search modal first
    setShowSearchModal(false);

    // Trigger file selection with appropriate accept attribute after a slight delay
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.setAttribute("accept", "image/*");
        fileInputRef.current.click();
      }
    }, 100);
  };

  // Handle file selection
  // Handling file preview
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
  // Replace the readFileContent and handleDocumentUpload functions in ChatbotTabContent.jsx

  const readFileContent = async (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided"));
        return;
      }

      // Check for file size limits to prevent browser crashes
      const MAX_SIZE_MB = 15;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        reject(new Error(`File too large (max ${MAX_SIZE_MB}MB)`));
        return;
      }

      console.log(`Reading file: ${file.name} (${file.type})`);

      // Handle different file types appropriately
      if (file.type === "application/pdf") {
        // For PDFs, we typically need specialized libraries
        // We'll just return basic info since browser PDF parsing is limited
        resolve(
          `[PDF Document: ${file.name}, Size: ${(file.size / 1024).toFixed(
            1
          )} KB]`
        );
        return;
      }

      // For Excel files
      if (
        file.type === "application/vnd.ms-excel" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".xlsx")
      ) {
        try {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              // Convert array buffer to binary string for XLSX.js
              const data = new Uint8Array(e.target.result);

              // Check if XLSX library is available
              if (typeof XLSX !== "undefined") {
                try {
                  const workbook = XLSX.read(data, { type: "array" });
                  const firstSheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheetName];
                  const json = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                  });

                  // Format as a nice CSV-like string
                  let formattedContent = "";

                  // Limit rows to prevent overwhelming the chat
                  const maxRows = Math.min(json.length, 100);

                  for (let i = 0; i < maxRows; i++) {
                    if (json[i] && json[i].length > 0) {
                      formattedContent += json[i].join(", ") + "\n";
                    }
                  }

                  if (json.length > maxRows) {
                    formattedContent += `\n[Note: Showing first ${maxRows} rows of ${json.length} total rows]`;
                  }

                  resolve(formattedContent);
                } catch (xlsxError) {
                  console.warn("XLSX parsing error:", xlsxError);
                  resolve(
                    `[Excel Document: ${file.name}, Size: ${(
                      file.size / 1024
                    ).toFixed(1)} KB]`
                  );
                }
              } else {
                console.warn("XLSX library not available");
                resolve(
                  `[Excel Document: ${file.name}, Size: ${(
                    file.size / 1024
                  ).toFixed(1)} KB]`
                );
              }
            } catch (error) {
              console.warn("Excel processing error:", error);
              resolve(
                `[Excel Document: ${file.name}, Size: ${(
                  file.size / 1024
                ).toFixed(1)} KB]`
              );
            }
          };

          reader.onerror = () => {
            reject(new Error("Error reading Excel file"));
          };

          reader.readAsArrayBuffer(file);
        } catch (excelError) {
          console.warn("Excel file handling error:", excelError);
          resolve(
            `[Excel Document: ${file.name}, Size: ${(file.size / 1024).toFixed(
              1
            )} KB]`
          );
        }
        return;
      }

      // For CSV files, try to parse them nicely
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        try {
          const reader = new FileReader();

          reader.onload = (e) => {
            try {
              const content = e.target.result;

              // Check if Papa Parse is available
              if (typeof Papa !== "undefined") {
                Papa.parse(content, {
                  header: true,
                  dynamicTyping: true,
                  skipEmptyLines: true,
                  complete: (results) => {
                    try {
                      // Format as a nice table
                      let formattedContent = "";

                      // Check if we have data and fields
                      if (
                        !results.data ||
                        !results.data.length ||
                        !results.meta ||
                        !results.meta.fields
                      ) {
                        resolve(content); // Fallback to raw content
                        return;
                      }

                      // Add headers
                      formattedContent += results.meta.fields.join(", ") + "\n";

                      // Add data rows (limit to prevent overwhelming the chat)
                      const maxRows = Math.min(results.data.length, 100);

                      for (let i = 0; i < maxRows; i++) {
                        if (results.data[i]) {
                          const values = Object.values(results.data[i]).map(
                            (v) => String(v || "")
                          );
                          formattedContent += values.join(", ") + "\n";
                        }
                      }

                      if (results.data.length > maxRows) {
                        formattedContent += `\n[Note: Showing first ${maxRows} rows of ${results.data.length} total rows]`;
                      }

                      resolve(formattedContent);
                    } catch (formatError) {
                      console.warn("CSV formatting error:", formatError);
                      resolve(content); // Fallback to raw content
                    }
                  },
                  error: (error) => {
                    console.warn("CSV parsing error:", error);
                    resolve(content); // Fallback to raw content
                  },
                });
              } else {
                console.warn("Papa Parse not available, using raw content");
                resolve(content);
              }
            } catch (csvError) {
              console.warn("CSV processing error:", csvError);
              reader.readAsText(file); // Try reading as plain text instead
            }
          };

          reader.onerror = () => {
            reject(new Error("Error reading CSV file"));
          };

          reader.readAsText(file);
        } catch (csvError) {
          console.warn("CSV file handling error:", csvError);
          resolve(
            `[CSV Document: ${file.name}, Size: ${(file.size / 1024).toFixed(
              1
            )} KB]`
          );
        }
        return;
      }

      // For Microsoft Word documents
      if (
        file.type === "application/msword" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".doc") ||
        file.name.endsWith(".docx")
      ) {
        // We can't parse these in the browser without specialized libraries
        resolve(
          `[Word Document: ${file.name}, Size: ${(file.size / 1024).toFixed(
            1
          )} KB]`
        );
        return;
      }

      // Default: Try to read as text for all other file types
      try {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const content = e.target.result;

            // Check if the content looks like binary data
            const isBinary = /[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(
              content.substring(0, 1000)
            );

            if (isBinary) {
              resolve(
                `[Binary file: ${file.name}, Size: ${(file.size / 1024).toFixed(
                  1
                )} KB]`
              );
            } else {
              // For large text files, truncate to avoid overwhelming the chat
              if (content.length > 50000) {
                resolve(
                  content.substring(0, 50000) +
                    `\n\n[Note: File truncated, showing first ~50KB of ${(
                      file.size / 1024
                    ).toFixed(1)} KB total]`
                );
              } else {
                resolve(content);
              }
            }
          } catch (error) {
            console.warn("File content processing error:", error);
            resolve(
              `[File: ${file.name}, Size: ${(file.size / 1024).toFixed(1)} KB]`
            );
          }
        };

        reader.onerror = () => {
          reject(new Error(`Error reading file: ${file.name}`));
        };

        reader.readAsText(file);
      } catch (error) {
        console.warn("General file handling error:", error);
        reject(new Error(`Cannot process this file type: ${file.type}`));
      }
    });
  };

  // Enhanced handleDocumentUpload function
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
      setUploadProgress(20);

      // Strategy: Try multiple methods in sequence, using the first one that succeeds
      let documentContent = null;
      let processingMethod = "unknown";
      let response = null;

      // Method 1: Try client-side processing for smaller files and specific formats
      if (
        file.size < 5 * 1024 * 1024 &&
        (file.type === "text/plain" ||
          file.type === "text/csv" ||
          file.name.endsWith(".txt") ||
          file.name.endsWith(".csv"))
      ) {
        try {
          console.log("Trying client-side document processing...");
          documentContent = await readFileContent(file);
          processingMethod = "client";
          setUploadProgress(50);
        } catch (readError) {
          console.warn("Client-side file reading error:", readError);
          documentContent = null;
        }
      }

      // Method 2: For PDFs, try specialized PDF endpoint
      if (
        !documentContent &&
        (file.type === "application/pdf" || file.name.endsWith(".pdf"))
      ) {
        try {
          console.log("Trying PDF-specific endpoint...");
          const formData = new FormData();
          formData.append("file", file);
          formData.append("userId", currentUser?.id || "default-user");
          formData.append(
            "message",
            inputText || `Analyze this PDF: ${file.name}`
          );

          response = await axios.post(
            `${apiService.utils.getBaseUrl()}/api/chat/process-pdf`,
            formData,
            {
              onUploadProgress: (progressEvent) => {
                const progress =
                  Math.round(
                    (progressEvent.loaded / progressEvent.total) * 50
                  ) + 30; // Start from 30%
                setUploadProgress(progress);
              },
              headers: {
                "Content-Type": "multipart/form-data",
              },
              timeout: 60000, // Extend timeout for large files
            }
          );

          processingMethod = "pdf-endpoint";
          setUploadProgress(70);
        } catch (pdfError) {
          console.warn("PDF processing error:", pdfError);
          response = null;
        }
      }

      // Method 3: Try generic document upload endpoint
      if (!documentContent && !response) {
        try {
          console.log("Trying generic document upload endpoint...");
          const formData = new FormData();
          formData.append("file", file);
          formData.append("userId", currentUser?.id || "default-user");
          formData.append(
            "message",
            inputText || `Analyze this document: ${file.name}`
          );

          response = await axios.post(
            `${apiService.utils.getBaseUrl()}/api/chat/upload-document`,
            formData,
            {
              onUploadProgress: (progressEvent) => {
                const progress =
                  Math.round(
                    (progressEvent.loaded / progressEvent.total) * 50
                  ) + 30; // Start from 30%
                setUploadProgress(progress);
              },
              headers: {
                "Content-Type": "multipart/form-data",
              },
              timeout: 60000,
            }
          );

          processingMethod = "standard-endpoint";
          setUploadProgress(70);
        } catch (uploadError) {
          console.warn("Document upload error:", uploadError);
          response = null;
        }
      }

      // Method 4: Use chat API with extracted content or file metadata
      if (!response && !documentContent) {
        try {
          console.log("Trying to extract basic file info...");
          // Get basic file metadata if we couldn't get content
          documentContent = `[File: ${file.name}
Type: ${file.type || "Unknown"}
Size: ${(file.size / 1024).toFixed(2)} KB
Last Modified: ${new Date(file.lastModified).toLocaleString()}]`;

          processingMethod = "metadata-only";
          setUploadProgress(50);
        } catch (metadataError) {
          console.warn("Metadata extraction error:", metadataError);
          // Final fallback - just use a generic message
          documentContent = `[Document: ${file.name}]`;
          processingMethod = "fallback";
        }
      }

      // Process based on what method succeeded
      setUploadProgress(80);

      // Option 1: We got a response directly from a specialized endpoint
      if (response && response.data) {
        console.log(`Document processed with ${processingMethod}`);

        // Add assistant response
        const assistantMessage = {
          sender: "assistant",
          message_type: "assistant",
          content:
            response.data.response ||
            "I've reviewed the document but couldn't extract any meaningful information.",
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
      }
      // Option 2: We extracted document content and need to call the chat API
      else if (documentContent) {
        console.log(`Document content extracted with ${processingMethod}`);

        // Prepare a prompt that includes the document content
        const prompt = `The following is content from a document called "${
          file.name
        }". Please analyze it and respond as if responding to the document upload.
      
DOCUMENT CONTENT:
${documentContent}

${
  inputText ||
  "Please analyze this document and provide a summary of the key points."
}`;

        // Call the chat API with the document content
        const chatResponse = await fetch(
          `${apiService.utils.getBaseUrl()}/api/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: prompt,
              userId: currentUser?.id || "default-user",
            }),
          }
        );

        if (!chatResponse.ok) {
          throw new Error(`Chat request failed: ${chatResponse.status}`);
        }

        const chatData = await chatResponse.json();

        // Add assistant response
        const assistantMessage = {
          sender: "assistant",
          message_type: "assistant",
          content:
            chatData.response ||
            "I've reviewed the document but couldn't extract any meaningful information.",
          created_at: new Date().toISOString(),
          thread_id: chatData.threadId,
        };

        setCurrentMessages((prev) => [...prev, assistantMessage]);

        // Update selected thread ID if this is a new thread
        if (chatData.threadId && !selectedThreadId) {
          setSelectedThreadId(chatData.threadId);
          // Turn off new chat mode once we have a thread ID
          setIsNewChat(false);
        }
      } else {
        // Nothing worked - throw an error
        throw new Error("All document processing methods failed");
      }

      setUploadProgress(100);

      // Clear input and file after sending
      setInputText("");
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      console.error("Document upload error:", err);

      // Create a more user-friendly error message
      let errorMsg = "I couldn't process this document. ";

      if (err.message.includes("CORS")) {
        errorMsg += "There was a cross-origin resource issue.";
      } else if (err.message.includes("network")) {
        errorMsg +=
          "There was a network issue. Please check your connection and try again.";
      } else if (err.message.includes("timeout")) {
        errorMsg +=
          "The request timed out. The file might be too large or complex.";
      } else if (file.size > 10 * 1024 * 1024) {
        errorMsg += "The file might be too large (over 10MB).";
      } else {
        errorMsg +=
          err.message ||
          "Please try a different file format or a smaller file.";
      }

      const errorMessage = {
        sender: "system",
        message_type: "error",
        content: errorMsg,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, errorMessage]);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // HandleImageSearch function
  // Modified handleImageSearch function to work with existing Supabase setup
  // Replace the handleImageSearch function in ChatbotTabContent.jsx with this improved version

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
      setUploadProgress(10);

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
      setUploadProgress(20);

      // Create form data for the request
      const formData = new FormData();
      formData.append("image", file);
      formData.append("mode", searchMode); // 'tensor' or 'partial'
      formData.append("limit", "20");
      formData.append("threshold", searchMode === "tensor" ? "0.65" : "0.4");

      const baseUrl = apiService.utils.getBaseUrl();
      let searchEndpoint = `${baseUrl}/api/chat/search/visual`;

      // For partial search mode, add fallback option if the main approach fails
      if (searchMode === "partial") {
        try {
          // First try the standard endpoint
          const searchResponse = await fetch(searchEndpoint, {
            method: "POST",
            body: formData,
          });

          if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            console.warn("Primary search endpoint failed:", errorData);

            // If we get the specific vector operator error, use the fallback endpoint
            if (
              errorData.error &&
              errorData.error.includes(
                "operator does not exist: integer - vector"
              )
            ) {
              console.log("Using fallback search method for partial matching");

              // Use alternative endpoint that doesn't rely on vector operations
              searchEndpoint = `${baseUrl}/api/chat/search/visual-fallback`;

              // Try the fallback approach
              const fallbackResponse = await fetch(searchEndpoint, {
                method: "POST",
                body: formData,
              });

              if (!fallbackResponse.ok) {
                throw new Error(
                  `Fallback search failed: ${fallbackResponse.status}`
                );
              }

              const searchData = await fallbackResponse.json();

              if (!searchData.success) {
                throw new Error(
                  `Fallback search failed: ${
                    searchData.error || "Unknown error"
                  }`
                );
              }

              setUploadProgress(80);

              // Process the fallback search results
              const matches = searchData.matches || [];
              console.log(
                `Found ${matches.length} matches with fallback ${searchMode} search`
              );

              // Format the matches for display
              const imageProxyBase = apiService.utils.getBaseUrl()
                ? `${apiService.utils.getBaseUrl()}/api/image-proxy`
                : "/api/image-proxy";

              const processedMatches = matches.map((match) => ({
                id:
                  match.id ||
                  `match-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 10)}`,
                path: match.path,
                similarity: parseFloat(match.score) || match.similarity || 0.5,
                filename: match.path.split("/").pop(),
                // For image URLs, use the image proxy endpoint
                url: `${imageProxyBase}?path=${encodeURIComponent(match.path)}`,
              }));

              setUploadProgress(90);

              // Format search results for display
              let searchResultsText = `I found ${
                processedMatches.length
              } image${
                processedMatches.length === 1 ? "" : "s"
              } similar to the uploaded image using the fallback search method.`;

              // If no results found, give a helpful message
              if (processedMatches.length === 0) {
                searchResultsText =
                  "I couldn't find any partial matches. Try using Full Image Match mode instead.";
              }

              // Add the analysis and search results to the chat
              const assistantMessage = {
                sender: "assistant",
                message_type: "assistant",
                content: searchResultsText,
                created_at: new Date().toISOString(),
                thread_id: selectedThreadId || null,
                isImageSearch: true,
                images: processedMatches,
                searchParams: {
                  type: "similarity",
                  mode: searchMode,
                  currentPage: 0,
                  totalResults: processedMatches.length,
                  hasMore: processedMatches.length >= 20, // Assume more if we hit the limit
                },
              };

              setCurrentMessages((prev) => [...prev, assistantMessage]);
              setUploadProgress(100);

              // Clear input and file after sending
              setInputText("");
              setFile(null);
              setFilePreview(null);
              setIsLoading(false);
              setUploadProgress(0);
              return;
            } else {
              // If it's not the specific vector error, rethrow the error
              throw new Error(
                `Search failed: ${
                  errorData.error || errorData.details || "Unknown error"
                }`
              );
            }
          }

          // If the original request succeeded, process the results
          const searchData = await searchResponse.json();

          if (!searchData.success) {
            throw new Error(
              `Search failed: ${searchData.error || "Unknown error"}`
            );
          }

          setUploadProgress(60);

          // Process the search results
          const matches = searchData.matches || [];
          console.log(
            `Found ${matches.length} matches with ${searchMode} search`
          );

          // Format the matches for display
          const imageProxyBase = apiService.utils.getBaseUrl()
            ? `${apiService.utils.getBaseUrl()}/api/image-proxy`
            : "/api/image-proxy";

          const processedMatches = matches.map((match) => ({
            id:
              match.id ||
              `match-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 10)}`,
            path: match.path,
            similarity: parseFloat(match.score) || match.similarity || 0.5,
            filename: match.path.split("/").pop(),
            // For image URLs, use the image proxy endpoint
            url: `${imageProxyBase}?path=${encodeURIComponent(match.path)}`,
          }));

          setUploadProgress(90);

          // Format search results for display
          let searchResultsText = `I found ${processedMatches.length} image${
            processedMatches.length === 1 ? "" : "s"
          } similar to the uploaded image.`;

          // If no results found, give a helpful message
          if (processedMatches.length === 0) {
            if (searchMode === "partial") {
              searchResultsText =
                "I couldn't find any partial matches. Try using Full Image Match mode instead.";
            } else {
              searchResultsText =
                "I couldn't find any similar images. Try using Partial Image Match mode or a different image.";
            }
          }

          // Add the analysis and search results to the chat
          const assistantMessage = {
            sender: "assistant",
            message_type: "assistant",
            content: searchResultsText,
            created_at: new Date().toISOString(),
            thread_id: selectedThreadId || null,
            isImageSearch: true,
            images: processedMatches,
            searchParams: {
              type: "similarity",
              mode: searchMode,
              currentPage: 0,
              totalResults: processedMatches.length,
              hasMore: processedMatches.length >= 20, // Assume more if we hit the limit
            },
          };

          setCurrentMessages((prev) => [...prev, assistantMessage]);
          setUploadProgress(100);

          // Clear input and file after sending
          setInputText("");
          setFile(null);
          setFilePreview(null);
        } catch (searchErr) {
          console.error("Search error:", searchErr);

          // For partial search, if all approaches failed, try keyword-based fallback
          const fallbackText =
            "Since the image similarity search is currently unavailable, I'll try to analyze this image and find related images instead.";

          // Add fallback message
          const fallbackMessage = {
            sender: "system",
            message_type: "system",
            content: fallbackText,
            created_at: new Date().toISOString(),
          };

          setCurrentMessages((prev) => [...prev, fallbackMessage]);

          try {
            // Analyze the image using a different endpoint for content-based search
            const analyzeFormData = new FormData();
            analyzeFormData.append("image", file);

            const analyzeResponse = await fetch(
              `${baseUrl}/api/analyze-image`,
              {
                method: "POST",
                body: analyzeFormData,
              }
            );

            if (!analyzeResponse.ok) {
              throw new Error(
                `Image analysis failed: ${analyzeResponse.status}`
              );
            }

            const analyzeData = await analyzeResponse.json();

            // Extract keywords from the analysis
            const keywords = analyzeData.labels
              ?.slice(0, 5)
              .map((l) => l.description) || ["tattoo", "design"];

            // Use these keywords for a text-based search instead
            const keywordResult = await processImageSearch(
              `Find images with ${keywords.join(", ")}`
            );

            const assistantMessage = {
              sender: "assistant",
              message_type: "assistant",
              content: `I analyzed your image and found these related images based on the content: ${keywords.join(
                ", "
              )}`,
              created_at: new Date().toISOString(),
              thread_id: selectedThreadId || null,
              isImageSearch: true,
              images: keywordResult.results || [],
              searchParams: keywordResult.searchParams || {
                type: "keyword",
                keyword: keywords.join(" "),
                currentPage: 0,
                hasMore: (keywordResult.results || []).length >= 20,
              },
            };

            setCurrentMessages((prev) => [...prev, assistantMessage]);
          } catch (fallbackErr) {
            // If even the fallback fails, show a clear error message
            console.error("Fallback approach also failed:", fallbackErr);
            throw new Error(
              "The image search functionality is currently experiencing technical difficulties. Please try again later."
            );
          }
        }
      } else {
        // For tensor mode, use the standard flow without the complex fallback
        const searchResponse = await fetch(searchEndpoint, {
          method: "POST",
          body: formData,
        });

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json();
          throw new Error(
            `Search failed: ${
              errorData.error || errorData.details || "Unknown error"
            }`
          );
        }

        setUploadProgress(60);

        // Parse the response
        const searchData = await searchResponse.json();

        if (!searchData.success) {
          throw new Error(
            `Search failed: ${searchData.error || "Unknown error"}`
          );
        }

        setUploadProgress(80);

        // Process the search results
        const matches = searchData.matches || [];
        console.log(
          `Found ${matches.length} matches with ${searchMode} search`
        );

        // Format the matches for display
        const imageProxyBase = apiService.utils.getBaseUrl()
          ? `${apiService.utils.getBaseUrl()}/api/image-proxy`
          : "/api/image-proxy";

        const processedMatches = matches.map((match) => ({
          id:
            match.id ||
            `match-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 10)}`,
          path: match.path,
          similarity: parseFloat(match.score) || match.similarity || 0.5,
          filename: match.path.split("/").pop(),
          // For image URLs, use the image proxy endpoint
          url: `${imageProxyBase}?path=${encodeURIComponent(match.path)}`,
        }));

        setUploadProgress(90);

        // Format search results for display
        let searchResultsText = `I found ${processedMatches.length} image${
          processedMatches.length === 1 ? "" : "s"
        } similar to the uploaded image.`;

        // If no results found, give a helpful message
        if (processedMatches.length === 0) {
          if (searchMode === "partial") {
            searchResultsText =
              "I couldn't find any partial matches. Try using Full Image Match mode instead.";
          } else {
            searchResultsText =
              "I couldn't find any similar images. Try using Partial Image Match mode or a different image.";
          }
        }

        // Add the analysis and search results to the chat
        const assistantMessage = {
          sender: "assistant",
          message_type: "assistant",
          content: searchResultsText,
          created_at: new Date().toISOString(),
          thread_id: selectedThreadId || null,
          isImageSearch: true,
          images: processedMatches,
          searchParams: {
            type: "similarity",
            mode: searchMode,
            currentPage: 0,
            totalResults: processedMatches.length,
            hasMore: processedMatches.length >= 20, // Assume more if we hit the limit
          },
        };

        setCurrentMessages((prev) => [...prev, assistantMessage]);
        setUploadProgress(100);
      }

      // Clear input and file after sending
      setInputText("");
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      console.error("Image search error:", err);

      // Handle specific errors more gracefully
      let errorMessage = `Error searching for similar images: ${
        err.message || "Unknown error"
      }`;

      if (err.message?.includes("operator does not exist: integer - vector")) {
        errorMessage = `This type of image search is currently having technical difficulties. 
      Please try the other search mode (${
        searchMode === "tensor" ? "Partial" : "Full"
      } Image Match) instead.`;
      }

      const errorSystemMessage = {
        sender: "system",
        message_type: "error",
        content: errorMessage,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, errorSystemMessage]);
      setError(err.message || "Failed to search for similar images");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Add this function to the ChatbotTabContent.jsx component
  const handleGetMoreImages = async (searchParams) => {
    if (!searchParams) return;

    try {
      // Create loading indicator
      const loadingMessage = {
        sender: "system",
        message_type: "system",
        content: "Loading more images...",
        created_at: new Date().toISOString(),
      };

      // Add loading message temporarily
      setCurrentMessages((prev) => [...prev, loadingMessage]);

      // Calculate next page
      const nextPage = (searchParams.currentPage || 0) + 1;
      const offset = nextPage * 20; // 20 per page

      let results = [];
      let responseText = "";

      switch (searchParams.type) {
        case "similarity":
          // For similarity search, we need to reuse the embedding
          if (!searchParams.embedding) {
            throw new Error("Missing embedding for pagination");
          }

          // Call search_images_by_embedding with offset
          const { data: moreImages, error: searchError } = await supabase.rpc(
            "search_images_by_embedding",
            {
              query_embedding: searchParams.embedding,
              match_threshold: 0.65,
              match_limit: 20,
              embedding_type: searchParams.mode,
              offset_value: offset, // Make sure your function supports this
            }
          );

          if (searchError) throw searchError;

          results = (moreImages || []).map((match) => ({
            id: match.id,
            path: match.image_path,
            score: match.similarity,
            filename: match.image_path.split("/").pop(),
          }));

          responseText = `Here are ${results.length} more similar images.`;
          break;

        case "keyword":
          // For keyword search
          const keywords = searchParams.keyword?.split(/\s+/) || [];

          const { data: moreKeywordResults, error: keywordError } =
            await supabase.rpc("search_images_by_keywords", {
              search_terms: keywords,
              match_limit: 20,
              offset_value: offset,
            });

          if (keywordError) throw keywordError;

          results = (moreKeywordResults || []).map((item) => ({
            id: item.id || item.path,
            path: item.path,
            filename: item.path.split("/").pop(),
            matchScore: item.match_score,
          }));

          responseText = `Here are ${results.length} more images matching "${searchParams.keyword}".`;
          break;

        case "bodyPart":
          // For body part search
          const { data: moreBodyPartResults, error: bodyPartError } =
            await supabase.rpc("find_images_by_body_part", {
              body_part: searchParams.bodyPart,
              match_limit: 20,
              offset_value: offset,
            });

          if (bodyPartError) throw bodyPartError;

          results = (moreBodyPartResults || []).map((item) => ({
            id: item.id || item.path,
            path: item.path,
            filename: item.path.split("/").pop(),
            bodyPart: searchParams.bodyPart,
            confidence: item.confidence || 0.8,
          }));

          responseText = `Here are ${results.length} more images with tattoos on the ${searchParams.bodyPart}.`;
          break;

        // Updated "path" case for processImageSearch function
        // Replace the existing case "path" in the switch statement of processImageSearch

        case "path":
          console.log("Searching for images by path:", searchParams.path);

          try {
            // Normalize search term to improve match likelihood
            const searchTerm = searchParams.path.trim().toLowerCase();

            // First try the standard approach
            const { data: pathData, error: pathError } = await supabase
              .from("image_embeddings")
              .select("id, image_path, embedding_type, created_at")
              .ilike("image_path", `%${searchTerm}%`)
              .limit(searchParams.limit);

            if (pathError) {
              throw pathError;
            }

            // If the first approach returned no results, try a different table or approach
            if (!pathData || pathData.length === 0) {
              console.log(
                "No results with standard search, trying alternative approach"
              );

              // Try using a custom RPC function if available
              try {
                const { data: rpcData, error: rpcError } = await supabase.rpc(
                  "search_images_by_path",
                  {
                    path_pattern: searchTerm,
                    match_limit: searchParams.limit,
                  }
                );

                if (!rpcError && rpcData && rpcData.length > 0) {
                  console.log(
                    `Found ${rpcData.length} results with RPC function`
                  );

                  // Map results to the expected format
                  results = rpcData.map((item) => ({
                    id:
                      item.id ||
                      `path-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 8)}`,
                    path: item.image_path || item.path,
                    filename: (item.image_path || item.path).split("/").pop(),
                    type: item.embedding_type || "path_search",
                  }));

                  responseText = `I found ${results.length} image${
                    results.length === 1 ? "" : "s"
                  } in the path containing "${searchParams.path}".`;

                  break;
                }
              } catch (rpcErr) {
                console.warn(
                  "RPC search failed, continuing with direct query fallback:",
                  rpcErr
                );
              }

              // If RPC failed or returned no results, try a more basic approach with raw SQL if available
              try {
                const { data: rawData, error: rawError } = await supabase.rpc(
                  "search_images_by_path_fallback",
                  {
                    search_term: searchTerm,
                    limit_val: searchParams.limit,
                  }
                );

                if (!rawError && rawData && rawData.length > 0) {
                  console.log(
                    `Found ${rawData.length} results with fallback search`
                  );

                  // Map results to the expected format
                  results = rawData.map((item) => ({
                    id:
                      item.id ||
                      `path-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 8)}`,
                    path: item.image_path || item.path,
                    filename: (item.image_path || item.path).split("/").pop(),
                    type: item.embedding_type || "fallback_search",
                  }));

                  responseText = `I found ${results.length} image${
                    results.length === 1 ? "" : "s"
                  } in the path containing "${searchParams.path}".`;

                  break;
                }
              } catch (rawErr) {
                console.warn("Fallback search failed:", rawErr);
              }

              // If we get here, none of the specialized searches worked - last attempt with a simpler direct query
              const { data: lastResortData, error: lastResortError } =
                await supabase
                  .from("image_embeddings")
                  .select("id, image_path")
                  .not("image_path", "is", null)
                  .limit(searchParams.limit);

              if (
                !lastResortError &&
                lastResortData &&
                lastResortData.length > 0
              ) {
                // Filter client-side
                const filteredResults = lastResortData.filter(
                  (item) =>
                    item.image_path &&
                    item.image_path.toLowerCase().includes(searchTerm)
                );

                if (filteredResults.length > 0) {
                  console.log(
                    `Found ${filteredResults.length} results with client-side filtering`
                  );

                  results = filteredResults.map((item) => ({
                    id:
                      item.id ||
                      `path-${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2, 8)}`,
                    path: item.image_path,
                    filename: item.image_path.split("/").pop(),
                    type: "client_filtered",
                  }));

                  responseText = `I found ${results.length} image${
                    results.length === 1 ? "" : "s"
                  } in the path containing "${searchParams.path}".`;

                  break;
                }
              }

              // No results from any approach
              responseText = `I couldn't find any images in the path containing "${searchParams.path}". Try a different folder name.`;
              results = [];
              break;
            }

            // Process results from the standard approach
            // Remove duplicates by path
            const uniquePaths = {};
            results = pathData
              .filter((item) => {
                if (!uniquePaths[item.image_path]) {
                  uniquePaths[item.image_path] = true;
                  return true;
                }
                return false;
              })
              .map((item) => ({
                id:
                  item.id ||
                  `path-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 8)}`,
                path: item.image_path,
                filename: item.image_path.split("/").pop(),
                type: item.embedding_type,
                created: item.created_at,
              }));

            responseText = `I found ${results.length} image${
              results.length === 1 ? "" : "s"
            } in the path containing "${searchParams.path}".`;
          } catch (pathSearchError) {
            console.error("Path search error:", pathSearchError);
            responseText = `I encountered an error searching for images by path: ${pathSearchError.message}. Try a different search method.`;
            results = [];
          }
          break;

        case "noTattoo":
          // For no tattoo search
          const { data: moreNoTattooResults, error: noTattooError } =
            await supabase.rpc("find_images_without_tattoos", {
              match_limit: 20,
              offset_value: offset,
            });

          if (noTattooError) throw noTattooError;

          results = (moreNoTattooResults || []).map((item) => ({
            id: item.id || item.path,
            path: item.path,
            filename: item.path.split("/").pop(),
            noTattoo: true,
          }));

          responseText = `Here are ${results.length} more images without tattoos.`;
          break;

        default:
          throw new Error("Unknown search type for pagination");
      }

      // Remove loading message
      setCurrentMessages((prev) =>
        prev.filter(
          (msg) =>
            !(
              msg.sender === "system" &&
              msg.content === "Loading more images..."
            )
        )
      );

      // If no results found
      if (results.length === 0) {
        const noMoreMessage = {
          sender: "assistant",
          message_type: "assistant",
          content: "No more images found.",
          created_at: new Date().toISOString(),
        };

        setCurrentMessages((prev) => [...prev, noMoreMessage]);
        return;
      }

      // Add new message with more results
      const moreResultsMessage = {
        sender: "assistant",
        message_type: "assistant",
        content: responseText,
        created_at: new Date().toISOString(),
        isImageSearch: true,
        images: results,
        searchParams: {
          ...searchParams,
          currentPage: nextPage,
          hasMore: results.length >= 20, // Assume more if we hit the limit
        },
      };

      setCurrentMessages((prev) => [...prev, moreResultsMessage]);
    } catch (error) {
      console.error("Error getting more images:", error);

      // Remove loading message if exists
      setCurrentMessages((prev) =>
        prev.filter(
          (msg) =>
            !(
              msg.sender === "system" &&
              msg.content === "Loading more images..."
            )
        )
      );

      // Add error message
      const errorMessage = {
        sender: "system",
        message_type: "error",
        content: `Error loading more images: ${error.message}`,
        created_at: new Date().toISOString(),
      };

      setCurrentMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Handle file upload based on type
  const handleFileUpload = () => {
    if (!file) return;

    if (uploadType === "document" || !file.type.startsWith("image/")) {
      handleDocumentUpload();
    } else {
      handleImageSearch();
    }
  };

  // Add this function inside your ChatbotTabContent component
  const isImageSearchRequest = (message) => {
    const normalizedMessage = message.toLowerCase();

    // Image search keywords
    const searchPatterns = [
      /find|search|show|get|display/,
      /image(s)?|picture(s)?|photo(s)?/,
      /tattoo(s)?|tat(s)?/,
      /folder|directory|path/,
      /body part|arm|leg|back|chest|shoulder/,
      /similar|like|resemble/,
      /without tattoo|no tattoo/,
    ];

    // Count how many patterns match
    const matchCount = searchPatterns.filter((pattern) =>
      pattern.test(normalizedMessage)
    ).length;

    // If at least 2 patterns match, it's likely an image search request
    return matchCount >= 2;
  };

  // Add this function to parse search parameters
  const parseSearchQuery = (query) => {
    // Default search params
    const params = {
      type: "keyword",
      keyword: "",
      bodyPart: null,
      path: null,
      noTattoo: false,
      similarityPath: null,
      limit: 12,
    };

    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();

    // Check for folder/path search first as it's most specific
    if (
      normalizedQuery.includes("folder") ||
      normalizedQuery.includes("directory") ||
      normalizedQuery.includes("path") ||
      normalizedQuery.match(/\b(in|from|with)\s+[\w\/-]+/i) ||
      normalizedQuery.match(/images?\s+\w+\s+[\w\/-]+/i)
    ) {
      params.type = "path";

      // Try various patterns to extract path
      let pathMatch =
        normalizedQuery.match(/\b(?:in|from)\s+([\w\/-]+)/i) ||
        normalizedQuery.match(/folder\s+([\w\/-]+)/i) ||
        normalizedQuery.match(/path\s+([\w\/-]+)/i) ||
        normalizedQuery.match(/directory\s+([\w\/-]+)/i) ||
        normalizedQuery.match(/with\s+([\w\/-]+)/i) ||
        normalizedQuery.match(/images?\s+(?:in|from)\s+([\w\/-]+)/i) ||
        normalizedQuery.match(/images?\s+\w+\s+([\w\/-]+)/i); // catch "images containing xyz"

      // If we found a match, extract the path
      if (pathMatch && pathMatch[1]) {
        params.path = pathMatch[1];
        console.log("Found path in query:", params.path);
      } else {
        // No explicit path found, extract potential folder names from the query
        // by looking for words that could be folder names (2+ chars, alphanumeric/dash)
        const words = normalizedQuery.split(/\s+/);
        const potentialFolders = words.filter(
          (word) =>
            word.length >= 2 &&
            /^[\w\/-]+$/.test(word) &&
            ![
              "find",
              "show",
              "get",
              "search",
              "images",
              "pics",
              "photos",
              "with",
              "from",
              "for",
              "containing",
              "folder",
              "path",
              "directory",
            ].includes(word)
        );

        if (potentialFolders.length > 0) {
          // Use the longest word as it's more likely to be a specific folder name
          potentialFolders.sort((a, b) => b.length - a.length);
          params.path = potentialFolders[0];
          console.log("Extracted potential folder name:", params.path);
        }
      }
    }
    // Extract body part search
    else if (
      normalizedQuery.includes("body part") ||
      normalizedQuery.match(
        /\b(arm|leg|back|chest|face|neck|shoulder|hand|foot|ankle|thigh|calf|forearm|wrist)\b/i
      )
    ) {
      params.type = "bodyPart";

      // Find body part mentioned
      const bodyPartMatch = normalizedQuery.match(
        /\b(arm|arms|leg|legs|back|chest|face|neck|shoulder|shoulders|hand|hands|foot|feet|ankle|ankles|thigh|thighs|calf|calves|forearm|forearms|wrist|wrists)\b/i
      );

      if (bodyPartMatch && bodyPartMatch[1]) {
        // Normalize plural forms to singular
        let bodyPart = bodyPartMatch[1].toLowerCase();
        const pluralMap = {
          arms: "arm",
          legs: "leg",
          shoulders: "shoulder",
          hands: "hand",
          feet: "foot",
          ankles: "ankle",
          thighs: "thigh",
          calves: "calf",
          forearms: "forearm",
          wrists: "wrist",
        };

        params.bodyPart = pluralMap[bodyPart] || bodyPart;
      }
    }
    // Check for no-tattoo search
    else if (
      normalizedQuery.includes("no tattoo") ||
      normalizedQuery.includes("without tattoo") ||
      normalizedQuery.includes("non-tattoo") ||
      normalizedQuery.includes("clean skin") ||
      normalizedQuery.includes("no tat") ||
      normalizedQuery.includes("not tattooed")
    ) {
      params.type = "noTattoo";
      params.noTattoo = true;
    }
    // Check for similarity search
    else if (
      normalizedQuery.includes("similar") ||
      normalizedQuery.includes("like") ||
      normalizedQuery.includes("resembles") ||
      normalizedQuery.match(/similar\s+to\s+[\w\/-]+/i)
    ) {
      params.type = "similarity";

      // Try to find a path reference
      const pathMatch =
        normalizedQuery.match(/similar\s+to\s+([\w\/.-]+)/i) ||
        normalizedQuery.match(/like\s+([\w\/.-]+)/i) ||
        normalizedQuery.match(/resembles\s+([\w\/.-]+)/i);
      if (pathMatch && pathMatch[1]) {
        params.similarityPath = pathMatch[1];
      }
    }
    // Default to keyword search
    else {
      // Default to keyword search
      params.type = "keyword";
      params.keyword = normalizedQuery
        .replace(
          /show|find|search|me|for|images|with|tattoo[s]?|containing/gi,
          ""
        )
        .trim();
    }

    // Extract limit if specified
    const limitMatch = normalizedQuery.match(
      /\b(limit|show|find|get)\s+(\d+)\b/
    );
    if (limitMatch && limitMatch[2]) {
      const requestedLimit = parseInt(limitMatch[2]);
      params.limit =
        requestedLimit > 0 && requestedLimit <= 50 ? requestedLimit : 12;
    }

    console.log("Parsed search parameters:", params);
    return params;
  };

  // Function to process image search
  // Improved processImageSearch with better keyword handling
  const processImageSearch = async (query) => {
    try {
      console.log("Processing image search query:", query);

      // Parse query
      const searchParams = parseSearchQuery(query);
      let results = [];
      let responseText = "";

      console.log("Parsed search parameters:", searchParams);

      // Execute search based on type
      switch (searchParams.type) {
        case "keyword":
          // Improved keyword handling - split and filter meaningfully
          let keywords = searchParams.keyword
            .toLowerCase()
            .split(/\s+/)
            .filter((k) => k.length > 1)
            // Filter out common words that aren't useful for tattoo searches
            .filter(
              (k) =>
                ![
                  "the",
                  "and",
                  "with",
                  "for",
                  "me",
                  "please",
                  "show",
                  "get",
                  "of",
                ].includes(k)
            );

          // If no meaningful keywords left, extract tattoo-related terms
          if (keywords.length === 0) {
            const tattooTerms = query.match(
              /tattoo|ink|design|art|color|black|sleeve|tribal|script|portrait/gi
            );
            if (tattooTerms) {
              keywords = [...new Set(tattooTerms.map((t) => t.toLowerCase()))];
            } else {
              // Default to "tattoo" if no specific terms found
              keywords = ["tattoo"];
            }
          }

          console.log("Searching with keywords:", keywords);

          // Use search_images_by_keywords function
          const { data: keywordData, error: keywordError } = await supabase.rpc(
            "search_images_by_keywords",
            {
              search_terms: keywords,
              match_limit: searchParams.limit,
            }
          );

          if (keywordError) {
            console.error("Keyword search error:", keywordError);
            throw keywordError;
          }

          results = keywordData.map((item) => ({
            id: item.id || item.path,
            path: item.path,
            filename: item.path.split("/").pop(),
            matchScore: item.match_score,
            analysis: item.analysis,
          }));

          // Store the keywords in search params for pagination
          searchParams.keywords = keywords;

          responseText = `I found ${results.length} image${
            results.length === 1 ? "" : "s"
          } matching "${searchParams.keyword}".`;
          break;

        case "bodyPart":
          console.log("Searching for body part:", searchParams.bodyPart);

          // Use find_images_by_body_part function
          const { data: bodyPartData, error: bodyPartError } =
            await supabase.rpc("find_images_by_body_part", {
              body_part: searchParams.bodyPart,
              match_limit: searchParams.limit,
            });

          if (bodyPartError) {
            console.error("Body part search error:", bodyPartError);
            throw bodyPartError;
          }

          results = bodyPartData.map((item) => ({
            id: item.id || item.path,
            path: item.path,
            filename: item.path.split("/").pop(),
            bodyPart: searchParams.bodyPart,
            confidence: item.confidence || 0.8,
            analysis: item.analysis,
          }));

          responseText = `Here ${results.length === 1 ? "is" : "are"} ${
            results.length
          } image${results.length === 1 ? "" : "s"} with tattoos on the ${
            searchParams.bodyPart
          }.`;
          break;

        case "noTattoo":
          console.log("Searching for images without tattoos");

          // Use find_images_without_tattoos function
          const { data: noTattooData, error: noTattooError } =
            await supabase.rpc("find_images_without_tattoos", {
              match_limit: searchParams.limit,
            });

          if (noTattooError) {
            console.error("No tattoo search error:", noTattooError);
            throw noTattooError;
          }

          results = noTattooData.map((item) => ({
            id: item.id || item.path,
            path: item.path,
            filename: item.path.split("/").pop(),
            noTattoo: true,
            analysis: item.analysis,
          }));

          responseText = `Here ${results.length === 1 ? "is" : "are"} ${
            results.length
          } image${results.length === 1 ? "" : "s"} without tattoos.`;
          break;

        case "path":
          console.log("Searching for images by path:", searchParams.path);

          // Search by path using direct query
          const { data: pathData, error: pathError } = await supabase
            .from("image_embeddings")
            .select("id, image_path, embedding_type, created_at")
            .ilike("image_path", `%${searchParams.path}%`)
            .limit(searchParams.limit);

          if (pathError) {
            console.error("Path search error:", pathError);
            throw pathError;
          }

          // Remove duplicates by path
          const uniquePaths = {};
          results = pathData
            .filter((item) => {
              if (!uniquePaths[item.image_path]) {
                uniquePaths[item.image_path] = true;
                return true;
              }
              return false;
            })
            .map((item) => ({
              id: item.id,
              path: item.image_path,
              filename: item.image_path.split("/").pop(),
              type: item.embedding_type,
              created: item.created_at,
            }));

          responseText = `I found ${results.length} image${
            results.length === 1 ? "" : "s"
          } in the path containing "${searchParams.path}".`;
          break;

        case "similarity":
          if (!searchParams.similarityPath) {
            responseText =
              "I need a reference image to find similar images. Please specify an image path.";
            break;
          }

          console.log(
            "Searching for similar images to:",
            searchParams.similarityPath
          );

          // First get the embedding
          const { data: embeddingData, error: embeddingError } = await supabase
            .from("image_embeddings")
            .select("embedding_data")
            .eq("image_path", searchParams.similarityPath)
            .eq("embedding_type", "full")
            .limit(1)
            .single();

          if (embeddingError) {
            console.error("Embedding fetch error:", embeddingError);

            if (embeddingError.code === "PGRST116") {
              responseText = `I couldn't find the reference image at "${searchParams.similarityPath}".`;
              break;
            }
            throw embeddingError;
          }

          if (!embeddingData?.embedding_data?.embedding) {
            responseText = `The reference image doesn't have an embedding to compare with.`;
            break;
          }

          // Use search_images_by_embedding function
          const { data: similarityData, error: similarityError } =
            await supabase.rpc("search_images_by_embedding", {
              query_embedding: embeddingData.embedding_data.embedding,
              match_threshold: 0.65,
              match_limit: searchParams.limit,
            });

          if (similarityError) {
            console.error("Similarity search error:", similarityError);
            throw similarityError;
          }

          results = similarityData
            .filter((item) => item.image_path !== searchParams.similarityPath) // Remove reference image
            .map((item) => ({
              id: item.id,
              path: item.image_path,
              filename: item.image_path.split("/").pop(),
              similarity: item.similarity,
            }));

          responseText = `I found ${results.length} image${
            results.length === 1 ? "" : "s"
          } similar to the reference image.`;
          break;

        default:
          responseText =
            "I'm not sure what kind of image search you're looking for. Try being more specific.";
      }

      // If no results
      if (results.length === 0) {
        switch (searchParams.type) {
          case "keyword":
            responseText = `I couldn't find any images matching "${searchParams.keyword}". Try different keywords or check for typos.`;
            break;
          case "bodyPart":
            responseText = `I couldn't find any images with tattoos on the ${searchParams.bodyPart}. Try searching for a different body part.`;
            break;
          case "path":
            responseText = `I couldn't find any images in the path containing "${searchParams.path}". Try a different folder name.`;
            break;
          case "noTattoo":
            responseText = `I couldn't find any images without tattoos in our database.`;
            break;
          case "similarity":
            responseText = `I couldn't find any images similar to the one you specified.`;
            break;
        }
      }

      console.log(`Search completed. Found ${results.length} results.`);

      // Add pagination information
      const updatedSearchParams = {
        ...searchParams,
        currentPage: 0,
        hasMore: results.length >= searchParams.limit,
      };

      return {
        success: true,
        results,
        response: responseText,
        searchParams: updatedSearchParams,
      };
    } catch (error) {
      console.error("Error processing image search:", error);
      return {
        success: false,
        results: [],
        response: `I encountered an error while searching for images: ${error.message}`,
        error: error.message,
      };
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

      // Check if it's an image search request
      if (isImageSearchRequest(inputText)) {
        // First add a typing indicator
        const typingMessage = {
          sender: "system",
          message_type: "system",
          content: "Searching for images...",
          created_at: new Date().toISOString(),
        };

        setCurrentMessages((prev) => [...prev, typingMessage]);

        // Process the image search
        const result = await processImageSearch(inputText);

        // Remove the typing indicator
        setCurrentMessages((prev) =>
          prev.filter(
            (msg) =>
              !(
                msg.sender === "system" &&
                msg.content === "Searching for images..."
              )
          )
        );

        // Add assistant response with images
        const assistantMessage = {
          sender: "assistant",
          message_type: "assistant",
          content: result.response,
          created_at: new Date().toISOString(),
          thread_id: selectedThreadId || null,
          isImageSearch: true,
          images: result.results,
          searchParams: result.searchParams,
        };

        setCurrentMessages((prev) => [...prev, assistantMessage]);

        // Update selected thread ID if this is a new thread
        if (result.threadId && !selectedThreadId) {
          setSelectedThreadId(result.threadId);
          // Turn off new chat mode once we have a thread ID
          setIsNewChat(false);
        }
      } else {
        // Call API based on which mode is enabled
        let response;

        if (useZenoti) {
          // Zenoti-enhanced chat
          console.log("Using Zenoti integration for message:", inputText);

          // First add a typing indicator
          const typingMessage = {
            sender: "system",
            message_type: "system",
            content: "Searching Zenoti data...",
            created_at: new Date().toISOString(),
          };

          setCurrentMessages((prev) => [...prev, typingMessage]);

          // Make the API call
          const chatResponse = await fetch(
            `${apiService.utils.getBaseUrl()}/api/chat/zenoti`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: inputText,
                userId: currentUser?.id || "default-user",
              }),
            }
          );

          if (!chatResponse.ok) {
            throw new Error(
              `Zenoti chat request failed: ${chatResponse.status}`
            );
          }

          response = { data: await chatResponse.json() };

          // Remove the typing indicator
          setCurrentMessages((prev) =>
            prev.filter(
              (msg) =>
                !(
                  msg.sender === "system" &&
                  msg.content === "Searching Zenoti data..."
                )
            )
          );
        } else if (useInternet && chatSettings.showInternetSearch) {
          // Advanced chat with web search
          response = await apiService.chat.advanced(inputText, currentUser?.id);
        } else {
          // Regular chat
          const chatResponse = await fetch(
            `${apiService.utils.getBaseUrl()}/api/chat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: inputText,
                userId: currentUser?.id || "default-user",
              }),
            }
          );

          if (!chatResponse.ok) {
            throw new Error(`Chat request failed: ${chatResponse.status}`);
          }

          response = { data: await chatResponse.json() };
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
          // Turn off new chat mode once we have a thread ID
          setIsNewChat(false);
        }
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
  // Handle image view
  const handleImageView = (imagePath) => {
    if (!imagePath) {
      console.error("No image path provided");
      return;
    }

    // Ensure the path is properly formatted - remove leading slash if needed
    const normalizedPath =
      typeof imagePath === "string"
        ? imagePath.startsWith("/")
          ? imagePath.substring(1)
          : imagePath
        : "";

    if (!normalizedPath) {
      console.error("Invalid image path:", imagePath);
      return;
    }

    setCurrentViewImage(normalizedPath);
    setShowImageViewerModal(true);

    // Try to track analytics if available
    try {
      // Check if analytics helpers are available
      const analyticsHelpers = require("../../utils/analytics-helpers");
      if (
        analyticsHelpers &&
        analyticsHelpers.EVENT_TYPES &&
        analyticsHelpers.EVENT_TYPES.IMAGE_VIEW
      ) {
        analyticsHelpers.trackServerEvent(
          { headers: {} }, // Mock request object
          analyticsHelpers.EVENT_TYPES.IMAGE_VIEW,
          {
            imagePath: normalizedPath,
            userId: currentUser?.id || "default-user",
          }
        );
      } else {
        // Fallback tracking - just log to console
        console.log(
          "Image view event (analytics not available):",
          normalizedPath
        );
      }
    } catch (error) {
      // Silently handle errors in analytics to prevent breaking the UI
      console.warn("Error tracking image view:", error);
    }
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
    // Handle image search messages
    if (message.isImageSearch && message.images) {
      return (
        <ChatImageResults
          images={message.images}
          responseText={message.content}
          searchParams={message.searchParams}
          onImageClick={(image) => {
            console.log("Image clicked:", image);
            handleImageView(image.path);
          }}
          onSearchWithImage={(imagePath, searchQuery) => {
            // Set input text to search query
            setInputText(searchQuery);
          }}
          onCopyPath={(path) => {
            console.log(`Path copied: ${path}`);
          }}
          onGetMore={handleGetMoreImages} // Add this line
        />
      );
    }

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
            <FileText size={20} />
            <span>{message.file_name}</span>
          </div>
          <div>{message.content}</div>
        </div>
      );
    }

    // Handle HTML content with image links
    if (message.isHtml) {
      const processedContent = message.content
        .replace(/\[View Image\]\((.*?)\)/g, (match, path) => {
          const escapedPath = path.replace(/['\\]/g, "\\$&");
          return `<a href="#" class="view-image-link" data-path="${escapedPath}" onclick="event.preventDefault(); window.viewImage('${escapedPath}')">View Image</a>`;
        })
        .replace(
          /\/([^\/\s"']+\/)*[^\/\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
          (match) => {
            const encodedPath = encodeURIComponent(match);
            return `<a href="#" class="view-image-link" data-path="${match}" onclick="event.preventDefault(); window.viewImage('${match}')">View ${match}</a>`;
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

  // Separate component for advanced image loading with fallback
  // Improved ImageWithFetchFallback component to fix image loading issues
  const ImageWithFetchFallback = ({
    proxyUrl,
    fetchFunction,
    alt,
    fallbackSrc,
  }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      // Reset state when URL changes
      setLoading(true);
      setError(null);
      setImageSrc(null);

      // Instead of using fetchFunction which adds complexity, use a direct approach
      const img = new Image();

      // This correctly uses the absolute URL including the host
      const absoluteUrl = new URL(proxyUrl, window.location.origin).href;

      img.onload = () => {
        setImageSrc(absoluteUrl);
        setLoading(false);
      };

      img.onerror = (err) => {
        console.error("Image load failed:", absoluteUrl, err);
        setError(new Error(`Failed to load image: ${absoluteUrl}`));
        setLoading(false);
      };

      img.src = absoluteUrl;

      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }, [proxyUrl]);

    if (loading) {
      return <div className="image-loading">Loading...</div>;
    }

    if (error) {
      return (
        <img
          src={fallbackSrc}
          alt="Failed to load"
          className="error-image"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/placeholder-image.jpg";
          }}
        />
      );
    }

    return (
      <img
        src={imageSrc}
        alt={alt}
        className="search-result-image"
        onError={() => setError(new Error("Image load failed"))}
      />
    );
  };

  const testSupabaseConnection = async () => {
    try {
      // Test basic connection
      const { data, error } = await supabase
        .from("image_embeddings")
        .select("id", { count: "exact" }); // Use 'count: exact' to count rows correctly

      console.log("Supabase connection test:", { data, error });

      // Test function availability
      const { data: fnData, error: fnError } = await supabase.rpc(
        "search_images_by_keywords",
        { search_terms: ["test"], match_limit: 5 }
      );
      console.log("Function test:", { data: fnData, error: fnError });

      return !error && !fnError;
    } catch (e) {
      console.error("Connection test failed:", e);
      return false;
    }
  };

  // Add this with your other useEffect hooks
  useEffect(() => {
    testSupabaseConnection().then((success) => {
      console.log("Supabase test result:", success ? "SUCCESS" : "FAILED");
    });
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
                {/* Always show New Chat button, not conditionally rendered */}
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

            {/* Zenoti integration toggle - only show if enabled in settings */}
            {chatSettings.showZenotiIntegration && (
              <button
                className={`zenoti-toggle ${useZenoti ? "active" : ""}`}
                onClick={toggleZenoti}
                title={
                  useZenoti
                    ? "Zenoti integration enabled"
                    : "Enable Zenoti integration"
                }
              >
                <Calendar size={18} />
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
                  <label htmlFor="showZenotiIntegration">
                    Zenoti Integration
                  </label>
                  <input
                    type="checkbox"
                    id="showZenotiIntegration"
                    checked={chatSettings.showZenotiIntegration}
                    onChange={(e) =>
                      updateSetting("showZenotiIntegration", e.target.checked)
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
      </div>
    </div>
  );
};

export default ChatbotTabContent;
