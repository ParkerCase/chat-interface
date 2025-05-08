/// <reference types="https://deno.land/std@0.224.0/types.d.ts" />

interface WebhookPayload {
    type: 'INSERT' | 'UPDATE';
    table: string;
    record: {
      id: string;
      name: string;
      created_by: string;
      updated_by?: string;
    };
    old_record?: any;
  }
  
  interface NotificationInput {
    userId: string;
    title: string;
    message: string;
    documentId: string;
    event: string;
    timestamp: string;
  }
  
  const documentCorsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: documentCorsHeaders });
    }
  
    try {
      const payload = await req.json() as WebhookPayload;
      const { type, table, record } = payload;
  
      console.log(`Document event: ${type} on ${table}`, record);
  
      if (type === 'INSERT' && table === 'documents') {
        await storeNotificationInRedis({
          userId: record.created_by,
          title: 'New Document Added',
          message: `Document "${record.name}" was added to the system`,
          documentId: record.id,
          event: 'document_created',
          timestamp: new Date().toISOString()
        });
      } else if (type === 'UPDATE' && table === 'documents') {
        await storeNotificationInRedis({
          userId: record.updated_by || record.created_by,
          title: 'Document Updated',
          message: `Document "${record.name}" was updated`,
          documentId: record.id,
          event: 'document_updated',
          timestamp: new Date().toISOString()
        });
      }
  
      return new Response(JSON.stringify({ success: true }), {
        headers: documentCorsHeaders
      });
  
    } catch (error) {
      console.error('Error processing document webhook:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: documentCorsHeaders
      });
    }
  });
  
  async function storeNotificationInRedis({
    userId,
    title,
    message,
    documentId,
    event,
    timestamp
  }: NotificationInput): Promise<boolean> {
    try {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      };
  
      const notificationId = `notification:${Date.now()}:${Math.random().toString(36).substring(2, 15)}`;
      const notification = {
        id: notificationId,
        userId,
        title,
        message,
        documentId,
        event,
        timestamp,
        read: false
      };

      console.log("SUPABASE_SERVICE_ROLE_KEY:", Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  
      // Store the notification
      const resp = await fetch('https://rfnglcfyzoyqenofmsev.supabase.co/rest/v1/rpc/redis_set', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: notificationId,
          value: JSON.stringify(notification),
          expiry: 604800 // 7 days
        })
      });
  
      if (!resp.ok) throw new Error('Failed to store notification in Redis');
  
      // Update user's notification list
      const userNotificationsKey = `user:${userId}:notifications`;
  
      const listResp = await fetch('https://rfnglcfyzoyqenofmsev.supabase.co/rest/v1/rpc/redis_get', {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: userNotificationsKey })
      });
  
      const listData = await listResp.json();
      const currentList: string[] = listData ? JSON.parse(listData) : [];
  
      currentList.unshift(notificationId);
      const trimmedList = currentList.slice(0, 50);
  
      await fetch('https://rfnglcfyzoyqenofmsev.supabase.co/rest/v1/rpc/redis_set', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: userNotificationsKey,
          value: JSON.stringify(trimmedList),
          expiry: 2592000 // 30 days
        })
      });
  
      return true;
    } catch (err) {
      console.error('Error storing notification in Redis:', err);
      return false;
    }
  }
  