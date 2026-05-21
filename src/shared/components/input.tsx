import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureEntry?: boolean;
}

export function Input({ label, error, secureEntry = false, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View>
      {label && (
        <Text className="text-secondary-text text-sm font-medium mb-1">{label}</Text>
      )}
      <View className="relative">
        <TextInput
          className={`h-14 bg-card rounded-xl px-4 text-text text-base border ${
            error ? 'border-error' : 'border-border'
          }`}
          placeholderTextColor="#A0A0A0"
          secureTextEntry={secureEntry && !showPassword}
          {...props}
        />
        {secureEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 top-0 bottom-0 justify-center"
          >
            <Text className="text-secondary-text text-sm">
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text className="text-error text-xs mt-1">{error}</Text>}
    </View>
  );
}
