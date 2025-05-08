// src/components/messages/SlackMessages.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import SlackMessaging from "../../utils/SlackMessaging";
import { Send, RefreshCw, Menu } from "lucide-react";
import "./SlackMessages.css";

const SlackMessages = () => {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChannels, setShowChannels] = useState(false);

  // Load channels on mount
  useEffect(() => {
    const loadChannels = async () => {
      setLoading(true);
      try {
        const channels = await SlackMessaging.getChannels();
        setChannels(channels);

        // Select first channel by default
        if (channels.length > 0 && !selectedChannel) {
          setSelectedChannel(channels[0].id);
        }
      } catch (err) {
        setError("Failed to load channels");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadChannels();
  }, []);

  // Load messages when selected channel changes
  useEffect(() => {
    if (!selectedChannel) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const messages = await SlackMessaging.getMessages(selectedChannel);
        setMessages(messages);
      } catch (err) {
        setError("Failed to load messages");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Set up real-time subscription for new messages
    const subscription = supabase
      .channel("slack_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "slack_messages",
          filter: `channel_id=eq.${selectedChannel}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedChannel]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedChannel) return;

    try {
      await SlackMessaging.sendMessage(selectedChannel, newMessage);
      setNewMessage("");
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

  return (
    <div className="slack-messages-container">
      <div className="messages-header">
        <button
          className="menu-button"
          onClick={() => setShowChannels(!showChannels)}
        >
          <Menu size={20} />
        </button>
        <h2>Messages</h2>
        <button
          className="refresh-button"
          onClick={refreshMessages}
          disabled={loading}
        >
          <RefreshCw size={20} className={loading ? "spinning" : ""} />
        </button>
      </div>

      <div className="messages-content">
        <div className={`channels-sidebar ${showChannels ? "show" : ""}`}>
          <h3>Channels</h3>
          <ul className="channels-list">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className={selectedChannel === channel.id ? "active" : ""}
                onClick={() => {
                  setSelectedChannel(channel.id);
                  setShowChannels(false);
                }}
              >
                # {channel.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="messages-main">
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="no-messages">
                {loading ? "Loading messages..." : "No messages yet"}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message-item ${msg.is_self ? "self" : ""}`}
                >
                  <img
                    src={msg.user_avatar || "https://via.placeholder.com/40"}
                    alt={msg.user_name}
                    className="user-avatar"
                  />
                  <div className="message-content">
                    <div className="message-header">
                      <span className="user-name">{msg.user_name}</span>
                      <span className="timestamp">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-text">{msg.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="message-input-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={loading || !selectedChannel}
            />
            <button
              type="submit"
              disabled={loading || !newMessage.trim() || !selectedChannel}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default SlackMessages;
