#!/bin/bash

echo "Analyzing codebase for potentially unused files..."
echo "=============================================="

# Function to check if a file is imported or required anywhere
check_file_usage() {
    local file="$1"
    local filename=$(basename "$file" | sed 's/\.[^.]*$//')
    local search_patterns=()
    
    # Add various import patterns to search for
    search_patterns+=("import.*from.*['\"].*$filename.*['\"]")
    search_patterns+=("import.*['\"].*$filename.*['\"]")
    search_patterns+=("require.*['\"].*$filename.*['\"]")
    search_patterns+=("$filename")
    
    local found=false
    for pattern in "${search_patterns[@]}"; do
        if grep -r -q "$pattern" --exclude-dir=node_modules --exclude="$file" .; then
            found=true
            echo "✓ $file is used in:"
            grep -r -l "$pattern" --exclude-dir=node_modules --exclude="$file" . | head -3
            break
        fi
    done
    
    if [ "$found" = false ]; then
        echo "⚠ $file - No usage found"
    fi
    echo "----------------------------------------"
}

echo "Checking debug components..."
check_file_usage "src/components/AuthTest.jsx"
check_file_usage "src/components/AuthDebug.jsx"
check_file_usage "src/components/AuthDebugger.jsx"
check_file_usage "src/components/ZenotiDebug.jsx"
check_file_usage "src/components/ChatImageSearchIntegration.jsx"
check_file_usage "src/utils/DebugCentersInfo.jsx"
check_file_usage "src/components/auth/AuthDiagnostic.jsx"
check_file_usage "src/components/auth/BypassAdminPanel.jsx"
check_file_usage "src/components/admin/StorageTestComponent.jsx"

echo "\nChecking test files..."
check_file_usage "src/App.test.js"
check_file_usage "src/setupTests.js"

echo "\nChecking utility files..."
check_file_usage "src/utils/authDiagnostics.js"

echo "\nChecking for duplicate files..."
check_file_usage "src/supabaseClient.js"
check_file_usage "src/hooks/useSupabase.js"
check_file_usage "src/components/ThemeProvider.jsx"

echo "\n\nSUMMARY:"
echo "========"
echo "Files marked with ⚠ are potentially unused."
echo "Files marked with ✓ are actively used in the codebase."
echo ""
echo "Before deleting any file:"
echo "1. Double-check the usage analysis"
echo "2. Search for the filename in your IDE"
echo "3. Create a backup of the file"
echo "4. Test thoroughly after removal"
echo ""
echo "Note: This script may not catch all usage patterns."
echo "Always verify before deleting any file!"