# Update To Make

## Unused Files Safe to Delete

### JSX Files
1. `/Users/parkercase/chat-interface/src/components/AuthTest.jsx`
2. `/Users/parkercase/chat-interface/src/components/AuthDebug.jsx`
3. `/Users/parkercase/chat-interface/src/components/AuthDebugger.jsx`
4. `/Users/parkercase/chat-interface/src/components/ZenotiDebug.jsx`
5. `/Users/parkercase/chat-interface/src/components/ChatImageSearchIntegration.jsx`
6. `/Users/parkercase/chat-interface/src/utils/DebugCentersInfo.jsx`
7. `/Users/parkercase/chat-interface/src/components/auth/AuthDiagnostic.jsx`
8. `/Users/parkercase/chat-interface/src/components/auth/BypassAdminPanel.jsx`
9. `/Users/parkercase/chat-interface/src/components/admin/StorageTestComponent.jsx`

### JS Files
1. `/Users/parkercase/chat-interface/src/App.test.js`
2. `/Users/parkercase/chat-interface/src/setupTests.js`
3. `/Users/parkercase/chat-interface/src/utils/authDiagnostics.js`

### CSS Files (associated with unused components)
1. `/Users/parkercase/chat-interface/src/components/AuthDebug.css` (if exists)
2. `/Users/parkercase/chat-interface/src/components/ChatImageSearchIntegration.css` (if exists)
3. `/Users/parkercase/chat-interface/src/components/ZenotiDebug.css` (if exists)
4. `/Users/parkercase/chat-interface/src/components/auth/AuthDiagnostic.css` (if exists)

## Backend Configuration Issues

### Supabase Integration

1. **Duplicate Client Creation**
   - File: `/Users/parkercase/chat-interface/src/supabaseClient.js` and `/Users/parkercase/chat-interface/src/lib/supabase.js` 
   - Issue: Two separate Supabase client instances created, possible conflicts
   - Recommendation: Consolidate into a single client instance

2. **Hardcoded API Key**
   - File: `/Users/parkercase/chat-interface/src/lib/supabase.js`
   - Issue: Supabase API key hardcoded as a fallback
   - Recommendation: Remove hardcoded key, rely only on environment variables

3. **Missing Error Handling**
   - Several service files catch errors but don't consistently handle them
   - Some throw errors, others return formatted error responses

### Zenoti Integration

1. **Hardcoded Center Data**
   - File: `/Users/parkercase/chat-interface/src/services/zenotiService.js`
   - Issue: Hardcoded mapping of center codes to center IDs
   - Recommendation: Move to database configuration

## Theme System Issues

### Colors Not Properly Swapped in Dark Mode

1. **Inconsistent CSS Variable Usage**
   - The project uses multiple CSS variable systems: `--color-*` and standard variables like `--primary`
   - Two separate theme contexts competing: `/src/context/ThemeContext.jsx` and `/src/components/ThemeProvider.jsx`
   - Recommendation: Standardize on a single theme context and variable naming convention

2. **Missing Dark Mode Variables**
   - In `/src/base.css`, dark mode variables defined are incomplete compared to the light theme
   - Missing dark mode variants for: `--secondary`, `--success`, `--danger`, `--warning`, `--info`

3. **Inline Colors Without Variables**
   - Files using hardcoded colors without CSS variables:
     - `/src/components/Message.css`: Uses hardcoded colors like `#eef2ff`, `#4338ca`, `#059669`
     - `/src/components/ChatContainer.css`: Background uses `#f9fafb` instead of a variable
     - `/src/components/MainApp.css`: Multiple hardcoded colors including `#f9fafb`, `#1f2937`, `#e5e7eb`

4. **Component-Specific Colors Not Theme-Aware**
   - Message components use role-specific colors (user, assistant, system) not connected to the theme system
   - Alert components use fixed error/warning colors not connected to theme variables
   - Chat interface background gradients use fixed colors

5. **Missing Theme Variable Fallbacks**
   - Many components use variable fallbacks (e.g., `var(--color-primary, #4f46e5)`) but not consistently
   - Complete list of variables needing proper dark mode equivalents:
     - `--color-text-primary`: Used in headers and main text
     - `--color-text-secondary`: Used in supplementary text
     - `--color-background`: Page background
     - `--color-surface`: Component backgrounds
     - `--color-border`: Element borders
     - `--color-text-inverse`: Text on colored backgrounds
     - `--theme-color`: Used in theme selector

6. **Dark Mode Class Implementation Issues**
   - Dark mode toggle in `ThemeProvider.jsx` only adds/removes a class rather than updating CSS variables
   - Dark mode detection with `prefers-color-scheme` doesn't update all necessary variables

7. **Scrollbar Colors Not Themed**
   - Custom scrollbar styles use hardcoded `rgba` values instead of theme variables

### Recommendations

1. Standardize theme implementation using CSS variables
2. Complete the dark mode variable set in `base.css`
3. Replace all hardcoded colors with theme variables
4. Implement consistent dark mode detection and application
5. Create a comprehensive theme system documentation

## System Settings Analysis

The System Settings component (`EnhancedSystemSettings.jsx`) has been analyzed for functionality integrity. Key findings:

1. **Theme Integration Issues**
   - System Settings uses many hardcoded colors in its CSS (`EnhancedSystemSettings.css`)
   - Background colors, button colors, and text colors aren't using theme variables
   - Form elements don't properly match the theme system
   - No proper dark mode support for this critical admin interface

2. **Functionality Overview**
   - Component is structured with these key sections:
     - General Settings (site name, org name, timezone, etc.)
     - Storage Settings (paths, quotas, file types)
     - Security Settings (session timeouts, password policies, MFA)
     - Notification Settings (email/Slack notifications, alerts)
     - API Settings (rate limits, CORS domains, API key management)
     - Backup Settings (backup frequency, storage location, retention)
   - All settings are stored in Supabase tables and fetched on component mount

3. **Integration Points**
   - Uses Supabase for settings storage and API key management
   - Integrates with `apiService` for backup functionality
   - Leverages a mix of local state and database persistence
   - Uses feature flags to conditionally render certain options

4. **UX Considerations**
   - Mobile responsiveness is implemented but could be improved
   - Error handling and success messaging is properly implemented
   - Loading states are appropriately shown during async operations

5. **Potential Improvements**
   - Add comprehensive dark mode support
   - Replace hardcoded colors with theme variables
   - Add form validation for inputs (currently minimal validation)
   - Add confirmation dialogs for critical operations
   - Implement settings search functionality for larger installations

## Supabase Integration Health Check

A comprehensive analysis of the Supabase integration reveals several critical issues that need to be addressed:

1. **Multiple Supabase Client Instances**
   - Three separate instances created in:
     - `/src/supabaseClient.js` - Simple import with environment variables
     - `/src/lib/supabase.js` - Full configuration with auth options and OAuth settings
     - `/src/hooks/useSupabase.js` - Another instance with basic auth configuration
   - Risk: Potential race conditions, session conflicts, and token refresh issues
   - Recommendation: Consolidate into a single client instance, ideally in `/src/lib/supabase.js`

2. **Hardcoded Supabase Credentials**
   - Both `/src/lib/supabase.js` and `/src/hooks/useSupabase.js` contain hardcoded API keys
   - URLs and anon keys are directly in the source as fallbacks when env vars aren't available
   - Critical security risk: Credentials should never be in source code
   - Recommendation: Remove all hardcoded credentials and require proper environment variables

3. **Inconsistent Authentication Flow**
   - The auth system implements MFA but with multiple special cases and bypasses
   - Admin test accounts have hardcoded authentication logic throughout the codebase
   - Recommendation: Standardize auth flow and move test account handling to development environment only

4. **Problematic Admin Auth Bypass**
   - Direct auth bypasses for test accounts ("itsus@tatt2away.com" and "parker@tatt2away.com")
   - Password "password" is hardcoded for admin test accounts
   - Recommendation: Move this logic to a dedicated development environment and guard with env variables

5. **Overly Complex Session Management**
   - Local storage and session storage used inconsistently alongside Supabase auth
   - Multiple redundant checks and fallbacks create complex flow that's hard to maintain
   - Recommendation: Simplify to rely primarily on Supabase auth with minimal custom state

6. **Security Risks in Admin Access Control**
   - Admin role checks have multiple bypasses that could lead to privilege escalation
   - Role-based access control (RBAC) implementation fragmented across components
   - Recommendation: Implement a more robust RBAC system with server-side enforcement

7. **RLS Policy Issues**
   - Code contains workarounds for RLS (Row Level Security) failures
   - Multiple fallback approaches when permission errors occur
   - Indicates underlying RLS policy configuration issues in Supabase
   - Recommendation: Audit and fix RLS policies to eliminate need for client-side workarounds

## Summary and Priority Recommendations

After completing a comprehensive audit of the codebase, here are the highest priority issues that should be addressed:

### Critical Security Issues
1. **Remove hardcoded Supabase credentials** from `/src/lib/supabase.js` and `/src/hooks/useSupabase.js`
2. **Fix authentication bypasses** for admin accounts and implement proper environment-based testing
3. **Consolidate Supabase client instances** to prevent race conditions and authentication conflicts

### High Priority Improvements
1. **Theme system standardization**:
   - Adopt a single theme context provider (remove one of the duplicate implementations)
   - Complete dark mode variable definitions in `base.css`
   - Replace all hardcoded colors with theme variables

2. **Backend configuration cleanup**:
   - Replace hardcoded Zenoti center IDs with database configuration
   - Implement consistent error handling across all service files
   - Fix RLS policies in Supabase to eliminate client-side workarounds

3. **Codebase optimization**:
   - Remove unused files identified in this audit
   - Simplify authentication flow and session management
   - Standardize component patterns across the application

### Medium Priority Enhancements
1. **Improve theme customization**:
   - Add proper dark mode support to all components
   - Create comprehensive theme documentation
   - Fix the scrollbar styling to use theme variables

2. **Component improvements**:
   - Enhance form validation in System Settings
   - Add confirmation dialogs for critical operations
   - Improve mobile responsiveness in all components

This audit has identified numerous issues that affect security, maintainability, and user experience. Addressing these recommendations will significantly improve the overall quality and security of the application.

## Implementation Plan and Code Fixes

### 1. Supabase Client Consolidation

Create a single source of truth for the Supabase client:

```javascript
// src/lib/supabase.js - UPDATED VERSION
import { createClient } from "@supabase/supabase-js";

// Get environment variables with strict requirement
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Ensure environment variables are defined
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Error: Supabase URL and Anon Key are required. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment."
  );
  // Throw error in production, warn in development
  if (process.env.NODE_ENV === "production") {
    throw new Error("Supabase configuration missing");
  }
}

// Create supabase client with enhanced options
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: "pkce",
    // Debug in development only
    debug: process.env.NODE_ENV === "development",
    // Enhanced options for better reliability
    storageKey: "tatt2away_supabase_auth",
    cookieOptions: {
      name: "tatt2away_supabase_auth",
      lifetime: 60 * 60 * 24 * 7, // 7 days
      domain: window.location.hostname,
      path: "/",
      sameSite: "Lax",
    },
    // Configure OAuth providers
    oauth: {
      redirectTo: `${window.location.origin}/auth/callback`,
      provider_redirect_url: `${window.location.origin}/auth/callback`,
      // Handle provider errors
      providerRedirectErrorParams: {
        error: "error",
        error_description: "error_description",
      },
    },
  },
  global: {
    headers: {
      "X-Client-Info": "Tatt2Away Admin Panel",
    },
  },
  // Enable realtime subscriptions for session monitoring
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Make supabase available in window for debug purposes in dev mode only
if (process.env.NODE_ENV === "development") {
  window.supabase = supabase;
  
  // Set up auth state change listener for debugging
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      `[Supabase Debug] Auth state changed: ${event}`,
      session ? `User: ${session.user.email}` : "No session"
    );
  });
  
  // Test connection on startup (dev only)
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.warn("Supabase connection test failed:", error);
    } else {
      console.log("Supabase connection test successful");
      console.log("Session exists:", !!data.session);
    }
  });
}

export { supabase };
```

Then, in all other files, replace imports to use this central client:

```javascript
// In any file that currently imports from supabaseClient.js or hooks/useSupabase.js
import { supabase } from "../lib/supabase";
```

### 2. Fix Authentication Bypasses

Update the authentication bypass to use environment variables:

```javascript
// src/context/AuthContext.jsx - Replace the bypassAuthForAdmins function
const bypassAuthForAdmins = (email, password = "password") => {
  // Only allow admin bypass in development or with specific environment variable
  const allowBypass = 
    process.env.NODE_ENV === "development" || 
    process.env.REACT_APP_ALLOW_ADMIN_BYPASS === "true";
    
  // Restrict admin accounts to those defined in environment
  const adminEmails = (process.env.REACT_APP_ADMIN_EMAILS || "").split(",");
  
  if (
    allowBypass && 
    adminEmails.includes(email) &&
    (password === process.env.REACT_APP_ADMIN_PASSWORD || password === "password")
  ) {
    logAuth("Bypassing auth for admin account:", email);

    const adminName = email.split("@")[0] || "Admin";
    const adminUser = {
      id: `admin-${Date.now()}`,
      email,
      name: adminName,
      roles: ["super_admin", "admin", "user"],
      tier: "enterprise",
    };

    // Set in localStorage
    localStorage.setItem("currentUser", JSON.stringify(adminUser));
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("mfa_verified", "true");
    sessionStorage.setItem("mfa_verified", "true");
    localStorage.setItem("authStage", "post-mfa");

    // Update state
    setCurrentUser(adminUser);
    setMfaState({ required: false, verified: true });
    setIsInitialized(true);
    setLoading(false);

    // Set admin refs
    isAdminRef.current = true;
    isSuperAdminRef.current = true;

    return true;
  }
  return false;
};
```

### 3. Theme System Standardization

#### 3.1 Consolidate Theme Contexts

Remove the duplicate `src/components/ThemeProvider.jsx` and use only the `src/context/ThemeContext.jsx` with these enhancements:

```javascript
// src/context/ThemeContext.jsx - Update the applyTheme function
const applyTheme = (theme) => {
  console.log("=== APPLYING THEME ===");
  console.log("Theme to apply:", theme);

  if (!theme?.content) {
    console.error("No theme content to apply");
    return;
  }

  const root = document.documentElement;
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // Apply the base mode class
  if (isDarkMode && theme.supportsDarkMode) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
  
  // Apply all theme color variables
  Object.entries(theme.content).forEach(([key, value]) => {
    // Apply the right value based on mode
    let colorValue = value;
    if (isDarkMode && theme.supportsDarkMode && theme.darkContent && theme.darkContent[key]) {
      colorValue = theme.darkContent[key];
    }
    
    console.log(`Setting --color-${key}: ${colorValue}`);
    root.style.setProperty(`--color-${key}`, colorValue);
  });

  localStorage.setItem("currentTheme", JSON.stringify(theme));
  console.log("=== THEME APPLIED ===");
};
```

#### 3.2 Complete Dark Mode Variables in base.css

```css
/* src/base.css - Update dark mode variables */
.dark-mode {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --secondary: #4b5563;       /* Added */
  --success: #059669;         /* Added */
  --danger: #dc2626;          /* Added */
  --warning: #d97706;         /* Added */
  --info: #2563eb;            /* Added */
  --background: #1f2937;
  --foreground: #f9fafb;
  --muted: #4b5563;
  --muted-foreground: #9ca3af;
  --border: #374151;
}
```

#### 3.3 Update ComponentCSS Files

For example, update Message.css:

```css
/* src/components/Message.css - Update with theme variables */
.message-content a {
  color: var(--primary, #4f46e5);
  text-decoration: underline;
  word-break: break-all;
}

.message.user {
  align-self: flex-end;
  background-color: var(--color-surface-light, #eef2ff);
  border-bottom-right-radius: 2px;
  margin-left: auto;
}

.message.user .message-sender {
  color: var(--primary-hover, #4338ca);
}

.message.assistant {
  align-self: flex-start;
  background-color: var(--color-background, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-bottom-left-radius: 2px;
  margin-right: auto;
}

.message.assistant .message-sender {
  color: var(--success, #059669);
}

.message.system {
  align-self: center;
  background-color: var(--color-surface, #f8fafc);
  border: 1px dashed var(--color-border, #cbd5e1);
  font-size: 0.9rem;
  max-width: 80%;
  text-align: center;
}

.message.system .message-sender {
  color: var(--color-text-secondary, #64748b);
}

/* Error state */
.message-content.error {
  color: var(--color-error, #b91c1c);
  background-color: var(--color-error-background, #fee2e2);
  padding: 0.5rem;
  border-radius: 4px;
}
```

### 4. Replace Hardcoded Zenoti Center IDs

```javascript
// src/services/zenotiService.js - Replace hardcoded center mapping
// FROM:
const centerMap = {
  DEMO: "123456",
  NYC: "789012",
  LA: "345678",
  // other hardcoded centers...
};

// TO:
const getCenterMap = async () => {
  try {
    const { data, error } = await supabase
      .from('zenoti_centers')
      .select('*');
      
    if (error) throw error;
    
    // Convert data to map format
    const centerMap = {};
    data.forEach(center => {
      centerMap[center.code] = center.zenoti_id;
    });
    
    return centerMap;
  } catch (err) {
    console.error("Error fetching center mapping:", err);
    // Return empty map as fallback
    return {};
  }
}

// Then use async/await or Promise when calling functions that need the center map
const getCenterData = async (centerCode) => {
  const centerMap = await getCenterMap();
  const centerId = centerMap[centerCode];
  
  if (!centerId) {
    throw new Error(`Center code ${centerCode} not found in database`);
  }
  
  // Rest of the function using centerId
}
```

### 5. Standardize Error Handling

Create a consistent error handling utility:

```javascript
// src/utils/errorHandler.js
/**
 * Standardized error handling for API services
 * @param {Error} error - The error object
 * @param {string} context - The context where the error occurred
 * @param {boolean} shouldThrow - Whether to throw the error or return an error object
 * @returns {object} Formatted error response
 */
export const handleServiceError = (error, context = 'API', shouldThrow = false) => {
  // Log the error for debugging
  console.error(`${context} Error:`, error);
  
  // Create a standardized error response
  const errorResponse = {
    success: false,
    error: {
      message: error.message || 'An unknown error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      context,
      timestamp: new Date().toISOString(),
    }
  };
  
  // Add status if it exists
  if (error.status) {
    errorResponse.error.status = error.status;
  }
  
  // Add details if they exist
  if (error.details) {
    errorResponse.error.details = error.details;
  }
  
  // Either throw or return based on preference
  if (shouldThrow) {
    throw errorResponse;
  }
  
  return errorResponse;
};

/**
 * Create a success response
 * @param {any} data - The data to return
 * @param {string} message - Optional success message
 * @returns {object} Formatted success response
 */
export const createSuccessResponse = (data, message = null) => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
};
```

Then use it in all service files:

```javascript
// In any service file
import { handleServiceError, createSuccessResponse } from '../utils/errorHandler';

// Example usage
const fetchData = async (params) => {
  try {
    const response = await api.get('/endpoint', params);
    return createSuccessResponse(response.data);
  } catch (error) {
    return handleServiceError(error, 'fetchData', false);
  }
};
```

### 6. Fix RLS Policies

Example Supabase RLS policy update:

```sql
-- Example RLS policy for the profiles table to fix permission issues

-- First, drop any existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create proper policies with clearer names and logic
-- Allow users to read their own profile
CREATE POLICY "users_can_read_own_profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile (excluding role changes)
CREATE POLICY "users_can_update_own_profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- Prevent users from escalating their own permissions
  (roles IS NULL OR roles = old.roles)
);

-- Allow admins to read any profile
CREATE POLICY "admins_can_read_all_profiles" 
ON profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (roles::text[]?| ARRAY['admin', 'super_admin'])
  )
);

-- Allow admins to update any profile except super_admin role changes
CREATE POLICY "admins_can_update_profiles" 
ON profiles FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (roles::text[]?| ARRAY['admin', 'super_admin'])
  )
)
WITH CHECK (
  -- Regular admins can't modify super_admin roles
  (NOT (roles::text[]?| ARRAY['super_admin'])) OR
  -- Unless they are already super_admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND roles::text[]?| ARRAY['super_admin']
  )
);

-- Create an RPC function to safely get profile data
CREATE OR REPLACE FUNCTION public.get_profile(user_id uuid)
RETURNS SETOF profiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM profiles WHERE id = user_id;
$$;
```

### 7. Complete Cleanup Tasks

Add a script to automate removal of unused files:

```bash
#!/bin/bash
# cleanup-script.sh
# Script to remove identified unused files

# Unused JSX files
rm -f \
  ./src/components/AuthTest.jsx \
  ./src/components/AuthDebug.jsx \
  ./src/components/AuthDebugger.jsx \
  ./src/components/ZenotiDebug.jsx \
  ./src/components/ChatImageSearchIntegration.jsx \
  ./src/utils/DebugCentersInfo.jsx \
  ./src/components/auth/AuthDiagnostic.jsx \
  ./src/components/auth/BypassAdminPanel.jsx \
  ./src/components/admin/StorageTestComponent.jsx

# Unused JS files
rm -f \
  ./src/App.test.js \
  ./src/setupTests.js \
  ./src/utils/authDiagnostics.js

# Verify removals
echo "Files removed. Verifying..."
for file in \
  ./src/components/AuthTest.jsx \
  ./src/components/AuthDebug.jsx \
  ./src/App.test.js; do
  if [ -f "$file" ]; then
    echo "Warning: $file still exists!"
  else 
    echo "$file successfully removed."
  fi
done

echo "Clean up complete!"
```

### 8. Environment Variables Template

Create a `.env.example` file:

```
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Authentication Configuration
REACT_APP_ALLOW_ADMIN_BYPASS=false
REACT_APP_ADMIN_EMAILS=admin@tatt2away.com,another@tatt2away.com
REACT_APP_ADMIN_PASSWORD=your-secure-password

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_CRM=true
REACT_APP_ENABLE_CHAT=true

# API Configuration
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_ZENOTI_API_URL=https://api.zenoti.com/v1
```

### 9. Documentation on Theme System

Create a `THEMING.md` file:

```markdown
# Theming System Documentation

## Overview

The application uses a CSS variable-based theming system that supports both light and dark modes. Themes are stored in the Supabase database and can be customized by administrators.

## Theme Structure

Each theme consists of:

- **id**: Unique identifier
- **name**: Display name
- **content**: Object containing color variables for light mode
- **darkContent**: Object containing color variables for dark mode
- **supportsDarkMode**: Boolean indicating if dark mode is supported

## CSS Variables

The following CSS variables are used throughout the application:

### Base Variables (defined in base.css)
- `--primary`: Primary brand color
- `--primary-hover`: Hover state for primary color
- `--secondary`: Secondary UI color
- `--success`: Success indicators
- `--danger`: Error and destructive actions
- `--warning`: Warning indicators
- `--info`: Informational elements
- `--background`: Page background
- `--foreground`: Text color on background
- `--muted`: Muted UI elements
- `--muted-foreground`: Text on muted elements
- `--border`: Border color

### Theme Variables (defined in theme.css)
- `--color-primary`: Primary accent color
- `--color-secondary`: Secondary accent color
- `--color-background`: Main background color
- `--color-surface`: Card/component background
- `--color-text`: Main text color
- `--color-text-secondary`: Secondary text color
- `--color-border`: Border color
- `--color-success`: Success indicators
- `--color-warning`: Warning indicators
- `--color-error`: Error indicators
- `--color-accent`: Special accent color

## Adding Dark Mode Support

To add dark mode support to a component:

1. Use theme variables instead of hardcoded colors
2. Test the component with the dark mode class applied to the body
3. If specific dark mode overrides are needed:

```css
/* Standard styling using variables */
.my-component {
  background-color: var(--color-surface);
  color: var(--color-text);
}

/* Specific dark mode overrides if needed */
.dark-mode .my-component {
  /* Any specific dark mode styles that variables don't handle */
}
```

## Creating a New Theme

Themes can be created through the admin interface or directly in the database. A theme must include values for all the CSS variables listed above.
```