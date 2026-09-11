import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { SignUpFormData } from '../schemas/auth-schemas';
import { signUp } from '../services/auth-service';
import { getAuthErrorMessage } from '../utils/get-auth-error-message';

export function useSignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);
  const router = useRouter();

  async function handleSignUp(data: SignUpFormData) {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const { session } = await signUp({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      // Se o projeto Supabase exige confirmação de e-mail, signUp retorna sem sessão:
      // o usuário existe mas ainda não pode logar. Nesse caso não navega pra home
      // (o guard de sessão do _layout ia chutar ele de volta pro login sem explicação).
      if (!session) {
        setMessage('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
        return;
      }

      setSession(session);
      router.replace('/(app)/home');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return { handleSignUp, loading, error, message };
}
