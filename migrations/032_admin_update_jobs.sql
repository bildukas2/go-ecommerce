-- +goose Up
CREATE TABLE IF NOT EXISTS admin_update_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
  channel text NOT NULL CHECK (channel IN ('prod', 'dev')),
  current_version text NOT NULL DEFAULT '',
  latest_version text NOT NULL DEFAULT '',
  requested_by_email text NOT NULL DEFAULT '',
  command text NOT NULL DEFAULT '',
  log text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_update_jobs_status_triggered
  ON admin_update_jobs(status, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_update_jobs_triggered
  ON admin_update_jobs(triggered_at DESC);

-- +goose Down
DROP TABLE IF EXISTS admin_update_jobs;
