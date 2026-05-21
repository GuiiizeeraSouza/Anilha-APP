// Supabase Edge Function: notify-workout-start
// Sends an Expo push notification to all friends of the user who just started a workout.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, workoutLabel } = await req.json() as { userId: string; workoutLabel: string };
    if (!userId || !workoutLabel) {
      return new Response(JSON.stringify({ error: 'Missing userId or workoutLabel' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get the sender's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    const senderName: string = (profile as any)?.name ?? 'Um amigo';

    // Get all accepted friendships where this user is involved
    const { data: friendRequests } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (!friendRequests?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const friendIds = (friendRequests as any[]).map((r) =>
      r.sender_id === userId ? r.receiver_id : r.sender_id,
    );

    // Get push tokens for all friends
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', friendIds);

    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Expo push messages (max 100 per request)
    const messages = (tokenRows as any[]).map((row) => ({
      to: row.token as string,
      title: `🏋️ ${senderName} começou a treinar!`,
      body: workoutLabel,
      data: { navigate: '/(app)/ranking' },
      sound: 'default',
    }));

    // Send to Expo Push API (handles up to 100 messages per request)
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }
    await Promise.all(
      chunks.map((chunk) =>
        fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk),
        }),
      ),
    );

    return new Response(JSON.stringify({ sent: messages.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
