import type { PresetTemplate } from '../types';

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'abc',
    name: 'ABC',
    description: '3 dias · Divisão clássica',
    days: [
      { label: 'A', muscleGroupIds: ['chest', 'triceps'] },
      { label: 'B', muscleGroupIds: ['back', 'biceps'] },
      { label: 'C', muscleGroupIds: ['shoulders', 'legs'] },
    ],
  },
  {
    id: 'abcd',
    name: 'ABCD',
    description: '4 dias · Foco em isolamento',
    days: [
      { label: 'A', muscleGroupIds: ['chest'] },
      { label: 'B', muscleGroupIds: ['back'] },
      { label: 'C', muscleGroupIds: ['shoulders', 'biceps'] },
      { label: 'D', muscleGroupIds: ['legs', 'glutes'] },
    ],
  },
  {
    id: 'abcde',
    name: 'ABCDE',
    description: '5 dias · Alta frequência',
    days: [
      { label: 'A', muscleGroupIds: ['chest', 'triceps'] },
      { label: 'B', muscleGroupIds: ['back', 'biceps'] },
      { label: 'C', muscleGroupIds: ['shoulders'] },
      { label: 'D', muscleGroupIds: ['legs'] },
      { label: 'E', muscleGroupIds: ['glutes', 'core'] },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: '3 dias · Empurrar, Puxar, Pernas',
    days: [
      { label: 'Push', muscleGroupIds: ['chest', 'shoulders', 'triceps'] },
      { label: 'Pull', muscleGroupIds: ['back', 'biceps'] },
      { label: 'Legs', muscleGroupIds: ['legs', 'glutes'] },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: '2 dias · Superior e Inferior',
    days: [
      { label: 'Upper', muscleGroupIds: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { label: 'Lower', muscleGroupIds: ['legs', 'glutes', 'core'] },
    ],
  },
  {
    id: 'fullbody',
    name: 'Full Body',
    description: '1 dia · Corpo inteiro',
    days: [
      {
        label: 'Full',
        muscleGroupIds: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs'],
      },
    ],
  },
];
