-- Fresh schema for Minecraft Paceman tracking.
-- v3: Simplified — one row per game session.
-- Each row = one game played, with just the time played.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS public.paceman CASCADE;

CREATE TABLE public.paceman (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

    -- The time played for this game session (milliseconds)
    time_played_ms bigint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS paceman_created_at_idx ON public.paceman (created_at);

ALTER TABLE public.paceman ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all public reads on paceman" ON public.paceman;
CREATE POLICY "Allow all public reads on paceman"
ON public.paceman FOR SELECT
TO public
USING (true);