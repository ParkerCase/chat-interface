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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui";
import {
  Search,
  User,
  Phone,
  Mail,
  FileText,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { debounce } from "lodash";

const CRMContactLookup = ({
  onSelectContact,
  showDocuments = false,
  provider = null,
  allowProviderChange = true,
  className = "",
}) => {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(provider);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contacts, setContacts] = useState([]);
  const [documents, setDocuments] = useState({});
  const [error, setError] = useState(null);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch("/api/crm/providers");
        const data = await response.json();

        if (data.success && data.providers.length > 0) {
          setProviders(data.providers);

          // Set default provider if not already set
          if (!selectedProvider) {
            setSelectedProvider(data.defaultProvider || data.providers[0].name);
          }
        } else {
          setError("No CRM providers available");
        }
      } catch (err) {
        setError("Failed to load CRM providers");
        console.error("Error loading CRM providers:", err);
      }
    };

    loadProviders();
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term, provider) => {
      if (!term || term.length < 2) {
        setContacts([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/crm/contacts?provider=${provider}&query=${encodeURIComponent(
            term
          )}&limit=10`
        );
        const data = await response.json();

        if (data.success) {
          setContacts(data.contacts || []);
        } else {
          setError(data.error || "Failed to search contacts");
          setContacts([]);
        }
      } catch (err) {
        setError("Failed to search contacts");
        setContacts([]);
        console.error("Error searching contacts:", err);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
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
      onSelectContact(contact);
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
      const response = await fetch(
        `/api/crm/contacts/${contactId}/documents?provider=${selectedProvider}`
      );
      const data = await response.json();

      if (data.success) {
        setDocuments((prev) => ({
          ...prev,
          [contactId]: data.documents || [],
        }));
      }
    } catch (err) {
      console.error("Error loading contact documents:", err);
    }
  };

  // Render loading state
  if (providers.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="md" />
        <span className="ml-2">Loading CRM providers...</span>
      </div>
    );
  }

  // Render error state
  if (error && providers.length === 0) {
    return (
      <div className="text-red-500 p-4 border border-red-300 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className={`crm-contact-lookup ${className}`}>
      <div className="flex flex-col space-y-4">
        {/* Provider selector and search bar */}
        <div className="flex space-x-2">
          {allowProviderChange && (
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
          )}

          <div className="relative flex-1">
            <Input
              placeholder="Search contacts by name or email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10"
              disabled={isLoading}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {isLoading ? (
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
        ) : searchTerm.length > 0 && !isLoading ? (
          <div className="text-center py-4 text-gray-500">
            No contacts found matching "{searchTerm}"
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Implement create contact functionality
                  console.log("Create contact:", searchTerm);
                }}
              >
                Create New Contact
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CRMContactLookup;
