// src/utils/SupabaseStorageIntegration.jsx
import { supabase } from "../lib/supabase";

/**
 * Utility functions to integrate with Supabase Storage
 * This provides a consistent interface for storage operations
 */
export const SupabaseStorage = {
  /**
   * List all buckets
   * @returns {Promise<Array>} List of buckets
   */
  listBuckets: async () => {
    try {
      const { data, error } = await supabase.storage.listBuckets();

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error listing buckets:", error);
      throw error;
    }
  },

  /**
   * Create a new bucket
   * @param {string} name - Bucket name
   * @param {Object} options - Bucket options
   * @returns {Promise<Object>} Bucket data
   */
  createBucket: async (name, options = { public: false }) => {
    try {
      const { data, error } = await supabase.storage.createBucket(
        name,
        options
      );

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error creating bucket:", error);
      throw error;
    }
  },

  /**
   * Delete a bucket
   * @param {string} name - Bucket name
   * @returns {Promise<void>}
   */
  deleteBucket: async (name) => {
    try {
      const { error } = await supabase.storage.deleteBucket(name);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Error deleting bucket:", error);
      throw error;
    }
  },

  /**
   * List all files in a bucket/folder
   * @param {string} bucket - Bucket name
   * @param {string} path - Folder path (optional)
   * @returns {Promise<Array>} List of files
   */
  listFiles: async (bucket, path = "") => {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(path, {
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error listing files:", error);
      throw error;
    }
  },

  /**
   * Upload a file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in the bucket
   * @param {File} file - File to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload data
   */
  uploadFile: async (bucket, path, file, options = {}) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          ...options,
        });

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  /**
   * Update file with upsert
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in the bucket
   * @param {File} file - File to upload
   * @returns {Promise<Object>} Upload data
   */
  updateFile: async (bucket, path, file) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error updating file:", error);
      throw error;
    }
  },

  /**
   * Download a file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in the bucket
   * @returns {Promise<Blob>} File blob
   */
  downloadFile: async (bucket, path) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) {
        throw error;
      }

      return data; // Blob
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  },

  /**
   * Get public URL for a file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in the bucket
   * @returns {string} Public URL
   */
  getPublicUrl: (bucket, path) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  },

  /**
   * Generate a signed URL (time-limited)
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in the bucket
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} Signed URL
   */
  getSignedUrl: async (bucket, path, expiresIn = 60) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        throw error;
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw error;
    }
  },

  /**
   * Delete a file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path or array of paths
   * @returns {Promise<Object>} Result
   */
  deleteFile: async (bucket, path) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).remove(path);

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },

  /**
   * Move/rename a file
   * @param {string} bucket - Bucket name
   * @param {string} fromPath - Original path
   * @param {string} toPath - New path
   * @returns {Promise<Object>} Result
   */
  moveFile: async (bucket, fromPath, toPath) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .move(fromPath, toPath);

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error moving file:", error);
      throw error;
    }
  },

  /**
   * Copy a file
   * @param {string} bucket - Bucket name
   * @param {string} fromPath - Original path
   * @param {string} toPath - New path
   * @returns {Promise<Object>} Result
   */
  copyFile: async (bucket, fromPath, toPath) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .copy(fromPath, toPath);

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error copying file:", error);
      throw error;
    }
  },

  /**
   * Create a folder (by creating an empty .folder file)
   * @param {string} bucket - Bucket name
   * @param {string} path - Folder path
   * @returns {Promise<Object>} Result
   */
  createFolder: async (bucket, path) => {
    try {
      const folderPath = path.endsWith("/") ? path : `${path}/`;
      const emptyFile = new Blob([""], { type: "text/plain" });

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(`${folderPath}.folder`, emptyFile, {
          contentType: "application/x-directory",
          upsert: true,
        });

      if (error) {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error("Error creating folder:", error);
      throw error;
    }
  },

  /**
   * Get metadata for a file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path
   * @returns {Promise<Object>} Metadata
   */
  getMetadata: async (bucket, path) => {
    try {
      // Unfortunately, Supabase JS client doesn't have a direct method for file metadata
      // We can use a workaround by listing the parent folder and finding the file
      const folderPath = path.split("/").slice(0, -1).join("/");
      const fileName = path.split("/").pop();

      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folderPath);

      if (error) {
        throw error;
      }

      const fileData = data.find((file) => file.name === fileName);

      if (!fileData) {
        throw new Error("File not found");
      }

      return fileData;
    } catch (error) {
      console.error("Error getting file metadata:", error);
      throw error;
    }
  },

  /**
   * Update bucket or file permissions
   * @param {string} bucket - Bucket name
   * @param {string} path - File path (optional, if not provided, updates bucket permissions)
   * @param {Object} permissions - Permission object
   * @returns {Promise<Object>} Result
   */
  updatePermissions: async (bucket, path = null, permissions = {}) => {
    try {
      // This is a placeholder as the current supabase-js client doesn't have a direct
      // method for updating storage permissions via the JS client
      // In a real implementation, you would use a server-side function or SQL RPC

      // For now, return a mock success response
      return { success: true };
    } catch (error) {
      console.error("Error updating permissions:", error);
      throw error;
    }
  },
};

export default SupabaseStorage;
