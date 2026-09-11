import { useState } from 'react';
import type { ForgotPasswordFormData } from '../schemas/auth-schemas';
import { requestPasswordReset } from '../services/auth-service';
import { getAuthErrorMessage } from '../utils/get-auth-error-message';

export function useForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleForgotPassword(data: ForgotPasswordFormData) {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      await requestPasswordReset(data.email);
      setMessage('Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha.');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return { handleForgotPassword, loading, error, message };
}
