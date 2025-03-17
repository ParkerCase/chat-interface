import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Textarea,
  Alert,
  AlertTitle,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui";
import { Paperclip, Link, Check, AlertCircle } from "lucide-react";
import CRMContactLookup from "./CRMContactLookup";

const CRMDocumentLinker = ({
  documentPath,
  documentMetadata = null,
  onSuccess,
  onCancel,
  className = "",
}) => {
  const [selectedContact, setSelectedContact] = useState(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Load document metadata if not provided
  useEffect(() => {
    if (!documentMetadata && documentPath) {
      const loadMetadata = async () => {
        try {
          const response = await fetch(
            `/api/storage/metadata?path=${encodeURIComponent(documentPath)}`
          );
          const data = await response.json();

          if (data.success) {
            setDocumentMetadata(data.metadata);
          }
        } catch (err) {
          console.error("Error loading document metadata:", err);
        }
      };

      loadMetadata();
    }
  }, [documentPath, documentMetadata]);

  // Handle contact selection from lookup
  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setError(null); // Clear any previous errors
  };

  // Handle linking the document to the contact
  const handleLinkDocument = async () => {
    if (!selectedContact) {
      setError("Please select a contact");
      return;
    }

    if (!documentPath) {
      setError("No document path provided");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/crm/contacts/${selectedContact.id}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentPath,
            provider: selectedContact.provider,
            documentMetadata: {
              ...documentMetadata,
              description,
            },
          }),
        }
      );

      const data = await response.json();

      if (data.success || data.id) {
        setSuccess(true);

        if (onSuccess) {
          onSuccess({
            contact: selectedContact,
            documentPath,
            result: data,
          });
        }
      } else {
        setError(data.error || "Failed to link document");
      }
    } catch (err) {
      setError("Failed to link document to contact");
      console.error("Error linking document:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`max-w-lg ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Link className="h-5 w-5 mr-2" />
          Link Document to CRM Contact
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Document information */}
        <div className="p-3 bg-gray-50 rounded-md">
          <div className="flex items-start">
            <Paperclip className="h-5 w-5 mr-2 mt-0.5" />
            <div>
              <p className="font-medium">
                {documentMetadata?.name || documentPath.split("/").pop()}
              </p>
              <p className="text-sm text-gray-500 truncate">{documentPath}</p>
            </div>
          </div>
        </div>

        {/* Contact lookup */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Select Contact
          </label>
          <CRMContactLookup
            onSelectContact={handleSelectContact}
            showDocuments={false}
          />

          {selectedContact && (
            <div className="mt-2 p-2 border rounded-md bg-blue-50 flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              <span className="font-medium">{selectedContact.name}</span>
              <span className="ml-2 text-sm text-gray-500">
                ({selectedContact.email})
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Document Description (Optional)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description about this document..."
            rows={3}
          />
        </div>

        {/* Error message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <p>{error}</p>
          </Alert>
        )}

        {/* Success message */}
        {success && (
          <Alert variant="success">
            <Check className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <p>Document successfully linked to contact</p>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="border-t pt-4 flex justify-end space-x-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}

        <Button
          onClick={handleLinkDocument}
          disabled={!selectedContact || isLoading || success}
        >
          {isLoading ? "Linking..." : success ? "Linked" : "Link Document"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CRMDocumentLinker;
