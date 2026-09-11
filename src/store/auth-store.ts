import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // true enquanto o usuário está no fluxo de "esqueci minha senha" (veio de um link de
  // recuperação e já tem uma sessão válida, mas ainda não definiu a nova senha).
  // Evita que o guard de navegação do _layout mande ele direto pra home antes disso.
  isPasswordRecovery: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setPasswordRecovery: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  isPasswordRecovery: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set((state) => {
    const incoming = session?.user ?? null;
    if (!incoming) return { session, user: null };

    // Se for o mesmo usuário, mescla o user_metadata para não perder dados
    // definidos via updateUser (ex: avatar_url) quando o token é atualizado.
    if (state.user?.id === incoming.id) {
      return {
        session,
        user: {
          ...incoming,
          user_metadata: { ...state.user.user_metadata, ...incoming.user_metadata },
        },
      };
    }
    return { session, user: incoming };
  }),
  setLoading: (loading) => set({ loading }),
  setPasswordRecovery: (value) => set({ isPasswordRecovery: value }),
  logout: () => set({ user: null, session: null, loading: false, isPasswordRecovery: false }),
}));
