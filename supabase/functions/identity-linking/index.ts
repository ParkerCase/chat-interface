// supabase/functions/identity-linking/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper function for structured logging
function logEvent(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

// Helper for safe database operations
async function safeDbOperation(operation, fallback = null) {
  try {
    return await operation();
  } catch (error) {
    logEvent("error", `Database operation failed: ${error.message}`, { 
      error_code: error.code, 
      details: error.details 
    });
    return fallback;
  }
}

export const handler = async (event, context) => {
  const startTime = Date.now();
  let traceId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  try {
    // Get Supabase admin client from context
    const supabaseAdmin = context.supabaseAdmin;
    
    // Extract request data with validation
    const { provider, email, userData } = event.request.body;
    
    // Request validation
    if (!email || !provider) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: email and provider are required',
          traceId
        })
      };
    }
    
    // Normalize email (lowercase) for consistency
    const normalizedEmail = email.toLowerCase().trim();
    
    // Get client info for security logging
    const clientIp = event.request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = event.request.headers.get('user-agent') || 'unknown';
    
    logEvent("info", `Identity linking request started`, { 
      email: normalizedEmail, 
      provider, 
      clientIp, 
      traceId 
    });
    
    // Step 1: Check if this user already exists in our database (by email)
    let existingUser = null;
    
    // First try to find user by email using admin API
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      filter: {
        email: normalizedEmail
      }
    });
    
    if (usersError) {
      logEvent("error", `Error searching for users: ${usersError.message}`, { traceId });
    } else if (usersData?.users && usersData.users.length > 0) {
      // Found user by email
      existingUser = usersData.users[0];
      logEvent("info", `Found existing user by email`, { 
        userId: existingUser.id, 
        email: normalizedEmail,
        traceId 
      });
    }
    
    // If user not found with admin API, try a direct query to profiles
    if (!existingUser) {
      const profileData = await safeDbOperation(async () => {
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('email', normalizedEmail)
          .single();
          
        if (error && !error.message.includes('No rows found')) {
          throw error;
        }
        return data;
      });
      
      if (profileData?.id) {
        // Found user in profiles, now get auth user
        const authUser = await safeDbOperation(async () => {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(profileData.id);
          if (error) throw error;
          return data?.user;
        });
        
        if (authUser) {
          existingUser = authUser;
          logEvent("info", `Found existing user from profiles table`, { 
            userId: existingUser.id, 
            email: normalizedEmail,
            traceId 
          });
        }
      }
    }
    
    // If user doesn't exist, we should create a new account instead of linking
    if (!existingUser) {
      logEvent("info", `No existing user found, creating new user`, { 
        email: normalizedEmail, 
        provider,
        traceId 
      });
      
      try {
        // Create new user with this provider
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {
            provider: provider,
            full_name: userData?.name || '',
            avatar_url: userData?.avatar_url || '',
            ...userData
          },
          app_metadata: {
            provider: provider,
            providers: [provider]
          }
        });
        
        if (createError) throw createError;
        
        // Create profile for new user
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: newUser.id,
            email: normalizedEmail,
            full_name: userData?.name || normalizedEmail.split('@')[0],
            roles: ["user"],
            auth_provider: provider,
            auth_providers: [provider],
            tier: "basic",
            created_at: new Date().toISOString()
          });
        
        if (profileError) {
          logEvent("warn", `Created user but profile creation failed: ${profileError.message}`, { 
            userId: newUser.id, 
            traceId 
          });
        }
        
        // Record auth event
        await safeDbOperation(async () => {
          await supabaseAdmin
            .from("auth_events")
            .insert({
              user_id: newUser.id,
              email: normalizedEmail,
              event_type: "user_created",
              provider,
              client_ip: clientIp,
              user_agent: userAgent,
              metadata: { userData }
            });
        });
        
        logEvent("info", `New user created successfully`, { 
          userId: newUser.id, 
          email: normalizedEmail,
          executionTime: Date.now() - startTime,
          traceId 
        });
        
        return {
          statusCode: 201,
          body: JSON.stringify({
            success: true,
            action: "created",
            user: {
              id: newUser.id,
              email: normalizedEmail,
              provider
            },
            traceId
          })
        };
      } catch (createError) {
        logEvent("error", `Failed to create new user: ${createError.message}`, { 
          email: normalizedEmail, 
          traceId,
          error: createError.message,
          stack: createError.stack
        });
        
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to create new user: ' + createError.message,
            traceId
          })
        }
      }
    }
    
    // We found an existing user with this email
    logEvent("info", `Working with existing user`, { 
      userId: existingUser.id, 
      email: normalizedEmail,
      traceId 
    });
    
    // Special case for admin user
    if (normalizedEmail === "itsus@tatt2away.com") {
      logEvent("info", `Admin user detected, ensuring proper roles`, { traceId });
      
      // Check and update admin profile
      const adminProfile = await safeDbOperation(async () => {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", existingUser.id)
          .single();
          
        if (error && !error.message.includes('No rows found')) throw error;
        return data;
      });
      
      if (!adminProfile || !adminProfile.roles?.includes("super_admin")) {
        // Create or update admin profile with correct roles
        await safeDbOperation(async () => {
          const { error } = await supabaseAdmin
            .from("profiles")
            .upsert({
              id: existingUser.id,
              email: normalizedEmail,
              full_name: "Tatt2Away Admin",
              roles: ["super_admin", "admin", "user"],
              tier: "enterprise",
              auth_provider: provider,
              auth_providers: [provider],
              updated_at: new Date().toISOString()
            });
            
          if (error) throw error;
        });
        
        logEvent("info", `Admin profile updated with correct roles`, { traceId });
      }
    }
    
    // Step 2: Check if user has any identity providers
    const identityData = await safeDbOperation(async () => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserIdentities(existingUser.id);
      if (error) throw error;
      return data;
    }, { identities: [] });
    
    const identities = identityData?.identities || [];
    const hasSameProvider = identities.some(identity => 
      identity.provider.toLowerCase() === provider.toLowerCase()
    );
    
    // If user already has this provider
    if (hasSameProvider) {
      logEvent("info", `User already has this identity provider linked`, { 
        userId: existingUser.id, 
        provider,
        traceId 
      });
      
      // Update app metadata to ensure provider is tracked
      await safeDbOperation(async () => {
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          app_metadata: {
            ...existingUser.app_metadata,
            provider: provider,
            providers: [...(existingUser.app_metadata?.providers || []), provider]
              .filter((v, i, a) => a.indexOf(v) === i) // Unique values
          }
        });
      });
      
      // Update profile data
      await safeDbOperation(async () => {
        const currentProviders = await supabaseAdmin
          .from("profiles")
          .select("auth_providers")
          .eq("id", existingUser.id)
          .single();
          
        // Get current providers or default to empty array
        const providerArray = currentProviders?.data?.auth_providers || [];
        
        // Make sure provider is in the array
        if (!providerArray.includes(provider)) {
          providerArray.push(provider);
        }
        
        await supabaseAdmin
          .from("profiles")
          .update({
            auth_provider: provider,
            auth_providers: providerArray,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingUser.id);
      });
      
      // Record auth event
      await safeDbOperation(async () => {
        await supabaseAdmin
          .from("auth_events")
          .insert({
            user_id: existingUser.id,
            email: normalizedEmail,
            event_type: "provider_linking_skipped",
            provider,
            client_ip: clientIp,
            user_agent: userAgent,
            metadata: { reason: "already_linked" }
          });
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: "already_linked",
          user: {
            id: existingUser.id,
            email: normalizedEmail,
            provider
          },
          traceId
        })
      };
    }
    
    // Step 3: User exists but doesn't have this provider linked
    // We need to create a magic link for them to complete the linking
    logEvent("info", `Generating link for provider linking`, { 
      userId: existingUser.id, 
      email: normalizedEmail,
      provider,
      traceId 
    });
    
    try {
      // Generate a magic link 
      const origin = event.request.headers.get('origin') || 'http://localhost:3000';
      
      // Generate a unique state token to verify the flow later
      const stateToken = `link_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: {
          redirectTo: `${origin}/auth/callback?linking=true&provider=${provider}&state=${stateToken}`
        }
      });
      
      if (linkError) {
        throw linkError;
      }
      
      // Set up metadata to indicate pending linking
      await safeDbOperation(async () => {
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          app_metadata: {
            ...existingUser.app_metadata,
            pending_link: provider,
            pending_link_at: new Date().toISOString(),
            link_state_token: stateToken
          }
        });
      });
      
      // Update profile
      await safeDbOperation(async () => {
        await supabaseAdmin
          .from("profiles")
          .update({
            pending_link: provider,
            pending_link_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", existingUser.id);
      });
      
      // Record auth event
      await safeDbOperation(async () => {
        await supabaseAdmin
          .from("auth_events")
          .insert({
            user_id: existingUser.id,
            email: normalizedEmail,
            event_type: "provider_linking_initiated",
            provider,
            client_ip: clientIp,
            user_agent: userAgent,
            metadata: { state_token: stateToken }
          });
      });
      
      logEvent("info", `Magic link generated successfully`, { 
        userId: existingUser.id, 
        executionTime: Date.now() - startTime,
        traceId 
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: "link_initiated",
          email: normalizedEmail,
          provider: provider,
          magicLink: linkData.properties.action_link,
          traceId
        })
      };
    } catch (linkError) {
      logEvent("error", `Error generating magic link: ${linkError.message}`, { 
        userId: existingUser.id, 
        traceId 
      });
      
      // Fallback: Try to send OTP instead
      try {
        logEvent("info", `Falling back to OTP approach`, { traceId });
        
        // Set pending link metadata
        await safeDbOperation(async () => {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            app_metadata: {
              ...existingUser.app_metadata,
              pending_link: provider,
              pending_link_at: new Date().toISOString()
            }
          });
        });
        
        // Record auth event
        await safeDbOperation(async () => {
          await supabaseAdmin
            .from("auth_events")
            .insert({
              user_id: existingUser.id,
              email: normalizedEmail,
              event_type: "provider_linking_otp_fallback",
              provider,
              client_ip: clientIp,
              user_agent: userAgent,
              metadata: { error: linkError.message }
            });
        });
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            action: "otp_required",
            email: normalizedEmail,
            provider: provider,
            message: "Please verify your email with the code that will be sent",
            traceId
          })
        };
      } catch (otpError) {
        logEvent("error", `OTP fallback also failed: ${otpError.message}`, { 
          userId: existingUser.id, 
          traceId 
        });
        
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: "Failed to initiate account linking",
            traceId
          })
        };
      }
    }
  } catch (error) {
    // Top-level error handler
    logEvent("error", `Unexpected error in identity linking: ${error.message}`, {
      stack: error.stack,
      traceId
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred: ' + error.message,
        traceId
      })
    };
  } finally {
    // Log execution time for performance monitoring
    const executionTime = Date.now() - startTime;
    logEvent("info", `Request completed`, {
      executionTime,
      traceId
    });
  }
};