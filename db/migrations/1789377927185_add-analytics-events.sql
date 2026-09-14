-- Up Migration

-- TASK-023: first-party analytics events (docs/adr/0018-first-party-analytics.md).
-- event_name and a server-assigned occurred_at, nothing else: no
-- coordinates, no session/device identifier, no user agent. PRODUCT.md
-- section 14's rule is "without precise location"; this table does not
-- even carry coarse location, since nothing asks for it.
CREATE TYPE analytics_event_name AS ENUM (
  'app_opened',
  'location_granted',
  'location_denied',
  'results_loaded',
  'no_results',
  'toilet_selected',
  'navigation_clicked',
  'filter_applied',
  'report_submitted'
);

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name analytics_event_name NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_event_name_occurred_at_idx
  ON analytics_events (event_name, occurred_at);

-- Down Migration

DROP TABLE analytics_events;
DROP TYPE analytics_event_name;
