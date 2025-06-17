import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  CheckCircle,
  Monitor,
  Apple,
  Smartphone,
  Download,
  ArrowRight,
  ArrowLeft,
  X,
  Folder,
  Search,
} from "lucide-react";

// Mac Setup Screenshot Component
const MacSetupScreenshot = () => (
  <div
    style={{
      background: "#f5f5f7",
      borderRadius: "12px",
      padding: "20px",
      border: "1px solid #e1e1e1",
      position: "relative",
    }}
  >
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      {/* Mac Finder Window */}
      <div
        style={{
          background: "linear-gradient(to bottom, #f7f7f7, #e8e8e8)",
          padding: "12px 16px",
          borderBottom: "1px solid #d1d1d6",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginRight: "16px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              background: "#ff5f57",
              borderRadius: "50%",
            }}
          ></div>
          <div
            style={{
              width: "12px",
              height: "12px",
              background: "#ffbd2e",
              borderRadius: "50%",
            }}
          ></div>
          <div
            style={{
              width: "12px",
              height: "12px",
              background: "#28ca42",
              borderRadius: "50%",
            }}
          ></div>
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "500",
            color: "#333",
            flex: 1,
            textAlign: "center",
          }}
        >
          Claude — Application Support
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          background: "#f7f7f7",
          padding: "8px 16px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              background: "#e5e5e5",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
          >
            ←
          </button>
          <button
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              background: "#e5e5e5",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
          >
            →
          </button>
        </div>
        <div
          style={{
            background: "white",
            border: "1px solid #d1d1d6",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "12px",
            flex: 1,
            color: "#666",
          }}
        >
          ~/Library/Application Support/Claude
        </div>
        <div
          style={{
            background: "white",
            border: "1px solid #d1d1d6",
            borderRadius: "6px",
            padding: "4px 8px",
            width: "120px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          🔍 Search
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <div
          style={{
            width: "180px",
            background: "#f7f7f7",
            borderRight: "1px solid #e5e5e5",
            padding: "12px 0",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "#666",
                padding: "0 16px 8px",
                textTransform: "uppercase",
              }}
            >
              FAVORITES
            </div>
            {[
              "📱 AirDrop",
              "🔄 Recents",
              "📊 Applications",
              "🏠 Desktop",
              "📁 Documents",
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 16px",
                  fontSize: "13px",
                  color: "#333",
                  cursor: "pointer",
                }}
              >
                {item}
              </div>
            ))}
            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "#666",
                padding: "16px 16px 8px",
                textTransform: "uppercase",
              }}
            >
              LOCATIONS
            </div>
            <div
              style={{
                padding: "6px 16px",
                fontSize: "13px",
                background: "#007aff",
                color: "white",
              }}
            >
              💻 Macintosh HD
            </div>
          </div>
        </div>

        {/* File Area */}
        <div style={{ flex: 1, padding: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#666",
              marginBottom: "16px",
              padding: "8px 12px",
              background: "#f7f7f7",
              borderRadius: "6px",
            }}
          >
            Home › Library › Application Support › Claude
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            {/* Highlighted config file */}
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                background: "#fff3cd",
                border: "2px solid #ffc107",
                borderRadius: "8px",
                animation: "pulse 2s infinite",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  borderRadius: "8px",
                  margin: "0 auto 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "20px",
                }}
              >
                📄
              </div>
              <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                claude_desktop_config.json
              </div>
            </div>

            {/* Other files */}
            <div style={{ textAlign: "center", padding: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  background: "#e5e5e5",
                  borderRadius: "8px",
                  margin: "0 auto 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  fontSize: "20px",
                }}
              >
                📁
              </div>
              <div style={{ fontSize: "12px" }}>logs</div>
            </div>

            <div style={{ textAlign: "center", padding: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  background: "#e5e5e5",
                  borderRadius: "8px",
                  margin: "0 auto 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  fontSize: "20px",
                }}
              >
                📄
              </div>
              <div style={{ fontSize: "12px" }}>preferences.plist</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Instruction overlay */}
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "rgba(0, 0, 0, 0.85)",
        color: "white",
        padding: "16px",
        borderRadius: "8px",
        fontSize: "14px",
        maxWidth: "280px",
        lineHeight: "1.4",
      }}
    >
      ✅ Perfect! Your config file is in the right place.
    </div>
  </div>
);

// Windows Setup Screenshot Component
const WindowsSetupScreenshot = () => (
  <div
    style={{
      background: "#f3f3f3",
      borderRadius: "8px",
      padding: "20px",
      border: "1px solid #ccc",
      position: "relative",
    }}
  >
    <div
      style={{
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      {/* Windows File Explorer */}
      <div
        style={{
          background: "white",
          padding: "12px 16px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              background: "#0078d4",
              marginRight: "8px",
              borderRadius: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "10px",
            }}
          >
            📁
          </div>
          <div style={{ fontSize: "14px", fontWeight: "500" }}>
            Claude - File Explorer
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <button
            style={{
              width: "32px",
              height: "24px",
              border: "none",
              background: "transparent",
              fontSize: "12px",
            }}
          >
            ─
          </button>
          <button
            style={{
              width: "32px",
              height: "24px",
              border: "none",
              background: "transparent",
              fontSize: "12px",
            }}
          >
            ☐
          </button>
          <button
            style={{
              width: "32px",
              height: "24px",
              border: "none",
              background: "transparent",
              fontSize: "12px",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <div
        style={{
          background: "white",
          padding: "8px 16px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            style={{
              width: "28px",
              height: "28px",
              border: "1px solid #e5e5e5",
              background: "white",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            ←
          </button>
          <button
            style={{
              width: "28px",
              height: "28px",
              border: "1px solid #e5e5e5",
              background: "white",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            →
          </button>
          <button
            style={{
              width: "28px",
              height: "28px",
              border: "1px solid #e5e5e5",
              background: "white",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            ↑
          </button>
        </div>
        <div
          style={{
            flex: 1,
            padding: "6px 12px",
            border: "1px solid #e5e5e5",
            borderRadius: "4px",
            fontSize: "13px",
            background: "white",
          }}
        >
          C:\Users\%USERNAME%\AppData\Roaming\Claude
        </div>
        <div
          style={{
            width: "150px",
            padding: "6px 12px",
            border: "1px solid #e5e5e5",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          Search Claude
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <div
          style={{
            width: "200px",
            background: "#f8f9fa",
            borderRight: "1px solid #e5e5e5",
            padding: "12px 0",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#666",
                padding: "0 16px 8px",
                textTransform: "uppercase",
              }}
            >
              QUICK ACCESS
            </div>
            {["🏠 Desktop", "⬇️ Downloads", "📄 Documents"].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  color: "#333",
                }}
              >
                {item}
              </div>
            ))}
            <div
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#666",
                padding: "16px 16px 8px",
                textTransform: "uppercase",
              }}
            >
              THIS PC
            </div>
            <div
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                background: "#cce8ff",
                borderLeft: "3px solid #0078d4",
              }}
            >
              💾 Local Disk (C:)
            </div>
          </div>
        </div>

        {/* File Area */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e5e5",
              background: "#fafafa",
            }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              This PC › Local Disk (C:) › Users › AppData › Roaming
            </div>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "#333" }}>
              Claude
            </div>
          </div>

          <div style={{ padding: "20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
              }}
            >
              {/* Highlighted config file */}
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 8px",
                  background: "#fff3cd",
                  border: "2px solid #ff6b35",
                  borderRadius: "6px",
                  animation: "pulse 2s infinite",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                    borderRadius: "6px",
                    margin: "0 auto 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "24px",
                  }}
                >
                  📄
                </div>
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>
                  claude_desktop_config.json
                </div>
                <div
                  style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}
                >
                  2 KB • JSON File
                </div>
              </div>

              {/* Other files */}
              <div style={{ textAlign: "center", padding: "16px 8px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: "#ffd700",
                    borderRadius: "6px",
                    margin: "0 auto 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#8b4513",
                    fontSize: "24px",
                  }}
                >
                  📁
                </div>
                <div style={{ fontSize: "13px" }}>logs</div>
                <div
                  style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}
                >
                  File folder
                </div>
              </div>

              <div style={{ textAlign: "center", padding: "16px 8px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: "#e5e5e5",
                    borderRadius: "6px",
                    margin: "0 auto 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                    fontSize: "24px",
                  }}
                >
                  📄
                </div>
                <div style={{ fontSize: "13px" }}>preferences.dat</div>
                <div
                  style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}
                >
                  1 KB • DAT File
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Instruction overlay */}
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "rgba(0, 0, 0, 0.85)",
        color: "white",
        padding: "20px",
        borderRadius: "8px",
        fontSize: "14px",
        maxWidth: "300px",
        lineHeight: "1.5",
      }}
    >
      ✅ <strong>Perfect!</strong> Your config file is in the correct Windows
      location.
    </div>
  </div>
);

const ClaudeMCPModal = ({ isOpen, onClose, autoSignIn = true }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [configDownloaded, setConfigDownloaded] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

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

  const downloadConfig = () => {
    try {
      const configText = JSON.stringify(mcpConfig, null, 2);
      const blob = new Blob([configText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "claude_desktop_config.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setConfigDownloaded(true);

      // Show screenshot after download
      setTimeout(() => {
        setShowScreenshot(true);
      }, 500);
    } catch (error) {
      console.error("Failed to download config:", error);
    }
  };

  const downloadClaudeDesktop = () => {
    window.open("https://claude.ai/download", "_blank");
  };

  const launchClaude = () => {
    // Try to launch Claude Desktop
    if (selectedPlatform === "mac") {
      window.location.href = "claude://";
    } else if (selectedPlatform === "windows") {
      window.location.href = "claude://";
    }

    // Fallback to web version
    setTimeout(() => {
      window.open("https://claude.ai/chat", "_blank", "width=1200,height=800");
    }, 500);
  };

  const resetSetup = () => {
    setCurrentStep(1);
    setSelectedPlatform(null);
    setConfigDownloaded(false);
    setShowScreenshot(false);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 999999,
        backdropFilter: "blur(5px)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "24px",
          maxWidth: "1000px",
          width: "100%",
          maxHeight: "95vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "40px 50px",
            borderBottom: "2px solid #f0f0f0",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            borderRadius: "24px 24px 0 0",
          }}
        >
          <h1
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              margin: 0,
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }}
          >
            Set Up Claude with Advanced Tools
          </h1>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "12px",
              padding: "12px",
              cursor: "pointer",
              color: "white",
              fontSize: "24px",
              transition: "all 0.3s ease",
              backdropFilter: "blur(10px)",
            }}
            onMouseOver={(e) =>
              (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.3)")
            }
            onMouseOut={(e) =>
              (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)")
            }
          >
            <X size={32} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "30px",
            background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "24px",
                background:
                  currentStep >= 1
                    ? "linear-gradient(135deg, #4CAF50, #45a049)"
                    : "#cccccc",
                boxShadow:
                  currentStep >= 1
                    ? "0 8px 20px rgba(76, 175, 80, 0.4)"
                    : "none",
                transition: "all 0.3s ease",
              }}
            >
              {currentStep > 1 ? "✓" : "1"}
            </div>
            <div
              style={{
                width: "60px",
                height: "8px",
                borderRadius: "4px",
                background:
                  currentStep >= 2
                    ? "linear-gradient(90deg, #4CAF50, #45a049)"
                    : "#cccccc",
                transition: "all 0.3s ease",
              }}
            ></div>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "24px",
                background:
                  currentStep >= 2
                    ? "linear-gradient(135deg, #2196F3, #1976D2)"
                    : "#cccccc",
                boxShadow:
                  currentStep >= 2
                    ? "0 8px 20px rgba(33, 150, 243, 0.4)"
                    : "none",
                transition: "all 0.3s ease",
              }}
            >
              {currentStep > 2 ? "✓" : "2"}
            </div>
            <div
              style={{
                width: "60px",
                height: "8px",
                borderRadius: "4px",
                background:
                  currentStep >= 3
                    ? "linear-gradient(90deg, #2196F3, #1976D2)"
                    : "#cccccc",
                transition: "all 0.3s ease",
              }}
            ></div>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "24px",
                background:
                  currentStep >= 3
                    ? "linear-gradient(135deg, #FF9800, #F57C00)"
                    : "#cccccc",
                boxShadow:
                  currentStep >= 3
                    ? "0 8px 20px rgba(255, 152, 0, 0.4)"
                    : "none",
                transition: "all 0.3s ease",
              }}
            >
              {currentStep > 3 ? "✓" : "3"}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "50px" }}>
          {/* Step 1: Platform Selection */}
          {currentStep === 1 && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "48px",
                  fontWeight: "bold",
                  marginBottom: "30px",
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  lineHeight: "1.2",
                }}
              >
                Choose Your Computer Type
              </h2>
              <p
                style={{
                  fontSize: "24px",
                  color: "#666",
                  marginBottom: "50px",
                  lineHeight: "1.5",
                  maxWidth: "600px",
                  margin: "0 auto 50px",
                }}
              >
                This will help us give you the right instructions for your
                system
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "30px",
                  maxWidth: "600px",
                  margin: "0 auto",
                }}
              >
                <button
                  onClick={() => {
                    setSelectedPlatform("mac");
                    setCurrentStep(2);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #667eea, #764ba2)",
                    color: "white",
                    border: "none",
                    borderRadius: "20px",
                    padding: "30px 40px",
                    fontSize: "28px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 30px rgba(102, 126, 234, 0.3)",
                    transform: "scale(1)",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow =
                      "0 12px 40px rgba(102, 126, 234, 0.5)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 8px 30px rgba(102, 126, 234, 0.3)";
                  }}
                >
                  <Apple size={48} />
                  <span>Mac Computer</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPlatform("windows");
                    setCurrentStep(2);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #4CAF50, #45a049)",
                    color: "white",
                    border: "none",
                    borderRadius: "20px",
                    padding: "30px 40px",
                    fontSize: "28px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 30px rgba(76, 175, 80, 0.3)",
                    transform: "scale(1)",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow =
                      "0 12px 40px rgba(76, 175, 80, 0.5)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 8px 30px rgba(76, 175, 80, 0.3)";
                  }}
                >
                  <Monitor size={48} />
                  <span>Windows Computer</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPlatform("configured");
                    setCurrentStep(4);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #FF9800, #F57C00)",
                    color: "white",
                    border: "none",
                    borderRadius: "20px",
                    padding: "30px 40px",
                    fontSize: "28px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 30px rgba(255, 152, 0, 0.3)",
                    transform: "scale(1)",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow =
                      "0 12px 40px rgba(255, 152, 0, 0.5)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 8px 30px rgba(255, 152, 0, 0.3)";
                  }}
                >
                  <CheckCircle size={48} />
                  <span>Already Set Up</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Download Config */}
          {currentStep === 2 &&
            selectedPlatform &&
            selectedPlatform !== "configured" && (
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    fontSize: "42px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#333",
                  }}
                >
                  Download Setup File
                </h2>
                <p
                  style={{
                    fontSize: "22px",
                    color: "#666",
                    marginBottom: "40px",
                    lineHeight: "1.5",
                  }}
                >
                  We'll create a special file that tells Claude how to connect
                  to your tools
                </p>

                <div
                  style={{
                    background: "linear-gradient(135deg, #e3f2fd, #bbdefb)",
                    borderRadius: "20px",
                    padding: "40px",
                    marginBottom: "40px",
                    border: "2px solid #2196F3",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "32px",
                      fontWeight: "bold",
                      marginBottom: "30px",
                      color: "#1976D2",
                    }}
                  >
                    Step 1: Download the file
                  </h3>
                  <button
                    onClick={downloadConfig}
                    disabled={configDownloaded}
                    style={{
                      background: configDownloaded
                        ? "linear-gradient(135deg, #4CAF50, #45a049)"
                        : "linear-gradient(135deg, #2196F3, #1976D2)",
                      color: "white",
                      border: "none",
                      borderRadius: "20px",
                      padding: "25px 50px",
                      fontSize: "28px",
                      fontWeight: "bold",
                      cursor: configDownloaded ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      margin: "0 auto",
                      transition: "all 0.3s ease",
                      boxShadow: configDownloaded
                        ? "0 8px 30px rgba(76, 175, 80, 0.4)"
                        : "0 8px 30px rgba(33, 150, 243, 0.4)",
                      transform: "scale(1)",
                      opacity: configDownloaded ? 0.8 : 1,
                    }}
                    onMouseOver={(e) => {
                      if (!configDownloaded) {
                        e.target.style.transform = "scale(1.05)";
                        e.target.style.boxShadow =
                          "0 12px 40px rgba(33, 150, 243, 0.6)";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!configDownloaded) {
                        e.target.style.transform = "scale(1)";
                        e.target.style.boxShadow =
                          "0 8px 30px rgba(33, 150, 243, 0.4)";
                      }
                    }}
                  >
                    {configDownloaded ? (
                      <>
                        <CheckCircle size={36} />
                        <span>Downloaded Successfully!</span>
                      </>
                    ) : (
                      <>
                        <Download size={36} />
                        <span>Download Setup File</span>
                      </>
                    )}
                  </button>
                </div>

                {configDownloaded && (
                  <div style={{ marginBottom: "40px" }}>
                    <div
                      style={{
                        background: "linear-gradient(135deg, #fff3e0, #ffcc02)",
                        border: "3px solid #FF9800",
                        borderRadius: "20px",
                        padding: "40px",
                        marginBottom: "30px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "32px",
                          fontWeight: "bold",
                          marginBottom: "25px",
                          color: "#E65100",
                        }}
                      >
                        Step 2: Move the file to the right place
                      </h3>

                      {selectedPlatform === "mac" && (
                        <div
                          style={{
                            textAlign: "left",
                            fontSize: "20px",
                            lineHeight: "1.8",
                          }}
                        >
                          <p
                            style={{
                              fontWeight: "bold",
                              fontSize: "24px",
                              marginBottom: "20px",
                            }}
                          >
                            On your Mac:
                          </p>
                          <ol style={{ paddingLeft: "30px", color: "#333" }}>
                            <li style={{ marginBottom: "15px" }}>
                              Press{" "}
                              <kbd
                                style={{
                                  backgroundColor: "#f0f0f0",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  fontFamily: "monospace",
                                  fontSize: "18px",
                                  fontWeight: "bold",
                                }}
                              >
                                Cmd + Shift + G
                              </kbd>{" "}
                              at the same time
                            </li>
                            <li style={{ marginBottom: "15px" }}>
                              Type:{" "}
                              <code
                                style={{
                                  backgroundColor: "#f0f0f0",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  fontFamily: "monospace",
                                  fontSize: "16px",
                                }}
                              >
                                ~/Library/Application Support/Claude/
                              </code>
                            </li>
                            <li style={{ marginBottom: "15px" }}>
                              Press Enter
                            </li>
                            <li>Drag the downloaded file into this folder</li>
                          </ol>
                        </div>
                      )}

                      {selectedPlatform === "windows" && (
                        <div
                          style={{
                            textAlign: "left",
                            fontSize: "20px",
                            lineHeight: "1.8",
                          }}
                        >
                          <p
                            style={{
                              fontWeight: "bold",
                              fontSize: "24px",
                              marginBottom: "20px",
                            }}
                          >
                            On your Windows computer:
                          </p>
                          <ol style={{ paddingLeft: "30px", color: "#333" }}>
                            <li style={{ marginBottom: "15px" }}>
                              Press{" "}
                              <kbd
                                style={{
                                  backgroundColor: "#f0f0f0",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  fontFamily: "monospace",
                                  fontSize: "18px",
                                  fontWeight: "bold",
                                }}
                              >
                                Windows + R
                              </kbd>{" "}
                              at the same time
                            </li>
                            <li style={{ marginBottom: "15px" }}>
                              Type:{" "}
                              <code
                                style={{
                                  backgroundColor: "#f0f0f0",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  fontFamily: "monospace",
                                  fontSize: "16px",
                                }}
                              >
                                %APPDATA%\Claude
                              </code>
                            </li>
                            <li style={{ marginBottom: "15px" }}>
                              Press Enter
                            </li>
                            <li>Drag the downloaded file into this folder</li>
                          </ol>
                        </div>
                      )}
                    </div>

                    {/* Visual Screenshot */}
                    {showScreenshot && (
                      <div
                        style={{
                          background: "#f8f9fa",
                          borderRadius: "20px",
                          padding: "30px",
                          border: "2px solid #dee2e6",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "28px",
                            fontWeight: "bold",
                            marginBottom: "25px",
                            textAlign: "center",
                            color: "#495057",
                          }}
                        >
                          It should look like this:
                        </h3>
                        <div style={{ position: "relative" }}>
                          {selectedPlatform === "mac" && <MacSetupScreenshot />}
                          {selectedPlatform === "windows" && (
                            <WindowsSetupScreenshot />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "50px",
                  }}
                >
                  <button
                    onClick={() => setCurrentStep(1)}
                    style={{
                      background: "linear-gradient(135deg, #6c757d, #495057)",
                      color: "white",
                      border: "none",
                      borderRadius: "15px",
                      padding: "20px 30px",
                      fontSize: "20px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      transition: "all 0.3s ease",
                    }}
                    onMouseOver={(e) =>
                      (e.target.style.transform = "scale(1.05)")
                    }
                    onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
                  >
                    <ArrowLeft size={24} />
                    <span>Back</span>
                  </button>

                  {configDownloaded && (
                    <button
                      onClick={() => setCurrentStep(3)}
                      style={{
                        background: "linear-gradient(135deg, #28a745, #20c997)",
                        color: "white",
                        border: "none",
                        borderRadius: "15px",
                        padding: "20px 30px",
                        fontSize: "20px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        transition: "all 0.3s ease",
                        boxShadow: "0 8px 25px rgba(40, 167, 69, 0.4)",
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = "scale(1.05)";
                        e.target.style.boxShadow =
                          "0 12px 35px rgba(40, 167, 69, 0.6)";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = "scale(1)";
                        e.target.style.boxShadow =
                          "0 8px 25px rgba(40, 167, 69, 0.4)";
                      }}
                    >
                      <span>Next Step</span>
                      <ArrowRight size={24} />
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* Step 3: Download Claude Desktop */}
          {currentStep === 3 && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "42px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                  color: "#333",
                }}
              >
                Download Claude Desktop
              </h2>
              <p
                style={{
                  fontSize: "22px",
                  color: "#666",
                  marginBottom: "40px",
                  lineHeight: "1.5",
                }}
              >
                Now let's get the Claude Desktop app installed on your computer
              </p>

              <div
                style={{
                  background: "linear-gradient(135deg, #d4edda, #c3e6cb)",
                  borderRadius: "20px",
                  padding: "40px",
                  marginBottom: "40px",
                  border: "3px solid #28a745",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                    marginBottom: "30px",
                  }}
                >
                  <CheckCircle size={48} style={{ color: "#28a745" }} />
                  <span
                    style={{
                      fontSize: "32px",
                      fontWeight: "bold",
                      color: "#155724",
                    }}
                  >
                    Setup file is ready!
                  </span>
                </div>

                <button
                  onClick={downloadClaudeDesktop}
                  style={{
                    background: "linear-gradient(135deg, #28a745, #20c997)",
                    color: "white",
                    border: "none",
                    borderRadius: "20px",
                    padding: "25px 50px",
                    fontSize: "28px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    margin: "0 auto",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 30px rgba(40, 167, 69, 0.4)",
                    transform: "scale(1)",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow =
                      "0 12px 40px rgba(40, 167, 69, 0.6)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 8px 30px rgba(40, 167, 69, 0.4)";
                  }}
                >
                  <Smartphone size={36} />
                  <span>Download Claude Desktop</span>
                </button>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #e3f2fd, #bbdefb)",
                  borderRadius: "20px",
                  padding: "40px",
                  marginBottom: "40px",
                  border: "2px solid #2196F3",
                }}
              >
                <h3
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "25px",
                    color: "#1976D2",
                  }}
                >
                  What to do next:
                </h3>
                <ol
                  style={{
                    fontSize: "22px",
                    textAlign: "left",
                    lineHeight: "1.8",
                    maxWidth: "500px",
                    margin: "0 auto",
                    paddingLeft: "30px",
                    color: "#333",
                  }}
                >
                  <li style={{ marginBottom: "15px" }}>
                    Install Claude Desktop from the download
                  </li>
                  <li style={{ marginBottom: "15px" }}>Open Claude Desktop</li>
                  <li>Your advanced tools will be ready to use! 🎉</li>
                </ol>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setCurrentStep(2)}
                  style={{
                    background: "linear-gradient(135deg, #6c757d, #495057)",
                    color: "white",
                    border: "none",
                    borderRadius: "15px",
                    padding: "20px 30px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) =>
                    (e.target.style.transform = "scale(1.05)")
                  }
                  onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
                >
                  <ArrowLeft size={24} />
                  <span>Back</span>
                </button>

                <button
                  onClick={() => setCurrentStep(4)}
                  style={{
                    background: "linear-gradient(135deg, #FF9800, #F57C00)",
                    color: "white",
                    border: "none",
                    borderRadius: "15px",
                    padding: "20px 30px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 25px rgba(255, 152, 0, 0.4)",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "scale(1.05)";
                    e.target.style.boxShadow =
                      "0 12px 35px rgba(255, 152, 0, 0.6)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow =
                      "0 8px 25px rgba(255, 152, 0, 0.4)";
                  }}
                >
                  <span>I'm Done!</span>
                  <ArrowRight size={24} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Launch Claude */}
          {currentStep === 4 && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "48px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                  color: "#333",
                }}
              >
                🎉 You're All Set!
              </h2>
              <p
                style={{
                  fontSize: "24px",
                  color: "#666",
                  marginBottom: "40px",
                  lineHeight: "1.5",
                }}
              >
                Claude Desktop is ready with your advanced research tools
              </p>

              <div
                style={{
                  background: "linear-gradient(135deg, #f3e5f5, #e1bee7)",
                  borderRadius: "20px",
                  padding: "40px",
                  marginBottom: "40px",
                  border: "3px solid #9c27b0",
                }}
              >
                <h3
                  style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    marginBottom: "25px",
                    color: "#7b1fa2",
                  }}
                >
                  Your new superpowers:
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "25px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: "15px",
                      padding: "25px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#2196F3",
                        fontSize: "20px",
                        marginBottom: "8px",
                      }}
                    >
                      🔍 Smart Dropbox Search
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        color: "#666",
                      }}
                    >
                      Find any image or file instantly
                    </div>
                  </div>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "15px",
                      padding: "25px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#4CAF50",
                        fontSize: "20px",
                        marginBottom: "8px",
                      }}
                    >
                      📊 Business Reports
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        color: "#666",
                      }}
                    >
                      Generate detailed analytics
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={launchClaude}
                style={{
                  background: "linear-gradient(135deg, #9c27b0, #e91e63)",
                  color: "white",
                  border: "none",
                  borderRadius: "20px",
                  padding: "25px 50px",
                  fontSize: "28px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  margin: "0 auto 30px",
                  transition: "all 0.3s ease",
                  boxShadow: "0 8px 30px rgba(156, 39, 176, 0.4)",
                  transform: "scale(1)",
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "scale(1.05)";
                  e.target.style.boxShadow =
                    "0 12px 40px rgba(156, 39, 176, 0.6)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "scale(1)";
                  e.target.style.boxShadow =
                    "0 8px 30px rgba(156, 39, 176, 0.4)";
                }}
              >
                <Monitor size={36} />
                <span>Open Claude Desktop</span>
              </button>

              <button
                onClick={resetSetup}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  fontSize: "18px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "10px 20px",
                }}
                onMouseOver={(e) => (e.target.style.color = "#333")}
                onMouseOut={(e) => (e.target.style.color = "#666")}
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Use createPortal to render modal at document.body level
  return createPortal(modalContent, document.body);
};

export default ClaudeMCPModal;
