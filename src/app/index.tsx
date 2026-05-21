import { Loading } from '@/shared/components/loading';
import { useAuthStore } from '@/store/auth-store';
import { Redirect } from 'expo-router';

export default function Index() {
  const { session, loading } = useAuthStore();

  if (loading) return <Loading fullScreen />;
  if (session) return <Redirect href="/(app)/home" />;
  return <Redirect href="/(auth)/login" />;
}

