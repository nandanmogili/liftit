# Lift It

A phone-first workout accountability app. Every Gym, Cardio, or Sports log counts as one workout toward every group the user belongs to. Logs require one proof photo and can only be added for today or yesterday.

## Included in this first build

- Email/password signup and login with email verification
- Photo-required workout form with date, type, and optional note
- Monday–Sunday weekly quota progress
- Home activity feed and reactions UI
- Month calendar with workout and streak indicators
- Group member progress bars
- Responsive mobile and desktop navigation
- Supabase schema, row-level security, private proof-photo bucket
- Vercel configuration

The app runs with sample content when Supabase environment variables are absent, making the interface easy to review before backend setup.

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`. Run `supabase/schema.sql` once in the Supabase SQL editor. In Supabase Auth, keep email confirmation enabled and add your local and Vercel URLs to the allowed redirect URLs.

## Deploy to Vercel

Import the repository in Vercel and add the same two environment variables. Vercel detects the included Next.js configuration and runs `pnpm build`.

## Product rules locked for MVP

- Quota range: 1–14; zero is not allowed
- All workout types count equally as one
- No duration or distance tracking
- One proof photo per log
- Workouts can be logged within 24 hours; future dates are blocked
- A workout counts toward all of the user's groups
- Maximum three groups per user and ten members per group
- Photos are intended to expire after one week (cleanup scheduling is a deployment follow-up)
# liftit
