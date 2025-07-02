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
  Terminal,
  ExternalLink,
  Copy,
  CheckCheck,
} from "lucide-react";

const ClaudeMCPModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptDownloaded, setScriptDownloaded] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Auto-detect platform
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.indexOf('mac') !== -1) {
        setSelectedPlatform('mac');
      } else if (userAgent.indexOf('win') !== -1) {
        setSelectedPlatform('windows');
      } else if (userAgent.indexOf('linux') !== -1) {
        setSelectedPlatform('linux');
      }
    }
  }, []);

  // Generate platform-specific setup script
  const generateSetupScript = (platform) => {
    const commonProxyCode = {
      dropbox: `#!/usr/bin/env node
const http = require('http');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

console.error('[DROPBOX-PROXY] Starting Tatt2Away Dropbox MCP Proxy...');

const proxyServer = new Server({
  name: 'tatt2away-dropbox-proxy',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: '147.182.247.128',
      port: 3000,
      path: '/mcp/dropbox/sse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Tatt2Away-MCP-Proxy/1.0'
      },
      timeout: 15000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(\`HTTP \${res.statusCode}: \${responseData}\`));
        }
        
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse);
        } catch (e) {
          reject(new Error(\`Invalid JSON response: \${e.message}\`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[DROPBOX-PROXY] Request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

proxyServer.setRequestHandler('tools/list', async () => {
  const response = await makeRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  });
  return response.result;
});

proxyServer.setRequestHandler('tools/call', async (request) => {
  const response = await makeRequest({
    jsonrpc: '2.0',
    id: request.id || 1,
    method: 'tools/call',
    params: request.params
  });
  return response.result;
});

const transport = new StdioServerTransport();
proxyServer.connect(transport);`,

      zenoti: `#!/usr/bin/env node
const http = require('http');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

console.error('[ZENOTI-PROXY] Starting Tatt2Away Zenoti MCP Proxy...');

const proxyServer = new Server({
  name: 'tatt2away-zenoti-proxy',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: '147.182.247.128',
      port: 3000,
      path: '/mcp/zenoti/sse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Tatt2Away-MCP-Proxy/1.0'
      },
      timeout: 15000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(\`HTTP \${res.statusCode}: \${responseData}\`));
        }
        
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse);
        } catch (e) {
          reject(new Error(\`Invalid JSON response: \${e.message}\`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[ZENOTI-PROXY] Request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

proxyServer.setRequestHandler('tools/list', async () => {
  const response = await makeRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  });
  return response.result;
});

proxyServer.setRequestHandler('tools/call', async (request) => {
  const response = await makeRequest({
    jsonrpc: '2.0',
    id: request.id || 1,
    method: 'tools/call',
    params: request.params
  });
  return response.result;
});

const transport = new StdioServerTransport();
proxyServer.connect(transport);`
    };

    let configPath, proxyDir, setupScript;

    switch (platform) {
      case 'mac':
        configPath = '$HOME/Library/Application Support/Claude/claude_desktop_config.json';
        proxyDir = '$HOME/.tatt2away_mcp';
        setupScript = `#!/bin/bash

# Tatt2Away MCP Setup Script for Mac
set -e

echo "🚀 Setting up Tatt2Away MCP for Claude on Mac..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Create directories
echo "📁 Creating directories..."
mkdir -p "$HOME/Library/Application Support/Claude"
mkdir -p "$HOME/.tatt2away_mcp"

# Backup existing config
if [ -f "${configPath}" ]; then
    cp "${configPath}" "${configPath}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📋 Backed up existing config"
fi

# Create Dropbox proxy
echo "🔧 Creating Dropbox proxy..."
cat > "${proxyDir}/dropbox-proxy.js" << 'DROPBOX_EOF'
${commonProxyCode.dropbox}
DROPBOX_EOF

# Create Zenoti proxy
echo "🔧 Creating Zenoti proxy..."
cat > "${proxyDir}/zenoti-proxy.js" << 'ZENOTI_EOF'
${commonProxyCode.zenoti}
ZENOTI_EOF

# Set permissions
chmod +x "${proxyDir}/dropbox-proxy.js"
chmod +x "${proxyDir}/zenoti-proxy.js"

# Create Claude config
echo "⚙️ Creating Claude config..."
cat > "${configPath}" << 'CONFIG_EOF'
{
  "mcpServers": {
    "tatt2away-dropbox": {
      "command": "node",
      "args": ["${proxyDir}/dropbox-proxy.js"]
    },
    "tatt2away-zenoti": {
      "command": "node",
      "args": ["${proxyDir}/zenoti-proxy.js"]
    }
  }
}
CONFIG_EOF

echo ""
echo "✅ Tatt2Away MCP setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Restart Claude Desktop if it's running"
echo "  2. Ask Claude: 'What MCP tools do you have?'"
echo "  3. Try: 'Search my Dropbox for images of flames'"
echo ""
echo "🎉 You now have Universal Dropbox Search and Enhanced Zenoti tools!"`;
        break;

      case 'windows':
        configPath = '%APPDATA%\\Claude\\claude_desktop_config.json';
        proxyDir = '%USERPROFILE%\\.tatt2away_mcp';
        setupScript = `@echo off
setlocal EnableDelayedExpansion

echo 🚀 Setting up Tatt2Away MCP for Claude on Windows...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: !NODE_VERSION!

REM Create directories
echo 📁 Creating directories...
if not exist "%APPDATA%\\Claude" mkdir "%APPDATA%\\Claude"
if not exist "%USERPROFILE%\\.tatt2away_mcp" mkdir "%USERPROFILE%\\.tatt2away_mcp"

REM Backup existing config
if exist "%APPDATA%\\Claude\\claude_desktop_config.json" (
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set DATE=%%c%%a%%b
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME=%%a%%b
    copy "%APPDATA%\\Claude\\claude_desktop_config.json" "%APPDATA%\\Claude\\claude_desktop_config.json.backup.!DATE!_!TIME!"
    echo 📋 Backed up existing config
)

REM Create Dropbox proxy
echo 🔧 Creating Dropbox proxy...
(
echo ${commonProxyCode.dropbox.replace(/\$/g, '$$')}
) > "%USERPROFILE%\\.tatt2away_mcp\\dropbox-proxy.js"

REM Create Zenoti proxy
echo 🔧 Creating Zenoti proxy...
(
echo ${commonProxyCode.zenoti.replace(/\$/g, '$$')}
) > "%USERPROFILE%\\.tatt2away_mcp\\zenoti-proxy.js"

REM Create Claude config
echo ⚙️ Creating Claude config...
(
echo {
echo   "mcpServers": {
echo     "tatt2away-dropbox": {
echo       "command": "node",
echo       "args": ["%USERPROFILE%\\.tatt2away_mcp\\dropbox-proxy.js"]
echo     },
echo     "tatt2away-zenoti": {
echo       "command": "node",
echo       "args": ["%USERPROFILE%\\.tatt2away_mcp\\zenoti-proxy.js"]
echo     }
echo   }
echo }
) > "%APPDATA%\\Claude\\claude_desktop_config.json"

echo.
echo ✅ Tatt2Away MCP setup complete!
echo.
echo 📋 Next steps:
echo   1. Restart Claude Desktop if it's running
echo   2. Ask Claude: 'What MCP tools do you have?'
echo   3. Try: 'Search my Dropbox for images of flames'
echo.
echo 🎉 You now have Universal Dropbox Search and Enhanced Zenoti tools!
pause`;
        break;

      case 'linux':
        configPath = '$HOME/.config/Claude/claude_desktop_config.json';
        proxyDir = '$HOME/.tatt2away_mcp';
        setupScript = `#!/bin/bash

# Tatt2Away MCP Setup Script for Linux
set -e

echo "🚀 Setting up Tatt2Away MCP for Claude on Linux..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Ubuntu/Debian: sudo apt install nodejs npm"
    echo "   Red Hat/Fedora: sudo dnf install nodejs npm"
    echo "   Arch: sudo pacman -S nodejs npm"
    echo "   Or download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Create directories
echo "📁 Creating directories..."
mkdir -p "$HOME/.config/Claude"
mkdir -p "$HOME/.tatt2away_mcp"

# Backup existing config
if [ -f "${configPath}" ]; then
    cp "${configPath}" "${configPath}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📋 Backed up existing config"
fi

# Create Dropbox proxy
echo "🔧 Creating Dropbox proxy..."
cat > "${proxyDir}/dropbox-proxy.js" << 'DROPBOX_EOF'
${commonProxyCode.dropbox}
DROPBOX_EOF

# Create Zenoti proxy
echo "🔧 Creating Zenoti proxy..."
cat > "${proxyDir}/zenoti-proxy.js" << 'ZENOTI_EOF'
${commonProxyCode.zenoti}
ZENOTI_EOF

# Set permissions
chmod +x "${proxyDir}/dropbox-proxy.js"
chmod +x "${proxyDir}/zenoti-proxy.js"

# Create Claude config
echo "⚙️ Creating Claude config..."
cat > "${configPath}" << 'CONFIG_EOF'
{
  "mcpServers": {
    "tatt2away-dropbox": {
      "command": "node",
      "args": ["${proxyDir}/dropbox-proxy.js"]
    },
    "tatt2away-zenoti": {
      "command": "node",
      "args": ["${proxyDir}/zenoti-proxy.js"]
    }
  }
}
CONFIG_EOF

echo ""
echo "✅ Tatt2Away MCP setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Restart Claude Desktop if it's running"
echo "  2. Ask Claude: 'What MCP tools do you have?'"
echo "  3. Try: 'Search my Dropbox for images of flames'"
echo ""
echo "🎉 You now have Universal Dropbox Search and Enhanced Zenoti tools!"`;
        break;

      default:
        return null;
    }

    return setupScript;
  };

  const downloadSetupScript = () => {
    const script = generateSetupScript(selectedPlatform);
    if (!script) return;

    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedPlatform === 'windows' ? 'setup_tatt2away_mcp.bat' : 'setup_tatt2away_mcp.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setScriptDownloaded(true);
  };

  const downloadClaudeDesktop = () => {
    window.open("https://claude.ai/download", "_blank");
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    });
  };

  const getRunCommand = () => {
    const filename = selectedPlatform === 'windows' ? 'setup_tatt2away_mcp.bat' : 'setup_tatt2away_mcp.sh';
    
    switch (selectedPlatform) {
      case 'mac':
      case 'linux':
        return `chmod +x ~/Downloads/${filename} && ~/Downloads/${filename}`;
      case 'windows':
        return `cd Downloads && ${filename}`;
      default:
        return '';
    }
  };

  const resetSetup = () => {
    setCurrentStep(0);
    setScriptDownloaded(false);
    setShowScreenshot(false);
    setCopiedCommand(false);
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "24px",
          maxWidth: "900px",
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
              fontSize: "28px",
              fontWeight: "bold",
              margin: 0,
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }}
          >
            🚀 Tatt2Away MCP Setup
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
              fontSize: "20px",
              transition: "all 0.3s ease",
            }}
          >
            <X size={24} />
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
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {[0, 1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "18px",
                    background: currentStep >= step
                      ? "linear-gradient(135deg, #4CAF50, #45a049)"
                      : "#cccccc",
                    transition: "all 0.3s ease",
                  }}
                >
                  {currentStep > step ? "✓" : step + 1}
                </div>
                {step < 3 && (
                  <div
                    style={{
                      width: "40px",
                      height: "6px",
                      borderRadius: "3px",
                      background: currentStep > step
                        ? "linear-gradient(90deg, #4CAF50, #45a049)"
                        : "#cccccc",
                      transition: "all 0.3s ease",
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "40px" }}>
          
          {/* Step 0: Download Claude Desktop */}
          {currentStep === 0 && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                First, Get Claude Desktop
              </h2>
              <p
                style={{
                  fontSize: "20px",
                  color: "#666",
                  marginBottom: "40px",
                  lineHeight: "1.5",
                }}
              >
                You'll need the Claude Desktop app to use these advanced tools
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                    marginBottom: "30px",
                  }}
                >
                  <Smartphone size={48} style={{ color: "#2196F3" }} />
                  <span
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#1976D2",
                    }}
                  >
                    Claude Desktop Required
                  </span>
                </div>

                <button
                  onClick={downloadClaudeDesktop}
                  style={{
                    background: "linear-gradient(135deg, #2196F3, #1976D2)",
                    color: "white",
                    border: "none",
                    borderRadius: "16px",
                    padding: "20px 40px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    margin: "0 auto",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 25px rgba(33, 150, 243, 0.4)",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "scale(1.05)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "scale(1)";
                  }}
                >
                  <ExternalLink size={24} />
                  <span>Download Claude Desktop</span>
                </button>
              </div>

              <div
                style={{
                  background: "#fff3cd",
                  borderRadius: "16px",
                  padding: "30px",
                  border: "2px solid #ffc107",
                  marginBottom: "40px",
                }}
              >
                <h3
                  style={{
                    fontSize: "22px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#856404",
                  }}
                >
                  📋 Quick Setup:
                </h3>
                <div
                  style={{
                    textAlign: "left",
                    fontSize: "16px",
                    lineHeight: "1.6",
                  }}
                >
                  <p style={{ marginBottom: "10px" }}>
                    <strong>1.</strong> Download and install Claude Desktop from the link above
                  </p>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>2.</strong> Sign in with your Claude account
                  </p>
                  <p style={{ marginBottom: "10px" }}>
                    <strong>3.</strong> <strong>Close Claude completely</strong> (important!)
                  </p>
                  <p>
                    <strong>4.</strong> Come back here to add the advanced tools
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep(1)}
                style={{
                  background: "linear-gradient(135deg, #28a745, #20c997)",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  padding: "20px 40px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  margin: "0 auto",
                  transition: "all 0.3s ease",
                  boxShadow: "0 8px 25px rgba(40, 167, 69, 0.4)",
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "scale(1.05)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "scale(1)";
                }}
              >
                <span>I Have Claude Desktop</span>
                <ArrowRight size={24} />
              </button>
            </div>
          )}

          {/* Step 1: Platform Selection */}
          {currentStep === 1 && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                  color: "#333",
                }}
              >
                Choose Your Computer Type
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "#666",
                  marginBottom: "40px",
                  lineHeight: "1.5",
                }}
              >
                {selectedPlatform && (
                  <span style={{ color: "#28a745", fontWeight: "bold" }}>
                    ✅ Auto-detected: {selectedPlatform === 'mac' ? 'Mac' : selectedPlatform === 'windows' ? 'Windows' : 'Linux'}
                    <br />
                  </span>
                )}
                Confirm your platform to get the right setup instructions
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  maxWidth: "500px",
                  margin: "0 auto",
                }}
              >
                <button
                  onClick={() => {
                    setSelectedPlatform("mac");
                    setCurrentStep(2);
                  }}
                  style={{
                    background: selectedPlatform === 'mac' 
                      ? "linear-gradient(135deg, #667eea, #764ba2)"
                      : "linear-gradient(135deg, #f8f9fa, #e9ecef)",
                    color: selectedPlatform === 'mac' ? "white" : "#333",
                    border: selectedPlatform === 'mac' ? "3px solid #667eea" : "2px solid #dee2e6",
                    borderRadius: "16px",
                    padding: "25px 30px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "15px",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Apple size={32} />
                  <span>Mac Computer</span>
                  {selectedPlatform === 'mac' && <CheckCircle size={24} />}
                </button>

                <button
                  onClick={() => {
                    setSelectedPlatform("windows");
                    setCurrentStep(2);
                  }}
                  style={{
                    background: selectedPlatform === 'windows' 
                      ? "linear-gradient(135deg, #4CAF50, #45a049)"
                      : "linear-gradient(135deg, #f8f9fa, #e9ecef)",
                    color: selectedPlatform === 'windows' ? "white" : "#333",
                    border: selectedPlatform === 'windows' ? "3px solid #4CAF50" : "2px solid #dee2e6",
                    borderRadius: "16px",
                    padding: "25px 30px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "15px",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Monitor size={32} />
                  <span>Windows Computer</span>
                  {selectedPlatform === 'windows' && <CheckCircle size={24} />}
                </button>

                <button
                  onClick={() => {
                    setSelectedPlatform("linux");
                    setCurrentStep(2);
                  }}
                  style={{
                    background: selectedPlatform === 'linux' 
                      ? "linear-gradient(135deg, #FF6B35, #F7931E)"
                      : "linear-gradient(135deg, #f8f9fa, #e9ecef)",
                    color: selectedPlatform === 'linux' ? "white" : "#333",
                    border: selectedPlatform === 'linux' ? "3px solid #FF6B35" : "2px solid #dee2e6",
                    borderRadius: "16px",
                    padding: "25px 30px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "15px",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Terminal size={32} />
                  <span>Linux Computer</span>
                  {selectedPlatform === 'linux' && <CheckCircle size={24} />}
                </button>
              </div>

              <div style={{ marginTop: "40px" }}>
                <button
                  onClick={() => setCurrentStep(0)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    fontSize: "16px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  ← Back to Claude Desktop
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Download Setup Script */}
          {currentStep === 2 && selectedPlatform && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                  color: "#333",
                }}
              >
                Download Setup Script
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "#666",
                  marginBottom: "30px",
                  lineHeight: "1.5",
                }}
              >
                We'll create an automatic setup script for your {selectedPlatform === 'mac' ? 'Mac' : selectedPlatform === 'windows' ? 'Windows' : 'Linux'} computer
              </p>

              <div
                style={{
                  background: "linear-gradient(135deg, #e3f2fd, #bbdefb)",
                  borderRadius: "16px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "2px solid #2196F3",
                }}
              >
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#1976D2",
                  }}
                >
                  Step 1: Download
                </h3>
                
                <button
                  onClick={downloadSetupScript}
                  disabled={scriptDownloaded}
                  style={{
                    background: scriptDownloaded
                      ? "linear-gradient(135deg, #4CAF50, #45a049)"
                      : "linear-gradient(135deg, #2196F3, #1976D2)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    padding: "20px 40px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    cursor: scriptDownloaded ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    margin: "0 auto",
                    transition: "all 0.3s ease",
                    opacity: scriptDownloaded ? 0.8 : 1,
                  }}
                >
                  {scriptDownloaded ? (
                    <>
                      <CheckCircle size={24} />
                      <span>Downloaded!</span>
                    </>
                  ) : (
                    <>
                      <Download size={24} />
                      <span>Download Setup Script</span>
                    </>
                  )}
                </button>
              </div>

              {scriptDownloaded && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #fff3cd, #ffeaa7)",
                    borderRadius: "16px",
                    padding: "30px",
                    marginBottom: "30px",
                    border: "2px solid #ffc107",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      marginBottom: "20px",
                      color: "#856404",
                    }}
                  >
                    Step 2: Run the Script
                  </h3>

                  {selectedPlatform === 'windows' ? (
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: "16px", marginBottom: "15px", color: "#333" }}>
                        <strong>Windows Instructions:</strong>
                      </p>
                      <ol style={{ paddingLeft: "20px", fontSize: "16px", lineHeight: "1.6" }}>
                        <li style={{ marginBottom: "10px" }}>
                          Press <kbd style={{ background: "#f0f0f0", padding: "4px 8px", borderRadius: "4px" }}>Windows Key + R</kbd>
                        </li>
                        <li style={{ marginBottom: "10px" }}>
                          Type <code style={{ background: "#f0f0f0", padding: "4px 8px", borderRadius: "4px" }}>cmd</code> and press Enter
                        </li>
                        <li style={{ marginBottom: "15px" }}>Copy and paste this command:</li>
                      </ol>
                      
                      <div
                        style={{
                          background: "#2d3748",
                          color: "#e2e8f0",
                          padding: "15px",
                          borderRadius: "8px",
                          fontFamily: "monospace",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "15px",
                        }}
                      >
                        <code>{getRunCommand()}</code>
                        <button
                          onClick={() => copyToClipboard(getRunCommand())}
                          style={{
                            background: copiedCommand ? "#4CAF50" : "#0078d4",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {copiedCommand ? <CheckCheck size={16} /> : <Copy size={16} />}
                          {copiedCommand ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p style={{ fontSize: "14px", color: "#666" }}>
                        <strong>4.</strong> Press Enter and wait for "✅ Setup complete!"
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: "16px", marginBottom: "15px", color: "#333" }}>
                        <strong>{selectedPlatform === 'mac' ? 'Mac' : 'Linux'} Instructions:</strong>
                      </p>
                      <ol style={{ paddingLeft: "20px", fontSize: "16px", lineHeight: "1.6" }}>
                        <li style={{ marginBottom: "10px" }}>
                          Open Terminal {selectedPlatform === 'mac' 
                            ? "(Cmd + Space, type 'Terminal')" 
                            : "(Ctrl + Alt + T)"}
                        </li>
                        <li style={{ marginBottom: "15px" }}>Copy and paste this command:</li>
                      </ol>
                      
                      <div
                        style={{
                          background: "#2d3748",
                          color: "#e2e8f0",
                          padding: "15px",
                          borderRadius: "8px",
                          fontFamily: "monospace",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "15px",
                        }}
                      >
                        <code>{getRunCommand()}</code>
                        <button
                          onClick={() => copyToClipboard(getRunCommand())}
                          style={{
                            background: copiedCommand ? "#4CAF50" : "#0078d4",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {copiedCommand ? <CheckCheck size={16} /> : <Copy size={16} />}
                          {copiedCommand ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p style={{ fontSize: "14px", color: "#666" }}>
                        <strong>3.</strong> Press Enter and wait for "✅ Setup complete!"
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setCurrentStep(1)}
                  style={{
                    background: "linear-gradient(135deg, #6c757d, #495057)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    padding: "15px 25px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <ArrowLeft size={20} />
                  <span>Back</span>
                </button>

                {scriptDownloaded && (
                  <button
                    onClick={() => setCurrentStep(3)}
                    style={{
                      background: "linear-gradient(135deg, #28a745, #20c997)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      padding: "15px 25px",
                      fontSize: "16px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span>Next</span>
                    <ArrowRight size={20} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Success and Test */}
          {currentStep === 3 && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                  color: "#333",
                }}
              >
                🎉 Setup Complete!
              </h2>
              <p
                style={{
                  fontSize: "20px",
                  color: "#666",
                  marginBottom: "40px",
                  lineHeight: "1.5",
                }}
              >
                Claude Desktop now has powerful Dropbox and Zenoti tools
              </p>

              <div
                style={{
                  background: "linear-gradient(135deg, #d4edda, #c3e6cb)",
                  borderRadius: "16px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "2px solid #28a745",
                }}
              >
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#155724",
                  }}
                >
                  🚀 Your New Superpowers
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "20px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#2196F3",
                        fontSize: "18px",
                        marginBottom: "8px",
                      }}
                    >
                      🔍 Universal Dropbox Search
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      Find ANY content - flames, flowers, animals, documents
                    </div>
                  </div>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "20px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#4CAF50",
                        fontSize: "18px",
                        marginBottom: "8px",
                      }}
                    >
                      🏥 Enhanced Zenoti
                    </div>
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      Natural language reports & smart client search
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #e3f2fd, #bbdefb)",
                  borderRadius: "16px",
                  padding: "30px",
                  marginBottom: "30px",
                  border: "2px solid #2196F3",
                }}
              >
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#1976D2",
                  }}
                >
                  🧪 Test Your Setup
                </h3>
                <p style={{ fontSize: "16px", color: "#333", marginBottom: "15px" }}>
                  Open Claude Desktop and try these commands:
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "10px",
                    textAlign: "left",
                    fontSize: "14px",
                  }}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "12px",
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <strong>"What MCP tools do you have?"</strong> - Check connection
                  </div>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "12px",
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <strong>"Search my Dropbox for images of flames"</strong> - Test search
                  </div>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "8px",
                      padding: "12px",
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <strong>"Test my Zenoti connection"</strong> - Verify business tools
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#fff3cd",
                  borderRadius: "16px",
                  padding: "20px",
                  marginBottom: "30px",
                  border: "2px solid #ffc107",
                }}
              >
                <h4
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                    color: "#856404",
                  }}
                >
                  💡 Troubleshooting
                </h4>
                <div style={{ fontSize: "14px", color: "#333", textAlign: "left" }}>
                  <p style={{ marginBottom: "8px" }}>
                    <strong>If you see errors:</strong> Restart Claude Desktop completely
                  </p>
                  <p style={{ marginBottom: "8px" }}>
                    <strong>If tools don't appear:</strong> Check the setup script ran successfully
                  </p>
                  <p>
                    <strong>Still having issues?</strong> Run the setup script again
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
                <button
                  onClick={resetSetup}
                  style={{
                    background: "none",
                    border: "2px solid #6c757d",
                    color: "#6c757d",
                    borderRadius: "12px",
                    padding: "15px 25px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Start Over
                </button>
                
                <button
                  onClick={onClose}
                  style={{
                    background: "linear-gradient(135deg, #667eea, #764ba2)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    padding: "15px 25px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  I'm Done!
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ClaudeMCPModal;