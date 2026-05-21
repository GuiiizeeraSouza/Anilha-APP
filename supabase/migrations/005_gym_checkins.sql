-- ============================================================
-- 005_gym_checkins.sql  –  Gym check-ins with photo timeline
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gym_checkins (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_url  TEXT,
  caption    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gym_checkins ENABLE ROW LEVEL SECURITY;

-- ── 2. RLS Policies ───────────────────────────────────────────────────────────

-- Users can insert their own check-ins
CREATE POLICY "checkins: user can insert own"
  ON public.gym_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own check-ins + friends' check-ins
CREATE POLICY "checkins: user can view own and friends"
  ON public.gym_checkins FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = auth.uid() AND fr.receiver_id = gym_checkins.user_id)
          OR (fr.receiver_id = auth.uid() AND fr.sender_id = gym_checkins.user_id)
        )
    )
  );

-- Users can delete their own check-ins
CREATE POLICY "checkins: user can delete own"
  ON public.gym_checkins FOR DELETE
  USING (auth.uid() = user_id);

-- ── 3. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS gym_checkins_user_id_created_at_idx
  ON public.gym_checkins (user_id, created_at DESC);

-- ── 4. Storage bucket (run manually in Supabase Dashboard) ───────────────────
-- 1. Go to Storage > New bucket > name: "checkins" > Public bucket: ON
-- 2. Add RLS policy on storage.objects for bucket "checkins":
--    INSERT: (auth.uid()::text = (storage.foldername(name))[1])
--    SELECT: true  (public read)
--    DELETE: (auth.uid()::text = (storage.foldername(name))[1])
