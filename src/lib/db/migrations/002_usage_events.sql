-- Anonymous usage counters for the admin dashboard. A row is a count for a
-- day, never an individual event: there is no customer reference, no question
-- text and no time of day, so nothing here can be traced back to a person.
CREATE TABLE usage_events (
  day     date    NOT NULL,
  kind    text    NOT NULL,
  topic   text    NOT NULL,
  locale  text    NOT NULL,
  mode    text    NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, topic, locale, mode)
);
