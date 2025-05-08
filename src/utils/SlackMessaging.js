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

      // Call the RPC function
      const { data, error } = await supabase.rpc("slack_send_message", {
        channel_id: channelId,
        message_text: message,
      });

      if (error) {
        console.error("Backend error sending message:", error);
        throw error;
      }

      // If we need to directly insert into the database as a fallback
      if (!data) {
        // Direct insert fallback if RPC fails
        const { error: insertError } = await supabase
          .from("slack_messages")
          .insert({
            channel_id: channelId,
            text: message,
            user_id: (await supabase.auth.getUser()).data?.user?.id,
            timestamp: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error("Error sending Slack message:", error);
      // Return false so the component can handle the error appropriately
      return false;
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

      const { data, error } = await supabase.rpc("slack_send_attachment", {
        channel_id: channelId,
        attachment_data: attachmentInfo,
      });

      if (error) {
        // Fallback to direct insert if RPC fails
        const { error: insertError } = await supabase
          .from("slack_messages")
          .insert({
            channel_id: channelId,
            text: attachmentInfo.text || "Shared an attachment",
            user_id: (await supabase.auth.getUser()).data?.user?.id,
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
};

export default SlackMessaging;
