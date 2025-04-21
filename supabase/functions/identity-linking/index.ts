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
      providerId,    // ID from provider (like Google user ID)
      providerToken, // OAuth access token
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
    
    console.log(`Auto identity linking request for email: ${email} with provider: ${provider}`);
    
    // Step 1: Check if this user already exists in our database (by email)
    const { data: existingUsers, error: userSearchError } = await supabaseAdmin.auth.admin.listUsers({
      filters: {
        email: email
      }
    });
      
    if (userSearchError) {
      console.error("Error searching for existing user:", userSearchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Failed to search for existing user: ' + userSearchError.message 
        })
      };
    }
    
    // If user doesn't exist, we should create a new account instead of linking
    if (!existingUsers || existingUsers.users.length === 0) {
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
            auth_providers: [provider]
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
    const existingUser = existingUsers.users[0];
    console.log(`Found existing user ${existingUser.id} with email ${email}`);
    
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
    
    // Step 2: Check if this provider is already linked to the user
    const { data: identities } = await supabaseAdmin.auth.admin.getUserIdentities(existingUser.id);
    
    const providerIdentity = identities?.identities?.find(identity => 
      identity.provider.toLowerCase() === provider.toLowerCase()
    );
    
    if (providerIdentity) {
      console.log(`User ${existingUser.id} already has ${provider} identity linked`);
      
      // Update app metadata to ensure provider is tracked
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          ...existingUser.app_metadata,
          provider: provider,
          providers: [...(existingUser.app_metadata?.providers || []), provider].filter((v, i, a) => a.indexOf(v) === i) // Unique values
        }
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: "already_linked",
          user: existingUser
        })
      };
    }
    
    // Step 3: Attempt to link identities - since direct linking requires user interaction,
    // we'll set up metadata that indicates this account should be linked
    console.log(`Preparing to link ${provider} identity to user ${existingUser.id}`);
    
    // Update user metadata to track pending link and provider
    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      app_metadata: {
        ...existingUser.app_metadata,
        pending_link: provider,
        providers: [...(existingUser.app_metadata?.providers || []), provider].filter((v, i, a) => a.indexOf(v) === i)
      }
    });
    
    // Update profile to track provider
    await supabaseAdmin
      .from("profiles")
      .update({
        auth_provider: provider,
        auth_providers: [provider],
        updated_at: new Date().toISOString()
      })
      .eq("id", existingUser.id);
    
    // Generate a secure magic link for the user that will log them in
    // and link their account in a single step
    const { data: magicLink, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${event.request.headers.get('origin') || ''}/auth/callback?linking=true&provider=${provider}`
      }
    });
    
    if (magicLinkError) {
      console.error("Error generating magic link:", magicLinkError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to generate login link: ' + magicLinkError.message
        })
      };
    }
    
    // The frontend should use this information to handle the user automatically
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        action: "link_initiated",
        user: existingUser,
        magicLink: magicLink.properties.action_link,
        email: email
      })
    };
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