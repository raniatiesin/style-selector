-- Fresh schema for Minecraft Paceman tracking.
-- Drops the old structure and recreates a run-focused table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS public.paceman CASCADE;

CREATE TABLE public.paceman (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

    -- World identity
    world_id text NOT NULL UNIQUE,
    world_name text NOT NULL DEFAULT '',
    world_path text NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,

    -- Run classification
    run_type text NOT NULL DEFAULT 'unknown',
    start_gamemode text NOT NULL DEFAULT 'unknown',
    is_completed boolean NOT NULL DEFAULT false,

    -- Timings (milliseconds)
    final_igt integer NOT NULL DEFAULT 0,
    enter_nether_igt integer NOT NULL DEFAULT 0,
    enter_end_igt integer NOT NULL DEFAULT 0,
    observed_duration_ms bigint NOT NULL DEFAULT 0,

    -- Optional rollups for daily/overall reporting
    today_runs integer NOT NULL DEFAULT 0,
    today_completed integer NOT NULL DEFAULT 0,
    today_avg_igt integer NOT NULL DEFAULT 0,
    total_runs integer NOT NULL DEFAULT 0,
    completed_runs integer NOT NULL DEFAULT 0,
    total_pb_igt integer NOT NULL DEFAULT 0,
    total_avg_igt integer NOT NULL DEFAULT 0,
    total_avg_nether integer NOT NULL DEFAULT 0,
    total_avg_end integer NOT NULL DEFAULT 0,

    raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    session_id text
);

CREATE INDEX IF NOT EXISTS paceman_date_idx ON public.paceman (date);
CREATE INDEX IF NOT EXISTS paceman_run_type_idx ON public.paceman (run_type);
CREATE INDEX IF NOT EXISTS paceman_start_gamemode_idx ON public.paceman (start_gamemode);

ALTER TABLE public.paceman ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all public reads on paceman" ON public.paceman;
CREATE POLICY "Allow all public reads on paceman"
ON public.paceman FOR SELECT
TO public
USING (true);
