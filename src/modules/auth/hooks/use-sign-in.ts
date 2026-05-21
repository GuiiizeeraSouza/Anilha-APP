import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { SignInFormData } from '../schemas/auth-schemas';
import { signIn } from '../services/auth-service';

export function useSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);
  const router = useRouter();

  async function handleSignIn(data: SignInFormData) {
    try {
      setLoading(true);
      setError(null);
      const { session } = await signIn(data);
      setSession(session);
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return { handleSignIn, loading, error };
}
