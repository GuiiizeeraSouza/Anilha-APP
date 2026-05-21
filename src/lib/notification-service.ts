import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

export const WORKOUT_NOTIFICATION_ID = 'anilha-workout-timer';

// ─── Channel setup (Android 8+) ───────────────────────────────────────────────

async function ensureWorkoutChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('workout', {
    name: 'Treino em andamento',
    importance: Notifications.AndroidImportance.MAX,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    await ensureWorkoutChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

// ─── Workout notification ─────────────────────────────────────────────────────

/**
 * Shows (or updates) a persistent notification displaying the workout in progress.
 * Call this once when the workout starts (elapsed = 0), then every minute to update.
 */
export async function showWorkoutNotification(
  workoutLabel: string,
  elapsedSeconds: number,
): Promise<void> {
  try {
    // Dismiss the previous notification so we can "replace" it
    await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID);
  } catch { /* nothing to dismiss on first call */ }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_NOTIFICATION_ID,
      content: {
        title: '🏋️ Treino em andamento',
        body: `${workoutLabel}  ·  ${formatElapsed(elapsedSeconds)}`,
        // Android-only: prevent user from swiping it away
        sticky: true,
        autoDismiss: false,
        // Android channel
        ...(Platform.OS === 'android' ? { channelId: 'workout' } : {}),
      },
      trigger: null,
    });
  } catch { /* notifications are optional */ }
}

/** Removes the workout notification from the tray and cancels any pending schedule. */
export async function cancelWorkoutNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID);
  } catch { /* ignore */ }
  try {
    await Notifications.cancelScheduledNotificationAsync(WORKOUT_NOTIFICATION_ID);
  } catch { /* ignore */ }
}

// ─── Push token registration ──────────────────────────────────────────────────

/**
 * Gets the Expo push token and saves it to Supabase.
 * Requires EAS project configured in app.json (extra.eas.projectId).
 * Silently no-ops if unavailable.
 */
export async function savePushToken(userId: string): Promise<void> {
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token: tokenResponse.data }, { onConflict: 'user_id' });
  } catch { /* push tokens require EAS project; skip gracefully */ }
}
