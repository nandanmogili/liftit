# Lift It functional fix

Replace these files in the GitHub repository, preserving their paths:

- `app/page.tsx`
- `app/login/page.tsx`
- `app/layout.tsx`

Add this new file:

- `supabase/production_fix.sql`

Then open Supabase → SQL Editor, paste the entire contents of `supabase/production_fix.sql`, and click **Run** once. Commit the GitHub file changes to `main`; Vercel will redeploy automatically.

This update removes all sample people, groups, workouts, calendar dates, activity, and streaks. It loads the signed-in profile and real Supabase records, adds correct consecutive-day streak calculation, empty states, group creation, searchable group joining, password/invite-code joining, and live member progress.
