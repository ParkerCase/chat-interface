// src/utils/DocumentProcessor.js - Enhanced with Redis Caching
import { supabase } from "../lib/supabase";
import { DocumentCache, RedisCache } from "./RedisCache";

/**
 * Utility class for processing documents based on storage settings
 * Enhanced with Redis caching for improved performance
 */
class DocumentProcessor {
  constructor() {
    this.settings = null;
    this.initialized = false;
    this.settingsCacheKey = "global:document:settings";
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

    // Sanitize the filename before using it
    const sanitizedFileName = this.sanitizeFilename(fileName);

    // Add version to filename if version > 1
    const versionedName =
      version > 1
        ? `${sanitizedFileName}_v${version}${fileExt}`
        : `${sanitizedFileName}${fileExt}`;

    // Create a path structure: /basePath/year/month/versionedName
    return `${basePath}/${year}/${month}/${versionedName}`;
  }

  /**
   * Check if a file already exists and handle versioning with caching
   * @param {String} bucket - Storage bucket name
   * @param {String} path - File path
   * @param {File} file - The original file object
   * @returns {Promise<Object>} Status and version information
   */
  async checkExistingFile(bucket, path, file) {
    try {
      // Cache key for path existence
      const pathExistsCacheKey = `${bucket}:path:${path}:exists`;

      // Try to get from cache first
      const cachedResult = await RedisCache.get(pathExistsCacheKey);
      if (cachedResult) {
        console.log("Using cached path existence check:", cachedResult);
        return cachedResult;
      }

      // Extract the folder path and filename
      const pathParts = path.split("/");
      const fileName = pathParts.pop(); // Get the last part (filename)
      const folderPath = pathParts.join("/"); // Rebuild the folder path

      // First, check if the folder exists and what files are in it
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folderPath);

      if (error) {
        console.error("Error listing folder contents:", error);
        // If there's an error listing the folder, it might not exist yet - assume no duplicate
        return { exists: false, version: 1, path };
      }

      // Check if the exact file already exists
      const exactMatch = data && data.find((item) => item.name === fileName);

      if (!exactMatch) {
        // File doesn't exist, use version 1
        const result = { exists: false, version: 1, path };
        // Cache the result for 5 minutes
        await RedisCache.set(pathExistsCacheKey, result, 300);
        return result;
      }

      // If versioning is disabled, we'll need to use upsert
      if (!this.settings.enableVersioning) {
        const result = { exists: true, version: 1, path, useUpsert: true };
        // Cache the result for 5 minutes
        await RedisCache.set(pathExistsCacheKey, result, 300);
        return result;
      }

      // Versioning is enabled - need to create a new versioned filename

      // Extract the base name and extension
      const lastDotIndex = fileName.lastIndexOf(".");
      const baseName =
        lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
      const fileExt =
        lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";

      // Look for existing versions with a similar pattern
      const baseNameEscaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special regex chars
      const versionRegex = new RegExp(
        `^${baseNameEscaped}_v(\\d+)${fileExt.replace(".", "\\.")}$`
      );

      let highestVersion = 1; // Start with version 1

      if (data && data.length > 0) {
        for (const item of data) {
          // Check if this file matches the base name or is a versioned variant
          const match = item.name.match(versionRegex);
          if (match) {
            const version = parseInt(match[1], 10);
            if (version > highestVersion) {
              highestVersion = version;
            }
          }
        }
      }

      // Create the new version path
      const newVersion = highestVersion + 1;
      const versionedName = `${baseName}_v${newVersion}${fileExt}`;
      const versionedPath = pathParts.concat(versionedName).join("/");

      const result = { exists: true, version: newVersion, path: versionedPath };

      // Cache the result for 5 minutes
      await RedisCache.set(pathExistsCacheKey, result, 300);

      return result;
    } catch (error) {
      console.error("Error checking existing file:", error);
      // If there's any error, assume it doesn't exist and use version 1
      return { exists: false, version: 1, path };
    }
  }

  /**
   * Load storage settings from Supabase with caching
   */
  async loadStorageSettings() {
    try {
      // Try to get settings from cache first
      const cachedSettings = await RedisCache.get(this.settingsCacheKey);
      if (cachedSettings) {
        console.log("Using cached storage settings");
        this.settings = cachedSettings;
        return this.settings;
      }

      // Fetch from settings table if not in cache
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

      // Cache the settings for 1 hour
      await RedisCache.set(this.settingsCacheKey, this.settings, 3600);

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
   * Extract text content from a document file with caching
   * @param {File} file - The document file
   * @returns {Promise<String>} The extracted text content
   */
  async extractTextFromDocument(file) {
    try {
      // Generate a unique key for this file based on name and size
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      const cacheKey = `extract:text:${btoa(fileKey).replace(
        /[^a-zA-Z0-9]/g,
        ""
      )}`;

      // Try to get from cache first
      const cachedText = await RedisCache.get(cacheKey);
      if (cachedText) {
        console.log("Using cached text extraction for:", file.name);
        return cachedText;
      }

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

        const extractedText =
          data?.text || `Could not extract text from ${file.name}`;

        // Cache the extracted text for 24 hours
        await RedisCache.set(cacheKey, extractedText, 86400);

        return extractedText;
      } catch (e) {
        console.warn("Error using edge function for extraction:", e);

        // Fallback: Handle locally if edge function fails
        let fallbackText;
        if (["txt", "csv"].includes(fileExtension)) {
          // For text files, just read as text
          fallbackText = await this.readFileAsText(file);
        } else {
          // For other file types, return placeholder
          fallbackText = `Text from ${file.name} [Type: ${fileExtension}]. Extraction service is currently unavailable.`;
        }

        // Cache the fallback text for 1 hour (shorter TTL for fallback)
        await RedisCache.set(cacheKey, fallbackText, 3600);

        return fallbackText;
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
   * Upload a document file to storage and process it for the knowledge base with caching
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

      // 2. Generate initial file path with sanitized filename
      const initialPath = this.generateFilePath(file);
      console.log(`Initial path generated: ${initialPath}`);

      // 3. Check for existing versions
      const existingFile = await this.checkExistingFile(
        bucket,
        initialPath,
        file
      );
      const version = existingFile.version;
      const filePath = existingFile.path;
      const useUpsert =
        existingFile.useUpsert || !this.settings.enableVersioning;
      console.log(
        `File path after version check: ${filePath}, version: ${version}, useUpsert: ${useUpsert}`
      );

      // 4. Generate metadata
      const metadata = this.generateMetadata(file, version);

      if (options.userId) {
        metadata.uploadedBy = options.userId;
      }

      // 5. Upload file to storage
      console.log(
        `Uploading file to ${filePath}, version ${version}, useUpsert: ${useUpsert}`
      );
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: useUpsert,
          contentType: file.type,
          metadata,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      console.log("File uploaded successfully to storage", uploadData);

      // 6. Extract text from document
      let extractedText = "";
      try {
        extractedText = await this.extractTextFromDocument(file);
        console.log(
          `Extracted ${extractedText.length} characters of text from document`
        );
      } catch (extractError) {
        console.warn(
          "Text extraction failed, continuing with empty text:",
          extractError
        );
        extractedText = `[Text extraction failed for ${file.name}]`;
      }

      // 7. Generate embedding
      let embedding = [];
      try {
        embedding = await this.generateEmbedding(extractedText);
        console.log(`Generated embedding with ${embedding.length} dimensions`);
      } catch (embeddingError) {
        console.warn(
          "Embedding generation failed, continuing with empty embedding:",
          embeddingError
        );
      }

      // 8. Create record in documents table
      // First, check the table structure to ensure we're using the right column names
      try {
        console.log("Attempting to insert document record to database");

        // Determine document type
        const documentType = this.getDocumentType(file);

        // Create a document record with flexible column mapping to handle different table structures
        const documentRecord = {
          // Use title or name depending on schema
          title: file.name,
          name: file.name, // Some schemas use name instead of title

          // Path fields
          path: filePath,
          storage_path: uploadData.path || filePath,

          // Content and embedding
          content: extractedText,
          embedding: embedding && embedding.length ? embedding : null,

          // Metadata
          metadata: metadata,

          // Type fields - flexible mapping for different schemas
          document_type: documentType,
          type: documentType, // Some schemas use type instead of document_type

          source_type: "upload",
          source: "upload", // Some schemas use source instead of source_type

          // Status fields
          status: "active",

          // User tracking
          created_by: options.userId || null,

          // Timestamps
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Attempt to insert the record
        const { data: docData, error: docError } = await supabase
          .from("documents")
          .insert([documentRecord]);

        // Cache document data for fast retrieval
        if (!docError && docData && docData.length > 0) {
          const docId = docData[0].id;
          await DocumentCache.invalidateDocument(docId);
          console.log(
            "Document record created successfully and cached:",
            docData
          );
        } else if (docError) {
          console.error("Database insert error:", docError);
          // Don't throw here, we'll still consider the upload successful even if the DB insert fails
          console.warn(
            "File uploaded but database record creation failed. File can still be accessed from storage."
          );

          return {
            success: true,
            filePath,
            metadata,
            version,
            databaseSuccess: false,
            databaseError: docError.message,
          };
        }

        // Invalidate any folder cache that might contain this document
        if (options.folderId) {
          await RedisCache.delete(`folder:${options.folderId}:docs`);
        }

        return {
          success: true,
          filePath,
          metadata,
          version,
          databaseSuccess: true,
        };
      } catch (dbError) {
        console.error("Error in database operation:", dbError);
        // Still return success for the file upload part
        return {
          success: true,
          filePath,
          metadata,
          version,
          databaseSuccess: false,
          databaseError: dbError.message,
        };
      }
    } catch (error) {
      console.error("Error processing document:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Determine document type based on file extension
   * @param {File} file - The file to check
   * @returns {String} The document type
   */
  getDocumentType(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    const extensionMap = {
      // Documents
      pdf: "document",
      doc: "document",
      docx: "document",
      txt: "document",
      rtf: "document",
      // Spreadsheets
      xls: "spreadsheet",
      xlsx: "spreadsheet",
      csv: "spreadsheet",
      // Images
      jpg: "image",
      jpeg: "image",
      png: "image",
      gif: "image",
      svg: "image",
      // Presentations
      ppt: "presentation",
      pptx: "presentation",
      // Other types as needed
    };

    return extensionMap[extension] || "document";
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
   * Generate embedding for document text with caching
   * @param {String} text - The text to embed
   * @returns {Promise<Array<Number>>} The embedding vector
   */
  async generateEmbedding(text) {
    try {
      // Create a hash of the text for caching
      const textHash = this.hashString(text);
      const cacheKey = `embedding:${textHash}`;

      // Try to get from cache first
      const cachedEmbedding = await RedisCache.get(cacheKey);
      if (cachedEmbedding) {
        console.log("Using cached embedding");
        return cachedEmbedding;
      }

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

        const embedding = data?.embedding || [];

        // Cache the embedding for 30 days (embeddings rarely change)
        if (embedding.length > 0) {
          await RedisCache.set(cacheKey, embedding, 30 * 86400);
        }

        return embedding;
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

  /**
   * Create a simple hash of a string for caching purposes
   * @private
   * @param {string} str - String to hash
   * @returns {string} - Hashed string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Create and export a singleton instance
const documentProcessor = new DocumentProcessor();
export default documentProcessor;
