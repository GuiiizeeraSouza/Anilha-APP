import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useWorkoutStore } from '@/store/workout-store';

export default function ManageWorkoutsScreen() {
  const router = useRouter();
  const workouts = useWorkoutStore((s) => s.workouts);
  const removeWorkout = useWorkoutStore((s) => s.removeWorkout);

  function getMuscleGroupName(id: string) {
    return MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id;
  }

  function getMuscleGroupColor(id: string) {
    return MUSCLE_GROUPS.find((m) => m.id === id)?.color ?? '#D62828';
  }

  const WEEK_DAY_LABELS: Record<string, string> = {
    seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui',
    sex: 'Sex', sab: 'Sáb', dom: 'Dom',
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="w-8 h-8 items-center justify-center mr-3"
        >
          <Text className="text-text text-xl">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text text-lg font-bold">Meus treinos</Text>
          <Text className="text-secondary-text text-xs">
            {workouts.length} treino{workouts.length !== 1 ? 's' : ''} criado{workouts.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/create-workout')}
          activeOpacity={0.8}
          className="bg-primary rounded-xl px-4 h-9 items-center justify-center"
        >
          <Text className="text-white text-xs font-bold">＋ Novo</Text>
        </TouchableOpacity>
      </View>

      {workouts.length === 0 ? (
        /* Empty state */
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">🏋️</Text>
          <Text className="text-text text-lg font-bold mb-2 text-center">
            Nenhum treino criado
          </Text>
          <Text className="text-secondary-text text-sm text-center mb-6 leading-5">
            Crie seu primeiro treino e comece a acompanhar sua evolução.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/create-workout')}
            activeOpacity={0.85}
            className="bg-primary rounded-xl px-6 py-3"
          >
            <Text className="text-white font-bold text-sm">Criar primeiro treino</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {workouts.map((workout) => (
            <View
              key={workout.id}
              className="bg-card rounded-2xl border border-border mb-4 overflow-hidden"
            >
              {/* Workout header */}
              <View className="px-4 pt-4 pb-3 border-b border-border flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-text font-bold text-base">{workout.name}</Text>
                  <Text className="text-secondary-text text-xs mt-0.5">
                    {workout.days.length} dia{workout.days.length !== 1 ? 's' : ''} de treino
                  </Text>
                </View>
                <View className="flex-row items-center gap-2 mt-0.5">
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: '/(app)/create-workout', params: { id: workout.id } })
                    }
                    activeOpacity={0.7}
                    className="bg-border rounded-lg px-3 h-7 items-center justify-center"
                  >
                    <Text className="text-text text-xs font-medium">Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeWorkout(workout.id)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-7 h-7 rounded-full bg-background items-center justify-center"
                  >
                    <Text className="text-secondary-text text-xs">✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Days list */}
              <View className="px-4 py-3 gap-3">
                {workout.days.map((day) => (
                  <View key={day.id} className="flex-row gap-3 items-start">
                    {/* Day badge */}
                    <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center mt-0.5">
                      <Text className="text-white font-bold text-xs">{day.label}</Text>
                    </View>

                    <View className="flex-1">
                      {/* Muscle groups */}
                      {day.muscleGroupIds.length > 0 ? (
                        <View className="flex-row flex-wrap gap-1.5 mb-1">
                          {day.muscleGroupIds.map((mgId) => {
                            const color = getMuscleGroupColor(mgId);
                            return (
                              <View
                                key={mgId}
                                className="rounded-full px-2.5 py-0.5"
                                style={{ backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66' }}
                              >
                                <Text className="text-xs font-medium" style={{ color }}>
                                  {getMuscleGroupName(mgId)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text className="text-secondary-text text-xs mb-1">Sem grupos definidos</Text>
                      )}

                      {/* Week days */}
                      {day.weekDays.length > 0 && (
                        <View className="flex-row gap-1 flex-wrap">
                          {day.weekDays.map((wd) => (
                            <View key={wd} className="bg-background rounded-md px-2 py-0.5">
                              <Text className="text-secondary-text text-xs">
                                {WEEK_DAY_LABELS[wd] ?? wd}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
