#!/bin/bash
# check-critical-files.sh
# Script to verify usage of ThemeProvider and ChatImageSearchIntegration

echo "Checking ThemeProvider.jsx usage..."
echo "=================================="
grep -r "ThemeProvider" --exclude-dir=node_modules --exclude="src/components/ThemeProvider.jsx" . | grep -v "ThemeContext.jsx"

echo -e "\n\nChecking ChatImageSearchIntegration.jsx usage..."
echo "=============================================="
grep -r "ChatImageSearchIntegration" --exclude-dir=node_modules --exclude="src/components/ChatImageSearchIntegration.jsx" .

echo -e "\n\nChecking if ThemeContext is used instead of ThemeProvider..."
echo "========================================================"
grep -r "ThemeContext" --exclude-dir=node_modules . | head -10

# Check React component imports specifically
echo -e "\n\nChecking React imports..."
echo "========================"
grep -r "import.*ThemeProvider.*from" --exclude-dir=node_modules .
grep -r "import.*ChatImageSearchIntegration.*from" --exclude-dir=node_modules .