"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Dumbbell, Flame, Home, ImagePlus, Loader2, Medal, Plus, Search, Settings, Trophy, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type View = "home" | "calendar" | "groups" | "profile";
type WorkoutType = "Gym" | "Cardio" | "Sports";

const people = [
  { name: "Kiki", initials: "KM", count: 3, color: "bg-[#caff4a] text-[#112014]" },
  { name: "Nevin", initials: "NP", count: 2, color: "bg-[#f9a8d4] text-[#45172d]" },
  { name: "Shreya", initials: "SK", count: 4, color: "bg-[#a7f3d0] text-[#10342a]" },
  { name: "Jesse", initials: "JL", count: 1, color: "bg-[#bfdbfe] text-[#172554]" },
];
const workoutDays = new Set([1, 3, 4, 8, 10, 14, 16]);
const streakDays = new Set([14, 15, 16]);

function Brand() {
  return <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-[12px] bg-lime text-ink shadow-[0_5px_18px_rgba(202,255,74,.18)]"><Dumbbell className="size-[18px]" strokeWidth={2.5} /></span><span className="text-[19px] font-black tracking-[-0.04em]">Quota</span></div>;
}

function AppNav({ view, setView, onLog }: { view: View; setView: (v: View) => void; onLog: () => void }) {
  const items = [["home", Home, "Home"], ["calendar", CalendarDays, "Calendar"], ["log", Plus, "Log"], ["groups", Users, "Groups"], ["profile", UserRound, "Profile"]] as const;
  return <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[76px] max-w-[720px] items-center justify-around border-t border-white/10 bg-[#111612]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">{items.map(([id, Icon, label]) => {
    if (id === "log") return <button key={id} onClick={onLog} aria-label="Log a workout" className="-mt-7 grid size-14 place-items-center rounded-full bg-lime text-ink shadow-[0_12px_32px_rgba(202,255,74,.28)] transition-transform active:scale-95"><Icon className="size-6" strokeWidth={2.6} /></button>;
    const active = view === id;
    return <button key={id} onClick={() => setView(id)} className={cn("flex min-w-14 flex-col items-center gap-1 text-[11px] font-semibold transition-colors", active ? "text-lime" : "text-white/48 hover:text-white/80")}><Icon className="size-5" strokeWidth={active ? 2.5 : 1.8} />{label}</button>;
  })}</nav>;
}

function DesktopNav({ view, setView, onLog }: { view: View; setView: (v: View) => void; onLog: () => void }) {
  const items = [["home", Home, "Home"], ["calendar", CalendarDays, "Calendar"], ["groups", Users, "Groups"], ["profile", UserRound, "Profile"]] as const;
  return <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-white/8 px-5 py-7 md:flex"><Brand /><Button onClick={onLog} className="mt-9 h-12 justify-start rounded-xl bg-lime px-4 text-[15px] font-bold text-ink hover:bg-[#d6ff6a]"><Plus className="size-5" />Log workout</Button><div className="mt-7 space-y-1">{items.map(([id, Icon, label]) => <button key={id} onClick={() => setView(id)} className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition", view === id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white")}><Icon className="size-5" />{label}</button>)}</div><div className="mt-auto rounded-2xl border border-white/8 bg-white/[.035] p-4"><div className="mb-2 flex items-center justify-between text-xs text-white/48"><span>Your groups</span><span>2 / 3</span></div><Progress value={66} className="h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-lime" /></div></aside>;
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <header className="mb-7 flex items-center justify-between"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-lime">{eyebrow}</p><h1 className="text-[30px] font-black leading-none tracking-[-.045em] sm:text-4xl">{title}</h1></div><Avatar className="size-11 ring-2 ring-white/10"><AvatarFallback className="bg-[#fb7185] font-bold text-[#3d1018]">KM</AvatarFallback></Avatar></header>;
}

function HomeView({ count }: { count: number }) {
  return <><Header eyebrow="Wednesday, Sep 16" title="Hey, Kiki" /><section className="hero-card relative overflow-hidden rounded-[28px] border border-white/10 p-5 sm:p-7"><div className="relative z-10 flex items-end justify-between gap-5"><div><p className="text-sm font-semibold text-white/55">This week</p><div className="mt-2 flex items-baseline gap-2"><span className="text-6xl font-black tracking-[-.075em]">{count}</span><span className="text-2xl font-bold text-white/30">/ 4</span></div><div className="mt-4 inline-flex items-center gap-2 rounded-full bg-lime/12 px-3 py-1.5 text-sm font-bold text-lime"><Flame className="size-4 fill-lime" />3 day streak</div></div><div className="relative grid size-[112px] place-items-center rounded-full border-[10px] border-white/10 sm:size-[132px]"><div className="absolute inset-[-10px] rotate-[-34deg] rounded-full border-[10px] border-lime border-l-transparent" /><div className="text-center"><span className="block text-2xl font-black">{Math.round((count / 4) * 100)}%</span><span className="text-xs text-white/45">complete</span></div></div></div><p className="relative z-10 mt-5 text-sm text-white/52">{count >= 4 ? "You hit your highest group quota this week." : "One more workout and you’ve hit your highest group quota."}</p></section>
  <section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold tracking-tight">Group activity</h2><button className="text-sm font-bold text-lime">See all</button></div><div className="space-y-3"><article className="rounded-[22px] border border-white/8 bg-panel p-4 sm:p-5"><div className="flex gap-3"><Avatar className="size-10"><AvatarFallback className="bg-[#a7f3d0] font-bold text-[#10342a]">SK</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">Shreya hit the weekly goal <span aria-hidden>🎉</span></p><p className="mt-0.5 text-xs text-white/42">SF Gym Rats · 20 min ago</p></div><span className="grid size-8 place-items-center rounded-full bg-lime/12 text-lime"><Trophy className="size-4" /></span></div></div></div></article>
  <article className="overflow-hidden rounded-[22px] border border-white/8 bg-panel"><div className="flex gap-3 p-4 sm:p-5"><Avatar className="size-10"><AvatarFallback className="bg-[#f9a8d4] font-bold text-[#45172d]">NP</AvatarFallback></Avatar><div className="flex-1"><p className="font-bold">Nevin logged Cardio</p><p className="mt-0.5 text-xs text-white/42">SF Gym Rats · 2 hr ago</p></div><span className="rounded-full bg-white/7 px-2.5 py-1 text-xs font-bold text-white/64">2 / 4</span></div><div className="proof-image mx-4 grid h-40 place-items-center rounded-2xl border border-white/8 sm:mx-5"><div className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/70 backdrop-blur"><Camera className="mr-1.5 inline size-3.5" />Proof photo</div></div><div className="flex items-center gap-2 p-4 sm:px-5"><button className="rounded-full bg-white/7 px-3 py-1.5 text-sm">🔥 3</button><button className="rounded-full bg-white/7 px-3 py-1.5 text-sm">💪 1</button><span className="ml-auto text-xs text-white/38">Morning run</span></div></article></div></section></>;
}

function CalendarView() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return <><Header eyebrow="Your consistency" title="Calendar" /><div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">{[["7", "this month"], ["3", "day streak"], ["18", "this year"]].map(([v, l]) => <div key={l} className="rounded-2xl border border-white/8 bg-panel p-3.5 sm:p-4"><p className="text-2xl font-black">{v}</p><p className="mt-1 text-xs text-white/42">{l}</p></div>)}</div><section className="rounded-[26px] border border-white/8 bg-panel p-4 sm:p-6"><div className="mb-6 flex items-center justify-between"><Button variant="ghost" size="icon-sm" className="text-white/55"><ChevronLeft /></Button><h2 className="text-lg font-extrabold">September 2026</h2><Button variant="ghost" size="icon-sm" className="text-white/55"><ChevronRight /></Button></div><div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={`${d}-${i}`} className="pb-2 text-xs font-bold text-white/34">{d}</div>)}<div /><div />{days.map(day => { const worked = workoutDays.has(day); const streak = streakDays.has(day); return <div key={day} className={cn("grid aspect-square place-items-center rounded-xl text-sm font-semibold", worked && "bg-lime font-extrabold text-ink", streak && "ring-2 ring-[#fb7185] ring-offset-2 ring-offset-[#181e19]")}>{day}</div>; })}</div><div className="mt-6 flex items-center justify-center gap-5 text-xs text-white/45"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-lime" />Workout</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm border-2 border-[#fb7185]" />Streak</span></div></section></>;
}

function GroupsView() {
  return <><Header eyebrow="2 active groups" title="SF Gym Rats" /><div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none"><button className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">SF Gym Rats</button><button className="shrink-0 rounded-full bg-white/7 px-4 py-2 text-sm font-bold text-white/48">Nachle Fitness</button><button className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-white/45"><Plus className="size-4" /></button></div><section className="rounded-[26px] border border-white/8 bg-panel p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-white/45">Weekly quota</p><p className="mt-1 text-2xl font-black">4 workouts</p></div><Button variant="ghost" size="icon" className="rounded-full bg-white/6 text-white/55"><Settings /></Button></div><div className="mt-5 flex items-center justify-between rounded-2xl bg-lime/10 px-4 py-3 text-sm"><span className="font-semibold text-lime">1 of 4 completed</span><span className="text-white/40">Mon–Sun</span></div></section><section className="mt-7"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold">This week</h2><span className="text-xs text-white/40">Sep 14–20</span></div><div className="space-y-3">{people.map(person => <div key={person.name} className="rounded-[20px] border border-white/8 bg-panel p-4"><div className="mb-3 flex items-center gap-3"><Avatar className="size-9"><AvatarFallback className={cn("font-bold", person.color)}>{person.initials}</AvatarFallback></Avatar><div className="flex-1 font-bold">{person.name}{person.name === "Kiki" && <span className="ml-2 text-xs font-medium text-white/35">you</span>}</div><span className={cn("text-sm font-black", person.count >= 4 ? "text-lime" : "text-white/66")}>{person.count} / 4 {person.count >= 4 && <Check className="ml-1 inline size-4" />}</span></div><Progress value={Math.min(100, person.count * 25)} className="h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-lime" /></div>)}</div></section><button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/16 py-4 text-sm font-bold text-white/48 hover:border-lime/50 hover:text-lime"><Search className="size-4" />Find or create a group</button></>;
}

function ProfileView() {
  return <><Header eyebrow="Your profile" title="Kiki" /><section className="rounded-[28px] border border-white/8 bg-panel p-6 text-center"><Avatar className="mx-auto size-24 ring-4 ring-lime/15"><AvatarFallback className="bg-[#fb7185] text-2xl font-black text-[#3d1018]">KM</AvatarFallback></Avatar><h2 className="mt-4 text-2xl font-black">@kiki</h2><p className="mt-1 text-sm text-white/40">Member since September 2026</p><div className="mt-6 grid grid-cols-3 divide-x divide-white/8 rounded-2xl bg-white/[.035] py-4"><div><p className="text-2xl font-black">18</p><p className="text-xs text-white/40">this year</p></div><div><p className="text-2xl font-black">3</p><p className="text-xs text-white/40">day streak</p></div><div><p className="text-2xl font-black">2</p><p className="text-xs text-white/40">groups</p></div></div></section><div className="mt-5 space-y-2">{[[UserRound, "Edit profile"], [Medal, "Workout history"], [Settings, "Settings"]].map(([Icon, label]) => { const I = Icon as typeof UserRound; return <button key={label as string} className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-panel p-4 text-left font-bold"><span className="grid size-9 place-items-center rounded-xl bg-white/6 text-white/55"><I className="size-4" /></span>{label as string}<ChevronRight className="ml-auto size-4 text-white/28" /></button>; })}</div></>;
}

function LogDialog({ open, onOpenChange, onLogged }: { open: boolean; onOpenChange: (open: boolean) => void; onLogged: () => void }) {
  const [type, setType] = useState<WorkoutType>("Gym");
  const [photo, setPhoto] = useState<File | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function submit() {
    if (!photo) return;
    setSaving(true); setError("");
    const supabase = getSupabase();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); setError("Please log in again."); return; }
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("proof-photos").upload(path, photo, { upsert: false });
      if (upload.error) { setSaving(false); setError(upload.error.message); return; }
      const insert = await supabase.from("workouts").insert({ user_id: user.id, workout_type: type, workout_date: date, note, proof_path: path });
      if (insert.error) { await supabase.storage.from("proof-photos").remove([path]); setSaving(false); setError(insert.error.message); return; }
    }
    setSaving(false); setPhoto(null); setNote(""); onLogged(); onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white shadow-2xl sm:p-6"><DialogHeader><DialogTitle className="text-2xl font-black tracking-tight">Log a workout</DialogTitle><DialogDescription className="text-white/42">Each valid workout counts as 1 toward every group.</DialogDescription></DialogHeader><div className="mt-2 space-y-5"><fieldset><legend className="mb-2.5 text-sm font-bold">Workout type</legend><div className="grid grid-cols-3 gap-2">{(["Gym", "Cardio", "Sports"] as WorkoutType[]).map(item => <button key={item} onClick={() => setType(item)} className={cn("rounded-xl border px-2 py-3 text-sm font-bold transition", type === item ? "border-lime bg-lime text-ink" : "border-white/10 bg-white/4 text-white/55")}>{item}</button>)}</div></fieldset><div><label htmlFor="date" className="mb-2 block text-sm font-bold">Date</label><Input id="date" type="date" max={today} value={date} onChange={e => setDate(e.target.value)} className="h-12 border-white/10 bg-white/5 text-white [color-scheme:dark]" /></div><div><label htmlFor="proof" className="mb-2 block text-sm font-bold">Proof photo</label><label htmlFor="proof" className={cn("flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition", photo ? "border-lime bg-lime/8 text-lime" : "border-white/18 bg-white/[.025] text-white/44 hover:border-white/35")}><ImagePlus className="size-5" /><span className="max-w-[85%] truncate text-sm font-bold">{photo?.name || "Take or choose a photo"}</span><input id="proof" type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></label></div><div><label htmlFor="note" className="mb-2 block text-sm font-bold">Note <span className="font-normal text-white/35">optional</span></label><Textarea id="note" value={note} onChange={e => setNote(e.target.value)} maxLength={280} placeholder="Push day, morning run…" className="min-h-20 resize-none border-white/10 bg-white/5 placeholder:text-white/25" /></div>{error && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button onClick={submit} disabled={!photo || saving} className="h-12 w-full rounded-xl bg-lime text-base font-black text-ink hover:bg-[#d6ff6a] disabled:opacity-35">{saving ? <Loader2 className="animate-spin" /> : <Activity className="size-5" />}Log {type}</Button><p className="text-center text-xs text-white/30">Workouts can only be logged within 24 hours.</p></div></DialogContent></Dialog>;
}

export default function QuotaApp() {
  const [view, setView] = useState<View>("home"); const [logOpen, setLogOpen] = useState(false); const [count, setCount] = useState(3); const title = view[0].toUpperCase() + view.slice(1);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { window.location.href = "/login"; return; }
      const monday = new Date();
      const offset = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - offset);
      const start = monday.toISOString().slice(0, 10);
      const { count: workoutCount } = await supabase.from("workouts").select("id", { count: "exact", head: true }).gte("workout_date", start);
      if (typeof workoutCount === "number") setCount(workoutCount);
    });
  }, []);
  return <main className="min-h-screen bg-ink text-white"><div className="mx-auto flex min-h-screen max-w-[1180px]"><DesktopNav view={view} setView={setView} onLog={() => setLogOpen(true)} /><div className="min-w-0 flex-1"><div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-ink/88 px-5 backdrop-blur-xl md:hidden"><Brand /><span className="text-xs font-bold uppercase tracking-[.13em] text-white/35">{title}</span></div><div className="mx-auto w-full max-w-[720px] px-4 pb-28 pt-7 sm:px-7 md:pb-16 md:pt-10">{view === "home" && <HomeView count={count} />}{view === "calendar" && <CalendarView />}{view === "groups" && <GroupsView />}{view === "profile" && <ProfileView />}</div></div></div><AppNav view={view} setView={setView} onLog={() => setLogOpen(true)} /><LogDialog open={logOpen} onOpenChange={setLogOpen} onLogged={() => setCount(c => c + 1)} /></main>;
}
