import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mondayDateKey() {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = (day + 6) % 7;
  now.setUTCDate(now.getUTCDate() - offset);
  return now.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Cleanup environment variables are missing." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = mondayDateKey();
  const { data: expired, error: queryError } = await supabase
    .from("workouts")
    .select("id,proof_path")
    .lt("workout_date", cutoff)
    .is("proof_deleted_at", null)
    .limit(500);

  if (queryError) return Response.json({ error: queryError.message }, { status: 500 });
  if (!expired?.length) return Response.json({ deleted: 0, cutoff });

  const paths = expired.map(workout => workout.proof_path).filter(Boolean);
  const { error: storageError } = await supabase.storage.from("proof-photos").remove(paths);
  if (storageError) return Response.json({ error: storageError.message }, { status: 500 });

  const ids = expired.map(workout => workout.id);
  const { error: updateError } = await supabase
    .from("workouts")
    .update({ proof_deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  return Response.json({ deleted: paths.length, cutoff });
}

