// src/services/crmService.js
import apiClient from "./apiService";

const crmService = {
  // Get available CRM providers
  getProviders: async () => {
    try {
      console.log("Fetching CRM providers...");
      return await apiClient.get("/api/crm/providers");
    } catch (error) {
      console.error("Error getting CRM providers:", error);
      throw error;
    }
  },

  // Get CRM configuration
  getConfiguration: async (provider) => {
    try {
      return await apiClient.get("/api/crm/config", { params: { provider } });
    } catch (error) {
      console.error("Error getting CRM configuration:", error);
      throw error;
    }
  },

  // Update CRM configuration
  updateConfiguration: async (provider, config) => {
    try {
      console.log("Updating CRM configuration for", provider);
      return await apiClient.post("/api/crm/config", { provider, config });
    } catch (error) {
      console.error("Error updating CRM configuration:", error);
      throw error;
    }
  },

  // Search contacts
  getContacts: async (provider, query, limit = 20, page = 1) => {
    try {
      console.log("Searching CRM contacts:", { provider, query });
      return await apiClient.get("/api/crm/contacts", {
        params: { provider, query, limit, page },
      });
    } catch (error) {
      console.error("Error getting CRM contacts:", error);
      throw error;
    }
  },

  // Create a contact
  createContact: async (contact, provider) => {
    try {
      console.log("Creating CRM contact:", { provider });
      return await apiClient.post("/api/crm/contacts", { contact, provider });
    } catch (error) {
      console.error("Error creating CRM contact:", error);
      throw error;
    }
  },

  // Link document to contact
  linkDocumentToContact: async (contactId, documentData, provider) => {
    try {
      console.log("Linking document to contact:", { contactId, provider });
      return await apiClient.post(`/api/crm/contacts/${contactId}/documents`, {
        documentPath: documentData.documentPath,
        documentMetadata: documentData.documentMetadata,
        provider,
      });
    } catch (error) {
      console.error("Error linking document to contact:", error);
      throw error;
    }
  },
};

export default crmService;
