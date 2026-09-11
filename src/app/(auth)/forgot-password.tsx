import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useForgotPassword } from '@/modules/auth/hooks/use-forgot-password';
import { type ForgotPasswordFormData, forgotPasswordSchema } from '@/modules/auth/schemas/auth-schemas';
import { Button } from '@/shared/components/button';
import { Container } from '@/shared/components/container';
import { Input } from '@/shared/components/input';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { handleForgotPassword, loading, error, message } = useForgotPassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
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
            <View className="mb-10">
              <Text className="text-primary text-4xl font-bold mb-2">Esqueci minha senha</Text>
              <Text className="text-secondary-text text-base">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </Text>
            </View>

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

            {message != null && (
              <Text className="text-success text-sm mt-4 text-center">{message}</Text>
            )}
            {error != null && (
              <Text className="text-error text-sm mt-4 text-center">{error}</Text>
            )}

            <View className="mt-8 gap-3">
              <Button
                title="Enviar link"
                onPress={handleSubmit(handleForgotPassword)}
                loading={loading}
              />
              <Button
                title="Voltar para o login"
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
