-- 02_seed.sql
-- Campus Event Hub seed file
-- Small set of starter data for local/dev testing.

-- Upsert helpers ---------------------------------------------------------------
-- Users
-- create a few core users (student, organizer, admin)
INSERT INTO users (id, email, display_name, role, password_hash)
VALUES
  (gen_random_uuid(), 'alex.student@ucalgary.ca', 'Alex Student',   'student', NULL),
  (gen_random_uuid(), 'john.organizer@ucalgary.ca', 'John Organizer', 'organizer', NULL),
  (gen_random_uuid(), 'admin@ucalgary.ca',          'Admin User',     'admin', NULL)
ON CONFLICT (email) DO NOTHING;

-- Organizations
-- hook up a sample organization owned by the organizer
INSERT INTO organizations (id, name, owner_user_id)
SELECT gen_random_uuid(), 'University Tech Club', u.id
FROM users u
WHERE u.email = 'john.organizer@ucalgary.ca'
ON CONFLICT (name) DO NOTHING;

-- Tags
-- basic tag list so events can be filtered by category
INSERT INTO tags (id, name) VALUES
  (gen_random_uuid(), 'Tech'),
  (gen_random_uuid(), 'Clubs'),
  (gen_random_uuid(), 'Sports'),
  (gen_random_uuid(), 'Arts'),
  (gen_random_uuid(), 'Career'),
  (gen_random_uuid(), 'Free')
ON CONFLICT (name) DO NOTHING;

-- Events
-- main demo events used in screenshots / testing
WITH org AS (
  SELECT id AS org_id FROM organizations WHERE name = 'University Tech Club' LIMIT 1
), orgz AS (
  SELECT u.id AS organizer_id FROM users u WHERE u.email = 'john.organizer@ucalgary.ca' LIMIT 1
)
INSERT INTO events (id, organizer_id, organization_id, title, description, location, starts_at, ends_at, capacity, is_public)
SELECT
  gen_random_uuid(),
  orgz.organizer_id,
  org.org_id,
  'Intro to Campus Event Hub',
  'Kickoff session: how to discover, RSVP, and manage campus events.',
  'Science Bldg, Room 210',
  NOW() + INTERVAL '2 days',
  NOW() + INTERVAL '2 days 2 hours',
  50,
  TRUE
FROM org, orgz
ON CONFLICT DO NOTHING;

INSERT INTO events (id, organizer_id, title, description, location, starts_at, ends_at, capacity, is_public)
SELECT
  gen_random_uuid(), u.id,
  'Career Fair – Spring',
  'Meet employers, bring your resume. RSVP required.',
  'MacEwan Student Centre – Hall A',
  NOW() + INTERVAL '10 days',
  NOW() + INTERVAL '10 days 5 hours',
  300,
  TRUE
FROM users u WHERE u.role = 'organizer'
ON CONFLICT DO NOTHING;

-- Event Tags
WITH e AS (
  SELECT id FROM events ORDER BY created_at DESC LIMIT 2
)
INSERT INTO event_tags (event_id, tag)
SELECT e.id, tag_name
FROM e
CROSS JOIN (VALUES ('Tech'), ('Career'), ('Free')) AS tags(tag_name)
ON CONFLICT DO NOTHING;


-- RSVPs
-- give the student a single RSVP so the UI has data to show
WITH stu AS (
  SELECT id FROM users WHERE email='alex.student@ucalgary.ca' LIMIT 1
), ev AS (
  SELECT id FROM events ORDER BY created_at DESC LIMIT 1
)
INSERT INTO rsvps (id, user_id, event_id, status, note)
SELECT gen_random_uuid(), stu.id, ev.id, 'rsvped', 'Looking forward!'
FROM stu, ev
ON CONFLICT DO NOTHING;

-- Notifications
-- send a reminder notification tied to that RSVP
WITH alex AS (
  SELECT id FROM users WHERE email='alex.student@ucalgary.ca' LIMIT 1
), ev AS (
  SELECT id, title, starts_at FROM events ORDER BY created_at DESC LIMIT 1
)
INSERT INTO notifications (id, user_id, event_id, kind, title, message)
SELECT
  gen_random_uuid(),
  alex.id,
  ev.id,
  'reminder',
  'Event Reminder',
  'Your event "' || (SELECT title FROM ev) || '" starts soon.'
FROM alex, ev
ON CONFLICT DO NOTHING;
