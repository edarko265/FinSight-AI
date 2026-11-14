-- Recycle bin for things staff create or manage. Deleting sets deleted_at;
-- restoring clears it; purging removes the row.
ALTER TABLE advisor_requests ADD COLUMN deleted_at timestamptz;

-- Notices written by staff and shown to every customer among their insights.
-- Not customer data.
CREATE TABLE announcements (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  body        text NOT NULL,
  severity    text NOT NULL CHECK (severity IN ('info', 'warning', 'good')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
