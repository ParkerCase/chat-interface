// src/components/ChatImageSearchIntegration.jsx
import React, { useEffect, useCallback } from "react";
import { useChatImageSearch } from "../hooks/useChatImageSearch";
import ChatImageResults from "./ChatImageResults";

/**
 * Component to integrate image search into the chat component
 * @param {Object} props - Component props
 * @param {Array} props.messages - Current chat messages
 * @param {Function} props.onSendMessage - Function to send a message
 * @param {Function} props.onAddResponse - Function to add a response to the chat
 * @returns {JSX.Element} Chat image search integration component
 */
const ChatImageSearchIntegration = ({
  messages = [],
  onSendMessage,
  onAddResponse,
  children,
}) => {
  const {
    processImageSearchRequest,
    isImageSearchRequest,
    results,
    loading,
    searchParams,
    responseText,
  } = useChatImageSearch();

  /**
   * Process the last message if it's an image search request
   */
  const processLastMessage = useCallback(async () => {
    if (!messages.length) return;

    const lastMessage = messages[messages.length - 1];

    // Skip if it's not a user message or if it's already being processed
    if (
      lastMessage.type !== "user" ||
      lastMessage.processing === true ||
      lastMessage.processed === true
    ) {
      return;
    }

    // Check if the message is an image search request
    if (isImageSearchRequest(lastMessage.content)) {
      // Mark as processing to prevent duplicate processing
      if (onSendMessage) {
        onSendMessage({
          ...lastMessage,
          processing: true,
        });
      }

      // Process the image search request
      const result = await processImageSearchRequest(lastMessage.content);

      // Mark as processed
      if (onSendMessage) {
        onSendMessage({
          ...lastMessage,
          processing: false,
          processed: true,
        });
      }

      // Add response to chat
      if (onAddResponse) {
        onAddResponse({
          id: Date.now().toString(),
          type: "assistant",
          content: result.response,
          images: result.results,
          searchParams: result.searchParams,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [
    messages,
    isImageSearchRequest,
    processImageSearchRequest,
    onSendMessage,
    onAddResponse,
  ]);

  // Process last message when messages change
  useEffect(() => {
    processLastMessage();
  }, [messages, processLastMessage]);

  /**
   * Render a chat message that includes image search results
   * @param {Object} message - Chat message
   * @returns {JSX.Element} Rendered message
   */
  const renderImageSearchMessage = (message) => {
    // If not a message with images, return null
    if (message.type !== "assistant" || !message.images) {
      return null;
    }

    return (
      <ChatImageResults
        images={message.images}
        responseText={message.content}
        searchParams={message.searchParams}
        onImageClick={(image) => {
          console.log("Image clicked in chat:", image);
          // You can add custom handling here
        }}
      />
    );
  };

  // This component doesn't render anything itself
  // It just processes messages and adds responses
  return children;
};

export default ChatImageSearchIntegration;
