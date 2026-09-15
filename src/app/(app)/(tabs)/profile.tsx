import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Header } from 'expo-router/react-navigation';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { signOut } from '@/modules/auth/services/auth-service';

import { supabase } from '@/lib/supabase';
import { Button } from '@/shared/components/button';
import { Container } from '@/shared/components/container';
import { useAuthStore } from '@/store/auth-store';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    logout();
    router.replace('/(auth)/login');
  }

  const name = (user?.user_metadata?.name as string | undefined) ?? 'Usuário';
  const email = user?.email ?? '—';
  const initial = name[0].toUpperCase();
  const storedAvatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const avatarUrl = localAvatarUrl ?? storedAvatarUrl;

  async function pickAndUploadAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para alterar a foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    // Mostra a imagem local imediatamente, antes do upload
    setLocalAvatarUrl(asset.uri);

    setUploading(true);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user!.id}/avatar.${ext}`;

      const file = new File(asset.uri);
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const [{ data: updatedData, error: updateError }, { error: profileError }] = await Promise.all([
        supabase.auth.updateUser({ data: { avatar_url: publicUrl } }),
        supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user!.id),
      ]);

      if (updateError) throw updateError;
      if (profileError) throw profileError;
      if (updatedData.user) setUser(updatedData.user);
    } catch (err) {
      setLocalAvatarUrl(null);
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível atualizar a foto.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Container safe={false}>
      <Header title="Perfil" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View className="items-center mb-8">
          <TouchableOpacity onPress={pickAndUploadAvatar} activeOpacity={0.85} disabled={uploading}>
            <View>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{
                    width: 100, height: 100, borderRadius: 50,
                    borderWidth: 3, borderColor: '#D62828',
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View
                  style={{
                    width: 100, height: 100, borderRadius: 50,
                    backgroundColor: '#D62828',
                    borderWidth: 3, borderColor: '#D6282866',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 38, fontWeight: 'bold' }}>{initial}</Text>
                </View>
              )}
              {/* Botão câmera */}
              <View
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: '#1E1E1E',
                  borderWidth: 2, borderColor: '#D62828',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {uploading
                  ? <ActivityIndicator size={12} color="#D62828" />
                  : <Text style={{ fontSize: 13 }}>📷</Text>}
              </View>
            </View>
          </TouchableOpacity>

          <Text className="text-text text-xl font-bold mt-4">{name}</Text>
          <Text className="text-secondary-text text-sm mt-1">{email}</Text>
          {uploading && (
            <Text className="text-secondary-text text-xs mt-2">Enviando foto...</Text>
          )}
        </View>

        {/* Informações da conta */}
        <View className="bg-card rounded-2xl p-5 border border-border">
          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-widest mb-4">
            Informações da conta
          </Text>

          <View className="gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-secondary-text text-sm">Nome</Text>
              <Text className="text-text text-sm font-medium">{name}</Text>
            </View>

            <View className="h-px bg-border" />

            <View className="flex-row justify-between items-center">
              <Text className="text-secondary-text text-sm">E-mail</Text>
              <Text className="text-text text-sm font-medium">{email}</Text>
            </View>

            <View className="h-px bg-border" />

            <View className="flex-row justify-between items-center">
              <Text className="text-secondary-text text-sm">Membro desde</Text>
              <Text className="text-text text-sm font-medium">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('pt-BR')
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-6">
          <Button title="Sair" onPress={handleSignOut} variant="ghost" />
        </View>
      </ScrollView>
    </Container>
  );
}
