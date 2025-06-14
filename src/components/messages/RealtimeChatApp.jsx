import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/api-utils";
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
  const channelRef = useRef(null);

  useEffect(() => {
    if (!roomName || !username) return;

    setConnectionStatus("Connecting...");
    setIsConnected(false);

    // Simplified connection - just use broadcast channels without complex presence
    const channel = supabase.channel(`chat-${roomName}`);

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const newMessage = {
          id: payload.id || `${Date.now()}-${Math.random()}`,
          content: payload.content,
          user: payload.user,
          createdAt: payload.createdAt || new Date().toISOString(),
          roomName: roomName,
        };

        setMessages((prev) => {
          if (prev.find((msg) => msg.id === newMessage.id)) return prev;
          const updated = [...prev, newMessage];

          if (onMessage) {
            onMessage(updated);
          }

          return updated;
        });
      })
      .subscribe((status) => {
        console.log("Channel status:", status);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setConnectionStatus("Connected");
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setConnectionStatus("Connection Error");
        } else {
          setConnectionStatus("Connecting...");
        }
      });

    channelRef.current = channel;

    // More aggressive fallback - assume connected after 1 second
    const quickFallback = setTimeout(() => {
      setIsConnected(true);
      setConnectionStatus("Connected");
    }, 1000);

    return () => {
      clearTimeout(quickFallback);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      setIsConnected(false);
      setConnectionStatus("Disconnected");
    };
  }, [roomName, username, onMessage]);

  const sendMessage = async (content) => {
    if (!content.trim() || !channelRef.current) return;

    const message = {
      id: `${Date.now()}-${Math.random()}`,
      content: content.trim(),
      user: {
        name: username,
        id: username,
      },
      createdAt: new Date().toISOString(),
    };

    // Send the message via broadcast
    await channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });
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
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              {connectionStatus}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
