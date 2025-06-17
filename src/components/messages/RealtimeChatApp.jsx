import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/api-utils";
import {
  testSupabaseConnection,
  diagnoseSupabaseIssues,
} from "../../utils/supabaseConnectionTest";
import {
  Send,
  Plus,
  Search,
  ArrowLeft,
  MessageCircle,
  User,
  X,
  Settings,
  Hash,
  Menu,
  Smile,
  Paperclip,
  Wifi,
} from "lucide-react";
import "./RealtimeChatApp.css";

// Individual Message Component
const ChatMessageItem = ({ message, isOwnMessage, showHeader }) => {
  return (
    <div className={`realtime-chat-message${isOwnMessage ? " own" : ""}`}>
      {!isOwnMessage && (
        <div className="realtime-chat-avatar">
          {message.user.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      )}
      <div style={{ flex: 1 }}>
        {showHeader && (
          <div
            className="realtime-chat-header"
            style={{
              padding: 0,
              marginBottom: 8,
              background: "none",
              boxShadow: "none",
              border: "none",
            }}
          >
            <span style={{ fontWeight: 600, color: "#22223b", fontSize: 14 }}>
              {message.user.name}
            </span>
            <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div className="realtime-chat-bubble">{message.content}</div>
      </div>
      {isOwnMessage && (
        <div className="realtime-chat-avatar">
          {message.user.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      )}
    </div>
  );
};

// Real-time Chat Hook
const useRealtimeChat = (roomName, username, onMessage) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [retryCount, setRetryCount] = useState(0);
  const channelRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const { currentUser } = useAuth();

  // Load existing messages when room changes
  useEffect(() => {
    if (!roomName) return;

    const loadMessages = async () => {
      try {
        console.log(`Loading messages for room: ${roomName}`);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_name', roomName)
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) {
          console.error('Error loading messages:', error);
          return;
        }

        const formattedMessages = data.map(msg => ({
          id: msg.id,
          content: msg.content,
          user: {
            name: msg.user_name,
            id: msg.user_id
          },
          createdAt: msg.created_at,
          roomName: msg.room_name
        }));

        setMessages(formattedMessages);
        console.log(`Loaded ${formattedMessages.length} messages`);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [roomName]);

  useEffect(() => {
    if (!roomName || !username) return;

    console.log(`Setting up realtime connection for room: ${roomName}`);
    setConnectionStatus("Connecting...");
    setIsConnected(false);

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create channel for real-time database changes
    const channel = supabase
      .channel(`messages-${roomName}`, {
        config: {
          broadcast: { self: false },
          presence: { key: username }
        }
      })
      // Listen for new messages in the database
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_name=eq.${roomName}`
        },
        (payload) => {
          console.log('New message received via postgres_changes:', payload);
          const newMessage = {
            id: payload.new.id,
            content: payload.new.content,
            user: {
              name: payload.new.user_name,
              id: payload.new.user_id
            },
            createdAt: payload.new.created_at,
            roomName: payload.new.room_name
          };

          setMessages((prev) => {
            // Check if message already exists
            if (prev.find((msg) => msg.id === newMessage.id)) {
              return prev;
            }
            const updated = [...prev, newMessage];
            if (onMessage) {
              onMessage(updated);
            }
            return updated;
          });
        }
      )
      // Listen for presence changes
      .on("presence", { event: "sync" }, () => {
        console.log("Presence sync for room:", roomName);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined room:", key, roomName);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left room:", key, roomName);
      })
      .subscribe(async (status) => {
        console.log(`Channel status for ${roomName}:`, status);

        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setConnectionStatus("Connected");
          setRetryCount(0);
          console.log(`✅ Successfully connected to room: ${roomName}`);

          // Track user presence
          await channel.track({
            user: username,
            room: roomName,
            online_at: new Date().toISOString(),
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setIsConnected(false);
          setConnectionStatus(`Connection Error (${status})`);
          console.error(`❌ Connection failed for room ${roomName}:`, status);

          // Retry connection with exponential backoff
          const maxRetries = 5;
          if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(
              `Retrying connection for ${roomName} in ${delay}ms (attempt ${
                retryCount + 1
              }/${maxRetries})`
            );

            retryTimeoutRef.current = setTimeout(() => {
              setRetryCount((prev) => prev + 1);
            }, delay);
          } else {
            setConnectionStatus("Connection Failed - Max Retries Reached");
            console.error(`❌ Max retries reached for room: ${roomName}`);
          }
        } else {
          setConnectionStatus(`Connecting... (${status})`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (channelRef.current) {
        console.log(`Cleaning up connection for room: ${roomName}`);
        supabase.removeChannel(channelRef.current);
      }
      setIsConnected(false);
      setConnectionStatus("Disconnected");
    };
  }, [roomName, username, onMessage, retryCount, currentUser]);

  const sendMessage = async (content) => {
    if (!content.trim()) {
      console.error('Message content is empty');
      return;
    }

    if (!currentUser) {
      console.error('No authenticated user');
      return;
    }

    const messageData = {
      content: content.trim(),
      room_name: roomName,
      user_id: currentUser.id,
      user_name: currentUser.name || currentUser.email || 'Anonymous',
      created_at: new Date().toISOString()
    };

    console.log('Sending message to database:', messageData);

    try {
      // Insert message into database - this will trigger the realtime listener
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error('Failed to send message to database:', error);
        throw error;
      }

      console.log('✅ Message sent successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Add message to local state as fallback
      const fallbackMessage = {
        id: `temp-${Date.now()}-${Math.random()}`,
        content: content.trim(),
        user: {
          name: currentUser.name || currentUser.email || 'Anonymous',
          id: currentUser.id
        },
        createdAt: new Date().toISOString(),
        roomName: roomName
      };
      
      setMessages((prev) => [...prev, fallbackMessage]);
      throw error;
    }
  };

  return { messages, sendMessage, isConnected, connectionStatus, setMessages };
};

// Main Realtime Chat Component
const RealtimeChat = ({
  roomName,
  username,
  messages: initialMessages,
  onMessage,
}) => {
  const { messages, sendMessage, isConnected, connectionStatus, setMessages } =
    useRealtimeChat(roomName, username, onMessage);
  const [newMessage, setNewMessage] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await sendMessage(newMessage);
    setNewMessage("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await diagnoseSupabaseIssues();
      setConnectionTestResult(result);

      if (result.connection?.success) {
        console.log("✅ Connection test successful");
      } else {
        console.error("❌ Connection test failed:", result);
      }
    } catch (error) {
      console.error("Connection test error:", error);
      setConnectionTestResult({
        success: false,
        error: error.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getRoomDisplayName = () => {
    if (roomName.includes("-")) {
      return roomName.split("-").find((name) => name !== username) || roomName;
    }
    return roomName;
  };

  return (
    <div className="realtime-chat-main">
      {/* Chat Header */}
      <div className="realtime-chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="realtime-chat-avatar">
            {getRoomDisplayName().charAt(0).toUpperCase()}
          </div>
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#22223b",
                margin: 0,
              }}
            >
              {roomName.includes("-") ? (
                getRoomDisplayName()
              ) : (
                <>
                  <span style={{ color: "#888" }}>#</span>
                  {getRoomDisplayName()}
                </>
              )}
            </h2>
            <p
              style={{
                fontSize: 13,
                color:
                  connectionStatus.includes("Error") ||
                  connectionStatus.includes("Failed")
                    ? "#ef4444"
                    : connectionStatus.includes("Connected")
                    ? "#10b981"
                    : "#888",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    connectionStatus.includes("Error") ||
                    connectionStatus.includes("Failed")
                      ? "#ef4444"
                      : connectionStatus.includes("Connected")
                      ? "#10b981"
                      : "#f59e0b",
                  animation: connectionStatus.includes("Connecting")
                    ? "pulse 2s infinite"
                    : "none",
                }}
              />
              {connectionStatus}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            style={{
              background: "transparent",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              color: "#64748b",
              cursor: testingConnection ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: testingConnection ? 0.6 : 1,
            }}
            title="Test Supabase Connection"
          >
            <Wifi size={14} />
            {testingConnection ? "Testing..." : "Test Connection"}
          </button>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: isConnected ? "#10b981" : "#ef4444",
            }}
          />
        </div>
      </div>
      {/* Connection Test Results */}
      {connectionTestResult && (
        <div
          style={{
            background: connectionTestResult.connection?.success
              ? "#f0fdf4"
              : "#fef2f2",
            border: `1px solid ${
              connectionTestResult.connection?.success ? "#bbf7d0" : "#fecaca"
            }`,
            borderRadius: 8,
            margin: "0 2rem",
            padding: "12px 16px",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {connectionTestResult.connection?.success
              ? "✅ Connection Test Successful"
              : "❌ Connection Test Failed"}
          </div>
          {connectionTestResult.connection?.error && (
            <div style={{ color: "#dc2626", marginBottom: 8 }}>
              Error: {connectionTestResult.connection.error}
            </div>
          )}
          {connectionTestResult.recommendations &&
            connectionTestResult.recommendations.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Recommendations:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {connectionTestResult.recommendations.map((rec, index) => (
                    <li key={index} style={{ marginBottom: 2 }}>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
      {/* Messages Container */}
      <div className="realtime-chat-messages">
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", marginTop: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>💬</div>
            <h3 style={{ fontWeight: 600, fontSize: 20, marginBottom: 8 }}>
              No messages yet
            </h3>
            <p style={{ fontSize: 15 }}>
              {roomName.includes("-")
                ? `Start a conversation with ${getRoomDisplayName()}`
                : `Be the first to send a message in #${getRoomDisplayName()}`}
            </p>
          </div>
        ) : (
          <div>
            {messages.map((message, index) => {
              const isOwnMessage = message.user.name === username;
              const showHeader =
                index === 0 ||
                messages[index - 1].user.name !== message.user.name ||
                new Date(message.createdAt).getTime() -
                  new Date(messages[index - 1].createdAt).getTime() >
                  300000;
              return (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  showHeader={showHeader}
                />
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Message Input */}
      <div className="realtime-chat-input">
        <form
          onSubmit={handleSendMessage}
          style={{ display: "flex", width: "100%", gap: 12 }}
        >
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={`Message ${
              roomName.includes("-")
                ? getRoomDisplayName()
                : "#" + getRoomDisplayName()
            }...`}
            className=""
            disabled={!isConnected}
            rows={1}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="realtime-chat-send-btn"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

// Main Chat Application Component
const RealtimeChatApp = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [showRoomSidebar, setShowRoomSidebar] = useState(true);
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("group");
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  // Fetch all users for DMs
  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (data) {
        setAllUsers(data.filter((u) => u.id !== currentUser?.id));
      }
    }
    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    const defaultRooms = [
      {
        id: "general",
        name: "General",
        type: "group",
        participants: ["everyone"],
      },
      {
        id: "random",
        name: "Random",
        type: "group",
        participants: ["everyone"],
      },
    ];
    setRooms(defaultRooms);
    setActiveRoom(defaultRooms[0]);
  }, []);

  // DM logic: create or find a DM channel between currentUser and selected user
  const openDirectMessage = (user) => {
    // Check if DM room already exists
    let dmRoom = rooms.find(
      (room) =>
        room.type === "direct" &&
        room.participants.includes(currentUser.id) &&
        room.participants.includes(user.id)
    );
    if (!dmRoom) {
      dmRoom = {
        id: `dm-${[currentUser.id, user.id].sort().join("-")}`,
        name: user.full_name || user.email,
        type: "direct",
        participants: [currentUser.id, user.id],
        avatar:
          user.full_name?.charAt(0).toUpperCase() ||
          user.email?.charAt(0).toUpperCase(),
      };
      setRooms((prev) => [...prev, dmRoom]);
    }
    setActiveRoom(dmRoom);
  };

  const createRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoom = {
      id: `${newRoomType}-${Date.now()}`,
      name: newRoomName,
      type: newRoomType,
      participants: [currentUser?.id],
    };
    setRooms((prev) => [...prev, newRoom]);
    setActiveRoom(newRoom);
    setShowNewRoomDialog(false);
    setNewRoomName("");
  };

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  const handleMessage = async (messages) => {
    console.log("New messages:", messages);
  };

  // Sidebar filtering
  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groupChannels = filteredRooms.filter((room) => room.type === "group");
  const directMessages = rooms.filter((room) => room.type === "direct");

  return (
    <div className="realtime-chat-app">
      {/* Sidebar */}
      {showRoomSidebar && (
        <div className="realtime-chat-sidebar">
          {/* Sidebar Header */}
          <div
            style={{
              padding: 24,
              borderBottom: "1px solid #e5e7eb",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <button
                onClick={handleBackToAdmin}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Back to Admin
              </button>
              <button
                onClick={() => setShowNewRoomDialog(true)}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: 8,
                  fontWeight: 500,
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                +
              </button>
            </div>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                marginBottom: 8,
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {/* Channels Section */}
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              >
                Channels
              </div>
              {groupChannels.map((room) => (
                <div
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background:
                      activeRoom?.id === room.id ? "#e0e7ff" : "transparent",
                    color: activeRoom?.id === room.id ? "#4f46e5" : "#22223b",
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 18, color: "#64748b" }}
                  >
                    #
                  </span>
                  <span style={{ fontWeight: 500 }}>{room.name}</span>
                </div>
              ))}
            </div>
            {/* Direct Messages Section */}
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              >
                Direct Messages
              </div>
              {allUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => openDirectMessage(user)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background:
                      activeRoom?.type === "direct" &&
                      activeRoom?.participants.includes(user.id)
                        ? "#e0e7ff"
                        : "transparent",
                    color:
                      activeRoom?.type === "direct" &&
                      activeRoom?.participants.includes(user.id)
                        ? "#4f46e5"
                        : "#22223b",
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <div
                    className="realtime-chat-avatar"
                    style={{ width: 32, height: 32, fontSize: 15 }}
                  >
                    {user.full_name?.charAt(0).toUpperCase() ||
                      user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 500 }}>
                    {user.full_name || user.email}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Sidebar Footer */}
          <div
            style={{
              padding: 16,
              borderTop: "1px solid #e5e7eb",
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                className="realtime-chat-avatar"
                style={{ width: 32, height: 32, fontSize: 15 }}
              >
                {currentUser?.name?.charAt(0)?.toUpperCase() ||
                  currentUser?.email?.charAt(0)?.toUpperCase() ||
                  "U"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontWeight: 600, color: "#22223b", fontSize: 15 }}
                >
                  {currentUser?.name || currentUser?.email || "User"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Online</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Main Chat Area */}
      <div className="realtime-chat-main">
        {activeRoom ? (
          <RealtimeChat
            roomName={activeRoom.id}
            username={currentUser?.name || currentUser?.email || "Anonymous"}
            onMessage={handleMessage}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f8fafc",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  background: "#e0e7ff",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  fontSize: 48,
                  color: "#4f46e5",
                }}
              >
                💬
              </div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#22223b",
                  marginBottom: 12,
                }}
              >
                Welcome to Chat
              </h2>
              <p style={{ color: "#64748b", fontSize: 16 }}>
                Select a conversation from the sidebar to start messaging, or
                create a new chat to get started.
              </p>
            </div>
          </div>
        )}
      </div>
      {/* New Room Dialog */}
      {showNewRoomDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.15)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              boxShadow: "0 8px 32px rgba(60,72,100,0.18)",
              width: "100%",
              maxWidth: 400,
              padding: 32,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <h3
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#22223b",
                  margin: 0,
                }}
              >
                Create New Chat
              </h3>
              <button
                onClick={() => setShowNewRoomDialog(false)}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  width: 40,
                  height: 40,
                  fontSize: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={22} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    color: "#22223b",
                    marginBottom: 8,
                  }}
                >
                  Chat Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter chat name..."
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    fontSize: 15,
                    background: "#f3f4f6",
                    color: "#22223b",
                    outline: "none",
                    marginBottom: 0,
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    color: "#22223b",
                    marginBottom: 8,
                  }}
                >
                  Chat Type
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 14,
                      border: `2px solid ${
                        newRoomType === "group" ? "#4f46e5" : "#e5e7eb"
                      }`,
                      borderRadius: 12,
                      background: newRoomType === "group" ? "#e0e7ff" : "#fff",
                      cursor: "pointer",
                      transition: "border 0.2s, background 0.2s",
                    }}
                  >
                    <input
                      type="radio"
                      value="group"
                      checked={newRoomType === "group"}
                      onChange={(e) => setNewRoomType(e.target.value)}
                      style={{ accentColor: "#4f46e5", marginRight: 6 }}
                    />
                    <span
                      style={{
                        fontSize: 20,
                        color: "#4f46e5",
                        fontWeight: 700,
                      }}
                    >
                      #
                    </span>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color:
                            newRoomType === "group" ? "#4f46e5" : "#22223b",
                        }}
                      >
                        Channel
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Group discussion
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 14,
                      border: `2px solid ${
                        newRoomType === "direct" ? "#4f46e5" : "#e5e7eb"
                      }`,
                      borderRadius: 12,
                      background: newRoomType === "direct" ? "#e0e7ff" : "#fff",
                      cursor: "pointer",
                      transition: "border 0.2s, background 0.2s",
                    }}
                  >
                    <input
                      type="radio"
                      value="direct"
                      checked={newRoomType === "direct"}
                      onChange={(e) => setNewRoomType(e.target.value)}
                      style={{ accentColor: "#4f46e5", marginRight: 6 }}
                    />
                    <span
                      style={{
                        fontSize: 20,
                        color: "#4f46e5",
                        fontWeight: 700,
                      }}
                    >
                      👤
                    </span>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color:
                            newRoomType === "direct" ? "#4f46e5" : "#22223b",
                        }}
                      >
                        Direct
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Private message
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => setShowNewRoomDialog(false)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: "#f3f4f6",
                    color: "#22223b",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createRoom}
                  disabled={!newRoomName.trim()}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: !newRoomName.trim() ? "#e5e7eb" : "#4f46e5",
                    color: !newRoomName.trim() ? "#888" : "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: !newRoomName.trim() ? "not-allowed" : "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  Create Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealtimeChatApp;
