-- Hand-over to a human adviser. The customer asks for it, and what they share
-- (their note, the booked time, the messages) is sealed with their own key.
CREATE TABLE advisor_requests (
  id              text PRIMARY KEY,
  customer_ref    text NOT NULL REFERENCES customer_ledgers (customer_ref) ON DELETE CASCADE,
  topic           text NOT NULL CHECK (topic IN ('general', 'investment')),
  status          text NOT NULL CHECK (status IN ('open', 'active', 'closed')),
  sealed_details  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advisor_requests_customer_idx ON advisor_requests (customer_ref, created_at);

CREATE TABLE advisor_messages (
  id              text PRIMARY KEY,
  request_id      text NOT NULL REFERENCES advisor_requests (id) ON DELETE CASCADE,
  sender          text NOT NULL CHECK (sender IN ('customer', 'advisor')),
  sealed_text     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advisor_messages_request_idx ON advisor_messages (request_id, created_at);
