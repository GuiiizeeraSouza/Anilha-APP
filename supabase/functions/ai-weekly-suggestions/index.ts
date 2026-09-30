// Supabase Edge Function: ai-weekly-suggestions
// Gera sugestões de treino para a semana (ajuste de carga, frequência etc.)
// a partir do histórico do usuário, usando o Gemini. A chave do Gemini fica
// só aqui no servidor (secret GEMINI_API_KEY) — nunca no app.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_EXERCISES = 40;
const MAX_DAYS = 14;
const MAX_HISTORY_POINTS = 8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Formato de entrada (montado pelo app em src/modules/evolution/ai-suggestions.ts) ──

type WeekInput = {
  today: string; // YYYY-MM-DD
  weekday: string;
  daysTrainedThisWeek: number;
  daysScheduledPerWeek: number;
  minutesThisWeek: number;
  streakDays: number;
};

type DayInput = {
  workout: string;
  day: string;
  muscles: string[];
  weekdays: string[];
  sessionsLast4Weeks: number;
  daysSinceLastSession: number | null;
  avgMinutes: number | null;
};

type ExerciseInput = {
  name: string;
  muscle: string;
  days: string[];
  sets: number;
  reps: number;
  currentWeightKg: number;
  weightHistory: { date: string; kg: number }[];
  timesDoneLast4Weeks: number;
};

type SuggestionsInput = { week: WeekInput; days: DayInput[]; exercises: ExerciseInput[] };

const KINDS = ['increase', 'maintain', 'decrease', 'consistency', 'recovery', 'tip'] as const;

type Suggestion = {
  kind: (typeof KINDS)[number];
  title: string;
  detail: string;
  exerciseName: string | null;
  currentWeightKg: number | null;
  suggestedWeightKg: number | null;
};

const SYSTEM_PROMPT = `Você é um personal trainer experiente em musculação. Você recebe o histórico de treino de um aluno em JSON e devolve de 3 a 5 sugestões práticas e seguras para a semana atual.

Regras de progressão de carga:
- Só sugira aumentar a carga de um exercício quando o histórico mostra a mesma carga (ou quase) em pelo menos 2 registros e o aluno está fazendo o exercício com frequência.
- Incrementos: 1 a 2,5 kg em exercícios de membros superiores e isolados; 2,5 a 5 kg em exercícios grandes de pernas e costas (agachamento, leg press, terra, remadas pesadas). Nunca mais que 10% da carga atual. Use múltiplos de 0,5 kg.
- Se a carga caiu recentemente, ou o aluno quase não fez o exercício nas últimas semanas, sugira manter (kind "maintain") e consolidar a técnica.
- Exercícios com carga 0 são de peso corporal: sugira progressão em repetições, nunca em kg.
- Não invente dados. Use apenas exercícios da lista, com o nome exatamente como veio.

Outras sugestões possíveis:
- "consistency": dias programados que não estão sendo feitos, ou treinos (dias) parados há muito tempo.
- "recovery": sequência longa sem descanso ou grupos treinados com frequência excessiva.
- "tip": outra dica objetiva baseada nos dados.

Formato:
- title: curto (até 40 caracteres), ex: "Supino Reto: +2,5 kg".
- detail: 1 ou 2 frases explicando o porquê com base nos dados do aluno.
- currentWeightKg e suggestedWeightKg: preencha só em sugestões de carga ("increase", "maintain", "decrease") de um exercício com carga; senão null.
- exerciseName: nome do exercício, ou null para sugestões gerais.
- Ordene da mais importante para a menos importante.
- Português do Brasil, tom direto e motivador, sem markdown.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: [...KINDS] },
          title: { type: 'STRING' },
          detail: { type: 'STRING' },
          exerciseName: { type: 'STRING', nullable: true },
          currentWeightKg: { type: 'NUMBER', nullable: true },
          suggestedWeightKg: { type: 'NUMBER', nullable: true },
        },
        required: ['kind', 'title', 'detail', 'exerciseName', 'currentWeightKg', 'suggestedWeightKg'],
      },
    },
  },
  required: ['suggestions'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeInput(raw: unknown): SuggestionsInput | null {
  const input = raw as Partial<SuggestionsInput> | null;
  if (!input || typeof input !== 'object' || !input.week || !Array.isArray(input.exercises)) return null;
  return {
    week: input.week,
    days: (Array.isArray(input.days) ? input.days : []).slice(0, MAX_DAYS),
    exercises: input.exercises.slice(0, MAX_EXERCISES).map((ex) => ({
      ...ex,
      weightHistory: (Array.isArray(ex.weightHistory) ? ex.weightHistory : []).slice(-MAX_HISTORY_POINTS),
    })),
  };
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeSuggestions(raw: unknown): Suggestion[] {
  const list = (raw as { suggestions?: unknown[] } | null)?.suggestions;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => item as Record<string, unknown>)
    .filter(
      (s) =>
        KINDS.includes(s.kind as Suggestion['kind']) &&
        typeof s.title === 'string' &&
        typeof s.detail === 'string',
    )
    .slice(0, 5)
    .map((s) => ({
      kind: s.kind as Suggestion['kind'],
      title: (s.title as string).trim(),
      detail: (s.detail as string).trim(),
      exerciseName: typeof s.exerciseName === 'string' && s.exerciseName.trim() ? s.exerciseName.trim() : null,
      currentWeightKg: toNumberOrNull(s.currentWeightKg),
      suggestedWeightKg: toNumberOrNull(s.suggestedWeightKg),
    }));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Só usuários logados (evita que qualquer um gaste a cota do Gemini).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Não autenticado.' }, 401);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY não configurada na Edge Function.' }, 500);

    const input = sanitizeInput(await req.json().catch(() => null));
    if (!input) return json({ error: 'Dados de treino inválidos.' }, 400);

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Histórico de treino do aluno:\n${JSON.stringify(input)}` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = (await geminiRes.json().catch(() => ({}))) as { error?: { message?: string } };
      console.error('Gemini error', geminiRes.status, err);
      return json({ error: 'Não foi possível gerar as sugestões agora. Tente novamente em instantes.' }, 502);
    }

    const data = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Resposta do Gemini não é JSON', text);
    }

    const suggestions = sanitizeSuggestions(parsed);
    if (suggestions.length === 0) {
      return json({ error: 'A IA não retornou sugestões. Tente novamente.' }, 502);
    }
    return json({ suggestions });
  } catch (err) {
    console.error(err);
    return json({ error: 'Erro inesperado ao gerar sugestões.' }, 500);
  }
});
