import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import SlackMessaging from "../../utils/SlackMessaging";
import { RedisCache } from "../../utils/RedisCache";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import documentProcessor from "../../utils/DocumentProcessor";
import {
  Send,
  RefreshCw,
  Menu,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Plus,
  Paperclip,
  Image,
  FileText,
  Smile,
  Users,
  Settings,
  Info,
  Star,
  MessageCircle,
  Clock,
  BellOff,
  Pin,
  Share,
  Bookmark,
  Edit,
  Trash2,
  AlertCircle,
  X,
  CheckCircle,
  ArrowLeft,
  HelpCircle,
  Database,
} from "lucide-react";

const EnhancedSlackMessages = () => {
  // Navigation
  const navigate = useNavigate();

  // Theme context for proper styling
  const { currentTheme } = useTheme();

  // Core state
  const { currentUser } = useAuth();
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // UI state
  const [showChannels, setShowChannels] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Document processing state
  const [processingDocument, setProcessingDocument] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");

  // Advanced features
  const [messageReactions, setMessageReactions] = useState({});
  const [messageThreads, setMessageThreads] = useState({});
  const [activeThread, setActiveThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadReply, setThreadReply] = useState("");
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [draftMessages, setDraftMessages] = useState({});

  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const messageContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Load channels on mount
  useEffect(() => {
    const loadChannels = async () => {
      setLoading(true);
      try {
        // Try to get from cache first
        const cacheKey = `slack:channels:${currentUser?.id}`;
        const cachedChannels = await RedisCache.get(cacheKey);

        if (cachedChannels && Array.isArray(cachedChannels)) {
          setChannels(cachedChannels);

          // Select first channel by default if none selected
          if (cachedChannels.length > 0 && !selectedChannel) {
            setSelectedChannel(cachedChannels[0].id);
          }

          setLoading(false);

          // Fetch fresh data in background
          const freshChannels = await SlackMessaging.getChannels();

          // Only update if different
          if (
            JSON.stringify(freshChannels) !== JSON.stringify(cachedChannels)
          ) {
            setChannels(freshChannels);

            // Cache the updated channels for 30 minutes
            await RedisCache.set(cacheKey, freshChannels, 1800);
          }
        } else {
          // No cache, fetch directly
          const channels = await SlackMessaging.getChannels();
          setChannels(channels);

          // Select first channel by default
          if (channels.length > 0 && !selectedChannel) {
            setSelectedChannel(channels[0].id);
          }

          // Cache the channels for 30 minutes
          await RedisCache.set(cacheKey, channels, 1800);
        }
      } catch (err) {
        setError("Failed to load channels");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Initialize document processor
    const initDocProcessor = async () => {
      try {
        await documentProcessor.initialize();
      } catch (err) {
        console.error("Failed to initialize document processor:", err);
      }
    };

    loadChannels();
    initDocProcessor();

    // Initialize user preferences from localStorage
    const showChannelsPref = localStorage.getItem("slack_show_channels");
    if (showChannelsPref !== null) {
      setShowChannels(showChannelsPref === "true");
    }

    // Load draft messages
    const savedDrafts = localStorage.getItem("slack_draft_messages");
    if (savedDrafts) {
      try {
        setDraftMessages(JSON.parse(savedDrafts));
      } catch (e) {
        console.warn("Could not parse saved drafts:", e);
      }
    }
  }, [currentUser]);

  // Load messages when selected channel changes
  useEffect(() => {
    if (!selectedChannel) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        // Try to get from cache first for immediate display
        const cacheKey = `slack:messages:${selectedChannel}`;
        const cachedMessages = await RedisCache.get(cacheKey);

        if (cachedMessages && Array.isArray(cachedMessages)) {
          setMessages(cachedMessages);
          scrollToBottom();
          setLoading(false);
        }

        // Always fetch fresh messages
        const freshMessages = await SlackMessaging.getMessages(selectedChannel);

        // Mark channel as read
        const updatedUnreadMessages = { ...unreadMessages };
        delete updatedUnreadMessages[selectedChannel];
        setUnreadMessages(updatedUnreadMessages);

        // Only update state if messages are different
        if (JSON.stringify(freshMessages) !== JSON.stringify(cachedMessages)) {
          setMessages(freshMessages);
          scrollToBottom();

          // Cache for 5 minutes
          await RedisCache.set(cacheKey, freshMessages, 300);
        }

        // Restore draft message if available
        if (draftMessages[selectedChannel]) {
          setNewMessage(draftMessages[selectedChannel]);
        } else {
          setNewMessage("");
        }
      } catch (err) {
        setError("Failed to load messages");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Set up real-time subscription for new messages
    const messageSubscription = supabase
      .channel(`slack_messages_${selectedChannel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "slack_messages",
          filter: `channel_id=eq.${selectedChannel}`,
        },
        (payload) => {
          const newMessage = payload.new;

          // Skip if it's our own message (already in state)
          if (newMessage.user_id === currentUser?.id) return;

          // Add to messages
          setMessages((prev) => [...prev, newMessage]);

          // Update cache with new message
          const cacheKey = `slack:messages:${selectedChannel}`;
          RedisCache.get(cacheKey).then((cachedMessages) => {
            if (cachedMessages && Array.isArray(cachedMessages)) {
              RedisCache.set(cacheKey, [...cachedMessages, newMessage], 300);
            }
          });

          scrollToBottom();
        }
      )
      .subscribe();

    // Set up real-time subscription for typing indicators
    const typingSubscription = supabase
      .channel(`typing_${selectedChannel}`)
      .on("presence", { event: "sync" }, () => {
        const newState = typingSubscription.presenceState();
        const typingUsersList = Object.values(newState)
          .filter((presences) => presences.some((p) => p.isTyping))
          .map((presences) => presences[0].user)
          .filter((user) => user !== currentUser?.name);

        setTypingUsers(typingUsersList);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (newPresences.some((p) => p.isTyping)) {
          setTypingUsers((prev) => [
            ...prev.filter((u) => u !== newPresences[0].user),
            newPresences[0].user,
          ]);
        }
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        setTypingUsers((prev) =>
          prev.filter((u) => u !== leftPresences[0].user)
        );
      })
      .subscribe();

    // Send status that user viewed this channel
    const trackChannelView = async () => {
      try {
        const { error } = await supabase.from("slack_channel_views").insert({
          user_id: currentUser?.id,
          channel_id: selectedChannel,
          viewed_at: new Date().toISOString(),
        });

        if (error) throw error;
      } catch (err) {
        console.warn("Error tracking channel view:", err);
      }
    };

    trackChannelView();

    return () => {
      supabase.removeChannel(messageSubscription);
      supabase.removeChannel(typingSubscription);

      // Save draft message when channel changes
      if (newMessage.trim()) {
        setDraftMessages((prev) => {
          const updated = { ...prev, [selectedChannel]: newMessage };
          localStorage.setItem("slack_draft_messages", JSON.stringify(updated));
          return updated;
        });
      } else if (draftMessages[selectedChannel]) {
        // Remove draft if empty
        setDraftMessages((prev) => {
          const updated = { ...prev };
          delete updated[selectedChannel];
          localStorage.setItem("slack_draft_messages", JSON.stringify(updated));
          return updated;
        });
      }
    };
  }, [selectedChannel, currentUser]);

  // Effect for scrolling to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save show channels preference
  useEffect(() => {
    localStorage.setItem("slack_show_channels", showChannels);
  }, [showChannels]);

  // Detect typing status
  useEffect(() => {
    if (!selectedChannel) return;

    let typingTimeout;
    const handleTyping = () => {
      // Send typing indicator
      const channel = supabase.channel(`typing_${selectedChannel}`);
      channel.track({
        user: currentUser?.name,
        isTyping: true,
      });

      // Clear typing after 3 seconds of inactivity
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        channel.track({
          user: currentUser?.name,
          isTyping: false,
        });
      }, 3000);
    };

    if (messageInputRef.current) {
      messageInputRef.current.addEventListener("input", handleTyping);
    }

    return () => {
      if (messageInputRef.current) {
        messageInputRef.current.removeEventListener("input", handleTyping);
      }
      clearTimeout(typingTimeout);
    };
  }, [selectedChannel, messageInputRef, currentUser]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();

    if (!newMessage.trim() || !selectedChannel) return;

    try {
      await SlackMessaging.sendMessage(selectedChannel, newMessage);

      // Optimistically add message to the UI
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        channel_id: selectedChannel,
        text: newMessage,
        user_id: currentUser?.id,
        user_name: currentUser?.name || currentUser?.email,
        user_avatar: currentUser?.avatar || null,
        timestamp: new Date().toISOString(),
        is_self: true,
        is_sending: true,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage("");

      // Clear draft for this channel
      setDraftMessages((prev) => {
        const updated = { ...prev };
        delete updated[selectedChannel];
        localStorage.setItem("slack_draft_messages", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError("Failed to send message");
      console.error(err);
    }
  };

  const refreshMessages = async () => {
    if (!selectedChannel) return;

    setLoading(true);
    try {
      const messages = await SlackMessaging.getMessages(selectedChannel);
      setMessages(messages);
    } catch (err) {
      setError("Failed to refresh messages");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  const addReaction = async (messageId, emoji) => {
    try {
      // Optimistically update UI
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: [
          ...(prev[messageId] || []),
          {
            emoji,
            userId: currentUser?.id,
            name: currentUser?.name,
          },
        ],
      }));

      // Call API
      await SlackMessaging.addReaction(messageId, emoji);
    } catch (err) {
      console.error("Error adding reaction:", err);

      // Revert if it fails
      setMessageReactions((prev) => {
        const updated = { ...prev };
        updated[messageId] = (updated[messageId] || []).filter(
          (r) => !(r.emoji === emoji && r.userId === currentUser?.id)
        );
        if (updated[messageId].length === 0) {
          delete updated[messageId];
        }
        return updated;
      });
    }
  };

  const pinMessage = async (messageId) => {
    try {
      // Find the message
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      // Optimistically update UI
      setPinnedMessages((prev) => [...prev, message]);

      // Call API
      await SlackMessaging.pinMessage(messageId);
    } catch (err) {
      console.error("Error pinning message:", err);

      // Revert if it fails
      setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const startThread = (messageId) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    setActiveThread(messageId);
    setThreadMessages(messageThreads[messageId] || []);
  };

  const sendThreadReply = async () => {
    if (!threadReply.trim() || !activeThread) return;

    try {
      // Optimistically update UI
      const optimisticReply = {
        id: `temp-${Date.now()}`,
        parent_id: activeThread,
        text: threadReply,
        user_id: currentUser?.id,
        user_name: currentUser?.name || currentUser?.email,
        user_avatar: currentUser?.avatar || null,
        timestamp: new Date().toISOString(),
        is_self: true,
      };

      setThreadMessages((prev) => [...prev, optimisticReply]);

      // Update threads state
      setMessageThreads((prev) => ({
        ...prev,
        [activeThread]: [...(prev[activeThread] || []), optimisticReply],
      }));

      setThreadReply("");

      // Call API
      await SlackMessaging.sendThreadReply(activeThread, threadReply);
    } catch (err) {
      console.error("Error sending thread reply:", err);
      setError("Failed to send reply");

      // Revert optimistic update
      setThreadMessages((prev) =>
        prev.filter((m) => m.id !== `temp-${Date.now()}`)
      );
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      setLoading(true);
      const channel = await SlackMessaging.createChannel(newChannelName);

      // Update channels list
      setChannels((prev) => [...prev, channel]);

      // Select the new channel
      setSelectedChannel(channel.id);

      // Close dialog
      setShowAddChannelDialog(false);
      setNewChannelName("");
    } catch (err) {
      console.error("Error creating channel:", err);
      setError("Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) {
      return "just now";
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  // Search messages
  const searchMessages = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const results = await SlackMessaging.searchMessages(searchQuery);

      // Display results
      setMessages(results);

      // Change UI to search mode
      setShowSearch(true);
    } catch (err) {
      console.error("Error searching messages:", err);
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Get channel name for display
  const getChannelName = (channelId) => {
    const channel = channels.find((c) => c.id === channelId);
    return channel ? channel.name : "Unknown Channel";
  };

  // Get channel type for display (general, knowledge, etc.)
  const getChannelType = (channelId) => {
    const channel = channels.find((c) => c.id === channelId);
    return channel?.type || "general";
  };

  // Handle key press in message input
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Process document for knowledge base
  const processDocumentForKnowledgeBase = async (file, messageId = null) => {
    try {
      setProcessingDocument(true);
      setProcessingProgress(0);
      setProcessingStatus("Starting document processing...");

      // Update progress function to track status
      const updateProgress = (stage, progress) => {
        setProcessingProgress(progress);
        setProcessingStatus(stage);
      };

      // Update progress to 10%
      updateProgress("Validating document...", 10);

      // First validate the file
      const validation = documentProcessor.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Update progress to 20%
      updateProgress("Uploading document...", 20);

      // Get user ID for tracking
      const userId = currentUser?.id;

      // Process and upload the document
      const uploadResult = await documentProcessor.processAndUploadDocument(
        file,
        "documents",
        { userId }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to process document");
      }

      // Update progress to 60%
      updateProgress("Extracting document content...", 60);

      // Update progress to 80%
      updateProgress("Adding to knowledge base...", 80);

      // If we have a messageId, update the message with the document link
      if (messageId) {
        // This would be implemented based on your API structure
        // e.g., SlackMessaging.updateMessageWithDocument(messageId, uploadResult.filePath);
      }

      // Update progress to 100%
      updateProgress("Document processed successfully!", 100);

      // Wait a moment before hiding the progress
      setTimeout(() => {
        setProcessingDocument(false);
      }, 2000);

      return uploadResult;
    } catch (error) {
      console.error("Error processing document:", error);
      setProcessingStatus(`Error: ${error.message}`);
      setProcessingProgress(0);

      // Wait a moment before hiding the error
      setTimeout(() => {
        setProcessingDocument(false);
      }, 3000);

      throw error;
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);

      // Determine if we should process for knowledge base
      const shouldProcess =
        file.type === "application/pdf" ||
        file.type.includes("word") ||
        file.type.includes("text") ||
        file.name.endsWith(".csv");

      // Generate a unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      let attachmentInfo = {
        text: `Shared a file: ${file.name}`,
        attachment_type: file.type.startsWith("image/") ? "image" : "file",
        original_filename: file.name,
      };

      // If it's a document we should process for knowledge base
      if (shouldProcess) {
        try {
          // Process the document
          await processDocumentForKnowledgeBase(file);

          // Update the message text to indicate it was added to knowledge base
          attachmentInfo.text = `Added document to knowledge base: ${file.name}`;
          attachmentInfo.added_to_kb = true;
        } catch (processError) {
          console.error("Error processing document:", processError);
          // Continue with regular upload if processing fails
        }
      }

      // Upload to storage
      const { data, error } = await supabase.storage
        .from("slack_attachments")
        .upload(`${selectedChannel}/${fileName}`, file);

      if (error) throw error;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("slack_attachments")
        .getPublicUrl(`${selectedChannel}/${fileName}`);

      // Add URL to attachment info
      attachmentInfo.attachment_url = publicUrl;

      // Send message with attachment
      await SlackMessaging.sendAttachment(selectedChannel, attachmentInfo);

      setShowAttachmentMenu(false);
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const getChannelAdminStatus = (channelId) => {
    const channel = channels.find((c) => c.id === channelId);
    return channel?.admin_only || false;
  };

  // Navigate back to admin panel
  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  // Determine if current user is an admin
  const isUserAdmin = () => {
    return (
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin")
    );
  };

  return (
    <div
      className="slack-messages-container"
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-text)",
        minHeight: "100vh",
      }}
    >
      <div
        className="messages-header"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          minHeight: "15vh",
        }}
      >
        <div className="header-left">
          <button
            className="back-button"
            onClick={handleBackToAdmin}
            title="Back to Admin"
            style={{
              background: "none",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--color-primary)",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "4px",
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Admin</span>
          </button>
        </div>

        {!showChannels && (
          <button
            className="menu-button"
            onClick={() => setShowChannels(true)}
            title="Show channels"
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            <Menu size={20} />
          </button>
        )}

        <div
          className="channel-info"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              padding: "0 20px",

              color: "var(--color-text-primary)",
            }}
          >
            #{" "}
            {selectedChannel
              ? getChannelName(selectedChannel)
              : "Select a channel"}
            {getChannelAdminStatus(selectedChannel) && (
              <span
                style={{
                  fontSize: "0.75rem",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: "12px",
                  marginLeft: "8px",
                }}
              >
                Admin Only
              </span>
            )}
            {getChannelType(selectedChannel) === "knowledge" && (
              <span
                style={{
                  fontSize: "0.75rem",
                  backgroundColor: "var(--color-success)",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: "12px",
                  marginLeft: "8px",
                }}
              >
                Knowledge
              </span>
            )}
          </h2>

          {selectedChannel && (
            <button
              className="channel-info-button"
              onClick={() => setShowChannelInfo(!showChannelInfo)}
              style={{
                background: "none",
                border: "none",
                padding: "4px",
                marginLeft: "8px",
                color: "var(--color-text-secondary)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <Info size={16} />
            </button>
          )}
        </div>

        <div
          className="header-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0 20px",
            justifyItems: "space-between",
          }}
        >
          <button
            className="action-button search-button"
            onClick={() => setShowSearch(!showSearch)}
            title="Search messages"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              width: "36px",
              height: "36px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <Search size={18} />
          </button>

          <button
            className="action-button refresh-button"
            onClick={refreshMessages}
            disabled={loading}
            title="Refresh"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              width: "36px",
              height: "36px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <RefreshCw size={18} className={loading ? "spinning" : ""} />
          </button>

          <button
            className="action-button help-button"
            onClick={() => setShowHelp(!showHelp)}
            title="Help"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              width: "36px",
              height: "36px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div
          className="search-bar"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 20px",
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMessages()}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              outline: "none",
              fontSize: "0.9rem",
              backgroundColor: "var(--color-background)",
            }}
          />
          <button
            onClick={searchMessages}
            style={{
              background: "none",
              border: "none",
              padding: "8px",
              marginLeft: "5px",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
            }}
          >
            <Search size={16} />
          </button>
          <button
            className="close-search"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
              refreshMessages();
            }}
            style={{
              background: "rgba(0, 0, 0, 0.05)",
              border: "none",
              padding: "8px",
              marginLeft: "5px",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showHelp && (
        <div
          className="help-panel"
          style={{
            padding: "15px 20px",
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "0.9rem",
            color: "var(--color-text-secondary)",
            position: "relative",
          }}
        >
          <button
            onClick={() => setShowHelp(false)}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>

          <h3
            style={{ margin: "0 0 10px 0", color: "var(--color-text-primary)" }}
          >
            Using the Messaging System
          </h3>

          <ul style={{ padding: "0 0 0 20px", margin: "0" }}>
            <li style={{ marginBottom: "8px" }}>
              <strong>General Channels</strong> - For normal communication
              within your organization.
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Knowledge Channels</strong> - Files shared here are
              automatically added to your knowledge base.
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Admin Channels</strong> - Only visible to administrators.
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Sharing Documents</strong> - Upload PDF, Word, or text
              files to add them to your knowledge base.
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Channel Management</strong> - Administrators can create
              new channels for specific topics.
            </li>
          </ul>
        </div>
      )}

      <div
        className="messages-content"
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
          minHeight: "85vh",
        }}
      >
        {showChannels && (
          <div
            className="channels-sidebar"
            style={{
              width: "260px",
              backgroundColor: "var(--color-surface)",
              borderRight: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              transition: "width 0.3s ease",
            }}
          >
            <div
              className="channels-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "15px",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  color: "var(--color-text-primary)",
                  fontWeight: 600,
                }}
              >
                Channels
              </h3>

              {isUserAdmin() && (
                <button
                  className="add-channel-button"
                  onClick={() => setShowAddChannelDialog(true)}
                  title="Add channel"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-secondary)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div
              className="channel-sections"
              style={{
                padding: "8px 0 0 0",
                margin: 0,
                overflowY: "auto",
                flex: 1,
              }}
            >
              <div className="channel-section">
                <div
                  className="section-header"
                  style={{
                    padding: "2px 15px 6px 15px",
                    fontSize: "0.8rem",
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  General Channels
                </div>
                <ul
                  className="channels-list"
                  style={{
                    listStyle: "none",
                    padding: "0 0 12px 0",
                    margin: 0,
                  }}
                >
                  {channels
                    .filter(
                      (c) => !c.admin_only && (!c.type || c.type === "general")
                    )
                    .map((channel) => (
                      <li
                        key={channel.id}
                        className={`
                        channel-item 
                        ${selectedChannel === channel.id ? "active" : ""}
                        ${unreadMessages[channel.id] ? "unread" : ""}
                      `}
                        onClick={() => {
                          setSelectedChannel(channel.id);
                          setActiveThread(null);
                          if (window.innerWidth < 768) {
                            setShowChannels(false);
                          }
                        }}
                        style={{
                          padding: "6px 15px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          color:
                            selectedChannel === channel.id
                              ? "white"
                              : "var(--color-text-secondary)",
                          borderRadius: 0,
                          margin: "1px 0",
                          backgroundColor:
                            selectedChannel === channel.id
                              ? "var(--color-primary)"
                              : "transparent",
                        }}
                      >
                        <div
                          className="channel-name"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            className="channel-prefix"
                            style={{
                              color:
                                selectedChannel === channel.id
                                  ? "rgba(255, 255, 255, 0.8)"
                                  : "var(--color-text-secondary)",
                              fontWeight: "normal",
                            }}
                          >
                            #
                          </span>{" "}
                          {channel.name}
                        </div>

                        {unreadMessages[channel.id] && (
                          <div
                            className="unread-badge"
                            style={{
                              backgroundColor:
                                selectedChannel === channel.id
                                  ? "white"
                                  : "var(--color-primary)",
                              color:
                                selectedChannel === channel.id
                                  ? "var(--color-primary)"
                                  : "white",
                              borderRadius: "12px",
                              padding: "2px 6px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              minWidth: "18px",
                              textAlign: "center",
                            }}
                          >
                            {unreadMessages[channel.id]}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </div>

              <div className="channel-section">
                <div
                  className="section-header"
                  style={{
                    padding: "2px 15px 6px 15px",
                    fontSize: "0.8rem",
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Database size={12} />
                  Knowledge Base Channels
                </div>
                <ul
                  className="channels-list"
                  style={{
                    listStyle: "none",
                    padding: "0 0 12px 0",
                    margin: 0,
                  }}
                >
                  {channels
                    .filter((c) => c.type === "knowledge")
                    .map((channel) => (
                      <li
                        key={channel.id}
                        className={`
                        channel-item 
                        ${selectedChannel === channel.id ? "active" : ""}
                        ${unreadMessages[channel.id] ? "unread" : ""}
                      `}
                        onClick={() => {
                          setSelectedChannel(channel.id);
                          setActiveThread(null);
                          if (window.innerWidth < 768) {
                            setShowChannels(false);
                          }
                        }}
                        style={{
                          padding: "6px 15px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          color:
                            selectedChannel === channel.id
                              ? "white"
                              : "var(--color-text-secondary)",
                          borderRadius: 0,
                          margin: "1px 0",
                          backgroundColor:
                            selectedChannel === channel.id
                              ? "var(--color-success)"
                              : "transparent",
                        }}
                      >
                        <div
                          className="channel-name"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            className="channel-prefix"
                            style={{
                              color:
                                selectedChannel === channel.id
                                  ? "rgba(255, 255, 255, 0.8)"
                                  : "var(--color-text-secondary)",
                              fontWeight: "normal",
                            }}
                          >
                            #
                          </span>{" "}
                          {channel.name}
                        </div>

                        {unreadMessages[channel.id] && (
                          <div
                            className="unread-badge"
                            style={{
                              backgroundColor:
                                selectedChannel === channel.id
                                  ? "white"
                                  : "var(--color-success)",
                              color:
                                selectedChannel === channel.id
                                  ? "var(--color-success)"
                                  : "white",
                              borderRadius: "12px",
                              padding: "2px 6px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              minWidth: "18px",
                              textAlign: "center",
                            }}
                          >
                            {unreadMessages[channel.id]}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </div>

              {isUserAdmin() && (
                <div className="channel-section">
                  <div
                    className="section-header"
                    style={{
                      padding: "2px 15px 6px 15px",
                      fontSize: "0.8rem",
                      color: "var(--color-text-secondary)",
                      fontWeight: 500,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    Admin Only
                  </div>
                  <ul
                    className="channels-list"
                    style={{
                      listStyle: "none",
                      padding: "0 0 12px 0",
                      margin: 0,
                    }}
                  >
                    {channels
                      .filter((c) => c.admin_only)
                      .map((channel) => (
                        <li
                          key={channel.id}
                          className={`
                          channel-item 
                          ${selectedChannel === channel.id ? "active" : ""}
                          ${unreadMessages[channel.id] ? "unread" : ""}
                        `}
                          onClick={() => {
                            setSelectedChannel(channel.id);
                            setActiveThread(null);
                            if (window.innerWidth < 768) {
                              setShowChannels(false);
                            }
                          }}
                          style={{
                            padding: "6px 15px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            color:
                              selectedChannel === channel.id
                                ? "white"
                                : "var(--color-text-secondary)",
                            borderRadius: 0,
                            margin: "1px 0",
                            backgroundColor:
                              selectedChannel === channel.id
                                ? "var(--color-primary)"
                                : "transparent",
                          }}
                        >
                          <div
                            className="channel-name"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              className="channel-prefix"
                              style={{
                                color:
                                  selectedChannel === channel.id
                                    ? "rgba(255, 255, 255, 0.8)"
                                    : "var(--color-text-secondary)",
                                fontWeight: "normal",
                              }}
                            >
                              #
                            </span>{" "}
                            {channel.name}
                          </div>

                          {unreadMessages[channel.id] && (
                            <div
                              className="unread-badge"
                              style={{
                                backgroundColor:
                                  selectedChannel === channel.id
                                    ? "white"
                                    : "var(--color-primary)",
                                color:
                                  selectedChannel === channel.id
                                    ? "var(--color-primary)"
                                    : "white",
                                borderRadius: "12px",
                                padding: "2px 6px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                minWidth: "18px",
                                textAlign: "center",
                              }}
                            >
                              {unreadMessages[channel.id]}
                            </div>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            <div
              className="sidebar-footer"
              style={{
                padding: "12px",
                display: "flex",
                justifyContent: "flex-end",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <button
                className="collapse-sidebar"
                onClick={() => setShowChannels(false)}
                title="Collapse sidebar"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  width: "30px",
                  height: "30px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>
        )}

        <div
          className="messages-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backgroundColor: "var(--color-background)",
            position: "relative",
          }}
        >
          {activeThread ? (
            <div
              className="thread-view"
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                backgroundColor: "var(--color-background)",
              }}
            >
              <div
                className="thread-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                <button
                  className="back-button"
                  onClick={() => setActiveThread(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "var(--color-text-secondary)",
                    padding: "5px 10px",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                  }}
                >
                  <ChevronLeft size={20} />
                  <span>Back to channel</span>
                </button>

                <h3
                  style={{
                    margin: "0 0 0 auto",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Thread
                </h3>
              </div>

              <div
                className="thread-messages"
                ref={messageContainerRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px",
                }}
              >
                {/* Parent message */}
                {messages.find((m) => m.id === activeThread) && (
                  <div
                    className={`parent-message message-item ${
                      messages.find((m) => m.id === activeThread).is_self
                        ? "self"
                        : ""
                    }`}
                    style={{
                      marginBottom: "20px",
                      paddingBottom: "20px",
                      borderBottom: "1px solid var(--color-border)",
                      display: "flex",
                    }}
                  >
                    <img
                      src={
                        messages.find((m) => m.id === activeThread)
                          .user_avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          messages.find((m) => m.id === activeThread).user_name
                        )}&background=random`
                      }
                      alt={
                        messages.find((m) => m.id === activeThread).user_name
                      }
                      className="user-avatar"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "4px",
                        marginRight: "12px",
                        objectFit: "cover",
                        backgroundColor: "#e1e1e1",
                      }}
                    />
                    <div
                      className="message-content"
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        className="message-header"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          className="user-name"
                          style={{
                            fontWeight: 600,
                            color: "var(--color-text-primary)",
                            marginRight: "8px",
                          }}
                        >
                          {
                            messages.find((m) => m.id === activeThread)
                              .user_name
                          }
                        </span>
                        <span
                          className="timestamp"
                          style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {formatTimestamp(
                            messages.find((m) => m.id === activeThread)
                              .timestamp
                          )}
                        </span>
                      </div>
                      <div
                        className="message-text"
                        style={{
                          color: "var(--color-text-primary)",
                          fontSize: "0.95rem",
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {messages.find((m) => m.id === activeThread).text}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="replies-divider"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    margin: "20px 0",
                    color: "var(--color-text-secondary)",
                    fontSize: "0.9rem",
                  }}
                >
                  <div
                    className="divider-line"
                    style={{
                      flex: 1,
                      height: "1px",
                      backgroundColor: "var(--color-border)",
                    }}
                  ></div>
                  <span style={{ padding: "0 15px" }}>Replies</span>
                  <div
                    className="divider-line"
                    style={{
                      flex: 1,
                      height: "1px",
                      backgroundColor: "var(--color-border)",
                    }}
                  ></div>
                </div>

                {/* Thread replies */}
                {threadMessages.length === 0 ? (
                  <div
                    className="no-replies"
                    style={{
                      textAlign: "center",
                      padding: "30px 0",
                      color: "var(--color-text-secondary)",
                      fontStyle: "italic",
                    }}
                  >
                    No replies yet
                  </div>
                ) : (
                  threadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message-item ${msg.is_self ? "self" : ""}`}
                      style={{
                        display: "flex",
                        marginBottom: "16px",
                      }}
                    >
                      <img
                        src={
                          msg.user_avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            msg.user_name
                          )}&background=random`
                        }
                        alt={msg.user_name}
                        className="user-avatar"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "4px",
                          marginRight: "12px",
                          objectFit: "cover",
                          backgroundColor: "#e1e1e1",
                        }}
                      />
                      <div
                        className="message-content"
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          className="message-header"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            className="user-name"
                            style={{
                              fontWeight: 600,
                              color: "var(--color-text-primary)",
                              marginRight: "8px",
                            }}
                          >
                            {msg.user_name}
                          </span>
                          <span
                            className="timestamp"
                            style={{
                              color: "var(--color-text-secondary)",
                              fontSize: "0.8rem",
                            }}
                          >
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>
                        <div
                          className="message-text"
                          style={{
                            color: "var(--color-text-primary)",
                            fontSize: "0.95rem",
                            lineHeight: 1.5,
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <div ref={messagesEndRef} />
              </div>

              <form
                className="thread-input-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendThreadReply();
                }}
                style={{
                  display: "flex",
                  padding: "15px 20px",
                  borderTop: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                <input
                  type="text"
                  value={threadReply}
                  onChange={(e) => setThreadReply(e.target.value)}
                  placeholder="Reply to thread..."
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    outline: "none",
                    marginRight: "10px",
                    fontSize: "0.95rem",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !threadReply.trim()}
                  style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: threadReply.trim() ? "pointer" : "not-allowed",
                    opacity: threadReply.trim() ? 1 : 0.6,
                  }}
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          ) : (
            <>
              <div
                className="messages-list"
                ref={messageContainerRef}
                style={{
                  flex: 1,
                  padding: "15px 20px",
                  overflowY: "auto",
                  position: "relative",
                }}
              >
                {showChannelInfo && (
                  <div
                    className="channel-info-panel"
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: "320px",
                      height: "100%",
                      backgroundColor: "var(--color-surface)",
                      borderLeft: "1px solid var(--color-border)",
                      padding: "20px",
                      overflowY: "auto",
                      zIndex: 5,
                      animation: "slideIn 0.2s ease",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                        fontSize: "1.1rem",
                        color: "var(--color-text-primary)",
                        paddingBottom: "10px",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      About #{getChannelName(selectedChannel)}
                    </h3>

                    <div
                      className="channel-description"
                      style={{
                        margin: "15px 0",
                        color: "var(--color-text-secondary)",
                        fontSize: "0.95rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {channels.find((c) => c.id === selectedChannel)
                        ?.description || "No description set"}

                      {getChannelType(selectedChannel) === "knowledge" && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "8px",
                            backgroundColor: "rgba(16, 185, 129, 0.1)",
                            borderLeft: "3px solid var(--color-success)",
                            borderRadius: "0 4px 4px 0",
                          }}
                        >
                          <strong>Knowledge Channel:</strong> Files shared here
                          are automatically added to your organization's
                          knowledge base.
                        </div>
                      )}

                      {getChannelAdminStatus(selectedChannel) && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "8px",
                            backgroundColor: "rgba(79, 70, 229, 0.1)",
                            borderLeft: "3px solid var(--color-primary)",
                            borderRadius: "0 4px 4px 0",
                          }}
                        >
                          <strong>Admin Channel:</strong> Only administrators
                          can view and post in this channel.
                        </div>
                      )}
                    </div>

                    <div
                      className="channel-stats"
                      style={{
                        margin: "20px 0",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div
                        className="stat-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          color: "var(--color-text-secondary)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <Users size={16} />
                        <span>
                          {channels.find((c) => c.id === selectedChannel)
                            ?.member_count || 0}{" "}
                          members
                        </span>
                      </div>
                      <div
                        className="stat-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          color: "var(--color-text-secondary)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <MessageCircle size={16} />
                        <span>{messages.length} messages</span>
                      </div>
                      <div
                        className="stat-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          color: "var(--color-text-secondary)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <Clock size={16} />
                        <span>
                          Created on{" "}
                          {new Date(
                            channels.find((c) => c.id === selectedChannel)
                              ?.created_at || Date.now()
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {pinnedMessages.length > 0 && (
                      <div
                        className="pinned-messages"
                        style={{
                          marginTop: "20px",
                        }}
                      >
                        <h4
                          style={{
                            fontSize: "1rem",
                            marginBottom: "10px",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          Pinned Messages
                        </h4>
                        {pinnedMessages.map((msg) => (
                          <div
                            key={`pinned-${msg.id}`}
                            className="pinned-message"
                            style={{
                              backgroundColor: "rgba(0, 0, 0, 0.02)",
                              borderLeft: "3px solid var(--color-primary)",
                              padding: "10px",
                              marginBottom: "10px",
                              borderRadius: "0 4px 4px 0",
                            }}
                          >
                            <div
                              className="pinned-content"
                              style={{
                                marginBottom: "5px",
                                color: "var(--color-text-primary)",
                                fontSize: "0.9rem",
                              }}
                            >
                              {msg.text}
                            </div>
                            <div
                              className="pinned-by"
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              Pinned by {msg.pinned_by || "unknown"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      className="close-info"
                      onClick={() => setShowChannelInfo(false)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px",
                        marginTop: "20px",
                        border: "none",
                        backgroundColor: "var(--color-text-secondary)",
                        color: "white",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: 500,
                        transition: "background-color 0.2s",
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}

                {messages.length === 0 ? (
                  <div
                    className="no-messages"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--color-text-secondary)",
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    {loading ? (
                      <div
                        className="loading-messages"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "15px",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        <RefreshCw
                          size={24}
                          className="spinning"
                          style={{
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        <p>Loading messages...</p>
                      </div>
                    ) : (
                      <>
                        <MessageCircle
                          size={32}
                          style={{ opacity: 0.6, marginBottom: "15px" }}
                        />
                        <p style={{ margin: "5px 0", fontSize: "1rem" }}>
                          No messages yet in #{getChannelName(selectedChannel)}
                        </p>
                        <p
                          className="sub-text"
                          style={{
                            margin: "5px 0",
                            fontSize: "0.9rem",
                            opacity: 0.7,
                          }}
                        >
                          Be the first to send a message!
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={`
                        message-item 
                        ${msg.is_self ? "self" : ""} 
                        ${msg.is_sending ? "sending" : ""}
                        ${msg.pinned ? "pinned" : ""}
                      `}
                      style={{
                        display: "flex",
                        marginBottom: "16px",
                        position: "relative",
                        backgroundColor: msg.is_self
                          ? "rgba(var(--color-primary-rgb, 79, 70, 229), 0.05)"
                          : "transparent",
                        padding: "8px",
                        borderRadius: "8px",
                      }}
                    >
                      <img
                        src={
                          msg.user_avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            msg.user_name
                          )}&background=random`
                        }
                        alt={msg.user_name}
                        className="user-avatar"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "4px",
                          marginRight: "12px",
                          objectFit: "cover",
                          backgroundColor: "#e1e1e1",
                        }}
                      />
                      <div
                        className="message-content"
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          className="message-header"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            className="user-name"
                            style={{
                              fontWeight: 600,
                              color: "var(--color-text-primary)",
                              marginRight: "8px",
                            }}
                          >
                            {msg.user_name}
                          </span>
                          <span
                            className="timestamp"
                            style={{
                              color: "var(--color-text-secondary)",
                              fontSize: "0.8rem",
                            }}
                          >
                            {formatTimestamp(msg.timestamp)}
                          </span>

                          {msg.is_sending && (
                            <span
                              className="sending-indicator"
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--color-text-secondary)",
                                fontStyle: "italic",
                                marginLeft: "8px",
                              }}
                            >
                              Sending...
                            </span>
                          )}

                          {msg.added_to_kb && (
                            <span
                              style={{
                                fontSize: "0.8rem",
                                backgroundColor: "var(--color-success)",
                                color: "white",
                                padding: "2px 6px",
                                borderRadius: "12px",
                                marginLeft: "8px",
                              }}
                            >
                              Added to KB
                            </span>
                          )}
                        </div>
                        <div
                          className="message-text"
                          style={{
                            color: "var(--color-text-primary)",
                            fontSize: "0.95rem",
                            lineHeight: 1.5,
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {msg.text}
                        </div>

                        {msg.attachment_url && (
                          <div
                            className="message-attachment"
                            style={{
                              marginTop: "10px",
                              maxWidth: "100%",
                            }}
                          >
                            {msg.attachment_type === "image" ? (
                              <div
                                className="image-preview"
                                style={{
                                  maxWidth: "360px",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <img
                                  src={msg.attachment_url}
                                  alt="Attached image"
                                  onClick={() =>
                                    window.open(msg.attachment_url, "_blank")
                                  }
                                  style={{
                                    maxWidth: "100%",
                                    display: "block",
                                    cursor: "pointer",
                                  }}
                                />
                              </div>
                            ) : (
                              <div
                                className="file-attachment"
                                style={{
                                  display: "inline-block",
                                  padding: "8px 12px",
                                  backgroundColor: "rgba(0, 0, 0, 0.05)",
                                  borderRadius: "4px",
                                  fontSize: "0.9rem",
                                }}
                              >
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "var(--color-primary)",
                                    textDecoration: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <FileText size={16} />
                                  {msg.original_filename || "Attached file"}
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message reactions */}
                        {messageReactions[msg.id] &&
                          messageReactions[msg.id].length > 0 && (
                            <div
                              className="message-reactions"
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                                marginTop: "8px",
                              }}
                            >
                              {Object.entries(
                                messageReactions[msg.id].reduce((acc, r) => {
                                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([emoji, count]) => (
                                <div
                                  key={`${msg.id}-${emoji}`}
                                  className="reaction-badge"
                                  onClick={() => addReaction(msg.id, emoji)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 6px",
                                    borderRadius: "12px",
                                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease",
                                  }}
                                >
                                  <span
                                    className="reaction-emoji"
                                    style={{
                                      fontSize: "0.9rem",
                                      marginRight: "4px",
                                    }}
                                  >
                                    {emoji}
                                  </span>
                                  <span
                                    className="reaction-count"
                                    style={{
                                      fontSize: "0.8rem",
                                      color: "var(--color-text-secondary)",
                                    }}
                                  >
                                    {count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                        {/* Thread preview */}
                        {messageThreads[msg.id] &&
                          messageThreads[msg.id].length > 0 && (
                            <div
                              className="thread-preview"
                              onClick={() => startThread(msg.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                marginTop: "8px",
                                padding: "4px 8px",
                                backgroundColor: "rgba(0, 0, 0, 0.03)",
                                borderRadius: "12px",
                                cursor: "pointer",
                                color: "var(--color-text-primary)",
                                fontSize: "0.8rem",
                                transition: "background-color 0.2s ease",
                              }}
                            >
                              <MessageCircle size={14} />
                              <span>
                                {messageThreads[msg.id].length} replies
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Message actions */}
                      <div
                        className="message-actions"
                        style={{
                          position: "absolute",
                          top: "-14px",
                          right: "10px",
                          display: "none",
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "4px",
                          boxShadow: "0 1px 5px rgba(0, 0, 0, 0.1)",
                          zIndex: 2,
                        }}
                      >
                        <button
                          className="message-action"
                          onClick={() => setShowEmojiPicker(msg.id)}
                          title="Add reaction"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "5px",
                            cursor: "pointer",
                            color: "var(--color-text-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Smile size={16} />
                        </button>
                        <button
                          className="message-action"
                          onClick={() => startThread(msg.id)}
                          title="Reply in thread"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "5px",
                            cursor: "pointer",
                            color: "var(--color-text-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button
                          className="message-action"
                          onClick={() => pinMessage(msg.id)}
                          title="Pin message"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "5px",
                            cursor: "pointer",
                            color: "var(--color-text-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Pin size={16} />
                        </button>
                      </div>

                      {/* Emoji picker */}
                      {showEmojiPicker === msg.id && (
                        <div
                          className="emoji-picker"
                          style={{
                            position: "absolute",
                            backgroundColor: "white",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                            zIndex: 10,
                            padding: "8px",
                            top: "-60px",
                            right: "10px",
                          }}
                        >
                          <div
                            className="emoji-list"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(5, 1fr)",
                              gap: "4px",
                            }}
                          >
                            {[
                              "😀",
                              "👍",
                              "❤️",
                              "🎉",
                              "🔥",
                              "👀",
                              "👏",
                              "⭐",
                              "🚀",
                              "✅",
                            ].map((emoji) => (
                              <button
                                key={emoji}
                                className="emoji-item"
                                onClick={() => {
                                  addReaction(msg.id, emoji);
                                  setShowEmojiPicker(false);
                                }}
                                style={{
                                  border: "none",
                                  background: "none",
                                  padding: "6px",
                                  cursor: "pointer",
                                  fontSize: "1.2rem",
                                  borderRadius: "4px",
                                  transition: "background-color 0.2s",
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button
                            className="close-emoji-picker"
                            onClick={() => setShowEmojiPicker(false)}
                            style={{
                              position: "absolute",
                              top: "-8px",
                              right: "-8px",
                              backgroundColor: "var(--color-surface)",
                              border: "1px solid var(--color-border)",
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "12px",
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div
                    className="typing-indicator"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      margin: "5px 0 10px 48px",
                      color: "var(--color-text-secondary)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <div
                      className="typing-animation"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginRight: "6px",
                      }}
                    >
                      <span
                        style={{
                          height: "6px",
                          width: "6px",
                          backgroundColor: "var(--color-text-secondary)",
                          borderRadius: "50%",
                          display: "inline-block",
                          marginRight: "3px",
                          animation: "typingBounce 1.2s infinite ease-in-out",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "6px",
                          width: "6px",
                          backgroundColor: "var(--color-text-secondary)",
                          borderRadius: "50%",
                          display: "inline-block",
                          marginRight: "3px",
                          animation: "typingBounce 1.2s infinite ease-in-out",
                          animationDelay: "0.2s",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "6px",
                          width: "6px",
                          backgroundColor: "var(--color-text-secondary)",
                          borderRadius: "50%",
                          display: "inline-block",
                          marginRight: 0,
                          animation: "typingBounce 1.2s infinite ease-in-out",
                          animationDelay: "0.4s",
                        }}
                      ></span>
                    </div>
                    <div className="typing-text">
                      {typingUsers.length === 1
                        ? `${typingUsers[0]} is typing...`
                        : `${typingUsers.length} people are typing...`}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form
                className="message-input-form"
                onSubmit={sendMessage}
                style={{
                  display: "flex",
                  padding: "30px 20px",
                  borderTop: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  position: "relative",
                }}
              >
                <div
                  className="input-container"
                  style={{
                    flex: 1,
                    position: "relative",
                  }}
                >
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      selectedChannel
                        ? `Message #${getChannelName(selectedChannel)}`
                        : "Select a channel"
                    }
                    disabled={loading || !selectedChannel}
                    onKeyDown={handleKeyPress}
                    ref={messageInputRef}
                    style={{
                      width: "100%",
                      padding: "12px 85px 12px 15px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "6px",
                      outline: "none",
                      fontSize: "0.95rem",
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-text-primary)",
                    }}
                  />

                  <div
                    className="input-actions"
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "flex",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      className="attachment-button"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      disabled={loading || !selectedChannel}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        color: "var(--color-text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: loading || !selectedChannel ? 0.5 : 1,
                      }}
                    >
                      <Paperclip size={20} />
                    </button>

                    <button
                      type="button"
                      className="emoji-button"
                      onClick={() => setShowEmojiPicker("input")}
                      disabled={loading || !selectedChannel}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        color: "var(--color-text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: loading || !selectedChannel ? 0.5 : 1,
                      }}
                    >
                      <Smile size={20} />
                    </button>
                  </div>

                  {/* Attachment menu */}
                  {showAttachmentMenu && (
                    <div
                      className="attachment-menu"
                      style={{
                        position: "absolute",
                        bottom: "50px",
                        right: "40px",
                        backgroundColor: "white",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                        padding: "8px 0",
                        zIndex: 10,
                        width: "180px",
                      }}
                    >
                      <button
                        className="attachment-option"
                        onClick={() => {
                          fileInputRef.current.click();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 16px",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          width: "100%",
                          textAlign: "left",
                          color: "var(--color-text-primary)",
                          transition: "background-color 0.2s",
                        }}
                      >
                        <FileText size={16} />
                        <span>Upload document</span>
                      </button>

                      <button
                        className="attachment-option"
                        onClick={() => {
                          imageInputRef.current.click();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 16px",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          width: "100%",
                          textAlign: "left",
                          color: "var(--color-text-primary)",
                          transition: "background-color 0.2s",
                        }}
                      >
                        <Image size={16} />
                        <span>Upload image</span>
                      </button>

                      <input
                        ref={fileInputRef}
                        id="file-upload"
                        type="file"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                      />

                      <input
                        ref={imageInputRef}
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                      />
                    </div>
                  )}

                  {/* Emoji picker for input */}
                  {showEmojiPicker === "input" && (
                    <div
                      className="emoji-picker emoji-picker-input"
                      style={{
                        position: "absolute",
                        bottom: "50px",
                        right: "60px",
                        backgroundColor: "white",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                        zIndex: 10,
                        padding: "8px",
                      }}
                    >
                      <div
                        className="emoji-list"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(5, 1fr)",
                          gap: "4px",
                        }}
                      >
                        {[
                          "😀",
                          "👍",
                          "❤️",
                          "🎉",
                          "🔥",
                          "👀",
                          "👏",
                          "⭐",
                          "🚀",
                          "✅",
                          "😊",
                          "🙌",
                          "🤔",
                          "👋",
                          "💯",
                          "🙏",
                          "💪",
                          "🎊",
                          "🥳",
                          "😂",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            className="emoji-item"
                            onClick={() => handleEmojiSelect(emoji)}
                            style={{
                              border: "none",
                              background: "none",
                              padding: "6px",
                              cursor: "pointer",
                              fontSize: "1.2rem",
                              borderRadius: "4px",
                              transition: "background-color 0.2s",
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button
                        className="close-emoji-picker"
                        onClick={() => setShowEmojiPicker(false)}
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "12px",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !newMessage.trim() || !selectedChannel}
                  className="send-button"
                  style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor:
                      !newMessage.trim() || !selectedChannel
                        ? "var(--color-text-disabled)"
                        : "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    marginLeft: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor:
                      !newMessage.trim() || !selectedChannel
                        ? "not-allowed"
                        : "pointer",
                    transition: "background-color 0.2s",
                  }}
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Processing Document Overlay */}
      {processingDocument && (
        <div
          className="document-processing-overlay"
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "8px",
            padding: "15px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            width: "380px",
            zIndex: 1000,
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 500,
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--color-text-primary)",
            }}
          >
            <Database size={18} />
            <span>Processing document for knowledge base...</span>
          </div>

          <div
            style={{
              height: "10px",
              backgroundColor: "var(--color-border)",
              borderRadius: "5px",
              overflow: "hidden",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${processingProgress}%`,
                backgroundColor: "var(--color-success)",
                borderRadius: "5px",
                transition: "width 0.3s ease-in-out",
              }}
            ></div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "var(--color-text-secondary)",
            }}
          >
            <span>{processingStatus}</span>
            <span>{processingProgress}%</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="error-message"
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            backgroundColor: "var(--alert-error-bg, #fee2e2)",
            color: "var(--alert-error-text, #b91c1c)",
            borderRadius: "4px",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
            maxWidth: "90%",
            zIndex: 100,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <AlertCircle size={16} />
          <p>{error}</p>
          <button
            className="dismiss-button"
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--alert-error-text, #b91c1c)",
              marginLeft: "10px",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Add channel dialog */}
      {showAddChannelDialog && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            className="modal-container"
            style={{
              backgroundColor: "var(--color-background)",
              borderRadius: "8px",
              overflow: "hidden",
              width: "420px",
              maxWidth: "90%",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              className="modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "15px 20px",
                backgroundColor: "var(--color-surface)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  color: "var(--color-text-primary)",
                }}
              >
                Create New Channel
              </h3>
              <button
                className="close-modal"
                onClick={() => setShowAddChannelDialog(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "5px",
                  borderRadius: "4px",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                padding: "20px",
                backgroundColor: "var(--color-background)",
              }}
            >
              <div
                className="form-group"
                style={{
                  marginBottom: "20px",
                }}
              >
                <label
                  htmlFor="channel-name"
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Channel Name
                </label>
                <input
                  id="channel-name"
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. marketing"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "4px",
                    fontSize: "0.95rem",
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <p
                  className="input-help"
                  style={{
                    marginTop: "5px",
                    fontSize: "0.8rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Names must be lowercase, without spaces or special characters.
                </p>
              </div>

              <div className="form-group">
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Channel Type
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "15px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      padding: "8px 12px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "4px",
                      backgroundColor: "var(--color-background)",
                    }}
                  >
                    <input
                      type="radio"
                      name="channelType"
                      value="general"
                      defaultChecked
                    />
                    <span>General</span>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      padding: "8px 12px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "4px",
                      backgroundColor: "var(--color-background)",
                    }}
                  >
                    <input type="radio" name="channelType" value="knowledge" />
                    <span>Knowledge Base</span>
                  </label>
                </div>
              </div>

              {isUserAdmin() && (
                <div className="form-group">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" name="adminOnly" />
                    <span>Admin Only Channel</span>
                  </label>
                </div>
              )}

              <div
                className="form-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <button
                  className="cancel-button"
                  onClick={() => setShowAddChannelDialog(false)}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "var(--color-text-primary)",
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  className="submit-button"
                  onClick={createChannel}
                  disabled={!newChannelName.trim() || loading}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor:
                      !newChannelName.trim() || loading
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: !newChannelName.trim() || loading ? 0.6 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="spinning"
                        style={{
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Channel
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Keyframes */}
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes typingBounce {
          0%,
          80%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-4px);
          }
        }

        .message-item:hover .message-actions {
          display: flex;
        }

        .attachment-option:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .emoji-item:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .reaction-badge:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .thread-preview:hover {
          background-color: rgba(0, 0, 0, 0.08);
        }

        .message-action:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .close-info:hover {
          background-color: var(--color-text-primary, #333);
        }
      `}</style>
    </div>
  );
};

export default EnhancedSlackMessages;
