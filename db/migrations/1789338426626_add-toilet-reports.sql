-- Up Migration

-- TASK-020: the toilet_reports table (ARCHITECTURE.md section 5.3),
-- recorded in docs/adr/0015-toilet-reports.md. issue_type is a real enum,
-- like every other categorical column in this schema, not text: the seven
-- members mirror BRAND.md's "Reporting" reasons exactly, in the same
-- order as PRODUCT.md section 6.4.
CREATE TYPE toilet_report_issue_type AS ENUM (
  'closed',
  'does_not_exist',
  'wrong_hours',
  'wrong_price',
  'access_denied',
  'wrong_accessibility',
  'other'
);

CREATE TYPE toilet_report_status AS ENUM ('new', 'reviewed', 'accepted', 'rejected');

-- No ON DELETE clause: toilets are never actually deleted (canonical_status
-- transitions to 'removed' instead), so cascading or nulling on delete is
-- not a real scenario. No location column: ARCHITECTURE.md section 5.3,
-- "do not store precise user location with a report."
CREATE TABLE toilet_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id uuid NOT NULL REFERENCES toilets(id),
  issue_type toilet_report_issue_type NOT NULL,
  note text,
  status toilet_report_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX toilet_reports_toilet_id_idx ON toilet_reports (toilet_id);

-- Down Migration

DROP TABLE toilet_reports;
DROP TYPE toilet_report_status;
DROP TYPE toilet_report_issue_type;
