// src/components/crm/CRMDocumentLinker.jsx
import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Textarea,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Spinner,
} from "../../ui/index.js";
import { Paperclip, Link, Check, AlertCircle, RefreshCw } from "lucide-react";
import CRMContactLookup from "./CRMContactLookup";
import { useCRM } from "../../hooks/useCRM";
import apiService from "../../services/apiService";
import analyticsUtils from "../../utils/analyticsUtils";

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
  const [documentPreview, setDocumentPreview] = useState(null);

  // Load document metadata if not provided
  useEffect(() => {
    if (!metadata && documentPath) {
      const loadMetadata = async () => {
        try {
          setIsLoading(true);
          const response = await apiService.storage.getMetadata(documentPath);

          if (response.data?.success) {
            setDocumentMetadata(response.data.metadata);

            // Try to get a document preview if it's an image
            if (
              response.data.metadata?.type?.startsWith("image/") ||
              documentPath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
            ) {
              setDocumentPreview(
                `/api/storage/preview?path=${encodeURIComponent(documentPath)}`
              );
            } else if (documentPath.match(/\.(pdf)$/i)) {
              setDocumentPreview(
                `/api/storage/thumbnail?path=${encodeURIComponent(
                  documentPath
                )}&page=1`
              );
            }
          } else {
            console.warn("Metadata response unsuccessful:", response.data);
          }
        } catch (err) {
          console.error("Error loading document metadata:", err);
        } finally {
          setIsLoading(false);
        }
      };

      loadMetadata();
    }
  }, [documentPath, metadata]);

  // Handle contact selection from lookup
  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setError(null); // Clear any previous errors

    // Track contact selection for analytics
    analyticsUtils.trackEvent(analyticsUtils.EVENT_TYPES.CRM_CONTACT_SELECT, {
      contactId: contact.id,
      contactName: contact.name,
      provider: contact.provider,
      forDocument: true,
    });
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
        linked_at: new Date().toISOString(),
        linked_by: localStorage.getItem("username") || "unknown",
      };

      // Link document to contact
      const result = await linkDocumentToContact(selectedContact.id, {
        documentPath,
        documentMetadata: docMetadata,
        provider: selectedContact.provider,
      });

      if (result?.success) {
        setSuccess(true);

        // Track successful document linking
        analyticsUtils.trackEvent(
          analyticsUtils.EVENT_TYPES.CRM_DOCUMENT_LINK,
          {
            contactId: selectedContact.id,
            contactName: selectedContact.name,
            provider: selectedContact.provider,
            documentPath,
            documentType: metadata?.type || "unknown",
          }
        );

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
      // Track error for analytics
      analyticsUtils.trackError(err, "document_linking");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle retrying metadata load
  const handleRetryMetadata = async () => {
    if (!documentPath) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.storage.getMetadata(documentPath, {
        forceRefresh: true,
      });

      if (response.data?.success) {
        setDocumentMetadata(response.data.metadata);

        // Try to get a document preview if it's an image
        if (
          response.data.metadata?.type?.startsWith("image/") ||
          documentPath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ) {
          setDocumentPreview(
            `/api/storage/preview?path=${encodeURIComponent(documentPath)}`
          );
        } else if (documentPath.match(/\.(pdf)$/i)) {
          setDocumentPreview(
            `/api/storage/thumbnail?path=${encodeURIComponent(
              documentPath
            )}&page=1`
          );
        }
      } else {
        throw new Error(response.data?.error || "Failed to refresh metadata");
      }
    } catch (err) {
      setError(`Failed to refresh metadata: ${err.message}`);
      console.error("Error refreshing metadata:", err);
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
            <div className="flex-1">
              <p className="font-medium">
                {metadata?.name || documentPath.split("/").pop()}
              </p>
              <p className="text-sm text-gray-500 truncate">{documentPath}</p>
              {metadata && (
                <div className="text-xs text-gray-500 mt-1">
                  {metadata.size && (
                    <span className="mr-3">
                      Size: {(metadata.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                  {metadata.type && (
                    <span className="mr-3">Type: {metadata.type}</span>
                  )}
                  {metadata.created && (
                    <span>
                      Created: {new Date(metadata.created).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
            {documentPath && !metadata && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetryMetadata}
                title="Refresh metadata"
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>

          {/* Document preview if available */}
          {documentPreview && (
            <div className="mt-3 flex justify-center">
              <div className="border border-gray-200 rounded overflow-hidden max-h-40">
                <img
                  src={documentPreview}
                  alt="Document preview"
                  className="max-h-40 object-contain"
                />
              </div>
            </div>
          )}
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
            <p>{error}</p>
          </Alert>
        )}

        {/* Success message */}
        {success && (
          <Alert variant="success">
            <Check className="h-4 w-4" />
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
