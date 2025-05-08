import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import SlackMessaging from "../../utils/SlackMessaging";
import { RedisCache } from "../../utils/RedisCache";
import { useAuth } from "../../context/AuthContext";
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
} from "lucide-react";
import "./SlackMessages.css";

const SlackMessages = () => {
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

    loadChannels();

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

  // Handle key press in message input
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);

      // Generate a unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

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

      // Send message with attachment
      const fileType = file.type.startsWith("image/") ? "image" : "file";
      await SlackMessaging.sendAttachment(selectedChannel, {
        text: `Shared a ${fileType}: ${file.name}`,
        attachment_type: fileType,
        attachment_url: publicUrl,
        original_filename: file.name,
      });

      setShowAttachmentMenu(false);
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="slack-messages-container">
      <div className="messages-header">
        {!showChannels && (
          <button
            className="menu-button"
            onClick={() => setShowChannels(true)}
            title="Show channels"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="channel-info">
          <h2>
            #{" "}
            {selectedChannel
              ? getChannelName(selectedChannel)
              : "Select a channel"}
          </h2>
          {selectedChannel && (
            <button
              className="channel-info-button"
              onClick={() => setShowChannelInfo(!showChannelInfo)}
            >
              <Info size={16} />
            </button>
          )}
        </div>

        <div className="header-actions">
          <button
            className="action-button search-button"
            onClick={() => setShowSearch(!showSearch)}
            title="Search messages"
          >
            <Search size={18} />
          </button>
          <button
            className="action-button refresh-button"
            onClick={refreshMessages}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "spinning" : ""} />
          </button>
          <button
            className="action-button members-button"
            onClick={() => {}}
            title="Channel members"
          >
            <Users size={18} />
          </button>
          <button
            className="action-button settings-button"
            onClick={() => {}}
            title="Channel settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMessages()}
          />
          <button onClick={searchMessages}>
            <Search size={16} />
          </button>
          <button
            className="close-search"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
              refreshMessages();
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="messages-content">
        {showChannels && (
          <div className="channels-sidebar">
            <div className="channels-header">
              <h3>Channels</h3>
              <button
                className="add-channel-button"
                onClick={() => setShowAddChannelDialog(true)}
                title="Add channel"
              >
                <Plus size={16} />
              </button>
            </div>

            <ul className="channels-list">
              {channels.map((channel) => (
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
                >
                  <div className="channel-name">
                    <span className="channel-prefix">#</span> {channel.name}
                  </div>

                  {unreadMessages[channel.id] && (
                    <div className="unread-badge">
                      {unreadMessages[channel.id]}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="sidebar-footer">
              <button
                className="collapse-sidebar"
                onClick={() => setShowChannels(false)}
                title="Collapse sidebar"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        <div className="messages-main">
          {activeThread ? (
            <div className="thread-view">
              <div className="thread-header">
                <button
                  className="back-button"
                  onClick={() => setActiveThread(null)}
                >
                  <ChevronLeft size={20} />
                  <span>Back to channel</span>
                </button>

                <h3>Thread</h3>
              </div>

              <div className="thread-messages" ref={messageContainerRef}>
                {/* Parent message */}
                {messages.find((m) => m.id === activeThread) && (
                  <div
                    className={`parent-message message-item ${
                      messages.find((m) => m.id === activeThread).is_self
                        ? "self"
                        : ""
                    }`}
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
                    />
                    <div className="message-content">
                      <div className="message-header">
                        <span className="user-name">
                          {
                            messages.find((m) => m.id === activeThread)
                              .user_name
                          }
                        </span>
                        <span className="timestamp">
                          {formatTimestamp(
                            messages.find((m) => m.id === activeThread)
                              .timestamp
                          )}
                        </span>
                      </div>
                      <div className="message-text">
                        {messages.find((m) => m.id === activeThread).text}
                      </div>
                    </div>
                  </div>
                )}

                <div className="replies-divider">
                  <div className="divider-line"></div>
                  <span>Replies</span>
                  <div className="divider-line"></div>
                </div>

                {/* Thread replies */}
                {threadMessages.length === 0 ? (
                  <div className="no-replies">No replies yet</div>
                ) : (
                  threadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message-item ${msg.is_self ? "self" : ""}`}
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
                      />
                      <div className="message-content">
                        <div className="message-header">
                          <span className="user-name">{msg.user_name}</span>
                          <span className="timestamp">
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>
                        <div className="message-text">{msg.text}</div>
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
              >
                <input
                  type="text"
                  value={threadReply}
                  onChange={(e) => setThreadReply(e.target.value)}
                  placeholder="Reply to thread..."
                  disabled={loading}
                />
                <button type="submit" disabled={loading || !threadReply.trim()}>
                  <Send size={20} />
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="messages-list" ref={messageContainerRef}>
                {showChannelInfo && (
                  <div className="channel-info-panel">
                    <h3>About #{getChannelName(selectedChannel)}</h3>
                    <div className="channel-description">
                      {channels.find((c) => c.id === selectedChannel)
                        ?.description || "No description set"}
                    </div>

                    <div className="channel-stats">
                      <div className="stat-item">
                        <Users size={16} />
                        <span>
                          {channels.find((c) => c.id === selectedChannel)
                            ?.member_count || 0}{" "}
                          members
                        </span>
                      </div>
                      <div className="stat-item">
                        <MessageCircle size={16} />
                        <span>{messages.length} messages</span>
                      </div>
                      <div className="stat-item">
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
                      <div className="pinned-messages">
                        <h4>Pinned Messages</h4>
                        {pinnedMessages.map((msg) => (
                          <div
                            key={`pinned-${msg.id}`}
                            className="pinned-message"
                          >
                            <div className="pinned-content">{msg.text}</div>
                            <div className="pinned-by">
                              Pinned by {msg.pinned_by || "unknown"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      className="close-info"
                      onClick={() => setShowChannelInfo(false)}
                    >
                      Close
                    </button>
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="no-messages">
                    {loading ? (
                      <div className="loading-messages">
                        <RefreshCw size={24} className="spinning" />
                        <p>Loading messages...</p>
                      </div>
                    ) : (
                      <>
                        <MessageCircle size={32} />
                        <p>
                          No messages yet in #{getChannelName(selectedChannel)}
                        </p>
                        <p className="sub-text">
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
                      />
                      <div className="message-content">
                        <div className="message-header">
                          <span className="user-name">{msg.user_name}</span>
                          <span className="timestamp">
                            {formatTimestamp(msg.timestamp)}
                          </span>

                          {msg.is_sending && (
                            <span className="sending-indicator">
                              Sending...
                            </span>
                          )}
                        </div>
                        <div className="message-text">{msg.text}</div>

                        {msg.attachment_url && (
                          <div className="message-attachment">
                            {msg.attachment_type === "image" ? (
                              <div className="image-preview">
                                <img
                                  src={msg.attachment_url}
                                  alt="Attached image"
                                  onClick={() =>
                                    window.open(msg.attachment_url, "_blank")
                                  }
                                />
                              </div>
                            ) : (
                              <div className="file-attachment">
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {msg.original_filename || "Attached file"}
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message reactions */}
                        {messageReactions[msg.id] &&
                          messageReactions[msg.id].length > 0 && (
                            <div className="message-reactions">
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
                                >
                                  <span className="reaction-emoji">
                                    {emoji}
                                  </span>
                                  <span className="reaction-count">
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
                            >
                              <MessageCircle size={14} />
                              <span>
                                {messageThreads[msg.id].length} replies
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Message actions */}
                      <div className="message-actions">
                        <button
                          className="message-action"
                          onClick={() => setShowEmojiPicker(msg.id)}
                          title="Add reaction"
                        >
                          <Smile size={16} />
                        </button>
                        <button
                          className="message-action"
                          onClick={() => startThread(msg.id)}
                          title="Reply in thread"
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button
                          className="message-action"
                          onClick={() => pinMessage(msg.id)}
                          title="Pin message"
                        >
                          <Pin size={16} />
                        </button>
                        <button
                          className="message-action"
                          onClick={() => {}}
                          title="More actions"
                        >
                          <Settings size={16} />
                        </button>
                      </div>

                      {/* Emoji picker */}
                      {showEmojiPicker === msg.id && (
                        <div className="emoji-picker">
                          <div className="emoji-list">
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
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button
                            className="close-emoji-picker"
                            onClick={() => setShowEmojiPicker(false)}
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
                  <div className="typing-indicator">
                    <div className="typing-animation">
                      <span></span>
                      <span></span>
                      <span></span>
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

              <form className="message-input-form" onSubmit={sendMessage}>
                <div className="input-container">
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
                  />

                  <div className="input-actions">
                    <button
                      type="button"
                      className="attachment-button"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      disabled={loading || !selectedChannel}
                    >
                      <Paperclip size={20} />
                    </button>

                    <button
                      type="button"
                      className="emoji-button"
                      onClick={() => setShowEmojiPicker("input")}
                      disabled={loading || !selectedChannel}
                    >
                      <Smile size={20} />
                    </button>
                  </div>

                  {/* Attachment menu */}
                  {showAttachmentMenu && (
                    <div className="attachment-menu">
                      <button
                        className="attachment-option"
                        onClick={() => {
                          document.getElementById("file-upload").click();
                        }}
                      >
                        <FileText size={16} />
                        <span>Upload file</span>
                      </button>

                      <button
                        className="attachment-option"
                        onClick={() => {
                          document.getElementById("image-upload").click();
                        }}
                      >
                        <Image size={16} />
                        <span>Upload image</span>
                      </button>

                      <input
                        id="file-upload"
                        type="file"
                        style={{ display: "none" }}
                        onChange={handleFileUpload}
                      />

                      <input
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
                    <div className="emoji-picker emoji-picker-input">
                      <div className="emoji-list">
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
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button
                        className="close-emoji-picker"
                        onClick={() => setShowEmojiPicker(false)}
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
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <p>{error}</p>
          <button className="dismiss-button" onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Add channel dialog */}
      {showAddChannelDialog && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Create New Channel</h3>
              <button
                className="close-modal"
                onClick={() => setShowAddChannelDialog(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="channel-name">Channel Name</label>
                <input
                  id="channel-name"
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. marketing"
                  autoFocus
                />
                <p className="input-help">
                  Names must be lowercase, without spaces or special characters.
                </p>
              </div>

              <div className="form-actions">
                <button
                  className="cancel-button"
                  onClick={() => setShowAddChannelDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="submit-button"
                  onClick={createChannel}
                  disabled={!newChannelName.trim() || loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="spinning" />
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
    </div>
  );
};

export default SlackMessages;
