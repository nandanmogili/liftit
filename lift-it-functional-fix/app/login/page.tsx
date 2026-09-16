"use client";

import { FormEvent, useState } from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const supabase = getSupabase();
    if (!supabase) { setMessage("Add your Supabase URL and anon key to connect sign-in."); return; }
    setLoading(true);
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { username } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === "signup") return setMessage("Check your email to verify your account.");
    window.location.href = "/";
  }

  return <main className="grid min-h-screen place-items-center bg-ink px-4 text-white"><section className="w-full max-w-[420px] rounded-[28px] border border-white/10 bg-panel p-6 shadow-2xl sm:p-8"><div className="mb-8 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-lime text-ink"><Dumbbell className="size-5" /></span><div><h1 className="text-2xl font-black tracking-tight">Lift It</h1><p className="text-sm text-white/40">Show up together.</p></div></div><h2 className="text-2xl font-black">{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="mt-1 text-sm text-white/42">{mode === "login" ? "Log in to see this week’s progress." : "Start tracking workouts with your group."}</p><form onSubmit={submit} className="mt-6 space-y-4">{mode === "signup" && <div><label className="mb-2 block text-sm font-bold" htmlFor="username">Display name</label><Input id="username" required minLength={3} value={username} onChange={e => setUsername(e.target.value)} placeholder="Nandan" className="h-12 border-white/10 bg-white/5" /></div>}<div><label className="mb-2 block text-sm font-bold" htmlFor="email">Email</label><Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 border-white/10 bg-white/5" /></div><div><label className="mb-2 block text-sm font-bold" htmlFor="password">Password</label><Input id="password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="h-12 border-white/10 bg-white/5" /></div>{message && <p className="rounded-xl bg-white/6 p-3 text-sm text-white/65">{message}</p>}<Button disabled={loading || !isSupabaseConfigured()} className="h-12 w-full rounded-xl bg-lime font-black text-ink hover:bg-[#d6ff6a]">{loading && <Loader2 className="animate-spin" />}{mode === "login" ? "Log in" : "Sign up"}</Button></form><button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-5 w-full text-sm font-bold text-lime">{mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}</button>{!isSupabaseConfigured() && <p className="mt-5 text-center text-xs text-white/30">Supabase setup is required before sign-in is enabled.</p>}</section></main>;
}
