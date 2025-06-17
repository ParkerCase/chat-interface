import React, { useState, useEffect, useRef } from "react";
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
  <div className="bg-gray-100 rounded-lg p-4 border">
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-full">
      {/* Mac Finder Window */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-200 px-4 py-3 border-b flex items-center">
        <div className="flex space-x-2 mr-4">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <div className="text-sm font-medium text-gray-700">
          Claude — Application Support
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center space-x-2">
        <div className="flex space-x-1">
          <button className="w-6 h-6 bg-gray-200 rounded text-xs flex items-center justify-center">
            ←
          </button>
          <button className="w-6 h-6 bg-gray-200 rounded text-xs flex items-center justify-center">
            →
          </button>
        </div>
        <div className="bg-white border rounded px-3 py-1 text-sm text-gray-600 flex-1">
          ~/Library/Application Support/Claude
        </div>
        <div className="bg-white border rounded px-3 py-1 text-sm w-32">
          <Search size={12} className="inline mr-1" />
          Search
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-48 bg-gray-50 border-r p-3">
          <div className="space-y-1 text-sm">
            <div className="text-xs text-gray-500 font-semibold mb-2">
              FAVORITES
            </div>
            <div className="py-1 px-2 hover:bg-gray-200 rounded">
              📱 AirDrop
            </div>
            <div className="py-1 px-2 hover:bg-gray-200 rounded">
              🔄 Recents
            </div>
            <div className="py-1 px-2 hover:bg-gray-200 rounded">
              📊 Applications
            </div>
            <div className="py-1 px-2 hover:bg-gray-200 rounded">
              🏠 Desktop
            </div>
            <div className="py-1 px-2 hover:bg-gray-200 rounded">
              📁 Documents
            </div>
            <div className="text-xs text-gray-500 font-semibold mt-4 mb-2">
              LOCATIONS
            </div>
            <div className="py-1 px-2 bg-blue-100 text-blue-800 rounded">
              💻 Macintosh HD
            </div>
          </div>
        </div>

        {/* File Area */}
        <div className="flex-1 p-4">
          <div className="text-xs text-gray-500 mb-3 bg-gray-100 px-2 py-1 rounded">
            Home > Library > Application Support > Claude
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Highlighted config file */}
            <div className="text-center p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg animate-pulse">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg mx-auto mb-2 flex items-center justify-center text-white text-lg">
                📄
              </div>
              <div className="text-xs font-medium">
                claude_desktop_config.json
              </div>
            </div>

            {/* Other files */}
            <div className="text-center p-3">
              <div className="w-12 h-12 bg-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center text-gray-600">
                📁
              </div>
              <div className="text-xs">logs</div>
            </div>

            <div className="text-center p-3">
              <div className="w-12 h-12 bg-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center text-gray-600">
                📄
              </div>
              <div className="text-xs">preferences.plist</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Instruction overlay */}
    <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm max-w-xs">
      ✅ Perfect! Your config file is in the right place.
    </div>
  </div>
);

// Windows Setup Screenshot Component
const WindowsSetupScreenshot = () => (
  <div className="bg-gray-100 rounded-lg p-4 border">
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-full">
      {/* Windows File Explorer */}
      <div className="bg-white px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-500 rounded-sm mr-2 flex items-center justify-center text-white text-xs">
            📁
          </div>
          <div className="text-sm font-medium">Claude - File Explorer</div>
        </div>
        <div className="flex">
          <button className="w-8 h-6 hover:bg-gray-100 text-xs">─</button>
          <button className="w-8 h-6 hover:bg-gray-100 text-xs">☐</button>
          <button className="w-8 h-6 hover:bg-red-500 hover:text-white text-xs">
            ✕
          </button>
        </div>
      </div>

      {/* Ribbon */}
      <div className="bg-gray-50 px-4 py-2 border-b">
        <div className="flex space-x-4 mb-2 text-sm">
          <div className="bg-blue-500 text-white px-3 py-1 rounded">Home</div>
          <div className="text-gray-600 px-3 py-1">Share</div>
          <div className="text-gray-600 px-3 py-1">View</div>
        </div>
        <div className="flex space-x-2 text-xs">
          <button className="bg-white border px-2 py-1 rounded">📋 Copy</button>
          <button className="bg-white border px-2 py-1 rounded">
            📁 New folder
          </button>
          <button className="bg-white border px-2 py-1 rounded">
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <div className="bg-white px-4 py-2 border-b flex items-center space-x-2">
        <div className="flex space-x-1">
          <button className="w-6 h-6 border bg-gray-50 rounded text-xs">
            ←
          </button>
          <button className="w-6 h-6 border bg-gray-50 rounded text-xs">
            →
          </button>
          <button className="w-6 h-6 border bg-gray-50 rounded text-xs">
            ↑
          </button>
        </div>
        <div className="bg-white border rounded px-3 py-1 text-sm flex-1">
          C:\Users\%USERNAME%\AppData\Roaming\Claude
        </div>
        <div className="bg-white border rounded px-3 py-1 text-sm w-32">
          Search Claude
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-48 bg-gray-50 border-r p-3">
          <div className="space-y-1 text-sm">
            <div className="text-xs text-gray-500 font-semibold mb-2">
              QUICK ACCESS
            </div>
            <div className="py-1 px-2 hover:bg-blue-100 rounded">
              🏠 Desktop
            </div>
            <div className="py-1 px-2 hover:bg-blue-100 rounded">
              ⬇️ Downloads
            </div>
            <div className="py-1 px-2 hover:bg-blue-100 rounded">
              📄 Documents
            </div>
            <div className="text-xs text-gray-500 font-semibold mt-4 mb-2">
              THIS PC
            </div>
            <div className="py-1 px-2 bg-blue-100 border-l-2 border-blue-500">
              💾 Local Disk (C:)
            </div>
          </div>
        </div>

        {/* File Area */}
        <div className="flex-1">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <div className="text-xs text-gray-500">
              This PC > Local Disk (C:) > Users > AppData > Roaming
            </div>
            <div className="text-lg font-semibold">Claude</div>
          </div>

          <div className="p-4">
            <div className="flex justify-between items-center mb-4 text-sm">
              <div className="text-gray-600">3 items</div>
              <div className="flex space-x-1">
                <button className="w-6 h-6 bg-blue-500 text-white text-xs">
                  ⊞
                </button>
                <button className="w-6 h-6 border text-xs">≡</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Highlighted config file */}
              <div className="text-center p-3 bg-orange-100 border-2 border-orange-400 rounded-lg animate-pulse">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-700 rounded mx-auto mb-2 flex items-center justify-center text-white text-lg">
                  📄
                </div>
                <div className="text-xs font-medium">
                  claude_desktop_config.json
                </div>
                <div className="text-xs text-gray-500">2 KB • JSON File</div>
              </div>

              {/* Other files */}
              <div className="text-center p-3">
                <div className="w-12 h-12 bg-yellow-400 rounded mx-auto mb-2 flex items-center justify-center text-yellow-800">
                  📁
                </div>
                <div className="text-xs">logs</div>
                <div className="text-xs text-gray-500">File folder</div>
              </div>

              <div className="text-center p-3">
                <div className="w-12 h-12 bg-gray-300 rounded mx-auto mb-2 flex items-center justify-center text-gray-600">
                  📄
                </div>
                <div className="text-xs">preferences.dat</div>
                <div className="text-xs text-gray-500">1 KB • DAT File</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Instruction overlay */}
    <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm max-w-xs">
      ✅ Perfect! Your config file is in the correct Windows location.
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

  // Auto-detect platform
  useEffect(() => {
    if (isOpen) {
      const platform = navigator.platform.toLowerCase();
      if (platform.includes("mac")) {
        // Don't auto-select, let user choose
      } else if (platform.includes("win")) {
        // Don't auto-select, let user choose
      }
    }
  }, [isOpen]);

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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl"
        style={{
          maxWidth: "900px",
          width: "90%",
          maxHeight: "95vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <h1 className="text-3xl font-bold text-gray-800">
            Set Up Claude with Advanced Tools
          </h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-2 shadow-lg hover:shadow-xl"
          >
            <X size={28} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center items-center p-6 bg-gradient-to-r from-gray-50 to-blue-50">
          <div className="flex items-center space-x-6">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-300 ${
                currentStep >= 1
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg"
                  : "bg-gray-300"
              }`}
            >
              1
            </div>
            <div
              className={`w-12 h-1 rounded transition-all duration-300 ${
                currentStep >= 2
                  ? "bg-gradient-to-r from-blue-500 to-purple-600"
                  : "bg-gray-300"
              }`}
            ></div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-300 ${
                currentStep >= 2
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg"
                  : "bg-gray-300"
              }`}
            >
              2
            </div>
            <div
              className={`w-12 h-1 rounded transition-all duration-300 ${
                currentStep >= 3
                  ? "bg-gradient-to-r from-blue-500 to-purple-600"
                  : "bg-gray-300"
              }`}
            ></div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-300 ${
                currentStep >= 3
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg"
                  : "bg-gray-300"
              }`}
            >
              3
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-10 min-h-[500px]">
          {/* Step 1: Platform Selection */}
          {currentStep === 1 && (
            <div className="text-center">
              <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Choose Your Computer Type
              </h2>
              <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                This will help us give you the right instructions for your
                system
              </p>

              <div className="space-y-6 max-w-lg mx-auto">
                <button
                  onClick={() => {
                    setSelectedPlatform("mac");
                    setCurrentStep(2);
                  }}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl p-8 text-2xl font-bold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-4 group"
                >
                  <Apple
                    size={40}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span>Mac Computer</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPlatform("windows");
                    setCurrentStep(2);
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-2xl p-8 text-2xl font-bold hover:from-green-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-4 group"
                >
                  <Monitor
                    size={40}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span>Windows Computer</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPlatform("configured");
                    setCurrentStep(4);
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-8 text-2xl font-bold hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-4 group"
                >
                  <CheckCircle
                    size={40}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span>Already Set Up</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Download Config */}
          {currentStep === 2 &&
            selectedPlatform &&
            selectedPlatform !== "configured" && (
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">Download Setup File</h2>
                <p className="text-lg text-gray-600 mb-8">
                  We'll create a special file that tells Claude how to connect
                  to your tools
                </p>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 mb-10 border border-blue-200">
                  <h3 className="text-2xl font-bold mb-6 text-center">
                    Step 1: Download the file
                  </h3>
                  <div className="flex justify-center">
                    <button
                      onClick={downloadConfig}
                      disabled={configDownloaded}
                      className={`${
                        configDownloaded
                          ? "bg-gradient-to-r from-green-500 to-emerald-600"
                          : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      } text-white rounded-2xl px-10 py-6 text-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center space-x-4 disabled:transform-none`}
                    >
                      {configDownloaded ? (
                        <>
                          <CheckCircle size={32} />
                          <span>Downloaded!</span>
                        </>
                      ) : (
                        <>
                          <Download size={32} />
                          <span>Download Setup File</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {configDownloaded && (
                  <div className="space-y-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
                      <h3 className="text-xl font-bold mb-4">
                        Step 2: Move the file to the right place
                      </h3>

                      {selectedPlatform === "mac" && (
                        <div className="text-left space-y-3">
                          <p className="font-semibold">On your Mac:</p>
                          <ol className="list-decimal list-inside space-y-2 text-lg">
                            <li>
                              Press{" "}
                              <kbd className="bg-gray-200 px-2 py-1 rounded">
                                Cmd + Shift + G
                              </kbd>{" "}
                              at the same time
                            </li>
                            <li>
                              Type:{" "}
                              <code className="bg-gray-200 px-2 py-1 rounded">
                                ~/Library/Application Support/Claude/
                              </code>
                            </li>
                            <li>Press Enter</li>
                            <li>Drag the downloaded file into this folder</li>
                          </ol>
                        </div>
                      )}

                      {selectedPlatform === "windows" && (
                        <div className="text-left space-y-3">
                          <p className="font-semibold">
                            On your Windows computer:
                          </p>
                          <ol className="list-decimal list-inside space-y-2 text-lg">
                            <li>
                              Press{" "}
                              <kbd className="bg-gray-200 px-2 py-1 rounded">
                                Windows + R
                              </kbd>{" "}
                              at the same time
                            </li>
                            <li>
                              Type:{" "}
                              <code className="bg-gray-200 px-2 py-1 rounded">
                                %APPDATA%\Claude
                              </code>
                            </li>
                            <li>Press Enter</li>
                            <li>Drag the downloaded file into this folder</li>
                          </ol>
                        </div>
                      )}
                    </div>

                    {/* Visual Screenshot */}
                    {showScreenshot && (
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="text-xl font-bold mb-4 text-center">
                          It should look like this:
                        </h3>
                        <div className="relative">
                          {selectedPlatform === "mac" && <MacSetupScreenshot />}
                          {selectedPlatform === "windows" && (
                            <WindowsSetupScreenshot />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between mt-8">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="bg-gray-500 text-white rounded-xl px-6 py-3 font-bold hover:bg-gray-600 flex items-center space-x-2"
                  >
                    <ArrowLeft size={20} />
                    <span>Back</span>
                  </button>

                  {configDownloaded && (
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="bg-blue-500 text-white rounded-xl px-6 py-3 font-bold hover:bg-blue-600 flex items-center space-x-2"
                    >
                      <span>Next Step</span>
                      <ArrowRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* Step 3: Download Claude Desktop */}
          {currentStep === 3 && (
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">
                Download Claude Desktop
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Now let's get the Claude Desktop app installed on your computer
              </p>

              <div className="bg-green-50 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <CheckCircle size={32} className="text-green-500" />
                  <span className="text-xl font-bold">
                    Setup file is ready!
                  </span>
                </div>

                <button
                  onClick={downloadClaudeDesktop}
                  className="bg-green-500 text-white rounded-xl px-8 py-4 text-xl font-bold hover:bg-green-600 transition-all flex items-center space-x-3 mx-auto"
                >
                  <Smartphone size={24} />
                  <span>Download Claude Desktop</span>
                </button>
              </div>

              <div className="bg-blue-50 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-bold mb-4">What to do next:</h3>
                <ol className="list-decimal list-inside space-y-2 text-lg text-left max-w-md mx-auto">
                  <li>Install Claude Desktop from the download</li>
                  <li>Open Claude Desktop</li>
                  <li>Your advanced tools will be ready to use! 🎉</li>
                </ol>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="bg-gray-500 text-white rounded-xl px-6 py-3 font-bold hover:bg-gray-600 flex items-center space-x-2"
                >
                  <ArrowLeft size={20} />
                  <span>Back</span>
                </button>

                <button
                  onClick={() => setCurrentStep(4)}
                  className="bg-blue-500 text-white rounded-xl px-6 py-3 font-bold hover:bg-blue-600 flex items-center space-x-2"
                >
                  <span>I'm Done!</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Launch Claude */}
          {currentStep === 4 && (
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">🎉 You're All Set!</h2>
              <p className="text-lg text-gray-600 mb-8">
                Claude Desktop is ready with your advanced research tools
              </p>

              <div className="bg-purple-50 rounded-xl p-6 mb-8">
                <h3 className="text-xl font-bold mb-4">
                  Your new superpowers:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="bg-white rounded-lg p-4">
                    <div className="font-bold text-blue-600">
                      🔍 Smart Dropbox Search
                    </div>
                    <div className="text-sm text-gray-600">
                      Find any image or file instantly
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <div className="font-bold text-green-600">
                      📊 Business Reports
                    </div>
                    <div className="text-sm text-gray-600">
                      Generate detailed analytics
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={launchClaude}
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl px-8 py-4 text-xl font-bold hover:from-purple-600 hover:to-pink-700 transition-all transform hover:scale-105 flex items-center space-x-3 mx-auto mb-6"
              >
                <Monitor size={24} />
                <span>Open Claude Desktop</span>
              </button>

              <button
                onClick={resetSetup}
                className="text-gray-500 hover:text-gray-700 underline"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaudeMCPModal;
