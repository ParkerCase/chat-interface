// src/components/storage/StorageManagement.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import FileUploadDropzone from "./FileUploadDropzone";
import {
  Folder,
  File,
  FileText,
  Image,
  Film,
  Archive,
  Music,
  Code,
  Database,
  Search,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Upload,
  Download,
  Trash,
  Share,
  FolderPlus,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader,
  Copy,
  Link,
  Eye,
  Lock,
  Users,
  UserPlus,
  Filter,
  Settings,
  XCircle,
  X,
  Save,
  Edit,
  ArrowLeft,
} from "lucide-react";
import "./StorageManagement.css";

const StorageManagement = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  // State for storage items and UI controls
  const [storageItems, setStorageItems] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedItems, setSelectedItems] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [buckets, setBuckets] = useState([]);
  const [currentBucket, setCurrentBucket] = useState("documents");
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [storageUsage, setStorageUsage] = useState({
    totalSize: 0,
    usedSize: 0,
    percentUsed: 0,
  });

  // UI controls
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedItemForPermissions, setSelectedItemForPermissions] =
    useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [filterType, setFilterType] = useState("all");

  // Permissions state
  const [permissions, setPermissions] = useState({
    isPublic: false,
    specificUsers: [],
    specificGroups: [],
  });

  // File type icons mapping
  const fileTypeIcons = {
    folder: <Folder size={24} />,
    pdf: <FileText size={24} />,
    doc: <FileText size={24} />,
    docx: <FileText size={24} />,
    txt: <FileText size={24} />,
    jpg: <Image size={24} />,
    jpeg: <Image size={24} />,
    png: <Image size={24} />,
    gif: <Image size={24} />,
    svg: <Image size={24} />,
    mp4: <Film size={24} />,
    mov: <Film size={24} />,
    avi: <Film size={24} />,
    mp3: <Music size={24} />,
    wav: <Music size={24} />,
    zip: <Archive size={24} />,
    rar: <Archive size={24} />,
    js: <Code size={24} />,
    jsx: <Code size={24} />,
    css: <Code size={24} />,
    html: <Code size={24} />,
    csv: <Database size={24} />,
    xls: <Database size={24} />,
    xlsx: <Database size={24} />,
    default: <File size={24} />,
  };

  // Define file categories for filtering
  const fileCategories = {
    document: ["pdf", "doc", "docx", "txt", "rtf"],
    image: ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff"],
    video: ["mp4", "mov", "avi", "mkv", "webm", "flv"],
    audio: ["mp3", "wav", "ogg", "flac", "aac"],
    archive: ["zip", "rar", "7z", "tar", "gz"],
    code: [
      "js",
      "jsx",
      "ts",
      "tsx",
      "css",
      "html",
      "php",
      "py",
      "java",
      "c",
      "cpp",
      "rb",
    ],
    data: ["csv", "xls", "xlsx", "json", "xml", "sql", "db", "sqlite"],
  };

  // Function to get file icon based on name or type
  const getItemIcon = (item) => {
    if (item.isFolder) {
      return fileTypeIcons.folder;
    }
    const extension = item.name.split(".").pop().toLowerCase();
    return fileTypeIcons[extension] || fileTypeIcons.default;
  };

  // Function to get file category from extension
  const getFileCategory = (fileName) => {
    const extension = fileName.split(".").pop().toLowerCase();
    for (const [category, extensions] of Object.entries(fileCategories)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }
    return "other";
  };

  // Function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  // Function to generate breadcrumbs from the current path
  const generateBreadcrumbs = useCallback(
    (path) => {
      // Start with the bucket as the root
      const crumbs = [{ name: currentBucket, path: "" }];

      if (path) {
        // Split the path into segments and build up the breadcrumbs
        const segments = path.split("/");
        let currentSegmentPath = "";

        segments.forEach((segment, index) => {
          if (segment) {
            currentSegmentPath += (index > 0 ? "/" : "") + segment;
            crumbs.push({
              name: segment,
              path: currentSegmentPath,
            });
          }
        });
      }

      setBreadcrumbs(crumbs);
    },
    [currentBucket]
  );

  // Load buckets on component mount
  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error } = await supabase.storage.listBuckets();

        if (error) {
          console.error("Error fetching buckets:", error);
          throw error;
        }

        if (data && data.length > 0) {
          setBuckets(data);
          // Default to the first bucket if documents doesn't exist
          setCurrentBucket(
            data.find((b) => b.name === "documents")?.name || data[0].name
          );
        }
      } catch (err) {
        setError(`Failed to load storage buckets: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBuckets();
  }, []);

  // Fetch storage items when currentPath or currentBucket changes
  useEffect(() => {
    if (currentBucket) {
      fetchStorageItems();
      generateBreadcrumbs(currentPath);
    }
  }, [currentBucket, currentPath, generateBreadcrumbs]);

  // Clear success message after 5 seconds
  useEffect(() => {
    let timeout;
    if (success) {
      timeout = setTimeout(() => {
        setSuccess(null);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [success]);

  // Update isAllSelected when selectedItems changes
  useEffect(() => {
    setIsAllSelected(
      storageItems.length > 0 && selectedItems.length === storageItems.length
    );
  }, [selectedItems, storageItems]);

  // Function to fetch storage items from Supabase
  const fetchStorageItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSelectedItems([]);

      // List files in the bucket and path
      const { data, error } = await supabase.storage
        .from(currentBucket)
        .list(currentPath);

      if (error) {
        console.error("Error fetching storage items:", error);
        throw error;
      }

      // Process the items to add additional properties
      if (data) {
        // Request public URLs for each file
        const enrichedData = await Promise.all(
          data.map(async (item) => {
            // Create the full path for the item
            const itemPath = currentPath
              ? `${currentPath}/${item.name}`
              : item.name;

            // For files, get the public URL
            if (!item.metadata) {
              // It's a folder if it doesn't have metadata
              return {
                ...item,
                isFolder: true,
                path: itemPath,
                fullPath: `${currentBucket}/${itemPath}`,
                category: "folder",
                icon: fileTypeIcons.folder,
              };
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from(currentBucket)
              .getPublicUrl(itemPath);

            // Determine file category
            const category = getFileCategory(item.name);

            return {
              ...item,
              isFolder: false,
              path: itemPath,
              fullPath: `${currentBucket}/${itemPath}`,
              publicUrl: urlData?.publicUrl || null,
              category,
              icon:
                fileTypeIcons[item.name.split(".").pop().toLowerCase()] ||
                fileTypeIcons.default,
            };
          })
        );

        setStorageItems(enrichedData);
      } else {
        setStorageItems([]);
      }

      // Get bucket/storage statistics
      await fetchStorageUsage();
    } catch (err) {
      setError(`Failed to load storage items: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch storage usage statistics
  const fetchStorageUsage = async () => {
    try {
      // This is just a placeholder. In a real app, you'd query your
      // backend for storage usage information tied to your account.
      // Supabase doesn't have a direct API for this, so we'd track it ourselves.

      // Simulate getting usage data
      const totalSize = 10 * 1024 * 1024 * 1024; // 10GB
      const usedSize = Math.floor(Math.random() * 7 * 1024 * 1024 * 1024); // 0-7GB
      const percentUsed = (usedSize / totalSize) * 100;

      setStorageUsage({
        totalSize,
        usedSize,
        percentUsed: parseFloat(percentUsed.toFixed(1)),
      });
    } catch (err) {
      console.error("Error fetching storage usage:", err);
      // Don't set an error state here to avoid disrupting the main UI
    }
  };

  // Function to apply filters and sorting to items
  const getFilteredAndSortedItems = () => {
    let result = [...storageItems];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(query));
    }

    // Apply file type filter
    if (filterType !== "all") {
      if (filterType === "folder") {
        result = result.filter((item) => item.isFolder);
      } else {
        result = result.filter((item) => item.category === filterType);
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      // Always put folders before files
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = (a.metadata?.size || 0) - (b.metadata?.size || 0);
          break;
        case "lastModified":
          const aTime = a.metadata?.lastModified || 0;
          const bTime = b.metadata?.lastModified || 0;
          comparison = aTime - bTime;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  };

  // Handle folder navigation
  const navigateToFolder = (folder) => {
    const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;

    setCurrentPath(newPath);
  };

  // Handle breadcrumb navigation
  const navigateToBreadcrumb = (breadcrumb) => {
    setCurrentPath(breadcrumb.path);
  };

  // Handle navigation to parent folder
  const navigateToParentFolder = () => {
    if (!currentPath) return;

    const pathSegments = currentPath.split("/");
    pathSegments.pop();
    const parentPath = pathSegments.join("/");

    setCurrentPath(parentPath);
  };

  // Handle toggle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle item selection
  const handleSelectItem = (item) => {
    setSelectedItems((prev) => {
      const itemId = item.fullPath;

      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItems([]);
    } else {
      setSelectedItems(storageItems.map((item) => item.fullPath));
    }
    setIsAllSelected(!isAllSelected);
  };

  // Handle item click
  const handleItemClick = (event, item) => {
    // Existing code
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      handleSelectItem(item);
      return;
    }

    // If it's a folder, navigate into it
    if (item.isFolder) {
      navigateToFolder(item);
    } else {
      // ADD THIS: Track content view
      SupabaseAnalytics.trackEvent("content_view", {
        content_id: item.fullPath,
        content_name: item.name,
        content_type: item.name.split(".").pop() || "unknown",
        bucket: currentBucket,
        path: currentPath,
      });

      // Existing code to show details
      setSelectedItemDetails(item);
      setShowItemDetailsModal(true);
    }
  };

  // Handle file download
  const handleDownload = async (item) => {
    try {
      // If we're downloading multiple items, we'd need to create a zip file
      // But for simplicity, we'll just download them one by one
      if (selectedItems.length > 1) {
        // Notify user that we're downloading multiple files
        setSuccess(`Downloading ${selectedItems.length} files...`);

        // Download each file sequentially
        for (const itemPath of selectedItems) {
          const itemToDownload = storageItems.find(
            (i) => i.fullPath === itemPath
          );
          if (itemToDownload && !itemToDownload.isFolder) {
            await downloadFile(itemToDownload);
          }
        }
      } else {
        // Download a single file
        await downloadFile(item);
      }
    } catch (err) {
      setError(`Failed to download: ${err.message}`);
    }
  };

  // Function to download a single file
  const downloadFile = async (item) => {
    try {
      // ADD THIS: Track download event
      SupabaseAnalytics.trackEvent("file_download", {
        content_id: item.fullPath,
        content_name: item.name,
        content_type: item.name.split(".").pop() || "unknown",
        size: item.metadata?.size || 0,
        bucket: currentBucket,
        path: currentPath,
      });
      // Use the public URL for download
      if (item.publicUrl) {
        // Create an invisible anchor and trigger download
        const a = document.createElement("a");
        a.href = item.publicUrl;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setSuccess(`Downloaded ${item.name}`);
      } else {
        // If no public URL, we need to download through Supabase
        const { data, error } = await supabase.storage
          .from(currentBucket)
          .download(item.path);

        if (error) {
          throw error;
        }

        // Create a download URL and trigger download
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSuccess(`Downloaded ${item.name}`);
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      throw err;
    }
  };

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    try {
      setIsLoading(true);

      // Create path for the empty file that acts as a folder marker
      const folderPath = currentPath
        ? `${currentPath}/${newFolderName}/.folder`
        : `${newFolderName}/.folder`;

      // In Supabase storage, folders are created by uploading a zero-byte file
      // with a path that includes the folder structure
      const { error } = await supabase.storage
        .from(currentBucket)
        .upload(folderPath, new Blob([]), {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (error) {
        // If error is that folder already exists, it's not really an error
        if (error.message?.includes("already exists")) {
          setError("A folder with this name already exists");
        } else {
          throw error;
        }
      } else {
        setSuccess(`Folder "${newFolderName}" created`);
        setNewFolderName("");
        setShowCreateFolderModal(false);

        // Refresh the storage items
        await fetchStorageItems();
      }
    } catch (err) {
      setError(`Failed to create folder: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete items
  const handleDelete = async () => {
    if (selectedItems.length === 0) return;

    try {
      setIsLoading(true);

      // Process each selected item
      for (const itemPath of selectedItems) {
        const item = storageItems.find((i) => i.fullPath === itemPath);

        if (!item) continue;

        if (item.isFolder) {
          // For folders, we need to get all files inside and delete them
          await deleteFolder(item);
        } else {
          // For files, simply delete them
          const { error } = await supabase.storage
            .from(currentBucket)
            .remove([item.path]);

          if (error) throw error;
        }
      }

      // Show success message
      setSuccess(`Deleted ${selectedItems.length} item(s)`);

      // Close delete modal
      setShowDeleteModal(false);

      // Reset selection
      setSelectedItems([]);

      // Refresh the storage items
      await fetchStorageItems();
    } catch (err) {
      setError(`Failed to delete items: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to recursively delete a folder
  const deleteFolder = async (folder) => {
    try {
      // List all items in the folder
      const { data, error } = await supabase.storage
        .from(currentBucket)
        .list(folder.path);

      if (error) throw error;

      // For each item, if it's a folder, delete recursively
      // If it's a file, delete it
      for (const item of data) {
        const itemPath = `${folder.path}/${item.name}`;

        if (!item.metadata) {
          // It's a folder
          await deleteFolder({
            isFolder: true,
            name: item.name,
            path: itemPath,
          });
        } else {
          // It's a file
          const { error } = await supabase.storage
            .from(currentBucket)
            .remove([itemPath]);

          if (error) throw error;
        }
      }

      // Finally, delete the folder marker file if it exists
      await supabase.storage
        .from(currentBucket)
        .remove([`${folder.path}/.folder`]);
    } catch (err) {
      console.error(`Error deleting folder ${folder.path}:`, err);
      throw err;
    }
  };

  // Handle permission change
  const handlePermissionChange = async () => {
    if (!selectedItemForPermissions) return;

    try {
      setIsLoading(true);

      // Determine access level
      const accessLevel = permissions.isPublic ? "public" : "private";

      // Get policy information based on item path
      const { bucket, path } = parseItemPath(
        selectedItemForPermissions.fullPath
      );

      // Call the server-side function to update permissions
      // This uses a Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        "update-storage-permissions",
        {
          body: {
            bucket,
            path,
            accessLevel,
            specificUsers: permissions.specificUsers.map((u) => u.email),
            specificGroups: permissions.specificGroups.map((g) => g.name),
          },
        }
      );

      if (error) throw error;

      // Update storageItems with new permission data
      setStorageItems((prevItems) =>
        prevItems.map((item) => {
          if (item.fullPath === selectedItemForPermissions.fullPath) {
            return {
              ...item,
              isPublic: permissions.isPublic,
              // Add other permission data as needed
            };
          }
          return item;
        })
      );

      // Update state and show success message
      setSuccess(`Permissions updated for ${selectedItemForPermissions.name}`);
      setShowPermissionsModal(false);
      setSelectedItemForPermissions(null);
    } catch (err) {
      console.error("Error updating permissions:", err);
      setError(`Failed to update permissions: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Add helper function to parse item path
  const parseItemPath = (fullPath) => {
    const [bucket, ...pathParts] = fullPath.split("/");
    return {
      bucket,
      path: pathParts.join("/"),
    };
  };

  // Handle file upload complete
  const handleUploadComplete = async (files) => {
    setSuccess(`Uploaded ${files.length} file(s)`);

    // Refresh the storage items
    await fetchStorageItems();
  };

  // Handle file upload error
  const handleUploadError = (error, file) => {
    setError(`Error uploading ${file.name}: ${error.message}`);
  };

  // Get display name for file type filter
  const getFilterDisplayName = (filter) => {
    switch (filter) {
      case "all":
        return "All Files";
      case "folder":
        return "Folders";
      case "document":
        return "Documents";
      case "image":
        return "Images";
      case "video":
        return "Videos";
      case "audio":
        return "Audio";
      case "archive":
        return "Archives";
      case "code":
        return "Code";
      case "data":
        return "Data";
      default:
        return "All Files";
    }
  };

  // Get filtered and sorted items for display
  const filteredItems = getFilteredAndSortedItems();

  // Generate folder path for uploads
  const uploadFolderPath = currentPath;

  return (
    <div className="storage-management-container">
      <div className="storage-header">
        <h1>Storage Management</h1>
        <div className="storage-actions">
          <button
            className="action-button refresh-button"
            onClick={fetchStorageItems}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>

          <button
            className="action-button add-folder-button"
            onClick={() => setShowCreateFolderModal(true)}
            title="New Folder"
          >
            <FolderPlus size={16} />
          </button>

          <button
            className="action-button upload-button"
            onClick={() => setShowUploadModal(true)}
            title="Upload Files"
          >
            <Upload size={16} />
            <span className="button-text">Upload</span>
          </button>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="success-message">
          <CheckCircle size={18} className="success-icon" />
          <p>{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <AlertCircle size={18} className="error-icon" />
          <p>{error}</p>
        </div>
      )}

      <div className="storage-main">
        <div className="storage-sidebar">
          {/* Storage usage display */}
          <div className="storage-usage">
            <h3>Storage Usage</h3>
            <div className="usage-bar-container">
              <div
                className="usage-bar"
                style={{ width: `${storageUsage.percentUsed}%` }}
              ></div>
            </div>
            <div className="usage-stats">
              <span className="usage-percentage">
                {storageUsage.percentUsed}%
              </span>
              <span className="usage-details">
                {formatFileSize(storageUsage.usedSize)} of{" "}
                {formatFileSize(storageUsage.totalSize)}
              </span>
            </div>
          </div>

          {/* Storage buckets */}
          <div className="storage-buckets">
            <h3>Storage Buckets</h3>
            <ul className="bucket-list">
              {buckets.map((bucket) => (
                <li
                  key={bucket.id}
                  className={`bucket-item ${
                    bucket.name === currentBucket ? "active" : ""
                  }`}
                  onClick={() => {
                    setCurrentBucket(bucket.name);
                    setCurrentPath("");
                  }}
                >
                  <Database size={16} />
                  <span>{bucket.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Filters */}
          <div className="storage-filters">
            <h3>Filters</h3>
            <ul className="filter-list">
              <li
                className={`filter-item ${
                  filterType === "all" ? "active" : ""
                }`}
                onClick={() => setFilterType("all")}
              >
                <File size={16} />
                <span>All Files</span>
              </li>
              <li
                className={`filter-item ${
                  filterType === "folder" ? "active" : ""
                }`}
                onClick={() => setFilterType("folder")}
              >
                <Folder size={16} />
                <span>Folders</span>
              </li>
              <li
                className={`filter-item ${
                  filterType === "document" ? "active" : ""
                }`}
                onClick={() => setFilterType("document")}
              >
                <FileText size={16} />
                <span>Documents</span>
              </li>
              <li
                className={`filter-item ${
                  filterType === "image" ? "active" : ""
                }`}
                onClick={() => setFilterType("image")}
              >
                <Image size={16} />
                <span>Images</span>
              </li>
              <li
                className={`filter-item ${
                  filterType === "video" ? "active" : ""
                }`}
                onClick={() => setFilterType("video")}
              >
                <Film size={16} />
                <span>Videos</span>
              </li>
              <li
                className={`filter-item ${
                  filterType === "audio" ? "active" : ""
                }`}
                onClick={() => setFilterType("audio")}
              >
                <Music size={16} />
                <span>Audio</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="storage-content">
          {/* Breadcrumbs and search */}
          <div className="storage-toolbar">
            <div className="breadcrumbs-container">
              {currentPath && (
                <button
                  className="parent-folder-button"
                  onClick={navigateToParentFolder}
                  title="Go to parent folder"
                >
                  <ChevronLeft size={16} />
                </button>
              )}

              <div className="breadcrumbs">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    <button
                      className="breadcrumb-item"
                      onClick={() => navigateToBreadcrumb(crumb)}
                    >
                      {crumb.name}
                    </button>
                    {index < breadcrumbs.length - 1 && (
                      <ChevronRight
                        size={14}
                        className="breadcrumb-separator"
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="storage-controls">
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    className="clear-search-button"
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="view-controls">
                <button
                  className={`view-button ${
                    viewMode === "grid" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                >
                  <Grid size={16} />
                </button>
                <button
                  className={`view-button ${
                    viewMode === "list" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* File/folder listing */}
          <div className="storage-items-container">
            {isLoading ? (
              <div className="loading-container">
                <Loader size={32} className="spinning" />
                <p>Loading files...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                {searchQuery ? (
                  <>
                    <Search size={48} />
                    <h3>No files match your search</h3>
                    <p>Try a different search term or clear your search</p>
                  </>
                ) : filterType !== "all" ? (
                  <>
                    <File size={48} />
                    <h3>
                      No {getFilterDisplayName(filterType).toLowerCase()} found
                    </h3>
                    <p>Try a different filter or upload some files</p>
                  </>
                ) : (
                  <>
                    <Folder size={48} />
                    <h3>This folder is empty</h3>
                    <p>Upload files or create a new folder</p>
                    <div className="empty-actions">
                      <button
                        className="upload-button"
                        onClick={() => setShowUploadModal(true)}
                      >
                        <Upload size={16} />
                        Upload Files
                      </button>
                      <button
                        className="create-folder-button"
                        onClick={() => setShowCreateFolderModal(true)}
                      >
                        <FolderPlus size={16} />
                        Create Folder
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* List header (only in list view) */}
                {viewMode === "list" && (
                  <div className="list-header">
                    <div className="list-checkbox">
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                        />
                        <span className="checkbox-checkmark"></span>
                      </label>
                    </div>
                    <div
                      className="list-name sortable"
                      onClick={() => handleSort("name")}
                    >
                      <span>Name</span>
                      {sortField === "name" &&
                        (sortDirection === "asc" ? (
                          <SortAsc size={14} />
                        ) : (
                          <SortDesc size={14} />
                        ))}
                    </div>
                    <div
                      className="list-size sortable"
                      onClick={() => handleSort("size")}
                    >
                      <span>Size</span>
                      {sortField === "size" &&
                        (sortDirection === "asc" ? (
                          <SortAsc size={14} />
                        ) : (
                          <SortDesc size={14} />
                        ))}
                    </div>
                    <div
                      className="list-modified sortable"
                      onClick={() => handleSort("lastModified")}
                    >
                      <span>Modified</span>
                      {sortField === "lastModified" &&
                        (sortDirection === "asc" ? (
                          <SortAsc size={14} />
                        ) : (
                          <SortDesc size={14} />
                        ))}
                    </div>
                    <div className="list-actions"></div>
                  </div>
                )}

                {/* Items display */}
                <div className={`storage-items ${viewMode}`}>
                  {filteredItems.map((item) =>
                    viewMode === "grid" ? (
                      // Grid item
                      <div
                        key={item.fullPath}
                        className={`grid-item ${
                          selectedItems.includes(item.fullPath)
                            ? "selected"
                            : ""
                        }`}
                        onClick={(e) => handleItemClick(e, item)}
                      >
                        <div className="item-select">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.fullPath)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectItem(item);
                              }}
                            />
                            <span className="checkbox-checkmark"></span>
                          </label>
                        </div>
                        <div className="item-icon">{getItemIcon(item)}</div>
                        <div className="item-name" title={item.name}>
                          {item.name}
                        </div>
                        {!item.isFolder && (
                          <div className="item-size">
                            {formatFileSize(item.metadata?.size || 0)}
                          </div>
                        )}
                        <div className="item-actions">
                          <button
                            className="item-action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.isFolder) {
                                navigateToFolder(item);
                              } else {
                                handleDownload(item);
                              }
                            }}
                            title={
                              item.isFolder ? "Open folder" : "Download file"
                            }
                          >
                            {item.isFolder ? (
                              <Folder size={14} />
                            ) : (
                              <Download size={14} />
                            )}
                          </button>
                          {!item.isFolder && (
                            <button
                              className="item-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemDetails(item);
                                setShowItemDetailsModal(true);
                              }}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {isFeatureEnabled("advanced_security") && (
                            <button
                              className="item-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemForPermissions(item);
                                setShowPermissionsModal(true);
                              }}
                              title="Manage permissions"
                            >
                              <Lock size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      // List item
                      <div
                        key={item.fullPath}
                        className={`list-item ${
                          selectedItems.includes(item.fullPath)
                            ? "selected"
                            : ""
                        }`}
                        onClick={(e) => handleItemClick(e, item)}
                      >
                        <div className="list-checkbox">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.fullPath)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectItem(item);
                              }}
                            />
                            <span className="checkbox-checkmark"></span>
                          </label>
                        </div>
                        <div className="list-name">
                          <div className="item-icon">{getItemIcon(item)}</div>
                          <span className="item-name" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <div className="list-size">
                          {item.isFolder
                            ? "-"
                            : formatFileSize(item.metadata?.size || 0)}
                        </div>
                        <div className="list-modified">
                          {formatTimestamp(item.metadata?.lastModified)}
                        </div>
                        <div className="list-actions">
                          <button
                            className="item-action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.isFolder) {
                                navigateToFolder(item);
                              } else {
                                handleDownload(item);
                              }
                            }}
                            title={
                              item.isFolder ? "Open folder" : "Download file"
                            }
                          >
                            {item.isFolder ? (
                              <Folder size={14} />
                            ) : (
                              <Download size={14} />
                            )}
                          </button>
                          {!item.isFolder && (
                            <button
                              className="item-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemDetails(item);
                                setShowItemDetailsModal(true);
                              }}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {isFeatureEnabled("advanced_security") && (
                            <button
                              className="item-action-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemForPermissions(item);
                                setShowPermissionsModal(true);
                              }}
                              title="Manage permissions"
                            >
                              <Lock size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Bulk actions (when items are selected) */}
                {selectedItems.length > 0 && (
                  <div className="bulk-actions">
                    <div className="selected-count">
                      {selectedItems.length} item(s) selected
                    </div>
                    <div className="bulk-action-buttons">
                      <button
                        className="bulk-action-button download-button"
                        onClick={() => handleDownload(null)}
                        disabled={selectedItems.every((itemId) => {
                          const item = storageItems.find(
                            (i) => i.fullPath === itemId
                          );
                          return item && item.isFolder;
                        })}
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <button
                        className="bulk-action-button delete-button"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        <Trash size={14} />
                        Delete
                      </button>
                      {isFeatureEnabled("advanced_security") && (
                        <button
                          className="bulk-action-button permission-button"
                          onClick={() => {
                            if (selectedItems.length === 1) {
                              const item = storageItems.find(
                                (i) => i.fullPath === selectedItems[0]
                              );
                              if (item) {
                                setSelectedItemForPermissions(item);
                                setShowPermissionsModal(true);
                              }
                            }
                          }}
                          disabled={selectedItems.length !== 1}
                        >
                          <Lock size={14} />
                          Permissions
                        </button>
                      )}
                      <button
                        className="bulk-action-button cancel-button"
                        onClick={() => setSelectedItems([])}
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-container upload-modal">
            <div className="modal-header">
              <h3>Upload Files</h3>
              <button
                className="modal-close-button"
                onClick={() => setShowUploadModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <FileUploadDropzone
                bucket={currentBucket}
                folder={uploadFolderPath}
                onUploadComplete={(files) => {
                  handleUploadComplete(files);
                  setShowUploadModal(false);
                }}
                onUploadError={handleUploadError}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="modal-overlay">
          <div className="modal-container small-modal">
            <div className="modal-header">
              <h3>Create New Folder</h3>
              <button
                className="modal-close-button"
                onClick={() => setShowCreateFolderModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateFolder();
                }}
              >
                <div className="form-group">
                  <label htmlFor="folderName">Folder Name</label>
                  <input
                    type="text"
                    id="folderName"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                    className="form-input"
                    autoFocus
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setShowCreateFolderModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="create-button"
                    disabled={!newFolderName.trim() || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader size={14} className="spinning" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FolderPlus size={14} />
                        Create Folder
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-container small-modal">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button
                className="modal-close-button"
                onClick={() => setShowDeleteModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete these {selectedItems.length}{" "}
                item(s)?
              </p>
              <p className="warning-text">This action cannot be undone.</p>

              <div className="form-actions">
                <button
                  className="cancel-button"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="delete-button"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader size={14} className="spinning" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash size={14} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Modal */}
      {showItemDetailsModal && selectedItemDetails && (
        <div className="modal-overlay">
          <div className="modal-container details-modal">
            <div className="modal-header">
              <h3>File Details</h3>
              <button
                className="modal-close-button"
                onClick={() => {
                  setShowItemDetailsModal(false);
                  setSelectedItemDetails(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="file-preview">
                {selectedItemDetails.category === "image" ? (
                  <img
                    src={selectedItemDetails.publicUrl}
                    alt={selectedItemDetails.name}
                    className="image-preview"
                  />
                ) : (
                  <div className="icon-preview">
                    {getItemIcon(selectedItemDetails)}
                  </div>
                )}
              </div>

              <div className="file-details-list">
                <div className="detail-item">
                  <div className="detail-label">Name</div>
                  <div className="detail-value">{selectedItemDetails.name}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Type</div>
                  <div className="detail-value">
                    {selectedItemDetails.name.split(".").pop().toUpperCase()}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Size</div>
                  <div className="detail-value">
                    {formatFileSize(selectedItemDetails.metadata?.size || 0)}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Last Modified</div>
                  <div className="detail-value">
                    {formatTimestamp(
                      selectedItemDetails.metadata?.lastModified
                    )}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Path</div>
                  <div className="detail-value">{selectedItemDetails.path}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Bucket</div>
                  <div className="detail-value">{currentBucket}</div>
                </div>
              </div>

              <div className="file-actions">
                <button
                  className="download-button"
                  onClick={() => handleDownload(selectedItemDetails)}
                >
                  <Download size={16} />
                  Download
                </button>

                {selectedItemDetails.publicUrl && (
                  <button
                    className="copy-link-button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selectedItemDetails.publicUrl
                      );
                      setSuccess("Link copied to clipboard");
                    }}
                  >
                    <Copy size={16} />
                    Copy Link
                  </button>
                )}

                {isFeatureEnabled("advanced_security") && (
                  <button
                    className="permissions-button"
                    onClick={() => {
                      setSelectedItemForPermissions(selectedItemDetails);
                      setShowItemDetailsModal(false);
                      setShowPermissionsModal(true);
                    }}
                  >
                    <Lock size={16} />
                    Manage Permissions
                  </button>
                )}

                <button
                  className="delete-button"
                  onClick={() => {
                    setSelectedItems([selectedItemDetails.fullPath]);
                    setShowItemDetailsModal(false);
                    setShowDeleteModal(true);
                  }}
                >
                  <Trash size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal &&
        selectedItemForPermissions &&
        isFeatureEnabled("advanced_security") && (
          <div className="modal-overlay">
            <div className="modal-container permissions-modal">
              <div className="modal-header">
                <h3>Manage Permissions</h3>
                <button
                  className="modal-close-button"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setSelectedItemForPermissions(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="permissions-item-info">
                  <div className="item-icon">
                    {getItemIcon(selectedItemForPermissions)}
                  </div>
                  <div className="item-details">
                    <div className="item-name">
                      {selectedItemForPermissions.name}
                    </div>
                    <div className="item-path">
                      {selectedItemForPermissions.path}
                    </div>
                  </div>
                </div>

                <div className="permissions-form">
                  <div className="permission-section">
                    <div className="permission-toggle">
                      <label className="toggle-label">
                        <span>Public Access</span>
                        <button
                          type="button"
                          className={`toggle-button ${
                            permissions.isPublic ? "enabled" : "disabled"
                          }`}
                          onClick={() =>
                            setPermissions((prev) => ({
                              ...prev,
                              isPublic: !prev.isPublic,
                            }))
                          }
                        >
                          <div className="toggle-track">
                            <div className="toggle-indicator"></div>
                          </div>
                        </button>
                      </label>
                    </div>
                    <p className="permission-description">
                      {permissions.isPublic
                        ? "Anyone with the link can access this item"
                        : "Only authorized users can access this item"}
                    </p>
                  </div>

                  <div className="permission-section">
                    <h4>User Access</h4>
                    <div className="user-access-list">
                      {permissions.specificUsers.length === 0 ? (
                        <p className="no-users-message">
                          No specific users have been granted access
                        </p>
                      ) : (
                        <ul className="access-list">
                          {permissions.specificUsers.map((user, index) => (
                            <li key={index} className="access-item">
                              <div className="user-info">
                                <div className="user-avatar">
                                  {user.name.charAt(0)}
                                </div>
                                <span className="user-name">{user.name}</span>
                                <span className="user-email">{user.email}</span>
                              </div>
                              <button
                                className="remove-access-button"
                                onClick={() =>
                                  setPermissions((prev) => ({
                                    ...prev,
                                    specificUsers: prev.specificUsers.filter(
                                      (_, i) => i !== index
                                    ),
                                  }))
                                }
                              >
                                <X size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <button
                        className="add-user-button"
                        onClick={() =>
                          setPermissions((prev) => ({
                            ...prev,
                            specificUsers: [
                              ...prev.specificUsers,
                              { name: "New User", email: "user@example.com" },
                            ],
                          }))
                        }
                      >
                        <UserPlus size={14} />
                        Add User
                      </button>
                    </div>
                  </div>

                  <div className="permission-section">
                    <h4>Group Access</h4>
                    <div className="group-access-list">
                      {permissions.specificGroups.length === 0 ? (
                        <p className="no-groups-message">
                          No specific groups have been granted access
                        </p>
                      ) : (
                        <ul className="access-list">
                          {permissions.specificGroups.map((group, index) => (
                            <li key={index} className="access-item">
                              <div className="group-info">
                                <Users size={16} />
                                <span className="group-name">{group.name}</span>
                              </div>
                              <button
                                className="remove-access-button"
                                onClick={() =>
                                  setPermissions((prev) => ({
                                    ...prev,
                                    specificGroups: prev.specificGroups.filter(
                                      (_, i) => i !== index
                                    ),
                                  }))
                                }
                              >
                                <X size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <button
                        className="add-group-button"
                        onClick={() =>
                          setPermissions((prev) => ({
                            ...prev,
                            specificGroups: [
                              ...prev.specificGroups,
                              { name: "New Group" },
                            ],
                          }))
                        }
                      >
                        <Users size={14} />
                        Add Group
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="cancel-button"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setSelectedItemForPermissions(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="save-button"
                  onClick={handlePermissionChange}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader size={14} className="spinning" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Save Permissions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default StorageManagement;
