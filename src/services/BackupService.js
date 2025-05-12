// src/services/BackupService.js - Updated to remove function invocation
import axios from "axios";
import { supabase } from "../lib/supabase";
import apiService from "./apiService";

/**
 * Service for handling backup and embedding maintenance operations
 */
class BackupService {
  // At the top of BackupService.js, add this helper function
  getApiUrl = () => {
    // Use environment variable if available, otherwise use a default
    return process.env.REACT_APP_API_URL || "http://147.182.247.128:4000";
  };

  async triggerEmbeddingMaintenance(options = {}) {
    try {
      console.log("Triggering embedding maintenance");

      // Use the exact URL that worked in console
      const url =
        "http://147.182.247.128:4000/api/admin/backup/run-embedding-maintenance";

      console.log("Calling:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          providers: options.providers || "dropbox,googledrive",
          embeddingTypes: options.embeddingTypes || "full,partial",
          batchSize: options.batchSize || 50,
          concurrentProcessing: options.concurrentProcessing || 3,
        }),
      });

      if (!response.ok) {
        console.warn(`Embedding maintenance API error (${response.status})`);
        return { success: false, status: response.status };
      }

      return await response.json();
    } catch (error) {
      console.error("Error triggering embedding maintenance:", error);
      return { success: false, error: error.message };
    }
  }

  async triggerDatabaseBackup(options = {}) {
    try {
      console.log("Triggering database backup");

      // Use the exact URL that worked in console
      const url = "http://147.182.247.128:4000/api/admin/backup/database";

      console.log("Calling:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        console.warn(`Database backup API error (${response.status})`);
        return { success: false, status: response.status };
      }

      return await response.json();
    } catch (error) {
      console.error("Error triggering database backup:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a backup record in Supabase with valid status values
   * @param {Object} backupData - Data about the backup
   * @returns {Promise<Object>} The created backup record
   */
  async createBackupRecord(backupData = {}) {
    try {
      // Try different status values in order of preference
      const validStatusValues = ["pending", "running", "completed", "failed"];

      for (const status of validStatusValues) {
        try {
          // Create a record with the current status value
          const baseRecord = {
            type: backupData.type || "manual",
            status: status, // Try each status in sequence
            location: backupData.location || "cloud",
            includes_files:
              backupData.includesFiles !== undefined
                ? backupData.includesFiles
                : true,
            includes_database:
              backupData.includesDatabase !== undefined
                ? backupData.includesDatabase
                : true,
            includes_settings:
              backupData.includesSettings !== undefined
                ? backupData.includesSettings // FIXED: Using backupData instead of backupSettings
                : true,
            created_by: backupData.userId,
            created_at: new Date().toISOString(),
          };

          const { data, error } = await supabase
            .from("backups")
            .insert([baseRecord])
            .select();

          if (error) {
            if (
              error.code === "23514" &&
              error.message.includes("check constraint")
            ) {
              // This status value doesn't work, try the next one
              console.log(
                `Status value '${status}' not allowed, trying next option`
              );
              continue;
            }

            if (error.message?.includes("does not exist")) {
              console.warn(
                "backups table does not exist, skipping record creation"
              );
              return null;
            }

            throw error;
          }

          console.log(
            `Successfully created backup record with status: ${status}`
          );
          return data?.[0] || null;
        } catch (statusError) {
          // If error is not related to constraint violation, throw it
          if (statusError.code !== "23514") {
            throw statusError;
          }
        }
      }

      // If we get here, none of the status values worked
      throw new Error(
        "Could not create backup record - all status values rejected"
      );
    } catch (error) {
      console.error("Error creating backup record:", error);

      // Return null instead of throwing to allow the process to continue
      return null;
    }
  }

  /**
   * Update a backup record in Supabase with valid status values
   * @param {string} backupId - ID of the backup to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} The updated backup record
   */
  async updateBackupRecord(backupId, updateData = {}) {
    try {
      if (!backupId) {
        console.warn("No backup ID provided for update");
        return null;
      }

      // If the update includes a status, make sure it's valid
      if (updateData.status) {
        const validStatusValues = ["pending", "running", "completed", "failed"];

        // If the provided status is not in the valid list, try them in order
        if (!validStatusValues.includes(updateData.status)) {
          for (const status of validStatusValues) {
            try {
              const testUpdateData = { ...updateData, status };

              const { data, error } = await supabase
                .from("backups")
                .update(testUpdateData)
                .eq("id", backupId)
                .select();

              if (!error) {
                console.log(
                  `Successfully updated backup record with status: ${status}`
                );
                return data?.[0] || null;
              }

              if (error.code !== "23514") {
                throw error;
              }
            } catch (statusError) {
              // If error is not constraint violation, throw it
              if (statusError.code !== "23514") {
                throw statusError;
              }
            }
          }

          // If all status values failed, try without a status update
          const noStatusUpdateData = { ...updateData };
          delete noStatusUpdateData.status;

          if (Object.keys(noStatusUpdateData).length > 0) {
            try {
              const { data, error } = await supabase
                .from("backups")
                .update(noStatusUpdateData)
                .eq("id", backupId)
                .select();

              if (error) {
                throw error;
              }

              return data?.[0] || null;
            } catch (updateError) {
              throw updateError;
            }
          }

          // If we couldn't update with or without status, return null
          return null;
        }
      }

      // If no status in update or status is already valid, just do normal update
      const { data, error } = await supabase
        .from("backups")
        .update(updateData)
        .eq("id", backupId)
        .select();

      if (error) {
        if (error.message?.includes("does not exist")) {
          console.warn("backups table does not exist, skipping record update");
          return null;
        }
        throw error;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error("Error updating backup record:", error);
      return null;
    }
  }

  /**
   * Initiate a full backup and sync operation with simplified approach
   * @param {Object} options - Backup options
   * @param {string} userId - User ID
   * @returns {Promise<Object>} The results of the backup operation
   */
  async runBackupAndSync(options = {}, userId) {
    let backupRecord = null;
    let embeddingSuccess = false;
    let databaseSuccess = false;
    let settingsSuccess = false;

    try {
      // 1. Create a backup record to track the process
      try {
        backupRecord = await this.createBackupRecord({
          type: "manual",
          location: options.backupLocation || "cloud",
          includesFiles: options.includeFiles,
          includesDatabase: options.includeDatabase,
          includesSettings: options.includeSettings,
          userId,
        });
      } catch (recordError) {
        console.error("Error creating backup record:", recordError);
        // Continue without a record
      }

      // 2. Call the progress callback with initialization status
      if (options.onProgressUpdate) {
        options.onProgressUpdate({
          step: "initialization",
          message: backupRecord
            ? "Backup record created"
            : "Running without backup record",
          progress: 10,
          backupId: backupRecord?.id,
        });
      }

      // 3. Trigger embedding maintenance if needed
      if (options.includeFiles) {
        if (options.onProgressUpdate) {
          options.onProgressUpdate({
            step: "embedding_maintenance",
            message: "Triggering embedding maintenance...",
            progress: 20,
            backupId: backupRecord?.id,
          });
        }

        try {
          const embeddingResult = await this.triggerEmbeddingMaintenance({
            providers: options.providers || "dropbox,googledrive",
            embeddingTypes: options.embeddingTypes || "full,partial",
            batchSize: options.batchSize || 50,
            concurrentProcessing: options.concurrentProcessing || 3,
          });

          embeddingSuccess = embeddingResult?.success;

          if (options.onProgressUpdate) {
            options.onProgressUpdate({
              step: embeddingSuccess
                ? "embedding_maintenance_complete"
                : "embedding_maintenance_error",
              message: embeddingSuccess
                ? "Embedding maintenance triggered successfully"
                : "Embedding maintenance failed, continuing with other backups",
              progress: 40,
              backupId: backupRecord?.id,
            });
          }
        } catch (embedError) {
          console.error("Embedding maintenance error:", embedError);
          if (options.onProgressUpdate) {
            options.onProgressUpdate({
              step: "embedding_maintenance_error",
              message:
                "Embedding maintenance failed, continuing with other backups",
              progress: 40,
              backupId: backupRecord?.id,
            });
          }
        }
      }

      // 4. Database backup if needed
      if (options.includeDatabase) {
        if (options.onProgressUpdate) {
          options.onProgressUpdate({
            step: "database_backup",
            message: "Backing up database...",
            progress: 50,
            backupId: backupRecord?.id,
          });
        }

        try {
          const dbResult = await this.triggerDatabaseBackup({
            location: options.backupLocation,
          });

          databaseSuccess = dbResult?.success;

          if (options.onProgressUpdate) {
            options.onProgressUpdate({
              step: databaseSuccess
                ? "database_backup_complete"
                : "database_backup_error",
              message: databaseSuccess
                ? "Database backup completed"
                : "Database backup failed, continuing with other backups",
              progress: 70,
              backupId: backupRecord?.id,
            });
          }
        } catch (dbError) {
          console.error("Database backup error:", dbError);
          if (options.onProgressUpdate) {
            options.onProgressUpdate({
              step: "database_backup_error",
              message: "Database backup failed, continuing with other backups",
              progress: 70,
              backupId: backupRecord?.id,
            });
          }
        }
      }

      // 5. Settings backup if needed
      if (options.includeSettings) {
        if (options.onProgressUpdate) {
          options.onProgressUpdate({
            step: "settings_backup",
            message: "Backing up settings...",
            progress: 80,
            backupId: backupRecord?.id,
          });
        }

        try {
          // Use direct Supabase call for settings backup
          const { data: settingsData, error: settingsError } = await supabase
            .from("settings")
            .select("*");

          if (settingsError) {
            throw new Error(
              `Failed to retrieve settings: ${settingsError.message}`
            );
          }

          // Record settings backup
          settingsSuccess = true;

          // Store settings backup if we have a backup record
          if (backupRecord && settingsData) {
            try {
              await supabase.from("settings_backups").insert([
                {
                  backup_id: backupRecord.id,
                  settings_data: settingsData,
                  created_at: new Date().toISOString(),
                  created_by: userId,
                },
              ]);
            } catch (saveError) {
              console.warn(
                "Could not save settings backup:",
                saveError.message
              );
            }
          }

          if (options.onProgressUpdate) {
            options.onProgressUpdate({
              step: "settings_backup_complete",
              message: "Settings backup completed",
              progress: 90,
              backupId: backupRecord?.id,
            });
          }
        } catch (settingsError) {
          console.error("Settings backup error:", settingsError);
          if (options.onProgressUpdate) {
            options.onProgressUpdate({
              step: "settings_backup_error",
              message: "Settings backup failed",
              progress: 90,
              backupId: backupRecord?.id,
            });
          }
        }
      }

      // 6. Update the backup record to mark it as completed
      if (backupRecord) {
        try {
          await this.updateBackupRecord(backupRecord.id, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });
        } catch (updateError) {
          console.error(
            "Error updating backup status, but operations completed:",
            updateError
          );
        }
      }

      // 7. Determine overall success state
      const success =
        (!options.includeFiles || embeddingSuccess) &&
        (!options.includeDatabase || databaseSuccess) &&
        (!options.includeSettings || settingsSuccess);

      // 8. Generate a meaningful message
      let message = "Backup ";
      if (success) {
        message += "completed successfully";
      } else {
        const successList = [];
        if (embeddingSuccess) successList.push("file synchronization");
        if (databaseSuccess) successList.push("database backup");
        if (settingsSuccess) successList.push("settings backup");

        if (successList.length > 0) {
          message += `partially completed (${successList.join(
            ", "
          )} successful)`;
        } else {
          message += "failed";
        }
      }

      // 9. Call completion callback if provided
      if (options.onComplete) {
        options.onComplete({
          success,
          backupId: backupRecord?.id,
          message,
        });
      }

      return {
        success,
        backupId: backupRecord?.id,
        message,
        details: {
          embeddingSuccess,
          databaseSuccess,
          settingsSuccess,
        },
      };
    } catch (error) {
      console.error("Error running backup and sync:", error);

      // Try to update the backup record to mark it as failed
      if (backupRecord?.id) {
        await this.updateBackupRecord(backupRecord.id, {
          status: "failed",
          completed_at: new Date().toISOString(),
        }).catch((err) =>
          console.error("Error updating failed backup record:", err)
        );
      }

      // Call error callback if provided
      if (options.onError) {
        options.onError({
          error:
            error.message || "Unknown error occurred during backup and sync",
          backupId: backupRecord?.id,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error occurred during backup and sync",
        backupId: backupRecord?.id,
      };
    }
  }

  /**
   * Get backup history with simplified approach
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Backup history records
   */
  async getBackupHistory(options = { limit: 10, page: 0 }) {
    try {
      // Use direct Supabase query - more reliable than API calls
      const { data, error, count } = await supabase
        .from("backups")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(
          options.page * options.limit,
          (options.page + 1) * options.limit - 1
        );

      if (error) {
        if (error.message?.includes("does not exist")) {
          console.warn("backups table does not exist, returning empty results");
          return {
            data: [],
            totalCount: 0,
            page: options.page,
            limit: options.limit,
          };
        }
        throw error;
      }

      return {
        data: data || [],
        totalCount: count || 0,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      console.error("Error fetching backup history:", error);

      // Return empty data instead of throwing to avoid breaking the UI
      return {
        data: [],
        totalCount: 0,
        page: options.page || 0,
        limit: options.limit || 10,
        error: error.message,
      };
    }
  }

  // Update these methods in your BackupService.js

  // Fixed method to check document embedding existence
  async checkDocumentEmbeddingExists(documentPath) {
    try {
      // Check documents table instead of document_embeddings
      const { data, error } = await supabase
        .from("documents")
        .select("id")
        .eq("path", documentPath)
        .maybeSingle();

      if (error) {
        // If error is about column 'path' not existing, try with 'storage_path' instead
        if (
          error.message &&
          error.message.includes("column") &&
          error.message.includes("path")
        ) {
          const { data: altData, error: altError } = await supabase
            .from("documents")
            .select("id")
            .eq("storage_path", documentPath)
            .maybeSingle();

          if (altError) {
            if (altError.message.includes("does not exist")) {
              console.log("documents table does not exist");
              return false;
            }
            throw altError;
          }

          return !!altData;
        }

        if (error.message.includes("does not exist")) {
          console.log("documents table does not exist");
          return false;
        }
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error("Error checking document embedding:", error);
      return false;
    }
  }

  // Fixed method to check image embedding existence
  async checkImageEmbeddingExists(imagePath) {
    try {
      const { data, error } = await supabase
        .from("image_embeddings")
        .select("id")
        .eq("image_path", imagePath)
        .maybeSingle();

      if (error) {
        if (error.message.includes("does not exist")) {
          console.log("image_embeddings table does not exist");
          return false;
        }
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error("Error checking image embedding:", error);
      return false;
    }
  }

  // Fixed ensureBackupTablesExist method to create the correct tables
  async ensureBackupTablesExist() {
    try {
      const tablesToCheck = ["backups", "database_backups", "settings_backups"];
      let allTablesExist = true;

      // Check if each table exists
      for (const tableName of tablesToCheck) {
        try {
          const { error } = await supabase
            .from(tableName)
            .select("id")
            .limit(1);

          if (error && error.message.includes("does not exist")) {
            allTablesExist = false;
            break;
          }
        } catch (tableError) {
          console.warn(`Error checking table ${tableName}:`, tableError);
          allTablesExist = false;
          break;
        }
      }

      // If all tables exist, return success
      if (allTablesExist) {
        return true;
      }

      // Tables don't exist, create them via the API endpoint
      try {
        const response = await fetch("/api/admin/backup/setup-tables", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `Server returned ${response.status}`
          );
        }

        const result = await response.json();
        return result.success;
      } catch (apiError) {
        console.error("Error setting up backup tables via API:", apiError);

        // Try creating a backup directly as a fallback
        try {
          console.log("Attempting to create tables via direct insert...");

          // Try to insert a record into backups table, which might auto-create it
          const { error: insertError } = await supabase.from("backups").insert([
            {
              type: "initialization",
              status: "completed",
              location: "local",
              created_at: new Date().toISOString(),
            },
          ]);

          return (
            !insertError || !insertError.message.includes("does not exist")
          );
        } catch (insertError) {
          console.error("Failed to create tables via insert:", insertError);
          return false;
        }
      }
    } catch (error) {
      console.error("Error ensuring backup tables exist:", error);
      return false;
    }
  }

  /**
   * Check backup constraints to diagnose issues
   */
  async checkBackupConstraints() {
    try {
      console.log("Checking backup table constraints...");

      // Check if backups table exists
      const { error: checkError } = await supabase
        .from("backups")
        .select("id")
        .limit(1);

      if (checkError) {
        return {
          success: false,
          tableExists: false,
          error: checkError.message,
        };
      }

      // Try to insert with each possible status to find what works
      const statuses = ["pending", "running", "completed", "failed"];
      const results = {};

      for (const status of statuses) {
        try {
          const { data, error } = await supabase
            .from("backups")
            .insert([
              {
                type: "test",
                status: status,
                location: "test",
                created_at: new Date().toISOString(),
              },
            ])
            .select();

          results[status] = {
            success: !error,
            error: error ? error.message : null,
          };

          // If successful, clean up the test record
          if (data && data[0]?.id) {
            await supabase.from("backups").delete().eq("id", data[0].id);
          }
        } catch (err) {
          results[status] = {
            success: false,
            error: err.message,
          };
        }
      }

      return {
        success: true,
        tableExists: true,
        statusTests: results,
        workingStatuses: Object.keys(results).filter(
          (status) => results[status].success
        ),
      };
    } catch (error) {
      console.error("Error checking backup constraints:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export a singleton instance
const backupService = new BackupService();
export default backupService;
