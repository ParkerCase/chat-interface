import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Send,
  Loader2,
  X,
  Search,
  Database,
  Bot,
  User,
  Settings,
  Plus,
  Mic,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Trash,
  ExternalLink,
  Download,
  Copy,
  CheckCircle,
  AlertCircle,
  Monitor,
} from "lucide-react";
import "./ClaudeMCPModal.css";

const ClaudeMCPModal = ({ isOpen, onClose, autoSignIn = true }) => {
  const [setupStep, setSetupStep] = useState("checking"); // checking, configure, downloaded, configured, launched
  const [isLoading, setIsLoading] = useState(false);
  const [claudeWindow, setClaudeWindow] = useState(null);
  const [configCopied, setConfigCopied] = useState(false);
  const [historyDropdownOpen, setHistoryDropdownOpen] = useState(false);
  const [claudeHistory, setClaudeHistory] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState("configured");
  const messagesEndRef = useRef(null);

  // Your MCP backend configuration
  const MCP_BACKEND_URL = "http://147.182.247.128:3000";

  const mcpConfig = {
    mcpServers: {
      "tatt2away-dropbox": {
        command: "node",
        args: [
          "-p",
          `
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// Proxy to your remote MCP server
const proxyServer = new Server({
  name: 'tatt2away-dropbox-proxy',
  version: '1.0.0'
}, { capabilities: { tools: {} } });

// Forward all requests to your remote server
proxyServer.setRequestHandler('tools/list', async () => {
  const response = await fetch('${MCP_BACKEND_URL}/mcp/dropbox/sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  });
  const data = await response.json();
  return data.result;
});

proxyServer.setRequestHandler('tools/call', async (request) => {
  const response = await fetch('${MCP_BACKEND_URL}/mcp/dropbox/sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: request.id || 1,
      method: 'tools/call',
      params: request.params
    })
  });
  const data = await response.json();
  return data.result;
});

const transport = new StdioServerTransport();
proxyServer.connect(transport);
`,
        ],
      },
      "tatt2away-zenoti": {
        command: "node",
        args: [
          "-p",
          `
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// Proxy to your remote MCP server
const proxyServer = new Server({
  name: 'tatt2away-zenoti-proxy',
  version: '1.0.0'
}, { capabilities: { tools: {} } });

// Forward all requests to your remote server
proxyServer.setRequestHandler('tools/list', async () => {
  const response = await fetch('${MCP_BACKEND_URL}/mcp/zenoti/sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  });
  const data = await response.json();
  return data.result;
});

proxyServer.setRequestHandler('tools/call', async (request) => {
  const response = await fetch('${MCP_BACKEND_URL}/mcp/zenoti/sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: request.id || 1,
      method: 'tools/call',
      params: request.params
    })
  });
  const data = await response.json();
  return data.result;
});

const transport = new StdioServerTransport();
proxyServer.connect(transport);
`,
        ],
      },
    },
  };

  // Check setup status on modal open
  useEffect(() => {
    if (isOpen && autoSignIn) {
      checkSetupStatus();
    }
  }, [isOpen]);

  // Load chat history
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem("claudeMCPHistory");
      if (stored) {
        setClaudeHistory(JSON.parse(stored));
      }
    }
  }, [isOpen]);

  const checkSetupStatus = async () => {
    setIsLoading(true);
    setSetupStep("checking");

    try {
      // Check if MCP backend is running
      const healthResponse = await fetch(`${MCP_BACKEND_URL}/health`);
      if (!healthResponse.ok) {
        throw new Error("MCP backend not accessible");
      }

      // Check if Claude Desktop configuration exists (simplified check)
      const hasConfig =
        localStorage.getItem("claudeDesktopConfigured") === "true";

      if (hasConfig) {
        setSetupStep("configured");
      } else {
        setSetupStep("configure");
      }
    } catch (error) {
      console.error("Setup check failed:", error);
      setSetupStep("configure");
    } finally {
      setIsLoading(false);
    }
  };

  const copyConfiguration = async () => {
    try {
      const configText = JSON.stringify(mcpConfig, null, 2);
      await navigator.clipboard.writeText(configText);
      setConfigCopied(true);
      setTimeout(() => setConfigCopied(false), 3000);
    } catch (error) {
      console.error("Failed to copy configuration:", error);
    }
  };

  const openSetupInstructions = () => {
    const instructions = `
# Claude Desktop MCP Setup for Tatt2Away

## Step 1: Locate Your Claude Desktop Config File

**macOS:**
~/Library/Application Support/Claude/claude_desktop_config.json

**Windows:**
%APPDATA%\\Claude\\claude_desktop_config.json

## Step 2: Add This Configuration

${JSON.stringify(mcpConfig, null, 2)}

## Step 3: Restart Claude Desktop

After saving the config file, restart Claude Desktop.

## Step 4: Test Your Connection

Ask Claude: "What MCP tools do you have access to?"

You should see:
- 🔍 Dropbox search tools (search_dropbox, search_images, etc.)
- 🏥 Zenoti business tools (natural_language_report, smart_search_clients, etc.)

## Your MCP Backend
Running at: ${MCP_BACKEND_URL}
- Dropbox: /mcp/dropbox/sse
- Zenoti: /mcp/zenoti/sse

## Need Help?
If you have issues, check that your MCP backend is running and accessible.
`;

    // Open instructions in new window
    const instructionsWindow = window.open(
      "",
      "_blank",
      "width=800,height=600"
    );
    instructionsWindow.document.write(`
      <html>
        <head><title>Claude MCP Setup Instructions</title></head>
        <body style="font-family: monospace; padding: 20px; line-height: 1.6;">
          <pre>${instructions}</pre>
        </body>
      </html>
    `);
  };

  const markAsConfigured = () => {
    localStorage.setItem("claudeDesktopConfigured", "true");
    setSetupStep("configured");
  };

  const launchClaude = () => {
    setIsLoading(true);
    setSetupStep("launched");

    // Try to open Claude Desktop first
    if (navigator.platform.includes("Mac")) {
      // Try to open Claude Desktop on macOS
      window.location.href = "claude://";
    } else if (navigator.platform.includes("Win")) {
      // Try to open Claude Desktop on Windows
      window.location.href = "claude://";
    }

    // Fallback to web version
    setTimeout(() => {
      const claudeWeb = window.open(
        "https://claude.ai/chat",
        "claude-mcp",
        "width=1200,height=800,scrollbars=yes,resizable=yes"
      );
      setClaudeWindow(claudeWeb);
      setIsLoading(false);
    }, 1000);
  };

  const resetSetup = () => {
    localStorage.removeItem("claudeDesktopConfigured");
    setSetupStep("configure");
    if (claudeWindow) {
      claudeWindow.close();
      setClaudeWindow(null);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="claude-mcp-modal-overlay">
      <div className="claude-mcp-modal claude-mcp-modern-modal">
        {/* Close button */}
        <button
          className="claude-mcp-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>

        {/* Connection status */}
        <div className="claude-mcp-modern-connected">
          {setupStep === "checking" && "Checking Setup..."}
          {setupStep === "configure" && "Setup Required"}
          {setupStep === "downloaded" && "📥 Config Downloaded"}
          {setupStep === "configured" && "✅ Ready to Launch"}
          {setupStep === "launched" && "🚀 Claude Launched"}
        </div>

        {/* Title */}
        <div className="claude-mcp-modern-title">
          Let's Dive A little Deeper
        </div>

        {/* Chat history dropdown */}
        <div className="claude-mcp-history-dropdown-container">
          <button
            className="claude-mcp-history-dropdown-btn"
            onClick={() => setHistoryDropdownOpen((v) => !v)}
          >
            Claude MCP Sessions
            <ChevronDown size={18} style={{ marginLeft: 8 }} />
          </button>
          {historyDropdownOpen && (
            <div className="claude-mcp-history-dropdown-list">
              <div
                className="claude-mcp-history-dropdown-item"
                onClick={() => setHistoryDropdownOpen(false)}
              >
                + New Research Session
              </div>

              {claudeHistory.length === 0 ? (
                <div className="claude-mcp-history-dropdown-empty">
                  No previous sessions
                </div>
              ) : (
                claudeHistory.map((h) => (
                  <div key={h.id} className="claude-mcp-history-dropdown-item">
                    {h.title}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="claude-mcp-modern-chat-area">
          {setupStep === "checking" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Loader2
                className="animate-spin"
                size={32}
                style={{ color: "#3b82f6", marginBottom: "16px" }}
              />
              <p style={{ color: "#666", margin: 0 }}>
                Checking your MCP backend connection...
              </p>
            </div>
          )}

          {setupStep === "configure" && (
            <div style={{ padding: "20px" }}>
              <div
                style={{
                  backgroundColor: "#fef3c7",
                  border: "1px solid #fbbf24",
                  borderRadius: "12px",
                  padding: "20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <Settings size={20} style={{ color: "#92400e" }} />
                  <h3 style={{ margin: 0, color: "#92400e" }}>
                    One-Time Setup Required
                  </h3>
                </div>
                <p style={{ margin: 0, color: "#92400e" }}>
                  Configure Claude Desktop to connect to your MCP backend for
                  unlimited research capabilities
                </p>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "#fff", marginBottom: "12px" }}>
                  🚀 What you'll get with full MCP:
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "4px",
                      }}
                    >
                      <Search size={16} style={{ color: "#3b82f6" }} />
                      <strong style={{ color: "#fff" }}>
                        Deep Dropbox Research
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                      Search thousands of images intelligently, multi-step
                      analysis
                    </p>
                  </div>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "4px",
                      }}
                    >
                      <Database size={16} style={{ color: "#10b981" }} />
                      <strong style={{ color: "#fff" }}>
                        Business Intelligence
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                      Natural language reports, smart client search, diagnostics
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  onClick={copyConfiguration}
                  style={{
                    backgroundColor: configCopied ? "#10b981" : "#3b82f6",
                    color: "white",
                    border: "none",
                    padding: "12px 18px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                >
                  {configCopied ? (
                    <CheckCircle size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {configCopied
                    ? "Configuration Copied!"
                    : "Copy Configuration"}
                </button>

                <button
                  onClick={openSetupInstructions}
                  style={{
                    backgroundColor: "#6b7280",
                    color: "white",
                    border: "none",
                    padding: "12px 18px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  <ExternalLink size={16} />
                  View Instructions
                </button>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  backgroundColor: "#f0f9ff",
                  borderRadius: "8px",
                  border: "1px solid #0ea5e9",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "12px",
                    color: "#0c4a6e",
                    fontWeight: "500",
                  }}
                >
                  Quick Setup Steps:
                </p>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "16px",
                    fontSize: "12px",
                    color: "#0c4a6e",
                  }}
                >
                  <li>Copy the configuration above</li>
                  <li>Open Claude Desktop config file</li>
                  <li>Paste the configuration</li>
                  <li>Restart Claude Desktop</li>
                  <li>Come back and click "I've Configured Claude"</li>
                </ol>
              </div>

              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <button
                  onClick={markAsConfigured}
                  style={{
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  I've Configured Claude Desktop ✓
                </button>
              </div>
            </div>
          )}

          {setupStep === "configured" && (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div
                style={{
                  backgroundColor: "#d1fae5",
                  border: "1px solid #34d399",
                  borderRadius: "12px",
                  padding: "20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <CheckCircle size={24} style={{ color: "#065f46" }} />
                  <h3 style={{ margin: 0, color: "#065f46" }}>
                    Ready for Deep Research!
                  </h3>
                </div>
                <p style={{ margin: 0, color: "#065f46" }}>
                  Claude Desktop is configured with your MCP backend. Launch
                  Claude for unlimited research capabilities.
                </p>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "#1a1a1a", marginBottom: "12px" }}>
                  🎯 Try these research queries:
                </h4>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    textAlign: "left",
                    backgroundColor: "#f9fafb",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    "Search my Dropbox for flame tattoo removal before and after
                    images"
                  </div>
                  <div>
                    "Find all client appointments for this week at Draper
                    location"
                  </div>
                  <div>"Generate a comprehensive sales report for Q4 2024"</div>
                  <div>
                    "Scan my entire Dropbox and categorize all tattoo-related
                    images"
                  </div>
                </div>
              </div>

              <button
                onClick={launchClaude}
                disabled={isLoading}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  padding: "14px 24px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  margin: "0 auto",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Launching Claude...
                  </>
                ) : (
                  <>
                    <Monitor size={18} />
                    Launch Claude with Full MCP
                  </>
                )}
              </button>

              <div style={{ marginTop: "16px" }}>
                <button
                  onClick={resetSetup}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6b7280",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reset Configuration
                </button>
              </div>
            </div>
          )}

          {setupStep === "launched" && (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div
                style={{
                  backgroundColor: "#ede9fe",
                  border: "1px solid #8b5cf6",
                  borderRadius: "12px",
                  padding: "20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <Bot size={24} style={{ color: "#5b21b6" }} />
                  <h3 style={{ margin: 0, color: "#5b21b6" }}>
                    Claude Launched!
                  </h3>
                </div>
                <p style={{ margin: 0, color: "#5b21b6" }}>
                  Claude should now be open with full access to your MCP
                  backend. Start your deep research!
                </p>
              </div>

              <div
                style={{
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #0ea5e9",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                  textAlign: "left",
                }}
              >
                <h4 style={{ margin: "0 0 8px 0" }}>
                  {selectedPlatform === "configured"
                    ? "💡 Pro Tips:"
                    : "Final Steps:"}
                </h4>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "16px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                  }}
                >
                  {selectedPlatform === "configured" ? (
                    <>
                      <li>
                        Ask Claude: "What MCP tools do you have?" to verify
                        connection
                      </li>
                      <li>
                        Try: "Search my Dropbox for [anything]" to test
                        universal search
                      </li>
                      <li>
                        Use: "Generate a report for [timeframe]" for business
                        intelligence
                      </li>
                      <li>
                        Claude can chain multiple tool calls for complex
                        research
                      </li>
                    </>
                  ) : (
                    <>
                      <li>Install Claude Desktop from the download</li>
                      <li>Launch Claude Desktop</li>
                      <li>
                        Your MCP tools will be automatically available! 🎉
                      </li>
                    </>
                  )}
                </ol>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={launchClaude}
                  disabled={isLoading}
                  style={{
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "14px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Launching Claude...
                    </>
                  ) : (
                    <>
                      <Bot size={18} />
                      🚀{" "}
                      {selectedPlatform === "configured"
                        ? "Launch Claude Desktop"
                        : "Launch Claude with Full MCP"}
                    </>
                  )}
                </button>

                {selectedPlatform !== "configured" && (
                  <button
                    onClick={() => setSetupStep("download")}
                    style={{
                      background: "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                )}
              </div>

              {selectedPlatform === "configured" && (
                <div style={{ marginTop: "16px" }}>
                  <button
                    onClick={resetSetup}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      fontSize: "12px",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    ← Back to Platform Selection
                  </button>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer with backend status */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e5e7eb",
            backgroundColor: "#1a1a1a",
            fontSize: "11px",
            color: "#999",
            textAlign: "center",
          }}
        >
          🖥️ <strong>MCP Backend:</strong> {MCP_BACKEND_URL} | 🔍{" "}
          <strong>Dropbox:</strong> Universal Search Ready | 🏥{" "}
          <strong>Zenoti:</strong> Business Intelligence Active
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ClaudeMCPModal;
