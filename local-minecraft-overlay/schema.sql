CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  date INTEGER NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  mc_version TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  run_type TEXT NOT NULL DEFAULT '',
  final_igt INTEGER NOT NULL DEFAULT 0,
  retimed_igt INTEGER NOT NULL DEFAULT 0,
  final_rta INTEGER NOT NULL DEFAULT 0,
  enter_nether_igt INTEGER NOT NULL DEFAULT 0,
  enter_end_igt INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);
CREATE INDEX IF NOT EXISTS idx_runs_completed ON runs(is_completed);
