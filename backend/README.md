## This is our  database Schema & Seeding readme

**Where:** `database_schema1.sql` (schema), `db/init/02_seed.sql` (seed)

### Whats included
- **Schema:** users organizations, events, tags, event_tags, rsvps, notifications
- **Enums:** `user_role`, `rsvp_status`, `notification_type`

- **some constraints we included:** time validity, capacity checks, unique RSVP per user/event
- **the Helpers:** `updated_at` trigger, `event_attendance` view, simple capacity trigger
- **Seed data:** sample users (student/organizer/admin), org, two example events, tags, one RSVP, one notification

### how it runs
when you start the stack for the **first time** the fresh volume), Docker mounts `db/init/` into Postgres’ auto-init folder:

 (`/docker-entrypoint-initdb.d`) and runs:
1. `01_schema.sql` – creates tables/types/constraints/indexes
2. `02_seed.sql` – inserts demo data

### in order to run it:

**First time fresh DB:**
```bash
# from repo root
docker compose up --build -d

