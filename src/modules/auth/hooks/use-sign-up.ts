import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { SignUpFormData } from '../schemas/auth-schemas';
import { signUp } from '../services/auth-service';

export function useSignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);
  const router = useRouter();

  async function handleSignUp(data: SignUpFormData) {
    try {
      setLoading(true);
      setError(null);
      const { session } = await signUp({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      setSession(session);
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return { handleSignUp, loading, error };
}
