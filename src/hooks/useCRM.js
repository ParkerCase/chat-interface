// src/hooks/useCRM.js
import { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useToast } from "@/components/ui/use-toast";

/**
 * Custom hook for CRM functionality
 */
export function useCRM(initialProvider = null) {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);
  const [defaultProvider, setDefaultProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  // Load CRM providers
  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.crm.getProviders();

      if (response.data.success) {
        setProviders(response.data.providers || []);
        setDefaultProvider(response.data.defaultProvider);

        // Set selected provider if not already set
        if (!selectedProvider && response.data.providers?.length > 0) {
          setSelectedProvider(
            response.data.defaultProvider || response.data.providers[0].name
          );
        }
      } else {
        setError("Failed to load CRM providers");
      }
    } catch (err) {
      setError("Failed to load CRM providers");

      toast({
        title: "Error",
        description: "Failed to load CRM providers. Please try again.",
        variant: "destructive",
      });

      console.error("Error loading CRM providers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider, toast]);

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

        const response = await apiService.crm.getContacts(
          provider,
          searchTerm,
          options.limit || 10
        );

        if (response.data.success) {
          return {
            contacts: response.data.contacts || [],
            total: response.data.total,
            pagination: response.data.pagination,
          };
        } else {
          setError(response.data.error || "Failed to search contacts");
          return { contacts: [] };
        }
      } catch (err) {
        setError("Failed to search contacts");

        toast({
          title: "Error",
          description: "Failed to search contacts. Please try again.",
          variant: "destructive",
        });

        console.error("Error searching contacts:", err);
        return { contacts: [] };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider, toast]
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

        const response = await apiService.crm.getContactDocuments(
          contactId,
          selectedProvider
        );

        if (response.data.success) {
          return {
            documents: response.data.documents || [],
          };
        } else {
          setError(response.data.error || "Failed to get contact documents");
          return { documents: [] };
        }
      } catch (err) {
        setError("Failed to get contact documents");

        toast({
          title: "Error",
          description: "Failed to load contact documents. Please try again.",
          variant: "destructive",
        });

        console.error("Error getting contact documents:", err);
        return { documents: [] };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider, toast]
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

        // Adjust data format to match backend expectations
        const requestData = {
          documentPath: documentData.documentPath,
          documentMetadata: documentData.documentMetadata || documentData,
          provider: selectedProvider,
        };

        const response = await apiService.crm.linkDocument(
          contactId,
          requestData
        );

        if (response.data.success) {
          toast({
            title: "Success",
            description: "Document successfully linked to contact.",
            variant: "default",
          });

          return {
            success: true,
            document: response.data.document,
          };
        } else {
          setError(response.data.error || "Failed to link document");

          toast({
            title: "Error",
            description: response.data.error || "Failed to link document.",
            variant: "destructive",
          });

          return { success: false, error: response.data.error };
        }
      } catch (err) {
        setError("Failed to link document");

        toast({
          title: "Error",
          description: "Failed to link document. Please try again.",
          variant: "destructive",
        });

        console.error("Error linking document:", err);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider, toast]
  );

  const createContact = useCallback(
    async (contactData) => {
      if (!selectedProvider) {
        return { success: false, error: "No CRM provider selected" };
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await apiService.crm.createContact(
          contactData,
          selectedProvider
        );

        if (response.data.success) {
          toast({
            title: "Success",
            description: "Contact successfully created.",
            variant: "default",
          });

          return {
            success: true,
            contact: response.data.contact,
          };
        } else {
          setError(response.data.error || "Failed to create contact");

          toast({
            title: "Error",
            description: response.data.error || "Failed to create contact.",
            variant: "destructive",
          });

          return { success: false, error: response.data.error };
        }
      } catch (err) {
        setError("Failed to create contact");

        toast({
          title: "Error",
          description: "Failed to create contact. Please try again.",
          variant: "destructive",
        });

        console.error("Error creating contact:", err);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider, toast]
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
