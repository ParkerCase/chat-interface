// src/components/crm/CRMDocumentLinker.jsx
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
  Spinner,
} from "@/components/ui";
import { Paperclip, Link, Check, AlertCircle } from "lucide-react";
import CRMContactLookup from "./CRMContactLookup";
import apiService from "../../services/apiService";
import { useCRM } from "../../hooks/useCRM";

const CRMDocumentLinker = ({
  documentPath,
  documentMetadata = null,
  onSuccess,
  onCancel,
  className = "",
}) => {
  const { linkDocumentToContact } = useCRM();
  const [selectedContact, setSelectedContact] = useState(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [metadata, setDocumentMetadata] = useState(documentMetadata);

  // Load document metadata if not provided
  useEffect(() => {
    if (!metadata && documentPath) {
      const loadMetadata = async () => {
        try {
          const response = await apiService.storage.getMetadata(documentPath);

          if (response.data?.success) {
            setDocumentMetadata(response.data.metadata);
          } else {
            console.warn("Metadata response unsuccessful:", response.data);
          }
        } catch (err) {
          console.error("Error loading document metadata:", err);
        }
      };

      loadMetadata();
    }
  }, [documentPath, metadata]);

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
      // Prepare document metadata
      const docMetadata = {
        ...metadata,
        description,
      };

      // Link document to contact
      const result = await linkDocumentToContact(selectedContact.id, {
        documentPath,
        documentMetadata: docMetadata,
      });

      if (result?.success) {
        setSuccess(true);

        // Call success callback after a short delay for better UX
        setTimeout(() => {
          if (onSuccess) {
            onSuccess({
              contact: selectedContact,
              documentPath,
              result: result.document,
            });
          }
        }, 1500);
      } else {
        setError(result?.error || "Failed to link document");
      }
    } catch (err) {
      setError(err?.message || "Failed to link document to contact");
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
                {metadata?.name || documentPath.split("/").pop()}
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
                ({selectedContact.email || selectedContact.phone || ""})
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
            disabled={isLoading || success}
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
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading || success}
          >
            Cancel
          </Button>
        )}

        <Button
          onClick={handleLinkDocument}
          disabled={!selectedContact || isLoading || success}
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Linking...
            </>
          ) : success ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Linked
            </>
          ) : (
            "Link Document"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CRMDocumentLinker;
