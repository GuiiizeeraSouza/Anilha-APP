import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { ResetPasswordFormData } from '../schemas/auth-schemas';
import { updatePassword } from '../services/auth-service';
import { getAuthErrorMessage } from '../utils/get-auth-error-message';

export function useResetPassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPasswordRecovery = useAuthStore((state) => state.setPasswordRecovery);
  const router = useRouter();

  async function handleResetPassword(data: ResetPasswordFormData) {
    try {
      setLoading(true);
      setError(null);
      await updatePassword(data.password);
      setPasswordRecovery(false);
      router.replace('/(app)/home');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return { handleResetPassword, loading, error };
}
