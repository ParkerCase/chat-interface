// src/utils/SlackMessaging.js
import { supabase } from "../lib/supabase";

export const SlackMessaging = {
  /**
   * Get available channels for the current user
   */
  async getChannels() {
    try {
      const { data, error } = await supabase.rpc("slack_get_channels");

      if (error) throw error;
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
   */
  async getMessages(channelId, limit = 50) {
    try {
      const { data, error } = await supabase.rpc("slack_get_messages", {
        channel_id: channelId,
        message_limit: limit,
      });

      if (error) throw error;
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
      const { data, error } = await supabase.rpc("slack_send_message", {
        channel_id: channelId,
        message_text: message,
      });

      if (error) throw error;
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

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  },
};

export default SlackMessaging;
