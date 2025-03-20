// src/hooks/useCRM.js - Basic implementation
import { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";

/**
 * Custom hook for CRM functionality
 */
export function useCRM(initialProvider = null) {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);
  const [defaultProvider, setDefaultProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load CRM providers
  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // In a real app, this would be an API call - simulating here
      const mockProviders = [
        { name: "zenoti", displayName: "Zenoti" },
        { name: "hubspot", displayName: "HubSpot" },
        { name: "salesforce", displayName: "Salesforce" },
      ];

      setProviders(mockProviders);
      setDefaultProvider("zenoti");

      // Set selected provider if not already set
      if (!selectedProvider && mockProviders.length > 0) {
        setSelectedProvider("zenoti");
      }
    } catch (err) {
      setError("Failed to load CRM providers");
      console.error("Error loading CRM providers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider]);

  // Search contacts
  const searchContacts = useCallback(
    async (searchTerm, options = {}) => {
      if (!searchTerm || searchTerm.length < 2) {
        return { contacts: [] };
      }

      const provider = options.provider || selectedProvider;

      try {
        setIsLoading(true);
        setError(null);

        // In a real app, this would be an API call - simulating here
        const mockContacts = [
          {
            id: "1",
            name: "John Doe",
            email: "john@example.com",
            phone: "555-123-4567",
          },
          {
            id: "2",
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "555-987-6543",
          },
        ];

        // Filter contacts by search term
        const filteredContacts = mockContacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
          contacts: filteredContacts,
          total: filteredContacts.length,
        };
      } catch (err) {
        setError("Failed to search contacts");
        console.error("Error searching contacts:", err);
        return { contacts: [] };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider]
  );

  // Get contact documents
  const getContactDocuments = useCallback(
    async (contactId) => {
      if (!contactId || !selectedProvider) {
        return { documents: [] };
      }

      try {
        setIsLoading(true);
        setError(null);

        // In a real app, this would be an API call - simulating here
        const mockDocuments = [
          {
            id: "doc1",
            title: "Treatment Plan",
            createdAt: new Date().toISOString(),
            viewUrl: "#",
          },
          {
            id: "doc2",
            title: "Before Images",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            viewUrl: "#",
          },
        ];

        return { documents: mockDocuments };
      } catch (err) {
        setError("Failed to get contact documents");
        console.error("Error getting contact documents:", err);
        return { documents: [] };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider]
  );

  // Link document to contact
  const linkDocumentToContact = useCallback(
    async (contactId, documentData) => {
      if (!contactId || !selectedProvider || !documentData.documentPath) {
        return { success: false, error: "Missing required information" };
      }

      try {
        setIsLoading(true);
        setError(null);

        // In a real app, this would be an API call - simulating success
        return {
          success: true,
          document: {
            id: "new-doc-id",
            title: documentData.documentPath.split("/").pop(),
            createdAt: new Date().toISOString(),
          },
        };
      } catch (err) {
        setError("Failed to link document");
        console.error("Error linking document:", err);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider]
  );

  const createContact = useCallback(
    async (contactData) => {
      if (!selectedProvider) {
        return { success: false, error: "No CRM provider selected" };
      }

      try {
        setIsLoading(true);
        setError(null);

        // In a real app, this would be an API call - simulating success
        return {
          success: true,
          contact: {
            id: "new-contact-id",
            name: `${contactData.firstName} ${contactData.lastName}`,
            email: contactData.email,
            phone: contactData.phone,
          },
        };
      } catch (err) {
        setError("Failed to create contact");
        console.error("Error creating contact:", err);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider]
  );

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  return {
    providers,
    selectedProvider,
    defaultProvider,
    isLoading,
    error,
    setSelectedProvider,
    setError,
    searchContacts,
    getContactDocuments,
    linkDocumentToContact,
    createContact,
    refreshProviders: loadProviders,
  };
}
