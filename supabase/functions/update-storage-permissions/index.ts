// Create file: supabase/functions/update-storage-permissions/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const handler = async (event, context) => {
  try {
    // Get the request body
    const { bucket, path, accessLevel, specificUsers, specificGroups } = event.request.body;

    // Get Supabase admin client from context
    const supabaseAdmin = context.supabaseAdmin;

    // Get the current user from auth token
    const auth = event.request.headers.get('Authorization');
    const token = auth?.replace('Bearer ', '');
    
    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Verify the user has permission to update storage policies
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    // Get the user's profile to check roles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('roles')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch user profile' }),
      };
    }

    // Check if user has admin permissions
    const isAdmin = profile.roles?.includes('admin') || profile.roles?.includes('super_admin');
    
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Permission denied' }),
      };
    }

    // Record the permission change
    await supabaseAdmin.from('storage_permissions').insert({
      bucket,
      path,
      access_level: accessLevel,
      specific_users: specificUsers,
      specific_groups: specificGroups,
      set_by: userData.user.id,
      created_at: new Date().toISOString(),
    });

    // REAL BUCKET POLICY MANAGEMENT
    // Get existing bucket policies
    const { data: bucketData, error: bucketError } = await supabaseAdmin
      .rpc('get_bucket_policies', { bucket_name: bucket });
      
    if (bucketError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get bucket policies' }),
      };
    }
    
    // Process policy based on access level
    if (accessLevel === 'public') {
      // Create or update policy for public access
      await supabaseAdmin.rpc('create_storage_policy', {
        policy_name: `allow_public_${bucket}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        bucket_name: bucket,
        definition: `bucket_id = '${bucket}' AND (name = '${path}' OR name LIKE '${path}/%')`,
        operation: 'SELECT',
        role_name: 'authenticated',
      });
    } else {
      // Revoke public access (delete public policy if it exists)
      await supabaseAdmin.rpc('delete_storage_policy', {
        policy_name: `allow_public_${bucket}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        bucket_name: bucket
      });
      
      // Create specific access policies for users and groups
      if (specificUsers?.length) {
        // Create or update policy for specific users
        const userEmails = specificUsers.map(email => `'${email}'`).join(',');
        await supabaseAdmin.rpc('create_storage_policy', {
          policy_name: `allow_users_${bucket}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          bucket_name: bucket,
          definition: `bucket_id = '${bucket}' AND (name = '${path}' OR name LIKE '${path}/%') AND auth.email() IN (${userEmails})`,
          operation: 'SELECT',
          role_name: 'authenticated',
        });
      }
      
      if (specificGroups?.length) {
        // For groups, we'll need a different approach using custom joins
        // Store in our tables and let RLS handle it
        await Promise.all(specificGroups.map(async (group) => {
          await supabaseAdmin.from('storage_access_grants').insert({
            bucket,
            path,
            grantee_type: 'group',
            grantee_id: group,
            granted_by: userData.user.id,
          });
        }));
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error updating storage permissions:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};