import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return Response.json({ error: "Account deletion is not configured." }, { status: 500 });

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function listUserFiles(bucket: string, userId: string) {
    const paths: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000, offset });
      if (error) break;
      const files = (data ?? []).filter(item => item.name && item.id);
      paths.push(...files.map(item => `${userId}/${item.name}`));
      if ((data ?? []).length < 1000) break;
      offset += 1000;
    }
    return paths;
  }
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Your session has expired. Log in again before deleting your account." }, { status: 401 });

  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  const { data: profile, error: profileError } = await admin.from("profiles").select("username").eq("id", user.id).single();
  if (profileError || !profile) return Response.json({ error: "Profile not found." }, { status: 404 });
  if (body?.confirmation?.trim() !== profile.username) return Response.json({ error: "The username confirmation does not match." }, { status: 400 });

  const [proofPaths, avatarPaths] = await Promise.all([
    listUserFiles("proof-photos", user.id),
    listUserFiles("avatars", user.id),
  ]);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  await Promise.all([
    proofPaths.length ? admin.storage.from("proof-photos").remove(proofPaths) : Promise.resolve(),
    avatarPaths.length ? admin.storage.from("avatars").remove(avatarPaths) : Promise.resolve(),
  ]);

  return Response.json({ deleted: true });
}
