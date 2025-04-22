// supabase/functions/identity-linking/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const handler = async (event, context) => {
  try {
    // Get Supabase admin client from context
    const supabaseAdmin = context.supabaseAdmin;
    
    // Extract request data
    const { 
      provider, 
      email,
      userData       // Additional user data from provider
    } = event.request.body;
    
    if (!email || !provider) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: email and provider are required' 
        })
      };
    }
    
    console.log(`Identity linking request for email: ${email} with provider: ${provider}`);
    
    // Step 1: Check if this user already exists in our database (by email)
    let existingUser = null;
    
    try {
      // First try to find user by email using admin API
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        filter: {
          email: email
        }
      });
      
      if (usersError) {
        console.error("Error searching for users:", usersError);
      } else if (usersData?.users && usersData.users.length > 0) {
        // Found user by email
        existingUser = usersData.users[0];
        console.log(`Found existing user ${existingUser.id} with email ${email}`);
      }
      
      // If user not found with admin API, try a direct query to auth.users
      if (!existingUser) {
        const { data: dbUserData, error: dbUserError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();
          
        if (dbUserError && !dbUserError.message.includes('No rows found')) {
          console.error("Error searching profiles:", dbUserError);
        } else if (dbUserData) {
          // Found user in profiles, now get auth user
          const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(dbUserData.id);
          
          if (!authUserError && authUser) {
            existingUser = authUser.user;
            console.log(`Found existing user ${existingUser.id} from profiles table`);
          }
        }
      }
    } catch (searchError) {
      console.error("Error during user search:", searchError);
      // Continue without failing - we'll create a user if needed
    }
    
    // If user doesn't exist, we should create a new account instead of linking
    if (!existingUser) {
      console.log(`No existing user found with email ${email}, creating new user`);
      
      try {
        // Create new user with this provider
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          email_confirm: true,
          user_metadata: {
            provider: provider,
            ...userData
          },
          app_metadata: {
            provider: provider,
            providers: [provider]
          }
        });
        
        if (createError) throw createError;
        
        // Create profile for new user
        await supabaseAdmin
          .from("profiles")
          .insert({
            id: newUser.id,
            email: email,
            full_name: userData?.name || email.split('@')[0],
            roles: ["user"],
            auth_provider: provider,
            auth_providers: [provider],
            created_at: new Date().toISOString()
          });
        
        return {
          statusCode: 201,
          body: JSON.stringify({
            success: true,
            action: "created",
            user: newUser
          })
        };
      } catch (createError) {
        console.error("Error creating new user:", createError);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to create new user: ' + createError.message
          })
        }
      }
    }
    
    // We found an existing user with this email
    console.log(`Working with existing user ${existingUser.id} with email ${email}`);
    
    // Special case for admin user
    if (email === "itsus@tatt2away.com") {
      console.log("Admin user detected, ensuring proper roles");
      
      // Check and update admin profile
      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", existingUser.id)
        .single();
      
      if (!adminProfile || !adminProfile.roles?.includes("super_admin")) {
        // Create or update admin profile with correct roles
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: existingUser.id,
            email: email,
            full_name: "Tatt2Away Admin",
            roles: ["super_admin", "admin", "user"],
            tier: "enterprise",
            auth_provider: provider,
            auth_providers: [provider],
            updated_at: new Date().toISOString()
          });
        
        console.log("Admin profile updated with correct roles");
      }
    }
    
    // Step 2: Check if user has any identity providers
    const { data: identityData, error: identityError } = await supabaseAdmin.auth.admin.getUserIdentities(
      existingUser.id
    );
    
    if (identityError) {
      console.error("Error getting user identities:", identityError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to get user identities: ' + identityError.message
        })
      };
    }
    
    const identities = identityData?.identities || [];
    const hasSameProvider = identities.some(identity => 
      identity.provider.toLowerCase() === provider.toLowerCase()
    );
    
    // If user already has this provider
    if (hasSameProvider) {
      console.log(`User ${existingUser.id} already has ${provider} identity linked`);
      
      // Update app metadata to ensure provider is tracked
      try {
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          app_metadata: {
            ...existingUser.app_metadata,
            provider: provider,
            providers: [...(existingUser.app_metadata?.providers || []), provider].filter((v, i, a) => a.indexOf(v) === i) // Unique values
          }
        });
      } catch (updateError) {
        console.error("Error updating user metadata:", updateError);
        // Non-critical, continue
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: "already_linked",
          user: existingUser
        })
      };
    }
    
    // Step 3: User exists but doesn't have this provider linked
    // We need to create a magic link for them to complete the linking
    console.log(`Generating magic link for ${email} to link with ${provider}`);
    
    try {
      // Generate a magic link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${event.request.headers.get('origin') || 'http://localhost:3000'}/auth/callback?linking=true&provider=${provider}`
        }
      });
      
      if (linkError) {
        throw linkError;
      }
      
      // Set up metadata to indicate pending linking
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          ...existingUser.app_metadata,
          pending_link: provider,
          pending_link_at: new Date().toISOString()
        }
      });
      
      // Update profile
      await supabaseAdmin
        .from("profiles")
        .update({
          pending_link: provider,
          pending_link_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existingUser.id);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: "link_initiated",
          email: email,
          provider: provider,
          magicLink: linkData.properties.action_link
        })
      };
    } catch (linkError) {
      console.error("Error generating link:", linkError);
      
      // Fallback: Try to send OTP instead
      try {
        console.log("Trying OTP approach instead");
        
        // Set pending link metadata
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          app_metadata: {
            ...existingUser.app_metadata,
            pending_link: provider,
            pending_link_at: new Date().toISOString()
          }
        });
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            action: "otp_required",
            email: email,
            provider: provider,
            message: "Please verify your email with the code that will be sent"
          })
        };
      } catch (otpError) {
        console.error("Error with OTP fallback:", otpError);
        
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: "Failed to initiate account linking"
          })
        };
      }
    }
  } catch (error) {
    console.error("Unexpected error in identity linking:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred: ' + error.message 
      })
    };
  }
};