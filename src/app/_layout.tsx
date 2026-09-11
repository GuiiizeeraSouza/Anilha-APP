import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '@/global.css';
import { savePushToken } from '@/lib/notification-service';
import { supabase } from '@/lib/supabase';
import * as workoutService from '@/lib/workout-service';
import { parseAuthCallbackUrl } from '@/modules/auth/utils/parse-auth-callback-url';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';

// Show notifications while app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { session, loading, isPasswordRecovery, setSession, setLoading, setUser, setPasswordRecovery } =
    useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const setWorkouts = useWorkoutStore((s) => s.setWorkouts);
  const setCustomExercises = useWorkoutStore((s) => s.setCustomExercises);
  const setCompletedSessions = useWorkoutStore((s) => s.setCompletedSessions);
  const setExerciseGifOverrides = useWorkoutStore((s) => s.setExerciseGifOverrides);
  const resetStore = useWorkoutStore((s) => s.resetStore);

  // Inicializa a sessão e registra listener de mudança de autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      // getSession() usa o cache local (JWT pode estar desatualizado).
      // getUser() busca dados frescos do servidor, garantindo que
      // user_metadata (ex: avatar_url) esteja sempre atualizado.
      if (s?.user) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) setUser(user);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading]);

  // Trata o link de recuperação de senha (e-mail "esqueci minha senha").
  // Os tokens vêm como fragmento (#access_token=...) na URL, não como query string.
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return;

      const { access_token, refresh_token, type } = parseAuthCallbackUrl(url);
      if (type !== 'recovery' || !access_token || !refresh_token) return;

      setPasswordRecovery(true);
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        setPasswordRecovery(false);
        return;
      }
      router.replace('/(auth)/reset-password');
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [router, setPasswordRecovery]);

  // Salva push token quando o usuário loga
  useEffect(() => {
    const userId = session?.user?.id;
    if (userId) savePushToken(userId);
  }, [session?.user?.id]);

  // Carrega dados do Supabase quando o usuário loga; limpa quando desloga
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      resetStore();
      return;
    }
    Promise.all([
      workoutService.fetchWorkouts(userId),
      workoutService.fetchCustomExercises(userId),
      workoutService.fetchCompletedSessions(userId),
      workoutService.fetchExerciseGifOverrides(userId),
    ])
      .then(([workouts, exercises, sessions, gifOverrides]) => {
        setWorkouts(workouts);
        setCustomExercises(exercises);
        setCompletedSessions(sessions);
        setExerciseGifOverrides(gifOverrides);
      })
      .catch(console.error);
  }, [userId]);

  // Redireciona conforme estado de autenticação
  useEffect(() => {
    if (loading) return;

    SplashScreen.hideAsync().catch(() => {});

    // Durante o fluxo de "esqueci minha senha" já existe uma sessão válida
    // (criada a partir do link de recuperação), mas o usuário ainda não
    // definiu a nova senha — não deixa o guard mandar ele pra home.
    if (isPasswordRecovery) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [session, loading, segments, router, isPasswordRecovery]);

  if (loading) return null;

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}
