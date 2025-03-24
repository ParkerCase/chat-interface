// src/lib/sso.js
import { supabase } from "./supabase";

/**
 * Handles SSO authentication with various providers
 * Supports Google, Microsoft, and custom SAML/OIDC providers
 */

// Available providers
export const ssoProviders = {
  google: {
    id: "google",
    name: "Google",
    type: "oauth",
    icon: "google",
    enabled: true,
  },
  microsoft: {
    id: "azure",
    name: "Microsoft",
    type: "oauth",
    icon: "microsoft",
    enabled: true,
  },
  custom: {
    id: "custom_saml",
    name: "Company SSO",
    type: "saml",
    icon: "building",
    enabled: true,
  },
};

/**
 * Sign in with SSO provider
 * @param {string} provider - The provider ID (google, microsoft, etc.)
 * @param {object} options - Additional options
 */
export const signInWithSSO = async (provider, options = {}) => {
  try {
    // Default redirect URL
    const redirectTo =
      options.redirectTo || `${window.location.origin}/auth/callback`;

    let response;

    switch (provider) {
      case "google":
        response = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            scopes: "email profile",
          },
        });
        break;

      case "azure":
        response = await supabase.auth.signInWithOAuth({
          provider: "azure",
          options: {
            redirectTo,
            scopes: "email profile",
          },
        });
        break;

      case "custom_saml":
        response = await supabase.auth.signInWithSSO({
          domain: options.domain || "your-organization-domain",
          options: {
            redirectTo,
          },
        });
        break;

      default:
        throw new Error(`Unsupported SSO provider: ${provider}`);
    }

    if (response.error) {
      throw response.error;
    }

    return response.data;
  } catch (error) {
    console.error("SSO sign in error:", error);
    throw error;
  }
};

/**
 * Get available SSO providers for an organization
 * @param {string} orgId - The organization ID
 */
export const getAvailableProviders = async (orgId) => {
  try {
    // In a real implementation, you would fetch this from your backend
    // For now, we'll just return the static list filtered by enabled
    return Object.values(ssoProviders).filter((p) => p.enabled);
  } catch (error) {
    console.error("Error fetching SSO providers:", error);
    return [];
  }
};

/**
 * Handle SSO callback after successful authentication
 */
export const handleSSOCallback = async () => {
  try {
    // Get the session from the URL
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    // Check if we have a session
    if (data && data.session) {
      // Extract return URL from query params
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get("returnUrl") || "/";

      // Redirect to the return URL
      window.location.href = returnUrl;
      return true;
    }

    return false;
  } catch (error) {
    console.error("SSO callback error:", error);
    return false;
  }
};

/**
 * Link a user's account to an SSO provider
 * @param {string} provider - The provider ID
 */
export const linkAccount = async (provider) => {
  try {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error("Account linking error:", error);
    throw error;
  }
};

/**
 * Unlink a user's account from an SSO provider
 * @param {string} provider - The provider ID
 */
export const unlinkAccount = async (provider) => {
  try {
    const { data, error } = await supabase.auth.unlinkIdentity({
      provider,
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error("Account unlinking error:", error);
    throw error;
  }
};
