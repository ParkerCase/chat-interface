// src/components/crm/CRMContactLookup.jsx - Fixed import paths
import React, { useState, useEffect, useCallback } from "react";
import {
  Input,
  Button,
  Card,
  CardBody,
  Avatar,
  Select,
  Spinner,
  Badge,
  Table,
} from "../../ui/index.js";
import {
  Search,
  User,
  Phone,
  Mail,
  FileText,
  ExternalLink,
  RefreshCw,
  UserPlus,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { debounce } from "lodash";
import { useCRM } from "../../hooks/useCRM";
import CreateContactForm from "./CreateContactForm";

const CRMContactLookup = ({
  onSelectContact,
  showDocuments = false,
  provider = null,
  allowProviderChange = true,
  className = "",
}) => {
  const {
    providers,
    selectedProvider,
    defaultProvider,
    isLoading: crmLoading,
    error: crmError,
    setSelectedProvider,
    searchContacts,
    getContactDocuments,
  } = useCRM(provider);

  const [searchTerm, setSearchTerm] = useState("");
  const [contacts, setContacts] = useState([]);
  const [documents, setDocuments] = useState({});
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [providerStatus, setProviderStatus] = useState({});

  const checkProviderStatus = async () => {
    if (!selectedProvider) return;

    try {
      // For Zenoti provider
      if (selectedProvider === "zenoti") {
        const response = await fetch("/api/zenoti/status");
        const data = await response.json();
        setProviderStatus((prev) => ({
          ...prev,
          [selectedProvider]: data.status === "connected",
        }));
      } else {
        // Generic check for other providers
        const response = await fetch(
          `/api/crm/config?provider=${selectedProvider}`
        );
        const data = await response.json();
        setProviderStatus((prev) => ({
          ...prev,
          [selectedProvider]: data.success,
        }));
      }
    } catch (err) {
      console.error(`Error checking ${selectedProvider} status:`, err);
      setProviderStatus((prev) => ({
        ...prev,
        [selectedProvider]: false,
      }));
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term, provider) => {
      if (!term || term.length < 2) {
        setContacts([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const result = await searchContacts(term, { provider });
        setContacts(result.contacts || []);

        if (result.contacts?.length === 0) {
          setError("No contacts found");
        }
      } catch (err) {
        setError(err.message || "Failed to search contacts");
        setContacts([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [searchContacts]
  );

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value, selectedProvider);
  };

  // Handle provider change
  const handleProviderChange = (e) => {
    const value = e.target.value;
    setSelectedProvider(value);

    if (searchTerm) {
      debouncedSearch(searchTerm, value);
    }
  };

  // Handle contact selection
  const handleSelectContact = (contact) => {
    if (onSelectContact) {
      // Add provider information to contact
      onSelectContact({
        ...contact,
        provider: selectedProvider,
      });
    }

    // Load documents if needed
    if (showDocuments) {
      loadContactDocuments(contact.id);
    }
  };

  // Load contact documents
  const loadContactDocuments = async (contactId) => {
    if (documents[contactId]) return;

    try {
      const result = await getContactDocuments(contactId);

      setDocuments((prev) => ({
        ...prev,
        [contactId]: result.documents || [],
      }));
    } catch (err) {
      console.error("Error loading contact documents:", err);
    }
  };

  // Handle creating new contact
  const handleCreateNewContact = () => {
    setShowCreateForm(true);
  };

  // Handle contact creation success
  const handleContactCreated = (newContact) => {
    setShowCreateForm(false);
    setContacts([newContact, ...contacts]);
    handleSelectContact(newContact);
  };

  useEffect(() => {
    if (selectedProvider) {
      checkProviderStatus();
    }
  }, [selectedProvider]);

  // Render loading state for CRM providers
  if (crmLoading && providers.length === 0) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="md" />
        <span className="ml-2">Loading CRM providers...</span>
      </div>
    );
  }

  // Render error state for CRM providers
  if (crmError && providers.length === 0) {
    return (
      <div className="text-red-500 p-4 border border-red-300 rounded">
        {crmError}
      </div>
    );
  }

  return (
    <div className={`crm-contact-lookup ${className}`}>
      <div className="flex flex-col space-y-4">
        {/* Provider selector and search bar */}
        <div className="flex space-x-2">
          {allowProviderChange && providers.length > 0 && (
            <div className="flex items-center">
              <Select
                value={selectedProvider}
                onChange={handleProviderChange}
                className="w-40"
              >
                {providers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName || p.name}
                  </option>
                ))}
              </Select>
              {selectedProvider && (
                <div className="ml-2">
                  {providerStatus[selectedProvider] ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative flex-1">
            <Input
              placeholder="Search contacts by name or email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10"
              disabled={isSearching || !selectedProvider}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {isSearching ? (
                <Spinner size="sm" />
              ) : (
                <Search className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {/* Contact results */}
        {contacts.length > 0 ? (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <Card
                key={contact.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSelectContact(contact)}
              >
                <CardBody className="p-4">
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 flex-shrink-0 mr-3">
                      <User className="h-6 w-6" />
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contact.name || "Unknown"}
                      </p>

                      <div className="flex items-center text-xs text-gray-500 space-x-2">
                        {contact.email && (
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}

                        {contact.phone && (
                          <div className="flex items-center ml-2">
                            <Phone className="h-3 w-3 mr-1" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge variant="outline" className="ml-2">
                      {selectedProvider}
                    </Badge>
                  </div>

                  {/* Show documents if enabled and loaded */}
                  {showDocuments &&
                    documents[contact.id] &&
                    documents[contact.id].length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium mb-1">
                          Related Documents:
                        </p>
                        <Table className="text-xs">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Date</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documents[contact.id].map((doc) => (
                              <tr key={doc.id}>
                                <td className="flex items-center">
                                  <FileText className="h-3 w-3 mr-1" />
                                  <span className="truncate max-w-xs">
                                    {doc.title}
                                  </span>
                                </td>
                                <td>
                                  {new Date(doc.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                  <Button size="xs" variant="ghost" asChild>
                                    <a
                                      href={doc.viewUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                </CardBody>
              </Card>
            ))}
          </div>
        ) : searchTerm.length > 0 && !isSearching ? (
          <div className="text-center py-4 text-gray-500">
            No contacts found matching "{searchTerm}"
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateNewContact}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Create New Contact
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create contact form modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CreateContactForm
              provider={selectedProvider}
              initialData={{ name: searchTerm }}
              onSuccess={handleContactCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMContactLookup;
