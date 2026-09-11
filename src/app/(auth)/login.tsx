import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useSignIn } from '@/modules/auth/hooks/use-sign-in';
import { type SignInFormData, signInSchema } from '@/modules/auth/schemas/auth-schemas';
import { Button } from '@/shared/components/button';
import { Container } from '@/shared/components/container';
import { Input } from '@/shared/components/input';

export default function LoginScreen() {
  const router = useRouter();
  const { handleSignIn, loading, error } = useSignIn();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 justify-center px-6 py-12">
            {/* Header */}
            <View className="mb-10">
              <Text className="text-primary text-4xl font-bold mb-2">Anilha</Text>
              <Text className="text-secondary-text text-base">
                Bem-vindo de volta. Faça login para continuar.
              </Text>
            </View>

            {/* Campos */}
            <View className="gap-4">
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="E-mail"
                    placeholder="seu@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Senha"
                    placeholder="••••••"
                    secureEntry
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                  />
                )}
              />

              <Text
                className="text-primary text-sm text-right"
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                Esqueci minha senha
              </Text>
            </View>

            {error != null && (
              <Text className="text-error text-sm mt-4 text-center">{error}</Text>
            )}

            {/* Botões */}
            <View className="mt-8 gap-3">
              <Button
                title="Entrar"
                onPress={handleSubmit(handleSignIn)}
                loading={loading}
              />
              <Button
                title="Criar conta"
                onPress={() => router.push('/(auth)/register')}
                variant="secondary"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}
