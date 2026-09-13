-- Up Migration

-- TASK-021: a Postgres-backed report-endpoint rate limiter
-- (docs/adr/0016-report-rate-limiting.md). `client_key` is a SHA-256 hash
-- of the requester's IP, never the raw address; `window_start` is the
-- hour boundary the count belongs to. Rows older than the retention
-- period are deleted on every write (lib/reports/rate-limit.ts), so this
-- table never accumulates more than about a day's worth of counters.
CREATE TABLE report_rate_limit_windows (
  client_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_key, window_start)
);

-- Down Migration

DROP TABLE report_rate_limit_windows;
