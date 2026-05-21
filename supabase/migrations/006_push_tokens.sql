-- 006_push_tokens.sql
-- Stores Expo push tokens so friends can receive workout-start notifications.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id   UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token     TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Each user can only manage their own token
CREATE POLICY "Users manage own push token"
  ON public.push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service-role reads all tokens (used by Edge Function)
-- No extra policy needed; service role bypasses RLS.
