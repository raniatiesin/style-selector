-- Migration/Setup script for the paceman table in Supabase
-- This table stores Minecraft Paceman tracking metrics.

CREATE TABLE IF NOT EXISTS public.paceman (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Today Metrics
    today_runs integer DEFAULT 0 NOT NULL,
    today_completed integer DEFAULT 0 NOT NULL,
    today_avg_igt integer DEFAULT 0 NOT NULL, -- Stored as ms or seconds
    
    -- Total Metrics
    total_pb_igt integer DEFAULT 0 NOT NULL, -- Stored as ms or seconds
    total_avg_igt integer DEFAULT 0 NOT NULL,
    total_avg_nether integer DEFAULT 0 NOT NULL,
    total_avg_end integer DEFAULT 0 NOT NULL,
    
    -- Raw stats that might match your event payload
    total_runs integer DEFAULT 0 NOT NULL,
    completed_runs integer DEFAULT 0 NOT NULL,
    
    -- Additional metadata if needed
    session_id text
);

-- Optional: Enable Row Level Security if you plan on using public client access
ALTER TABLE public.paceman ENABLE ROW LEVEL SECURITY;

-- Optional: Create basic policy for inserts/selects if accessed through anon key
CREATE POLICY "Allow all public reads on paceman" 
ON public.paceman FOR SELECT 
TO public 
USING (true);

-- (If only your Node.js server with the service_role key inserts to this table, 
-- you don't need an INSERT policy, RLS naturally blocks public inserts).
