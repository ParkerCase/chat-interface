// src/hooks/useChatWithImageSearch.js
import { useState, useCallback, useEffect } from "react";
import { useChatImageSearch } from "./useChatImageSearch";

/**
 * Hook to integrate image search into a chat interface
 * @param {Object} options - Configuration options
 * @param {Array} options.initialMessages - Initial chat messages
 * @returns {Object} Chat state and methods with image search capabilities
 */
export function useChatWithImageSearch(options = {}) {
  const { initialMessages = [] } = options;

  // Chat state
  const [messages, setMessages] = useState(initialMessages);
  const [isTyping, setIsTyping] = useState(false);

  // Image search hook
  const {
    processImageSearchRequest,
    isImageSearchRequest,
    loading: imageSearchLoading,
  } = useChatImageSearch();

  /**
   * Add a user message to the chat
   * @param {string} content - Message content
   * @returns {Object} The added message
   */
  const sendMessage = useCallback((content) => {
    // Create message object
    const newMessage = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    // Add to messages
    setMessages((prevMessages) => [...prevMessages, newMessage]);

    return newMessage;
  }, []);

  /**
   * Add an assistant response to the chat
   * @param {Object} responseData - Response data
   * @returns {Object} The added response
   */
  const addResponse = useCallback((responseData) => {
    const newResponse = {
      id: responseData.id || Date.now().toString(),
      type: "assistant",
      content: responseData.content || "",
      images: responseData.images || null,
      searchParams: responseData.searchParams || null,
      timestamp: responseData.timestamp || new Date().toISOString(),
    };

    setMessages((prevMessages) => [...prevMessages, newResponse]);
    setIsTyping(false);

    return newResponse;
  }, []);

  /**
   * Update an existing message in the chat
   * @param {Object} updatedMessage - Updated message data
   */
  const updateMessage = useCallback((updatedMessage) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
      )
    );
  }, []);

  /**
   * Process the last message for image search if needed
   */
  useEffect(() => {
    const processLastMessage = async () => {
      if (!messages.length) return;

      const lastMessage = messages[messages.length - 1];

      // Skip if it's not a user message or if it's already processed
      if (
        lastMessage.type !== "user" ||
        lastMessage.processing === true ||
        lastMessage.processed === true
      ) {
        return;
      }

      // Check if it's an image search request
      if (isImageSearchRequest(lastMessage.content)) {
        // Mark as processing
        updateMessage({
          ...lastMessage,
          processing: true,
        });

        setIsTyping(true);

        // Process the request
        try {
          const result = await processImageSearchRequest(lastMessage.content);

          // Mark as processed
          updateMessage({
            ...lastMessage,
            processing: false,
            processed: true,
          });

          // Add response
          addResponse({
            content: result.response,
            images: result.results,
            searchParams: result.searchParams,
          });
        } catch (error) {
          console.error("Error processing image search:", error);

          // Mark as processed with error
          updateMessage({
            ...lastMessage,
            processing: false,
            processed: true,
            error: true,
          });

          // Add error response
          addResponse({
            content: `I'm sorry, I couldn't process that image search request. ${error.message}`,
          });
        }
      }
    };

    processLastMessage();
  }, [
    messages,
    isImageSearchRequest,
    processImageSearchRequest,
    updateMessage,
    addResponse,
  ]);

  /**
   * Handle sending a chat message
   * @param {string} content - Message content
   */
  const handleSendMessage = useCallback(
    (content) => {
      if (!content.trim()) return;

      const message = sendMessage(content);

      // If not an image search request, add a default response
      // This is where you would normally handle other types of bot responses
      if (!isImageSearchRequest(content)) {
        setIsTyping(true);
        // Simulate typing delay
        setTimeout(() => {
          addResponse({
            content:
              "I'll need to pass this to my general AI system. Would you like me to process this as an image search instead?",
          });
        }, 1000);
      }

      return message;
    },
    [sendMessage, addResponse, isImageSearchRequest]
  );

  /**
   * Clear the chat history
   */
  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isTyping,
    isSearching: imageSearchLoading,
    sendMessage: handleSendMessage,
    addResponse,
    updateMessage,
    clearChat,
  };
}

export default useChatWithImageSearch;
