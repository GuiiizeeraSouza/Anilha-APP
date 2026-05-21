import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
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
  logout: () => set({ user: null, session: null, loading: false }),
}));
