const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface WorkoutAnalysisContext {
  todayWorkoutName: string | null;
  todayDayLabel: string | null;
  todayMuscleGroups: string[];
  todayExercises: string[];
  weekDoneCount: number;
  weekScheduledCount: number;
  weekTimeLabel: string;
  streak: number;
}

export async function analyzeWorkout(ctx: WorkoutAnalysisContext): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Chave do Gemini não configurada. Adicione EXPO_PUBLIC_GEMINI_API_KEY no arquivo .env e reinicie o app.\n\nObtenhagrátis em: aistudio.google.com',
    );
  }

  const todayInfo = ctx.todayWorkoutName
    ? `- Treino de hoje: ${ctx.todayWorkoutName} · Treino ${ctx.todayDayLabel} (${ctx.todayMuscleGroups.join(', ')})
- Exercícios programados: ${ctx.todayExercises.join(', ') || 'nenhum'}`
    : '- Hoje é dia de descanso (sem treino programado)';

  const prompt = `Aqui estão meus dados de treino desta semana:

${todayInfo}
- Treinos feitos esta semana: ${ctx.weekDoneCount} de ${ctx.weekScheduledCount} programados
- Tempo total treinado: ${ctx.weekTimeLabel === '—' ? '0 minutos' : ctx.weekTimeLabel}
- Dias seguidos treinando: ${ctx.streak}

Faça uma análise rápida e motivadora: como estou indo na semana e dicas práticas para o treino de hoje. Use no máximo 3 parágrafos curtos, linguagem informal e animada.`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'Você é um personal trainer especializado em musculação e hipertrofia. Responda sempre em português brasileiro, de forma motivadora, direta e prática. Não use asteriscos nem markdown.',
          },
        ],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 450, temperature: 0.8 },
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erro ${res.status} ao conectar com o Gemini`);
  }

  const data = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates[0].content.parts[0].text.trim();
}
