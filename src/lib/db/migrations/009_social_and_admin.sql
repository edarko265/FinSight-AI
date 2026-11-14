-- Announcements: publish later, and wording in Finnish and Swedish.
ALTER TABLE announcements ADD COLUMN publish_at timestamptz;
ALTER TABLE announcements ADD COLUMN pushed_at timestamptz;
ALTER TABLE announcements ADD COLUMN translations text NOT NULL DEFAULT '{}';
UPDATE announcements SET pushed_at = created_at;

-- The member of staff who wrote an adviser reply, sealed like the message itself.
ALTER TABLE advisor_messages ADD COLUMN sealed_author text;

-- A code a customer can give to friends. It maps to their blind index, never to their ID.
CREATE TABLE friend_codes (
  code          text PRIMARY KEY,
  customer_ref  text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- A customer saying that a shared plan should be looked at by staff. No reference to who reported.
CREATE TABLE plan_reports (
  id          text PRIMARY KEY,
  code        text NOT NULL,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_reports_code_idx ON plan_reports (code);

-- Payments. In this prototype every payment goes through a simulated provider: no card is
-- asked for and no money moves. The amount and purpose are plain for totals; who paid is a
-- blind index; anything else is sealed with the customer's key.
CREATE TABLE payments (
  id              text PRIMARY KEY,
  customer_ref    text NOT NULL,
  purpose         text NOT NULL,
  amount_cents    integer NOT NULL,
  provider        text NOT NULL,
  status          text NOT NULL,
  sealed_details  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_customer_idx ON payments (customer_ref, created_at DESC);
