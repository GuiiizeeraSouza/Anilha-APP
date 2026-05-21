import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  senderName: string;
}

export interface FriendWithTime {
  id: string;
  name: string;
  weeklySeconds: number;
  avatarUrl?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Search profiles by name, excluding the current user. */
export async function searchProfiles(
  query: string,
  currentUserId: string,
): Promise<Profile[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .ilike('name', `%${query.trim()}%`)
    .neq('id', currentUserId)
    .limit(15);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/** Get incoming pending friend requests for a user. */
export async function getIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id, receiver_id, status, profiles:sender_id(name)')
    .eq('receiver_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    senderId: r.sender_id as string,
    receiverId: r.receiver_id as string,
    status: r.status as 'pending',
    senderName: (r.profiles as any)?.name ?? 'Usuário',
  }));
}

/** Get the receiver IDs of all pending requests sent by the user. */
export async function getSentPendingReceiverIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('receiver_id')
    .eq('sender_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []).map((r: any) => r.receiver_id as string);
}

/** Get all accepted friends with their weekly workout duration. */
export async function getFriendsWithWeeklyTime(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<FriendWithTime[]> {
  const { data: requests, error: reqErr } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (reqErr) throw reqErr;
  if (!requests?.length) return [];

  const friendIds = (requests as any[]).map((r) =>
    r.sender_id === userId ? r.receiver_id : r.sender_id,
  );

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', friendIds);
  if (profErr) throw profErr;

  const { data: sessions, error: sessErr } = await supabase
    .from('workout_sessions')
    .select('user_id, duration_seconds')
    .in('user_id', friendIds)
    .gte('completed_at', weekStart.toISOString())
    .lt('completed_at', weekEnd.toISOString());
  if (sessErr) throw sessErr;

  return (profiles ?? []).map((p: any) => ({
    id: p.id as string,
    name: p.name as string,
    avatarUrl: (p.avatar_url as string | null) ?? undefined,
    weeklySeconds: ((sessions ?? []) as any[])
      .filter((s) => s.user_id === p.id)
      .reduce((acc: number, s) => acc + (s.duration_seconds as number), 0),
  }));
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Send a friend request. */
export async function sendFriendRequest(
  senderId: string,
  receiverId: string,
): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' });
  if (error) throw error;
}

/** Accept or decline a friend request. */
export async function respondToRequest(
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status })
    .eq('id', requestId);
  if (error) throw error;
}

/** Remove a friendship (deletes the accepted request in either direction). */
export async function removeFriendship(
  userId: string,
  friendId: string,
): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
    );
  if (error) throw error;
}

// ─── Gym Check-ins ────────────────────────────────────────────────────────────

export interface GymCheckin {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  photoUrl?: string;
  caption?: string;
  createdAt: string;
}

/** Upload a check-in photo to Supabase Storage and return its public URL. */
export async function uploadCheckinPhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const fileName = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('checkins')
    .upload(fileName, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  if (error) throw error;
  const { data } = supabase.storage.from('checkins').getPublicUrl(fileName);
  return data.publicUrl;
}

/** Create a gym check-in for the current user. */
export async function createCheckin(
  userId: string,
  photoUrl: string | null,
  caption?: string,
): Promise<void> {
  const { error } = await supabase
    .from('gym_checkins')
    .insert({ user_id: userId, photo_url: photoUrl ?? null, caption: caption ?? null });
  if (error) throw error;
}

/** Calls the Edge Function to send push notifications to all friends. */
export async function notifyFriendsWorkoutStarted(
  userId: string,
  workoutLabel: string,
): Promise<void> {
  try {
    await supabase.functions.invoke('notify-workout-start', {
      body: { userId, workoutLabel },
    });
  } catch { /* push notifications are best-effort */ }
}

/** Get recent check-ins from the user and their friends (newest first). */
export async function getFriendsCheckins(
  userId: string,
  limit = 30,
): Promise<GymCheckin[]> {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id, user_id, photo_url, caption, created_at, profiles:user_id(name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userName: (row.profiles as any)?.name ?? 'Usuário',
    userAvatarUrl: (row.profiles as any)?.avatar_url ?? undefined,
    photoUrl: (row.photo_url as string | null) ?? undefined,
    caption: (row.caption as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }));
}
