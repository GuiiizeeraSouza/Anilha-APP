import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { SignInFormData } from '../schemas/auth-schemas';
import { signIn } from '../services/auth-service';
import { getAuthErrorMessage } from '../utils/get-auth-error-message';

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
      router.replace('/home');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return { handleSignIn, loading, error };
}
