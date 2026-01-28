-- This is our postgresql schema
-- Campus Event Hub schema
-- Runs automatically on first DB creation via Docker


-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;      --- for generating random uid
CREATE EXTENSION IF NOT EXISTS citext;           -- here we have our checking for case-insensitive emails/usernames

-- Here we have our types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' ) THEN
    CREATE TYPE user_role AS ENUM ('student', 'organizer', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rsvp_status' ) THEN
    CREATE TYPE rsvp_status AS ENUM ('rsvped', 'waitlisted', 'cancelled', 'checked_in');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('reminder', 'update', 'rsvp', 'system');
  END IF;
END$$;

-- audit helpers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;



-- Users
CREATE TABLE IF NOT EXISTS users (

  id              UUID PRIMARY KEY DEFAULT gen_random_uuid( ),
  email           CITEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,

  first_name      TEXT,
  last_name       TEXT,
  username        CITEXT UNIQUE,
  bio             TEXT,
  avatar_data     TEXT,

  role            user_role NOT NULL DEFAULT 'student',
  -- If you store passwords locally; otherwise federate via SSO tables
  password_hash   TEXT,  -- nullable if using SSO
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Organization
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_org_updated
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- different events we may have
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  location        TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  capacity        INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_valid CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at );
CREATE INDEX IF NOT EXISTS idx_events_is_public ON events(is_public );

CREATE TRIGGER trg_events_updated
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- norm Tags
CREATE TABLE IF NOT EXISTS tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  CITEXT UNIQUE NOT NULL
);

-- event tags (many-to-many)
DROP TABLE IF EXISTS event_tags;

CREATE TABLE IF NOT EXISTS event_tags (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag      VARCHAR(50) NOT NULL,
  CONSTRAINT uq_event_tag UNIQUE (event_id, tag)
);


-- our RSVPS
CREATE TABLE IF NOT EXISTS rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status     rsvp_status NOT NULL DEFAULT 'rsvped',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user  ON rsvps(user_id);

CREATE TRIGGER trg_rsvps_updated
BEFORE UPDATE ON rsvps
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- simple capacity view 
CREATE OR REPLACE VIEW event_attendance AS
SELECT
  e.id AS event_id,
  e.title,
  e.capacity,
  COUNT(r.*) FILTER (WHERE r.status IN ('rsvped','checked_in','waitlisted')) AS total_booked
FROM events e
LEFT JOIN rsvps r ON r.event_id = e.id
GROUP BY e.id;

-- notifications for the users
CREATE TABLE IF NOT EXISTS notifications (

  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  kind          notification_type NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ NULL

);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- the basic integrity examples general setup, need work
CREATE OR REPLACE FUNCTION prevent_over_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cap        INTEGER;
  booked_cnt INTEGER;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status IN ('rsvped','checked_in' ) THEN
    SELECT capacity INTO cap FROM events WHERE id = NEW.event_id;
    IF cap IS NOT NULL THEN
      SELECT COUNT(*) INTO booked_cnt FROM rsvps
       WHERE event_id = NEW.event_id AND status IN ('rsvped','checked_in');
      IF (TG_OP = 'INSERT') THEN
        booked_cnt := booked_cnt + 1;
      END IF;
      IF booked_cnt > cap THEN
        RAISE EXCEPTION 'Capacity exceeded for event % (capacity %)', NEW.event_id, cap
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;


DROP TRIGGER IF EXISTS trg_rsvps_cap ON rsvps;
CREATE TRIGGER trg_rsvps_cap
BEFORE INSERT OR UPDATE ON rsvps
FOR EACH ROW EXECUTE FUNCTION prevent_over_capacity();
