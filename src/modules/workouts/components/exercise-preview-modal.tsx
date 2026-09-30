import { Image } from 'expo-image';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { MUSCLE_GROUPS } from '../data/muscle-groups';
import type { Exercise } from '../types';

interface ExercisePreviewModalProps {
  exercise: Exercise | null;
  dayLabel: string;
  selected: boolean;
  uploadingGif: boolean;
  onToggle: () => void;
  onAddGif: () => void;
  onClose: () => void;
}

// Gif do exercício em tamanho grande, para o usuário ver o movimento antes de
// colocá-lo no treino.
export function ExercisePreviewModal({
  exercise,
  dayLabel,
  selected,
  uploadingGif,
  onToggle,
  onAddGif,
  onClose,
}: ExercisePreviewModalProps) {
  const muscle = exercise ? MUSCLE_GROUPS.find((m) => m.id === exercise.muscleGroupId) : undefined;

  return (
    <Modal visible={exercise !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center px-5"
        style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      >
        {exercise && (
          // Pressable interno "engole" o toque para não fechar ao tocar no card.
          <Pressable onPress={() => {}} className="bg-card rounded-2xl w-full border border-border overflow-hidden" style={{ maxWidth: 480 }}>
            <View className="flex-row items-center px-4 py-3 border-b border-border">
              <View className="flex-1">
                <Text className="text-text font-bold text-base" numberOfLines={2}>
                  {exercise.name}
                  {exercise.isCustom ? ' ★' : ''}
                </Text>
                {muscle && (
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: muscle.color }} />
                    <Text className="text-secondary-text text-xs">{muscle.name}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                className="w-8 h-8 rounded-full bg-background items-center justify-center ml-3"
              >
                <Text className="text-secondary-text">✕</Text>
              </TouchableOpacity>
            </View>

            {exercise.gif ? (
              <Image
                source={exercise.gif}
                style={{ width: '100%', height: 300, backgroundColor: '#121212' }}
                contentFit="contain"
              />
            ) : (
              <View className="items-center justify-center bg-background" style={{ height: 200 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🏋️</Text>
                <Text className="text-secondary-text text-sm mb-3">Este exercício ainda não tem gif</Text>
                <TouchableOpacity
                  onPress={onAddGif}
                  disabled={uploadingGif}
                  activeOpacity={0.7}
                  className="rounded-lg px-4 py-2 border border-primary"
                >
                  {uploadingGif ? (
                    <ActivityIndicator color="#D62828" size="small" />
                  ) : (
                    <Text className="text-primary text-sm font-medium">+ Adicionar gif</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View className="p-4">
              <TouchableOpacity
                onPress={onToggle}
                activeOpacity={0.85}
                className="h-12 rounded-xl items-center justify-center border"
                style={{
                  backgroundColor: selected ? 'transparent' : '#D62828',
                  borderColor: selected ? '#2A2A2A' : '#D62828',
                }}
              >
                <Text className="font-bold text-sm" style={{ color: selected ? '#A0A0A0' : '#FFFFFF' }}>
                  {selected ? `Remover do Treino ${dayLabel}` : `+ Adicionar ao Treino ${dayLabel}`}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}
