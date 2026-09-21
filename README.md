# Lift It

Lift It is a phone-first social workout accountability app. Members log a Gym, Cardio, or Sports workout with a proof photo, build daily streaks, and work toward a shared weekly quota with their group.

The core idea is deliberately simple: every valid workout counts as one, regardless of type or duration. Progress and the activity feed reset at 12:00 AM Monday Eastern Time, while workout history and calendar statistics remain available for the current year.

## Features

### Accounts and profiles

- Email and password authentication through Supabase Auth
- Username-based profiles with optional profile pictures
- Interactive avatar cropping, repositioning, and zoom
- Persistent sessions and profile access from the avatar on every main screen
- No email confirmation required in the current setup

### Workout logging

- Gym, Cardio, and Sports workout types
- One required proof photo per workout
- Optional note of up to 280 characters
- Logs can be created for today or yesterday; future dates are blocked
- Client-side image compression before upload
- Users can delete their own posts, immediately updating quotas, statistics, streaks, and the calendar
- One workout counts toward every group the user currently belongs to

### Home and activity feed

- Personal progress against the highest quota among the user's groups
- Accurate circular weekly progress indicator
- Current daily workout streak
- Shared activity feed containing workouts from group members
- Three quick reactions plus a custom emoji picker
- Long-press a reaction count to see who reacted

### Calendar

- Current month and year views
- Workout days highlighted in green
- Connected dark-green styling for consecutive streak days
- Gold border when multiple workouts were logged on the same day
- Monthly workout count, current streak, and yearly total

### Groups

- Create or join searchable groups using a password or invite code
- Maximum of three groups per user and ten members per group
- Shared weekly quota from 1–14 workouts
- Weekly progress sorted from most workouts to least, with alphabetical tie-breaking
- Completed progress bars turn gold and display a checkmark
- Click a group member to view their public profile, role, streak, and workout totals
- Group owners can edit the group name, description, password, quota, and invite code
- Group owners can view and remove members or delete the group
- Regular members can leave a group without deleting their workout history

### Group statistics

- **The Moment:** member or members with the most workouts that week
- **Lazy Fuck:** member or members with the fewest workouts that week
- Ties display every tied member
- Monthly group workout total
- Average workouts per member
- Number of active workout days
- Most common workout type
- Number of members who reached the weekly quota

### Optional weight tracking

- Private, opt-in tracker located on the Profile page
- One weigh-in per day with pounds or kilograms display
- Add, edit, and delete personal entries without affecting workouts
- 30-day, 3-month, and 1-year line graph views
- Hold and drag across the graph on mobile to inspect an exact date and weight
- Hover across the graph for the same inspection behavior on desktop
- Weight data is never shown in groups, profiles viewed by others, or the activity feed

### Privacy and cleanup

- Supabase Row Level Security protects profiles, groups, memberships, workouts, reactions, and storage access
- Proof photos are stored in a private Supabase Storage bucket
- Proof photos are visible only to the owner and users who share a group with them
- Previous-week posts leave the activity feed and their photos become inaccessible at 12:00 AM Monday Eastern Time
- A protected Vercel cron endpoint permanently removes expired proof photos from storage
- Profile pictures remain available until the owner replaces or removes them

## Tech stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn-style UI components, Lucide icons |
| Authentication | Supabase Auth |
| Database | Supabase Postgres |
| File storage | Supabase Storage |
| Authorization | PostgreSQL Row Level Security policies |
| Hosting | Vercel |
| Package manager | pnpm 11 |

## Requirements

- Node.js 22.13 or newer
- pnpm 11.25 or compatible
- A Supabase project
- A Vercel project for production deployment and scheduled cleanup

## Local setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create the environment file

```bash
cp .env.example .env.local
```

Fill in the following values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=a-long-random-secret
```

| Variable | Used for | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server Supabase connection | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Authenticated browser requests protected by RLS | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side proof-photo cleanup | Secret; never expose to the browser |
| `CRON_SECRET` | Authorization for the cleanup endpoint | Secret |

Never commit `.env.local` or expose the service-role key in a `NEXT_PUBLIC_` variable.

### 3. Configure the database

For a new Supabase project, open the Supabase SQL Editor and run these files in order:

1. `supabase/schema.sql`
2. `supabase/production_fix.sql`
3. `supabase/profile_pictures.sql`
4. `supabase/delete_workouts.sql`
5. `supabase/reactions_and_cleanup.sql`
6. `supabase/group_settings.sql`
7. `supabase/custom_reactions.sql`
8. `supabase/weight_tracking.sql`
9. `supabase/eastern_week_cleanup.sql`

The first file creates the core tables, types, triggers, indexes, storage bucket, and baseline policies. The remaining files apply the production features added after the original schema and are intended to be run once on an existing Lift It project.

### 4. Configure Supabase Auth

In **Authentication → Providers → Email**:

- Enable email/password signups.
- Disable **Confirm email** for the current no-verification signup flow.

Add the local and production URLs to the allowed site and redirect URLs where required:

```text
http://localhost:3000
https://your-project.vercel.app
```

### 5. Start the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database model

| Table | Purpose |
| --- | --- |
| `profiles` | Username, avatar path, crop position, and zoom for each authenticated user |
| `workouts` | Workout type, date, note, proof-photo path, and cleanup status |
| `groups` | Group owner, name, description, weekly quota, password hash, and invite code |
| `group_members` | Group membership and owner/member role |
| `reactions` | One emoji reaction per user per workout |
| `weight_entries` | Private daily weight measurements stored in kilograms for unit-independent history |

Most progress values are calculated from workout records rather than stored separately. This keeps the home totals, group rankings, calendar, streaks, and statistics synchronized when a workout is added or deleted.

## Proof-photo lifecycle

Proof photos follow a weekly privacy and cleanup flow:

1. A workout image is compressed in the browser and uploaded to the private `proof-photos` bucket.
2. Storage policies permit access only when the viewer owns the workout or shares a group with its author.
3. At 12:00 AM Monday in `America/New_York`, earlier posts leave the feed and storage policies prevent access to their proof photos.
4. Vercel calls `/api/cleanup-proof-photos` at both possible UTC equivalents of Eastern midnight so daylight saving time is handled correctly.
5. The server uses the Supabase service-role key to remove expired files and records the deletion time in `workouts.proof_deleted_at`.

Workout records remain in Postgres after their proof images expire, preserving yearly totals, calendar history, and statistics.

## Deploying to Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel as a Next.js project.
3. Add all four environment variables from `.env.example` to the appropriate Vercel environments.
4. Deploy the project.
5. Confirm the production URL is allowed in Supabase Auth settings.

Vercel uses the included configuration:

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "crons": [
    {
      "path": "/api/cleanup-proof-photos",
      "schedule": "0 4 * * 1"
    },
    {
      "path": "/api/cleanup-proof-photos",
      "schedule": "0 5 * * 1"
    }
  ]
}
```

When `CRON_SECRET` is configured, Vercel sends it as a bearer token to protect the scheduled endpoint. The service-role key is used only inside that server route.

## Available commands

```bash
pnpm dev      # Start the local development server
pnpm build    # Create and type-check a production build
pnpm start    # Run the completed production build
pnpm lint     # Run ESLint
```

## Project structure

```text
app/
  api/cleanup-proof-photos/  Protected weekly cleanup endpoint
  login/                     Login and signup screen
  page.tsx                   Main authenticated application
components/ui/               Shared UI primitives
lib/supabase.ts              Browser Supabase client
supabase/                    Core schema and production migrations
public/                      Static assets and favicon
vercel.json                  Build and cron configuration
```

## Current product rules

- A week runs Monday through Sunday and resets at 12:00 AM Monday in `America/New_York`.
- Every workout type counts equally as one workout.
- Duration and distance are not tracked.
- A workout requires exactly one proof photo.
- A workout can be logged only for today or yesterday.
- A user can belong to at most three groups.
- A group can contain at most ten members.
- A group quota must be between one and fourteen workouts.
- One workout applies to all groups the user belongs to at the time it is viewed.
- Group owners cannot leave their group; deleting the group dissolves it.
- Deleting a group never deletes members' personal workout records.
- Each member can place one reaction on a workout and can switch or remove it.
- Weight tracking is disabled by default and remains visible only to the account owner.

## Security notes

- The anon/publishable key is expected in browser code; access is restricted by RLS.
- The service-role key bypasses RLS and must remain server-only.
- Group passwords are hashed in Postgres with `pgcrypto`; plaintext passwords are not stored.
- Owner-only group mutations are implemented as security-definer database functions that verify `auth.uid()`.
- Storage buckets are private and accessed with short-lived signed URLs.

## License

This project is currently private and does not include an open-source license.
