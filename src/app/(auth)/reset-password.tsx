import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useResetPassword } from '@/modules/auth/hooks/use-reset-password';
import { type ResetPasswordFormData, resetPasswordSchema } from '@/modules/auth/schemas/auth-schemas';
import { Button } from '@/shared/components/button';
import { Container } from '@/shared/components/container';
import { Input } from '@/shared/components/input';

export default function ResetPasswordScreen() {
  const { handleResetPassword, loading, error } = useResetPassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
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
              <Text className="text-primary text-4xl font-bold mb-2">Nova senha</Text>
              <Text className="text-secondary-text text-base">
                Defina uma nova senha para sua conta.
              </Text>
            </View>

            <View className="gap-4">
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nova senha"
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
                    label="Confirmar nova senha"
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

            <View className="mt-8">
              <Button
                title="Salvar nova senha"
                onPress={handleSubmit(handleResetPassword)}
                loading={loading}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}
