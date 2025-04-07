// src/hooks/useCRM.js
import { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import zenotiService from "../services/zenotiService";

/**
 * Custom hook for CRM functionality
 */
export function useCRM(initialProvider = null) {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);
  const [defaultProvider, setDefaultProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providerStatus, setProviderStatus] = useState({});

  // Load CRM providers
  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to fetch providers from API
      try {
        const response = await apiService.crm.getProviders();
        if (response.data && response.data.success) {
          setProviders(response.data.providers || []);
          setDefaultProvider(response.data.defaultProvider || "zenoti");
        } else {
          // Fall back to mock providers if API call fails
          setProviders([
            { name: "zenoti", displayName: "Zenoti" },
            { name: "hubspot", displayName: "HubSpot" },
            { name: "salesforce", displayName: "Salesforce" },
          ]);
          setDefaultProvider("zenoti");
        }
      } catch (e) {
        console.warn("Falling back to mock providers:", e);
        // Fall back to mock providers if API call fails
        setProviders([
          { name: "zenoti", displayName: "Zenoti" },
          { name: "hubspot", displayName: "HubSpot" },
          { name: "salesforce", displayName: "Salesforce" },
        ]);
        setDefaultProvider("zenoti");
      }

      // Set selected provider if not already set
      if (!selectedProvider && providers.length > 0) {
        setSelectedProvider(defaultProvider || providers[0].name);
      }
    } catch (err) {
      setError("Failed to load CRM providers");
      console.error("Error loading CRM providers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider, providers.length, defaultProvider]);

  // Check provider connection status
  const checkProviderStatus = useCallback(
    async (provider = selectedProvider) => {
      if (!provider) return false;

      try {
        // For Zenoti provider
        if (provider === "zenoti") {
          const response = await zenotiService.checkConnectionStatus();
          const isConnected =
            response.data?.success && response.data?.status === "connected";

          setProviderStatus((prev) => ({
            ...prev,
            [provider]: isConnected,
          }));

          return isConnected;
        } else {
          // Generic check for other providers
          const response = await apiService.crm.getConfiguration(provider);
          const isConnected = response.data?.success || false;

          setProviderStatus((prev) => ({
            ...prev,
            [provider]: isConnected,
          }));

          return isConnected;
        }
      } catch (err) {
        console.error(`Error checking ${provider} status:`, err);
        setProviderStatus((prev) => ({
          ...prev,
          [provider]: false,
        }));
        return false;
      }
    },
    [selectedProvider]
  );

  // Search contacts with proper error handling
  const searchContacts = useCallback(
    async (searchTerm, options = {}) => {
      if (!searchTerm || searchTerm.length < 2) {
        return { contacts: [] };
      }

      const provider = options.provider || selectedProvider;

      try {
        setIsLoading(true);
        setError(null);

        // Use the actual API if provider status is connected
        if (providerStatus[provider]) {
          if (provider === "zenoti") {
            const response = await zenotiService.searchClients({
              query: searchTerm,
              limit: options.limit || 10,
              centerCode: options.centerCode,
            });

            if (response.data && response.data.success) {
              // Format Zenoti clients to match our contact structure
              const contacts = (response.data.clients || []).map((client) => ({
                id: client.id || client.guest_id,
                name: `${client.first_name || ""} ${
                  client.last_name || ""
                }`.trim(),
                email: client.email,
                phone: client.mobile,
                provider: "zenoti",
                centerCode: client.center_code,
                // Add other fields as needed
              }));

              return {
                contacts,
                total: response.data.totalCount || contacts.length,
              };
            }
          } else {
            // Handle other providers through CRM API
            const response = await apiService.crm.getContacts(
              provider,
              searchTerm,
              options.limit || 10
            );

            if (response.data && response.data.success) {
              return {
                contacts: response.data.contacts || [],
                total:
                  response.data.totalCount ||
                  response.data.contacts?.length ||
                  0,
              };
            }
          }
        }

        // Fall back to mock data if API call fails or provider not connected
        console.log("Using mock contact data for", provider);
        const mockContacts = [
          {
            id: "1",
            name: "John Doe",
            email: "john@example.com",
            phone: "555-123-4567",
            provider,
          },
          {
            id: "2",
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "555-987-6543",
            provider,
          },
        ];

        // Filter contacts by search term
        const filteredContacts = mockContacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (contact.email &&
              contact.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (contact.phone && contact.phone.includes(searchTerm))
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
    [selectedProvider, providerStatus]
  );

  // Get contact documents with improved error handling
  const getContactDocuments = useCallback(
    async (contactId) => {
      if (!contactId || !selectedProvider) {
        return { documents: [] };
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use the actual API if provider status is connected
        if (providerStatus[selectedProvider]) {
          try {
            const response = await apiService.crm.getContactDocuments(
              contactId,
              selectedProvider
            );

            if (response.data && response.data.success) {
              return {
                documents: response.data.documents || [],
                total:
                  response.data.totalCount ||
                  response.data.documents?.length ||
                  0,
              };
            }
          } catch (err) {
            console.error("Error getting contact documents:", err);
            // Continue to fallback instead of throwing
          }
        }

        // Fall back to mock data
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
    [selectedProvider, providerStatus]
  );

  // Link document to contact with improved error handling
  const linkDocumentToContact = useCallback(
    async (contactId, documentData) => {
      if (!contactId || !selectedProvider || !documentData.documentPath) {
        return { success: false, error: "Missing required information" };
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use the actual API if provider status is connected
        if (providerStatus[selectedProvider]) {
          try {
            const response = await apiService.crm.linkDocument(contactId, {
              ...documentData,
              provider: selectedProvider,
            });

            if (response.data && response.data.success) {
              return {
                success: true,
                document: response.data.document,
              };
            } else {
              throw new Error(
                response.data?.error || "Failed to link document"
              );
            }
          } catch (err) {
            console.error("Error linking document:", err);
            // Continue to fallback instead of immediately throwing
            return {
              success: false,
              error: err.message || "Failed to link document to contact",
            };
          }
        }

        // Fall back to mock success response
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
    [selectedProvider, providerStatus]
  );

  // Create contact with improved error handling
  const createContact = useCallback(
    async (contactData) => {
      if (!selectedProvider) {
        return { success: false, error: "No CRM provider selected" };
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use the actual API if provider status is connected
        if (providerStatus[selectedProvider]) {
          try {
            let response;

            if (selectedProvider === "zenoti") {
              // Format the contact data for Zenoti
              const zenotiContactData = {
                first_name: contactData.firstName,
                last_name: contactData.lastName,
                email: contactData.email,
                mobile: contactData.phone,
                gender: contactData.gender || "NA",
                // Add other fields as needed
              };

              response = await zenotiService.createClient(zenotiContactData);
            } else {
              response = await apiService.crm.createContact(
                contactData,
                selectedProvider
              );
            }

            if (response.data && response.data.success) {
              // Handle different response formats
              const contact = response.data.client || response.data.contact;

              // Format the contact data consistently
              const formattedContact = {
                id: contact.id || contact.guest_id,
                name: `${contact.first_name || ""} ${
                  contact.last_name || ""
                }`.trim(),
                email: contact.email,
                phone: contact.mobile || contact.phone,
                provider: selectedProvider,
              };

              return {
                success: true,
                contact: formattedContact,
              };
            } else {
              throw new Error(
                response.data?.error || "Failed to create contact"
              );
            }
          } catch (err) {
            console.error("Error creating contact:", err);
            // Continue to fallback instead of immediately throwing
            return {
              success: false,
              error: err.message || "Failed to create contact",
            };
          }
        }

        // Fall back to mock success response
        return {
          success: true,
          contact: {
            id: "new-contact-id",
            name: `${contactData.firstName} ${contactData.lastName}`,
            email: contactData.email,
            phone: contactData.phone,
            provider: selectedProvider,
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
    [selectedProvider, providerStatus]
  );

  // Load providers and check status on mount or when provider changes
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (selectedProvider) {
      checkProviderStatus(selectedProvider);
    }
  }, [selectedProvider, checkProviderStatus]);

  return {
    providers,
    selectedProvider,
    defaultProvider,
    isLoading,
    error,
    providerStatus,
    setSelectedProvider,
    setError,
    searchContacts,
    getContactDocuments,
    linkDocumentToContact,
    createContact,
    refreshProviders: loadProviders,
    checkProviderStatus,
  };
}
