// src/utils/SlackMessaging.js
import { supabase } from "../lib/supabase";

export const SlackMessaging = {
  /**
   * Get available channels for the current user
   */
  async getChannels() {
    try {
      // First check if the RPC function exists
      const { data, error } = await supabase.rpc("slack_get_channels");

      if (error) {
        // If the RPC function fails, try direct table access
        console.warn("RPC function failed, trying direct access:", error);

        const { data: channels, error: directError } = await supabase
          .from("slack_channels")
          .select("*")
          .order("name", { ascending: true });

        if (directError) {
          console.error("Direct channel access failed:", directError);
          // Return empty array with sample channels in development
          if (process.env.NODE_ENV === "development") {
            return [
              {
                id: "1",
                name: "general",
                type: "general",
                description: "General discussion",
              },
              {
                id: "2",
                name: "admin-only",
                type: "general",
                admin_only: true,
                description: "Admin discussion",
              },
              {
                id: "3",
                name: "knowledge-base",
                type: "knowledge",
                description: "Knowledge base documents",
              },
            ];
          }
          throw directError;
        }

        return channels || [];
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching Slack channels:", error);
      return [];
    }
  },

  /**
   * Get messages from a specific channel
   * @param {string} channelId - Slack channel ID
   * @param {number} limit - Maximum number of messages to retrieve
   * @param {boolean} forceRefresh - Skip cache and force a fresh fetch
   */
  async getMessages(channelId, limit = 50, forceRefresh = false) {
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc("slack_get_messages", {
        p_channel_id: channelId,
        p_message_limit: limit,
      });

      if (error) {
        // Fallback to direct query
        console.warn("RPC function failed, trying direct access:", error);

        // First get messages without the user join
        const { data: messages, error: directError } = await supabase
          .from("slack_messages")
          .select("*")
          .eq("channel_id", channelId)
          .order("timestamp", { ascending: false })
          .limit(limit);

        if (directError) {
          console.error("Direct message access failed:", directError);
          throw directError;
        }

        // Get current user ID once
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData?.user?.id;

        // Get unique user IDs from messages
        const userIds = [
          ...new Set(messages.map((msg) => msg.user_id).filter(Boolean)),
        ];

        // Fetch user details separately if we have user IDs
        let userMap = {};
        if (userIds.length > 0) {
          try {
            const { data: users } = await supabase
              .from("profiles") // Using profiles table instead
              .select("id, full_name, email")
              .in("id", userIds);

            if (users) {
              userMap = users.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
              }, {});
            }
          } catch (userError) {
            console.warn("Could not fetch user details:", userError);
            // Continue without user details
          }
        }

        // Format messages to match expected structure
        return (messages || [])
          .map((msg) => ({
            ...msg,
            user_name:
              userMap[msg.user_id]?.full_name ||
              userMap[msg.user_id]?.email ||
              msg.user_name ||
              "Unknown User",
            user_avatar: null, // Add avatar URL if available
            is_self: msg.user_id === currentUserId,
          }))
          .reverse(); // Reverse to get oldest first
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching Slack messages:", error);
      return [];
    }
  },

  /**
   * Send a message to a Slack channel
   * @param {string} channelId - Slack channel ID
   * @param {string} message - Message text
   */
  async sendMessage(channelId, message) {
    try {
      // First check if the channel exists
      if (!channelId) {
        throw new Error("Channel ID is required");
      }

      // Add additional validation if needed
      if (!message || !message.trim()) {
        throw new Error("Message content is required");
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Try RPC function first
      const { data, error } = await supabase.rpc("slack_send_message", {
        p_channel_id: channelId,
        p_message_text: message,
      });

      if (error) {
        console.warn("RPC function failed, trying direct insert:", error);

        // Direct insert fallback
        const { data: insertData, error: insertError } = await supabase
          .from("slack_messages")
          .insert({
            channel_id: channelId,
            text: message,
            user_id: userId,
            timestamp: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return true;
      }

      return true;
    } catch (error) {
      console.error("Error sending Slack message:", error);
      return false;
    }
  },

  /**
   * Get unread message count
   */
  async getUnreadCount() {
    try {
      const { data, error } = await supabase.rpc("slack_get_unread_count");

      if (error) {
        console.warn("Could not get unread count:", error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  },

  /**
   * Send a message with attachment to a Slack channel
   * @param {string} channelId - Slack channel ID
   * @param {object} attachmentInfo - Information about the attachment
   */
  async sendAttachment(channelId, attachmentInfo) {
    try {
      if (!channelId || !attachmentInfo) {
        throw new Error("Channel ID and attachment info are required");
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Try RPC first
      const { data, error } = await supabase.rpc("slack_send_attachment", {
        channel_id: channelId,
        attachment_data: attachmentInfo,
      });

      if (error) {
        console.warn("RPC function failed, trying direct insert:", error);

        // Fallback to direct insert
        const { error: insertError } = await supabase
          .from("slack_messages")
          .insert({
            channel_id: channelId,
            text: attachmentInfo.text || "Shared an attachment",
            user_id: userId,
            attachment_url: attachmentInfo.attachment_url,
            attachment_type: attachmentInfo.attachment_type,
            original_filename: attachmentInfo.original_filename,
            timestamp: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error("Error sending attachment:", error);
      return false;
    }
  },

  /**
   * Create a new channel
   * @param {string} name - Channel name
   * @param {object} options - Channel options
   */
  async createChannel(name, options = {}) {
    try {
      // Direct insert since RPC might not be available
      const { data, error } = await supabase
        .from("slack_channels")
        .insert({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          description: options.description || `${name} channel`,
          type: options.type || "general",
          admin_only: options.adminOnly || false,
          created_by: (await supabase.auth.getUser()).data?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  },

  /**
   * Search messages in channels
   * @param {string} query - Search query
   */
  async searchMessages(query) {
    try {
      const { data, error } = await supabase
        .from("slack_messages")
        .select(
          `
          *,
          user:user_id (
            id,
            email,
            full_name
          )
        `
        )
        .ilike("text", `%${query}%`)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get current user ID once
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;

      // Format messages
      return (data || []).map((msg) => ({
        ...msg,
        user_name: msg.user?.full_name || msg.user?.email || "Unknown User",
        user_avatar: null,
        is_self: msg.user_id === currentUserId,
      }));
    } catch (error) {
      console.error("Error searching messages:", error);
      return [];
    }
  },

  /**
   * Add reaction to a message
   * @param {string} messageId - Message ID
   * @param {string} emoji - Emoji reaction
   */
  async addReaction(messageId, emoji) {
    try {
      const userId = (await supabase.auth.getUser()).data?.user?.id;

      const { error } = await supabase.from("slack_message_reactions").insert({
        message_id: messageId,
        user_id: userId,
        emoji: emoji,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error adding reaction:", error);
      return false;
    }
  },

  /**
   * Pin a message
   * @param {string} messageId - Message ID
   */
  async pinMessage(messageId) {
    try {
      const { error } = await supabase
        .from("slack_messages")
        .update({ pinned: true })
        .eq("id", messageId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error pinning message:", error);
      return false;
    }
  },

  /**
   * Send a thread reply
   * @param {string} parentId - Parent message ID
   * @param {string} message - Reply text
   */
  async sendThreadReply(parentId, message) {
    try {
      const userId = (await supabase.auth.getUser()).data?.user?.id;

      const { error } = await supabase.from("slack_messages").insert({
        parent_id: parentId,
        text: message,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error sending thread reply:", error);
      return false;
    }
  },
};

export default SlackMessaging;
