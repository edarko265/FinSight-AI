-- Request limits that hold across server instances. The key is a keyed hash,
-- so no address or customer reference is stored in readable form.
CREATE TABLE rate_limits (
  key           text PRIMARY KEY,
  window_start  timestamptz NOT NULL DEFAULT now(),
  count         integer NOT NULL DEFAULT 0
);
