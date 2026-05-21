import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useSignUp } from '@/modules/auth/hooks/use-sign-up';
import { type SignUpFormData, signUpSchema } from '@/modules/auth/schemas/auth-schemas';
import { Button } from '@/shared/components/button';
import { Container } from '@/shared/components/container';
import { Input } from '@/shared/components/input';

export default function RegisterScreen() {
  const router = useRouter();
  const { handleSignUp, loading, error } = useSignUp();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
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
              <Text className="text-primary text-4xl font-bold mb-2">Criar conta</Text>
              <Text className="text-secondary-text text-base">
                Junte-se ao Anilha e comece a treinar.
              </Text>
            </View>

            {/* Campos */}
            <View className="gap-4">
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nome"
                    placeholder="Seu nome completo"
                    autoCapitalize="words"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.name?.message}
                  />
                )}
              />

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
                    placeholder="Mínimo 6 caracteres"
                    secureEntry
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Confirmar senha"
                    placeholder="Repita a senha"
                    secureEntry
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.confirmPassword?.message}
                  />
                )}
              />
            </View>

            {error != null && (
              <Text className="text-error text-sm mt-4 text-center">{error}</Text>
            )}

            {/* Botões */}
            <View className="mt-8 gap-3">
              <Button
                title="Criar conta"
                onPress={handleSubmit(handleSignUp)}
                loading={loading}
              />
              <Button
                title="Já tenho conta"
                onPress={() => router.back()}
                variant="ghost"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}
