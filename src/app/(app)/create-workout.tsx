import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { generateId } from '@/lib/uuid';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { PRESET_TEMPLATES } from '@/modules/workouts/data/presets';
import type { Exercise, WorkoutDay } from '@/modules/workouts/types';
import { useWorkoutStore } from '@/store/workout-store';

// ─── Constants ─────────────────────────────────────────────────────────────

const WEEK_DAYS = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

const DAY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

type Step = 'template' | 'configure' | 'review';
const STEPS: Step[] = ['template', 'configure', 'review'];

const STEP_TITLES: Record<Step, string> = {
  template: 'Escolha o modelo',
  configure: 'Configure os treinos',
  review: 'Revisão',
};

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function CreateWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);
  const workouts = useWorkoutStore((s) => s.workouts);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);

  const allExercises = [...DEFAULT_EXERCISES, ...customExercises];

  const existingWorkout = id ? workouts.find((w) => w.id === id) : undefined;
  const isEditing = !!existingWorkout;

  // Step
  const [step, setStep] = useState<Step>(isEditing ? 'configure' : 'template');

  // Draft
  const [name, setName] = useState(existingWorkout?.name ?? '');
  const [days, setDays] = useState<WorkoutDay[]>(existingWorkout?.days ?? []);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Exercise picker modal
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscleId, setNewExerciseMuscleId] = useState<string | null>(null);
  const [weekdayError, setWeekdayError] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function getMuscleGroup(id: string) {
    return MUSCLE_GROUPS.find((m) => m.id === id);
  }

  function getExercise(id: string) {
    return allExercises.find((e) => e.id === id);
  }

  function getMuscleGroupNames(ids: string[]) {
    return ids.map((id) => getMuscleGroup(id)?.name ?? id);
  }

  function formatWeekDays(wds: string[]) {
    const order = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    const labels: Record<string, string> = {
      seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui',
      sex: 'Sex', sab: 'Sáb', dom: 'Dom',
    };
    return [...wds]
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((d) => labels[d])
      .join(', ');
  }

  function getDefaultExercisesForMuscles(muscleIds: string[]): string[] {
    return allExercises
      .filter((e) => muscleIds.includes(e.muscleGroupId))
      .slice(0, 2 * muscleIds.length)
      .map((e) => e.id);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  function selectTemplate(presetId: string | null) {
    const WEEK_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    if (!presetId) {
      setDays([
        {
          id: generateId(),
          label: 'A',
          muscleGroupIds: [],
          exerciseIds: [],
          weekDays: [],
        },
      ]);
      setName('');
    } else {
      const template = PRESET_TEMPLATES.find((p) => p.id === presetId);
      if (!template) return;
      setName(template.name);
      setDays(
        template.days.map((d, i) => ({
          id: generateId(),
          label: d.label,
          muscleGroupIds: d.muscleGroupIds,
          exerciseIds: getDefaultExercisesForMuscles(d.muscleGroupIds),
          weekDays: [WEEK_ORDER[i] ?? 'seg'],
        }))
      );
    }
    setWeekdayError(false);
    setExpandedDay(null);
    setStep('configure');
  }

  function toggleMuscleGroup(dayId: string, muscleId: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const has = d.muscleGroupIds.includes(muscleId);
        const newMuscles = has
          ? d.muscleGroupIds.filter((m) => m !== muscleId)
          : [...d.muscleGroupIds, muscleId];
        const filtered = d.exerciseIds.filter((eId) => {
          const ex = allExercises.find((e) => e.id === eId);
          return ex && newMuscles.includes(ex.muscleGroupId);
        });
        if (!has) {
          const added = allExercises
            .filter((e) => e.muscleGroupId === muscleId && !filtered.includes(e.id))
            .slice(0, 2)
            .map((e) => e.id);
          return { ...d, muscleGroupIds: newMuscles, exerciseIds: [...filtered, ...added] };
        }
        return { ...d, muscleGroupIds: newMuscles, exerciseIds: filtered };
      })
    );
  }

  function toggleExercise(dayId: string, exerciseId: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const has = d.exerciseIds.includes(exerciseId);
        return {
          ...d,
          exerciseIds: has
            ? d.exerciseIds.filter((e) => e !== exerciseId)
            : [...d.exerciseIds, exerciseId],
        };
      })
    );
  }

  function toggleWeekDay(dayId: string, weekDay: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const has = d.weekDays.includes(weekDay);
        return {
          ...d,
          weekDays: has ? d.weekDays.filter((w) => w !== weekDay) : [...d.weekDays, weekDay],
        };
      })
    );
  }

  function addDay() {
    const nextLabel = DAY_LABELS[days.length] ?? `${days.length + 1}`;
    setDays((prev) => [
      ...prev,
      {
        id: generateId(),
        label: nextLabel,
        muscleGroupIds: [],
        exerciseIds: [],
        weekDays: [],
      },
    ]);
  }

  function removeDay(dayId: string) {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
    if (expandedDay === dayId) setExpandedDay(null);
  }

  function handleCreateCustomExercise() {
    if (!newExerciseName.trim() || !newExerciseMuscleId) return;
    const ex: Exercise = {
      id: generateId(),
      name: newExerciseName.trim(),
      muscleGroupId: newExerciseMuscleId,
      isCustom: true,
    };
    addCustomExercise(ex);
    if (pickerDayId) toggleExercise(pickerDayId, ex.id);
    setNewExerciseName('');
    setNewExerciseMuscleId(null);
    setShowCreateExercise(false);
  }

  function closePickerModal() {
    setPickerDayId(null);
    setExerciseSearch('');
    setShowCreateExercise(false);
    setNewExerciseName('');
    setNewExerciseMuscleId(null);
  }

  function handleSave() {
    if (isEditing && existingWorkout) {
      updateWorkout({ ...existingWorkout, name: name.trim() || 'Meu Treino', days });
    } else {
      addWorkout({
        id: generateId(),
        name: name.trim() || 'Meu Treino',
        days,
        createdAt: new Date().toISOString(),
      });
    }
    router.back();
  }

  function goBack() {
    if (step === 'configure' && isEditing) {
      router.back();
    } else if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1]);
    } else {
      router.back();
    }
  }

  function goNext() {
    if (step === 'configure') {
      const missing = days.some((d) => d.weekDays.length === 0);
      if (missing) {
        setWeekdayError(true);
        return;
      }
      setWeekdayError(false);
    }
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }

  // ─── Exercise Picker ──────────────────────────────────────────────────────

  const pickerDay = days.find((d) => d.id === pickerDayId);
  const pickerMuscleIds = pickerDay?.muscleGroupIds ?? [];

  const filteredExercises = allExercises.filter((e) => {
    if (exerciseSearch.trim()) {
      return e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    }
    return pickerMuscleIds.length === 0 || pickerMuscleIds.includes(e.muscleGroupId);
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-3 border-b border-border">
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          className="w-8 h-8 items-center justify-center mr-3"
        >
          <Text className="text-text text-xl">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text text-lg font-bold">
            {isEditing && step === 'configure' ? 'Editar treino' : STEP_TITLES[step]}
          </Text>
          {step !== 'template' && (
            <Text className="text-secondary-text text-xs">
              {isEditing ? 'Editando' : `Etapa ${stepIndex} de 2`}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="w-8 h-8 rounded-full bg-card items-center justify-center"
        >
          <Text className="text-secondary-text">✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {step !== 'template' && (
        <View className="flex-row gap-1.5 px-5 py-2.5">
          {[1, 2].map((i) => (
            <View
              key={i}
              className={`flex-1 h-1 rounded-full ${stepIndex >= i ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </View>
      )}

      {/* ── Step: template ─────────────────────────────────────────────── */}
      {step === 'template' && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-secondary-text text-sm mb-5">
            Selecione como deseja organizar seus treinos
          </Text>

          {/* Do zero */}
          <TouchableOpacity
            onPress={() => selectTemplate(null)}
            activeOpacity={0.8}
            className="bg-card rounded-2xl p-5 border border-border mb-5 flex-row items-center gap-4"
          >
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#D6282822' }}
            >
              <Text className="text-2xl">✦</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-base mb-0.5">Do zero</Text>
              <Text className="text-secondary-text text-sm">Configure do jeito que quiser</Text>
            </View>
            <Text className="text-secondary-text text-xl">›</Text>
          </TouchableOpacity>

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-widest mb-3">
            Modelos prontos
          </Text>

          {PRESET_TEMPLATES.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              onPress={() => selectTemplate(preset.id)}
              activeOpacity={0.8}
              className="bg-card rounded-2xl p-5 border border-border mb-3 flex-row items-center gap-4"
            >
              <View className="w-12 h-12 rounded-xl bg-border items-center justify-center">
                <Text className="text-text font-bold text-xs" numberOfLines={1}>
                  {preset.name.split(' ')[0]}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base mb-0.5">{preset.name}</Text>
                <Text className="text-secondary-text text-xs mb-1.5">{preset.description}</Text>
                <View className="flex-row gap-1.5 flex-wrap">
                  {preset.days.map((d) => (
                    <View key={d.label} className="bg-background rounded-md px-2 py-0.5">
                      <Text className="text-secondary-text text-xs">{d.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text className="text-secondary-text text-xl">›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Step: configure ────────────────────────────────────────────── */}
      {step === 'configure' && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View className="mb-5">
            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-widest mb-2">
              Nome do treino
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Projeto Verão, Hipertrofia..."
              placeholderTextColor="#A0A0A0"
              className="h-14 bg-card rounded-xl px-4 text-text text-base border border-border"
              autoFocus
            />
          </View>

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-widest mb-3">
            Dias de treino
          </Text>

          {days.map((day) => {
            const isExpanded = expandedDay === day.id;
            const dayExercises = allExercises.filter((e) =>
              day.muscleGroupIds.includes(e.muscleGroupId)
            );

            return (
              <View
                key={day.id}
                className="bg-card rounded-2xl border mb-3 overflow-hidden"
                style={{
                  borderColor:
                    weekdayError && day.weekDays.length === 0 ? '#FF4D4D' : '#2A2A2A',
                }}
              >
                {/* Day header row */}
                <TouchableOpacity
                  onPress={() => setExpandedDay(isExpanded ? null : day.id)}
                  activeOpacity={0.8}
                  className="flex-row items-center p-4 gap-3"
                >
                  <View className="w-9 h-9 rounded-lg bg-primary items-center justify-center">
                    <Text className="text-white font-bold text-xs">{day.label}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text font-semibold text-sm" numberOfLines={1}>
                      {day.muscleGroupIds.length > 0
                        ? getMuscleGroupNames(day.muscleGroupIds).join(' + ')
                        : 'Selecione grupos musculares'}
                    </Text>
                    <Text className="text-secondary-text text-xs mt-0.5">
                      {day.exerciseIds.length > 0
                        ? `${day.exerciseIds.length} exercício${day.exerciseIds.length > 1 ? 's' : ''}`
                        : 'Nenhum exercício'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {days.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeDay(day.id)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="w-7 h-7 rounded-full bg-background items-center justify-center"
                      >
                        <Text className="text-secondary-text text-sm">✕</Text>
                      </TouchableOpacity>
                    )}
                    <Text className="text-secondary-text text-sm">
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded */}
                {isExpanded && (
                  <View className="px-4 pb-4 border-t border-border">
                    {/* Muscle group chips */}
                    <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-3 mb-2">
                      Grupos musculares
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {MUSCLE_GROUPS.map((muscle) => {
                        const active = day.muscleGroupIds.includes(muscle.id);
                        return (
                          <TouchableOpacity
                            key={muscle.id}
                            onPress={() => toggleMuscleGroup(day.id, muscle.id)}
                            activeOpacity={0.7}
                            className="rounded-full px-4 py-2 border"
                            style={{
                              backgroundColor: active ? muscle.color + '22' : '#1E1E1E',
                              borderColor: active ? muscle.color : '#2A2A2A',
                            }}
                          >
                            <Text
                              className="text-sm font-medium"
                              style={{ color: active ? muscle.color : '#A0A0A0' }}
                            >
                              {muscle.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Exercise chips */}
                    {day.muscleGroupIds.length > 0 && (
                      <>
                        <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-4 mb-2">
                          Exercícios
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {dayExercises.map((ex) => {
                            const selected = day.exerciseIds.includes(ex.id);
                            const muscle = getMuscleGroup(ex.muscleGroupId);
                            const color = muscle?.color ?? '#D62828';
                            return (
                              <TouchableOpacity
                                key={ex.id}
                                onPress={() => toggleExercise(day.id, ex.id)}
                                activeOpacity={0.7}
                                className="rounded-full px-3 py-1.5 border"
                                style={{
                                  backgroundColor: selected ? color + '22' : '#121212',
                                  borderColor: selected ? color : '#2A2A2A',
                                }}
                              >
                                <Text
                                  className="text-xs"
                                  style={{ color: selected ? color : '#A0A0A0' }}
                                >
                                  {ex.name}
                                  {ex.isCustom ? ' ★' : ''}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}

                    {/* Add exercise button */}
                    <TouchableOpacity
                      onPress={() => {
                        setPickerDayId(day.id);
                        setExerciseSearch('');
                      }}
                      activeOpacity={0.7}
                      className="mt-3 self-start"
                    >
                      <Text className="text-primary text-sm font-medium">
                        + Adicionar exercício
                      </Text>
                    </TouchableOpacity>

                    <View className="mt-4 pt-3 border-t border-border">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider">
                          Dias da semana
                        </Text>
                        {weekdayError && day.weekDays.length === 0 && (
                          <Text className="text-error text-xs font-medium">Obrigatório</Text>
                        )}
                      </View>
                      <View className="flex-row gap-1.5">
                        {WEEK_DAYS.map((wd) => {
                          const active = day.weekDays.includes(wd.key);
                          return (
                            <TouchableOpacity
                              key={wd.key}
                              onPress={() => toggleWeekDay(day.id, wd.key)}
                              activeOpacity={0.7}
                              className="flex-1 h-9 rounded-lg items-center justify-center border"
                              style={{
                                backgroundColor: active ? '#D62828' : '#121212',
                                borderColor: active ? '#D62828' : '#2A2A2A',
                              }}
                            >
                              <Text
                                className="text-xs font-semibold"
                                style={{ color: active ? '#FFFFFF' : '#A0A0A0' }}
                              >
                                {wd.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {day.weekDays.length > 0 && (
                        <Text className="text-primary text-xs mt-1.5">
                          {formatWeekDays(day.weekDays)}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* Add day */}
          <TouchableOpacity
            onPress={addDay}
            activeOpacity={0.7}
            className="border border-dashed border-border rounded-2xl py-4 items-center mb-4"
          >
            <Text className="text-secondary-text text-sm">+ Adicionar dia de treino</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Step: review ───────────────────────────────────────────────── */}
      {step === 'review' && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Name card */}
          <View className="bg-card rounded-2xl border border-border p-5 mb-4">
            <Text className="text-secondary-text text-xs uppercase tracking-wider mb-1">
              Nome do treino
            </Text>
            <Text className="text-text text-xl font-bold">{name || 'Meu Treino'}</Text>
            <Text className="text-secondary-text text-sm mt-1">
              {days.length} dia{days.length > 1 ? 's' : ''} de treino
            </Text>
          </View>

          {days.map((day) => (
            <View key={day.id} className="bg-card rounded-2xl border border-border p-4 mb-3">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center">
                  <Text className="text-white font-bold text-xs">{day.label}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text font-semibold text-sm">
                    {day.muscleGroupIds.length > 0
                      ? getMuscleGroupNames(day.muscleGroupIds).join(' + ')
                      : `Treino ${day.label}`}
                  </Text>
                  {day.weekDays.length > 0 ? (
                    <Text className="text-primary text-xs mt-0.5">
                      {formatWeekDays(day.weekDays)}
                    </Text>
                  ) : (
                    <Text className="text-secondary-text text-xs mt-0.5">
                      Sem dias definidos
                    </Text>
                  )}
                </View>
              </View>

              {day.exerciseIds.length > 0 && (
                <View className="gap-1.5 pl-11">
                  {day.exerciseIds.map((exId) => {
                    const ex = getExercise(exId);
                    if (!ex) return null;
                    const muscle = getMuscleGroup(ex.muscleGroupId);
                    return (
                      <View key={exId} className="flex-row items-center gap-2">
                        <View
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: muscle?.color ?? '#D62828' }}
                        />
                        <Text className="text-secondary-text text-sm">
                          {ex.name}
                          {ex.isCustom ? ' ★' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {step !== 'template' && (
        <View className="px-5 pb-8 pt-3 border-t border-border">
          {step === 'configure' && weekdayError && (
            <Text className="text-error text-xs text-center mb-2">
              Selecione ao menos um dia da semana para cada treino
            </Text>
          )}
          <TouchableOpacity
            onPress={step === 'review' ? handleSave : goNext}
            activeOpacity={0.85}
            disabled={step === 'configure' && !name.trim()}
            className="h-14 rounded-xl items-center justify-center bg-primary"
            style={
              step === 'configure' && !name.trim() ? { opacity: 0.4 } : undefined
            }
          >
            <Text className="text-white font-bold text-base">
              {step === 'review' ? 'Salvar treino' : 'Continuar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Exercise Picker Modal ───────────────────────────────────────── */}
      <Modal
        visible={pickerDayId !== null}
        transparent
        animationType="slide"
        onRequestClose={closePickerModal}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View className="bg-card rounded-t-3xl" style={{ maxHeight: '82%' }}>
            {/* Modal header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
              <Text className="text-text font-bold text-lg">Adicionar exercício</Text>
              <TouchableOpacity
                onPress={closePickerModal}
                activeOpacity={0.7}
                className="w-8 h-8 rounded-full bg-background items-center justify-center"
              >
                <Text className="text-secondary-text">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View className="px-5 py-3 border-b border-border">
              <TextInput
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                placeholder="Buscar exercício..."
                placeholderTextColor="#A0A0A0"
                className="h-10 bg-background rounded-xl px-4 text-text text-sm border border-border"
              />
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredExercises.length === 0 && (
                <Text className="text-secondary-text text-sm text-center py-6">
                  Nenhum exercício encontrado
                </Text>
              )}

              {filteredExercises.map((ex) => {
                const isSelected = pickerDay?.exerciseIds.includes(ex.id) ?? false;
                const muscle = getMuscleGroup(ex.muscleGroupId);
                const color = muscle?.color ?? '#D62828';
                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => pickerDayId && toggleExercise(pickerDayId, ex.id)}
                    activeOpacity={0.7}
                    className="rounded-xl mb-2 border overflow-hidden"
                    style={{
                      backgroundColor: isSelected ? color + '18' : '#121212',
                      borderColor: isSelected ? color : '#2A2A2A',
                    }}
                  >
                    {ex.gif && (
                      <Image
                        source={ex.gif}
                        style={{ width: '100%', height: 140 }}
                        contentFit="contain"
                      />
                    )}
                    <View className="flex-row items-center justify-between p-3">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <Text className="text-text text-sm flex-1">
                          {ex.name}
                          {ex.isCustom ? ' ★' : ''}
                        </Text>
                        <Text className="text-secondary-text text-xs">
                          {getMuscleGroup(ex.muscleGroupId)?.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text className="text-sm font-bold ml-2" style={{ color }}>
                          ✓
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Create custom exercise */}
              {!showCreateExercise ? (
                <TouchableOpacity
                  onPress={() => setShowCreateExercise(true)}
                  activeOpacity={0.7}
                  className="mt-2 border border-dashed border-border rounded-xl py-3.5 items-center"
                >
                  <Text className="text-primary text-sm font-medium">
                    + Criar exercício personalizado
                  </Text>
                </TouchableOpacity>
              ) : (
                <View className="mt-2 bg-background rounded-xl border border-border p-4 gap-3">
                  <Text className="text-text font-semibold text-sm">Novo exercício</Text>
                  <TextInput
                    value={newExerciseName}
                    onChangeText={setNewExerciseName}
                    placeholder="Nome do exercício"
                    placeholderTextColor="#A0A0A0"
                    className="h-11 bg-card rounded-lg px-3 text-text text-sm border border-border"
                    autoFocus
                  />
                  <Text className="text-secondary-text text-xs font-medium">
                    Grupo muscular
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {MUSCLE_GROUPS.map((m) => {
                      const active = newExerciseMuscleId === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => setNewExerciseMuscleId(m.id)}
                          activeOpacity={0.7}
                          className="rounded-full px-3 py-1.5 border"
                          style={{
                            backgroundColor: active ? m.color + '22' : '#1E1E1E',
                            borderColor: active ? m.color : '#2A2A2A',
                          }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: active ? m.color : '#A0A0A0' }}
                          >
                            {m.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setShowCreateExercise(false);
                        setNewExerciseName('');
                        setNewExerciseMuscleId(null);
                      }}
                      activeOpacity={0.7}
                      className="flex-1 h-10 rounded-lg items-center justify-center border border-border"
                    >
                      <Text className="text-secondary-text text-sm">Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCreateCustomExercise}
                      activeOpacity={0.7}
                      disabled={!newExerciseName.trim() || !newExerciseMuscleId}
                      className="flex-1 h-10 rounded-lg items-center justify-center bg-primary"
                      style={
                        !newExerciseName.trim() || !newExerciseMuscleId
                          ? { opacity: 0.4 }
                          : undefined
                      }
                    >
                      <Text className="text-white text-sm font-semibold">Criar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
