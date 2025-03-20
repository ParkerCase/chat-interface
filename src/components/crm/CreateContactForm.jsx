// src/components/crm/CreateContactForm.jsx
import React, { useState } from "react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Alert,
  AlertTitle,
  Spinner,
} from "@/components/ui";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useCRM } from "../../hooks/useCRM";

const CreateContactForm = ({
  provider,
  initialData = {},
  onSuccess,
  onCancel,
}) => {
  const { createContact } = useCRM(provider);

  const [formData, setFormData] = useState({
    firstName: initialData.firstName || "",
    lastName: initialData.lastName || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    company: initialData.company || "",
    notes: initialData.notes || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // If initialData has a full name, split it into first and last
  if (initialData.name && !initialData.firstName && !initialData.lastName) {
    const nameParts = initialData.name.split(" ");
    if (nameParts.length > 1) {
      formData.firstName = nameParts[0];
      formData.lastName = nameParts.slice(1).join(" ");
    } else if (nameParts.length === 1) {
      formData.lastName = nameParts[0];
    }
  }

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Form validation
    if (!formData.email && !formData.phone) {
      setError("Either email or phone is required");
      return;
    }

    if (!formData.lastName) {
      setError("Last name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Prepare contact data
      const contactData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        notes: formData.notes,
      };

      // Create contact
      const result = await createContact(contactData);

      if (result.success) {
        setSuccess(true);

        // Call onSuccess callback after a short delay for better UX
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(result.contact);
          }
        }, 1000);
      } else {
        setError(result.error || "Failed to create contact");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-1">
      <h3 className="text-lg font-semibold mb-4">Create New Contact</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            Either email or phone is required
          </p>
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            disabled={isSubmitting}
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
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <p>Contact created successfully</p>
          </Alert>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Creating...
              </>
            ) : (
              "Create Contact"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateContactForm;
