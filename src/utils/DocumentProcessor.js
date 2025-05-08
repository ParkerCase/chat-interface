// src/utils/DocumentProcessor.js
import { supabase } from "../lib/supabase";

/**
 * Utility class for processing documents based on storage settings
 * This handles validation, versioning, and metadata for uploaded documents
 */
class DocumentProcessor {
  constructor() {
    this.settings = null;
    this.initialized = false;
  }

  /**
   * Initialize the processor by loading settings
   */
  async initialize() {
    if (!this.initialized) {
      await this.loadStorageSettings();
      this.initialized = true;
    }
    return this;
  }

  // Update these methods in your DocumentProcessor.js file

  /**
   * Generate file path based on settings and file info
   * @param {File} file - The file to generate path for
   * @param {Number} version - Optional version number
   * @returns {String} The storage path
   */
  generateFilePath(file, version = 1) {
    if (!this.settings) {
      throw new Error(
        "DocumentProcessor not initialized. Call initialize() first."
      );
    }

    const basePath = this.settings.storagePath.replace(/^\//, ""); // Remove leading slash if present
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    // Get filename and extension
    const lastDotIndex = file.name.lastIndexOf(".");
    const fileName =
      lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
    const fileExt =
      lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : "";

    // Add version to filename if version > 1
    const versionedName =
      version > 1 ? `${fileName}_v${version}${fileExt}` : file.name;

    // Create a path structure: /basePath/year/month/versionedName
    return `${basePath}/${year}/${month}/${versionedName}`;
  }

  /**
   * Check if a file already exists and handle versioning
   * @param {String} bucket - Storage bucket name
   * @param {String} path - File path
   * @param {File} file - The original file object
   * @returns {Promise<Object>} Status and version information
   */
  async checkExistingFile(bucket, path, file) {
    try {
      // First, check if exact file already exists
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path.split("/").slice(0, -1).join("/"));

      if (error) throw error;

      const fileName = path.split("/").pop();
      const exactMatch = data.find((item) => item.name === fileName);

      if (!exactMatch) {
        return { exists: false, version: 1, path };
      }

      // If versioning is disabled, we'll just overwrite (using upsert)
      if (!this.settings.enableVersioning) {
        return { exists: true, version: 1, path };
      }

      // We need to create a new version
      // First, get the base name and extension
      const lastDotIndex = file.name.lastIndexOf(".");
      const baseName =
        lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
      const fileExt =
        lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : "";

      // Look for existing versions of this file
      const versionRegex = new RegExp(
        `^${baseName}_v(\\d+)${fileExt.replace(".", "\\.")}$`
      );
      const versions = data
        .filter(
          (item) => item.name === file.name || versionRegex.test(item.name)
        )
        .map((item) => {
          // Extract version number
          const match = item.name.match(versionRegex);
          return match ? parseInt(match[1], 10) : 1;
        });

      // Find highest version
      const highestVersion = versions.length > 0 ? Math.max(...versions) : 0;
      const newVersion = highestVersion + 1;

      // Generate new versioned path
      const versionedPath = this.generateFilePath(file, newVersion);

      return { exists: true, version: newVersion, path: versionedPath };
    } catch (error) {
      console.error("Error checking existing file:", error);
      // If there's an error, assume it doesn't exist and use version 1
      return { exists: false, version: 1, path };
    }
  }

  /**
   * Upload a document file to storage and process it for the knowledge base
   * @param {File} file - The file to upload
   * @param {String} bucket - The storage bucket name
   * @param {Object} options - Additional options like userId
   * @returns {Promise<Object>} Upload result
   */
  async processAndUploadDocument(file, bucket = "documents", options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // 1. Validate the file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Generate initial file path
      const initialPath = this.generateFilePath(file);

      // 3. Check for existing versions
      const existingFile = await this.checkExistingFile(
        bucket,
        initialPath,
        file
      );
      const version = existingFile.version;
      const filePath = existingFile.path;

      // 4. Generate metadata
      const metadata = this.generateMetadata(file, version);

      if (options.userId) {
        metadata.uploadedBy = options.userId;
      }

      // 5. Upload file to storage
      console.log(`Uploading file to ${filePath}, version ${version}`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: !this.settings.enableVersioning ? true : false, // Only upsert if versioning is disabled
          contentType: file.type,
          metadata,
        });

      if (uploadError) throw uploadError;

      // 6. Extract text from document
      const extractedText = await this.extractTextFromDocument(file);

      // 7. Generate embedding
      const embedding = await this.generateEmbedding(extractedText);

      // 8. Create record in documents table
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert([
          {
            name: file.name,
            path: filePath,
            storage_path: uploadData.path || filePath,
            content: extractedText,
            embedding,
            metadata,
            document_type: "document",
            source_type: "upload",
            status: "active",
            created_by: options.userId,
          },
        ]);

      if (docError) throw docError;

      return {
        success: true,
        filePath,
        metadata,
        version,
      };
    } catch (error) {
      console.error("Error processing document:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Load storage settings from Supabase
   */
  async loadStorageSettings() {
    try {
      // Fetch from settings table
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("category", "storage");

      if (error) throw error;

      const settings = {};
      if (data && data.length > 0) {
        // Convert array of settings to object
        data.forEach((setting) => {
          // Convert string "true"/"false" to actual booleans
          if (setting.value === "true") {
            settings[setting.key] = true;
          } else if (setting.value === "false") {
            settings[setting.key] = false;
          } else if (!isNaN(setting.value) && setting.value !== "") {
            // Convert numeric strings to numbers
            settings[setting.key] = Number(setting.value);
          } else {
            settings[setting.key] = setting.value;
          }
        });
      }

      // Set defaults if settings are missing
      this.settings = {
        storagePath: settings.storagePath || "/data/uploads",
        maxFileSize: settings.maxFileSize || 50, // MB
        acceptedFileTypes:
          settings.acceptedFileTypes || "pdf,doc,docx,xls,xlsx,csv,txt",
        storageQuota: settings.storageQuota || 50, // GB
        enableVersioning:
          settings.enableVersioning !== undefined
            ? settings.enableVersioning
            : true,
        autoDeleteOldVersions:
          settings.autoDeleteOldVersions !== undefined
            ? settings.autoDeleteOldVersions
            : false,
        retentionDays: settings.retentionDays || 30,
        compressionEnabled:
          settings.compressionEnabled !== undefined
            ? settings.compressionEnabled
            : true,
      };

      return this.settings;
    } catch (error) {
      console.error("Error loading storage settings:", error);
      // Fallback to default settings
      this.settings = {
        storagePath: "/data/uploads",
        maxFileSize: 50, // MB
        acceptedFileTypes: "pdf,doc,docx,xls,xlsx,csv,txt",
        storageQuota: 50, // GB
        enableVersioning: true,
        autoDeleteOldVersions: false,
        retentionDays: 30,
        compressionEnabled: true,
      };
      return this.settings;
    }
  }

  /**
   * Validate a file against storage settings
   * @param {File} file - The file to validate
   * @returns {Object} Validation result with status and error message if any
   */
  validateFile(file) {
    if (!this.initialized || !this.settings) {
      throw new Error(
        "DocumentProcessor not initialized. Call initialize() first."
      );
    }

    // Check file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > this.settings.maxFileSize) {
      return {
        valid: false,
        error: `File exceeds maximum size limit of ${this.settings.maxFileSize}MB.`,
      };
    }

    // Check file type
    const fileExtension = file.name.split(".").pop().toLowerCase();
    const acceptedTypes = this.settings.acceptedFileTypes
      .split(",")
      .map((type) => type.trim().toLowerCase());

    if (!acceptedTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type '${fileExtension}' is not allowed. Accepted types: ${this.settings.acceptedFileTypes}`,
      };
    }

    return { valid: true };
  }

  // Add this method to your DocumentProcessor.js file

  /**
   * Sanitize filename to make it safe for storage
   * @param {string} filename - The original filename
   * @returns {string} - The sanitized filename
   */
  sanitizeFilename(filename) {
    // Replace problematic characters with underscores
    // Remove/replace characters that cause issues in URLs and storage paths
    return filename
      .replace(/[·]/g, "-") // Replace middle dot with hyphen
      .replace(/[&+%]/g, "-") // Replace &, +, % with hyphen
      .replace(/[=\[\]{}]/g, "-") // Replace =, [], {} with hyphen
      .replace(/[#^|]/g, "-") // Replace #, ^, | with hyphen
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/__+/g, "_") // Replace multiple underscores with single
      .replace(/--+/g, "-") // Replace multiple hyphens with single
      .replace(/[^\w\-_.]/g, "") // Remove any remaining non-alphanumeric characters except -, _, and .
      .trim(); // Trim whitespace from ends
  }

  /**
   * Generate metadata for the file based on settings
   * @param {File} file - The file to generate metadata for
   * @param {Number} version - Version number (optional)
   * @returns {Object} The metadata object
   */
  generateMetadata(file, version = 1) {
    if (!this.settings) {
      throw new Error(
        "DocumentProcessor not initialized. Call initialize() first."
      );
    }

    const fileExtension = file.name.split(".").pop().toLowerCase();
    const currentDate = new Date().toISOString();

    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: fileExtension,
      uploadedAt: currentDate,
      version: version,
      isVersioned: this.settings.enableVersioning,
      isCompressed: this.settings.compressionEnabled,
      retentionDays: this.settings.autoDeleteOldVersions
        ? this.settings.retentionDays
        : null,
      storagePath: this.settings.storagePath,
      visibleTo: ["super_admin", "admin", "user"], // Default visibility
    };
  }

  /**
   * Extract text content from a document file
   * @param {File} file - The document file
   * @returns {Promise<String>} The extracted text content
   */
  async extractTextFromDocument(file) {
    try {
      const fileExtension = file.name.split(".").pop().toLowerCase();

      // Convert file to base64
      const fileContent = await this.readFileAsBase64(file);

      try {
        // Call the document processing function with base64 content
        const { data, error } = await supabase.functions.invoke(
          "extract-document-text",
          {
            body: {
              filename: file.name,
              fileContent,
              fileType: fileExtension,
            },
          }
        );

        if (error) throw error;

        return data?.text || `Could not extract text from ${file.name}`;
      } catch (e) {
        console.warn("Error using edge function for extraction:", e);

        // Fallback: Handle locally if edge function fails
        if (["txt", "csv"].includes(fileExtension)) {
          // For text files, just read as text
          return await this.readFileAsText(file);
        } else {
          // For other file types, return placeholder
          return `Text from ${file.name} [Type: ${fileExtension}]. Extraction service is currently unavailable.`;
        }
      }
    } catch (error) {
      console.error("Error extracting text from document:", error);
      return `Error extracting text from ${file.name}: ${error.message}`;
    }
  }

  /**
   * Read a file as base64
   * @param {File} file - The file to read
   * @returns {Promise<String>} The file content as base64
   */
  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:text/plain;base64,")
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  /**
   * Read a file as text
   * @param {File} file - The file to read
   * @returns {Promise<String>} The file content as text
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  }

  /**
   * Generate embedding for document text
   * @param {String} text - The text to embed
   * @returns {Promise<Array<Number>>} The embedding vector
   */
  async generateEmbedding(text) {
    try {
      // Truncate text if very long to avoid processing delays
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      try {
        // Call the embedding function
        const { data, error } = await supabase.functions.invoke(
          "generate-embedding",
          {
            body: { text: truncatedText },
          }
        );

        if (error) throw error;

        return data?.embedding || [];
      } catch (e) {
        console.warn(
          "Error using edge function for embedding, using fallback:",
          e
        );
        // Fallback: return empty array (or you could use a 3rd party API here)
        return [];
      }
    } catch (error) {
      console.error("Error generating embedding:", error);
      return []; // Return empty array as fallback
    }
  }
}

// Create and export a singleton instance
const documentProcessor = new DocumentProcessor();
export default documentProcessor;
