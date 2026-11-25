import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/shared/theme/colors';

import { DEFAULT_GYM_RADIUS, GYM_RADIUS_OPTIONS } from '../arrival';
import { localDayKey, useGymStore } from '../gym-store';

// Alert.alert não faz nada no react-native-web — usa os diálogos do navegador.
function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}

${message}`);
  else Alert.alert(title, message);
}

function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}

${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function GymSettingsCard() {
  const gym = useGymStore((s) => s.gym);
  const setGym = useGymStore((s) => s.setGym);
  const setLastPromptDay = useGymStore((s) => s.setLastPromptDay);
  const [busy, setBusy] = useState(false);

  async function saveCurrentLocation() {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showMessage(
          'Localização negada',
          'Permita o acesso à localização no navegador para o Anilha saber quando você está na academia.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGym({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        radius: gym?.radius ?? DEFAULT_GYM_RADIUS,
        savedAt: new Date().toISOString(),
      });
      // Você já está na academia: não pergunta "chegou?" agora mesmo.
      setLastPromptDay(localDayKey());
    } catch (e) {
      console.error('saveCurrentLocation', e);
      showMessage('Não foi possível obter a localização', 'Verifique se a localização está ligada e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function removeGym() {
    confirmAction('Remover academia?', 'Você deixa de receber o aviso ao chegar.', 'Remover', () => setGym(null));
  }

  return (
    <View className="bg-card rounded-2xl p-5 border border-border mt-4">
      <Text className="text-secondary-text text-xs font-semibold uppercase tracking-widest mb-4">Academia</Text>

      {!gym ? (
        <Text className="text-secondary-text text-sm leading-5">
          Salve o local da sua academia: quando você abrir o Anilha lá, ele pergunta se quer iniciar o treino do dia.
        </Text>
      ) : (
        <>
          <View className="flex-row items-center justify-between">
            <Text className="text-secondary-text text-sm">Local salvo</Text>
            <Text className="text-text text-sm font-medium">
              {new Date(gym.savedAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <Text className="text-secondary-text text-xs mt-2 leading-4">
            O aviso aparece ao abrir o app perto da academia (uma vez por dia).
          </Text>

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-2">
            Distância para avisar
          </Text>
          <View className="flex-row gap-2">
            {GYM_RADIUS_OPTIONS.map((r) => {
              const active = r === gym.radius;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setGym({ ...gym, radius: r })}
                  activeOpacity={0.75}
                  className="flex-1 h-9 rounded-lg items-center justify-center border"
                  style={{
                    backgroundColor: active ? Colors.primary : Colors.background,
                    borderColor: active ? Colors.primary : Colors.border,
                  }}
                >
                  <Text className="text-sm font-semibold" style={{ color: active ? Colors.white : Colors.secondaryText }}>
                    {r} m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <TouchableOpacity
        onPress={saveCurrentLocation}
        disabled={busy}
        activeOpacity={0.85}
        className="h-11 rounded-xl items-center justify-center mt-4"
        style={{ backgroundColor: Colors.primary, opacity: busy ? 0.7 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text className="font-bold text-sm" style={{ color: Colors.white }}>
            {gym ? 'Atualizar para minha localização atual' : 'Estou na academia · salvar local'}
          </Text>
        )}
      </TouchableOpacity>

      {gym && (
        <TouchableOpacity onPress={removeGym} activeOpacity={0.7} className="items-center mt-3">
          <Text className="text-sm" style={{ color: Colors.error }}>
            Remover academia
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
