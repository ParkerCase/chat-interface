// src/components/enterprise/WorkflowManagement.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import {
  Play,
  Pause,
  Plus,
  Edit,
  Trash2,
  Save,
  ArrowRight,
  Loader,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Header from "../Header";
import UpgradePrompt from "../UpgradePrompt";
import "./EnterpriseComponents.css";

const WorkflowManagement = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    // Check if user has access to this enterprise feature
    if (!isFeatureEnabled("custom_workflows")) {
      setShowUpgradePrompt(true);
      return;
    }

    // Load workflows
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        const response = await apiService.workflows.getAll();

        if (response.data && response.data.success) {
          setWorkflows(response.data.workflows || []);
        } else {
          setError("Failed to load workflows");
        }
      } catch (err) {
        console.error("Error loading workflows:", err);
        setError("Failed to load workflows. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [isFeatureEnabled]);

  const handleCreateWorkflow = () => {
    // Implementation would go here
    console.log("Create workflow");
  };

  const handleEditWorkflow = (workflow) => {
    // Implementation would go here
    setEditingWorkflow(workflow);
  };

  const handleDeleteWorkflow = async (workflowId) => {
    // Implementation would go here
    console.log("Delete workflow", workflowId);
  };

  const handleToggleWorkflow = async (workflowId, isActive) => {
    // Implementation would go here
    console.log("Toggle workflow", workflowId, isActive);
  };

  // Show upgrade prompt if feature not available
  if (showUpgradePrompt) {
    return (
      <UpgradePrompt feature="custom_workflows" onClose={() => navigate("/")} />
    );
  }

  return (
    <div className="enterprise-container">
      <Header currentUser={currentUser} onLogout={logout} />

      <div className="enterprise-content">
        <div className="enterprise-header">
          <h1>Workflow Management</h1>
          <button className="create-button" onClick={handleCreateWorkflow}>
            <Plus size={16} />
            Create Workflow
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <Loader className="spinner" size={32} />
            <p>Loading workflows...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="empty-state">
            <h3>No workflows configured</h3>
            <p>
              Create your first workflow to automate tasks within the Tatt2Away
              system.
            </p>
            <button className="create-button" onClick={handleCreateWorkflow}>
              <Plus size={16} />
              Create First Workflow
            </button>
          </div>
        ) : (
          <div className="workflows-list">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="workflow-card">
                <div className="workflow-header">
                  <h3>{workflow.name}</h3>
                  <div className="workflow-actions">
                    <button
                      className={`toggle-button ${
                        workflow.isActive ? "active" : "inactive"
                      }`}
                      onClick={() =>
                        handleToggleWorkflow(workflow.id, !workflow.isActive)
                      }
                    >
                      {workflow.isActive ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      className="edit-button"
                      onClick={() => handleEditWorkflow(workflow)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="workflow-details">
                  <p>{workflow.description}</p>
                  <div className="workflow-stats">
                    <span>Triggers: {workflow.triggerCount || 0}</span>
                    <span>
                      Last Run:{" "}
                      {workflow.lastRun
                        ? new Date(workflow.lastRun).toLocaleString()
                        : "Never"}
                    </span>
                    <span
                      className={`status ${
                        workflow.isActive ? "active" : "inactive"
                      }`}
                    >
                      {workflow.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowManagement;
