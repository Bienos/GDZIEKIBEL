-- Up Migration

-- TASK-029: a Postgres-backed rate limiter for the analytics ingest
-- endpoint (docs/adr/0023-analytics-rate-limiting.md), closing the gap
-- docs/adr/0018-first-party-analytics.md named and deferred. Same shape
-- as report_rate_limit_windows (docs/adr/0016-report-rate-limiting.md):
-- client_key is a SHA-256 hash of the requester's IP, never the raw
-- address; window_start is the hour boundary the count belongs to. A
-- separate table, not a shared one with a scope column, so the two
-- endpoints' very different limits (5/hour for reports, much higher here)
-- never share one counter by accident.
CREATE TABLE analytics_rate_limit_windows (
  client_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_key, window_start)
);

-- Down Migration

DROP TABLE analytics_rate_limit_windows;
