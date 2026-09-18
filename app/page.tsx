"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Dumbbell,
  Copy, Crown, DoorOpen, Flame, Home, ImagePlus, Loader2, LogOut, Plus, RefreshCw, Search, Settings, Trash2, UserMinus, UserRound, Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type View = "home" | "calendar" | "groups" | "profile";
type WorkoutType = "Gym" | "Cardio" | "Sports";
type Profile = { id: string; username: string; avatar_path: string | null; avatar_position_x: number; avatar_position_y: number; avatar_zoom: number; created_at: string; avatar_url?: string };
type Workout = { id: string; user_id: string; workout_type: WorkoutType; workout_date: string; note: string; proof_path: string; created_at: string; proof_url?: string };
type Reaction = { workout_id: string; user_id: string; emoji: "❤️" | "🔥" | "💪" | "👏"; created_at: string };
type Group = { id: string; owner_id: string; name: string; description: string; image_path: string | null; weekly_quota: number; invite_code: string; created_at: string };
type Membership = { group_id: string; user_id: string; role: "owner" | "member"; joined_at: string };
type MemberProgress = { profile: Profile; role: string; count: number };

const today = new Date();
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
const titleCase = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value;
const addDays = (date: Date, amount: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + amount); return copy; };
const weekStart = (date = new Date()) => { const copy = new Date(date); const offset = (copy.getDay() + 6) % 7; copy.setHours(0, 0, 0, 0); copy.setDate(copy.getDate() - offset); return copy; };
const friendlyDate = (date = new Date()) => date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
const relativeTime = (iso: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

async function compressWorkoutPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1920 / longestSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "workout-proof";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function addAvatarUrls(items: Profile[]) {
  const supabase = getSupabase();
  const paths = [...new Set(items.map(item => item.avatar_path).filter((path): path is string => Boolean(path)))];
  if (!supabase || !paths.length) return items;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(paths, 3600);
  const urls = new Map((data ?? []).map(item => [item.path, item.signedUrl ?? undefined]));
  return items.map(item => ({ ...item, avatar_url: item.avatar_path ? urls.get(item.avatar_path) : undefined }));
}

function calculateStreak(workouts: Workout[]) {
  const dates = new Set(workouts.map(workout => workout.workout_date));
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  if (!dates.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  const streakDates = new Set<string>();
  while (dates.has(dateKey(cursor))) { streakDates.add(dateKey(cursor)); cursor = addDays(cursor, -1); }
  return { count: streakDates.size, dates: streakDates };
}

function Brand() {
  return <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-[12px] bg-lime text-ink shadow-[0_5px_18px_rgba(202,255,74,.18)]"><Dumbbell className="size-[18px]" strokeWidth={2.5} /></span><span className="text-[19px] font-black tracking-[-0.04em]">Lift It</span></div>;
}

function UserAvatar({ name, avatarUrl, positionX = 50, positionY = 50, zoom = 100, large = false }: { name: string; avatarUrl?: string; positionX?: number; positionY?: number; zoom?: number; large?: boolean }) {
  return <Avatar className={cn(large ? "size-24" : "size-11", "ring-2 ring-white/10")}>{avatarUrl && <AvatarImage src={avatarUrl} alt={`${name}'s profile picture`} className="object-cover" style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom / 100})`, transformOrigin: `${positionX}% ${positionY}%` }} />}<AvatarFallback className={cn("bg-[#fb7185] font-bold text-[#3d1018]", large && "text-2xl")}>{initials(name)}</AvatarFallback></Avatar>;
}

function AppNav({ view, setView, onLog }: { view: View; setView: (view: View) => void; onLog: () => void }) {
  const items = [["home", Home, "Home"], ["calendar", CalendarDays, "Calendar"], ["log", Plus, "Log"], ["groups", Users, "Groups"], ["profile", UserRound, "Profile"]] as const;
  return <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[76px] max-w-[720px] items-center justify-around border-t border-white/10 bg-[#111612]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">{items.map(([id, Icon, label]) => id === "log" ? <button key={id} onClick={onLog} aria-label="Log a workout" className="-mt-7 grid size-14 place-items-center rounded-full bg-lime text-ink shadow-[0_12px_32px_rgba(202,255,74,.28)]"><Icon className="size-6" /></button> : <button key={id} onClick={() => setView(id)} className={cn("flex min-w-14 flex-col items-center gap-1 text-[11px] font-semibold", view === id ? "text-lime" : "text-white/48")}><Icon className="size-5" />{label}</button>)}</nav>;
}

function DesktopNav({ view, setView, onLog, groupCount }: { view: View; setView: (view: View) => void; onLog: () => void; groupCount: number }) {
  const items = [["home", Home, "Home"], ["calendar", CalendarDays, "Calendar"], ["groups", Users, "Groups"], ["profile", UserRound, "Profile"]] as const;
  return <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-white/8 px-5 py-7 md:flex"><Brand /><Button onClick={onLog} className="mt-9 h-12 justify-start rounded-xl bg-lime px-4 text-[15px] font-bold text-ink hover:bg-[#d6ff6a]"><Plus className="size-5" />Log workout</Button><div className="mt-7 space-y-1">{items.map(([id, Icon, label]) => <button key={id} onClick={() => setView(id)} className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition", view === id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white")}><Icon className="size-5" />{label}</button>)}</div><div className="mt-auto rounded-2xl border border-white/8 bg-white/[.035] p-4"><div className="mb-2 flex items-center justify-between text-xs text-white/48"><span>Your groups</span><span>{groupCount} / 3</span></div><Progress value={(groupCount / 3) * 100} className="h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-lime" /></div></aside>;
}

function Header({ eyebrow, title, username, avatarUrl, avatarPositionX, avatarPositionY, avatarZoom, onProfile }: { eyebrow: string; title: string; username: string; avatarUrl?: string; avatarPositionX?: number; avatarPositionY?: number; avatarZoom?: number; onProfile?: () => void }) {
  return <header className="mb-7 flex items-center justify-between"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-lime">{eyebrow}</p><h1 className="text-[30px] font-black leading-none tracking-[-.045em] sm:text-4xl">{title}</h1></div><button type="button" onClick={onProfile} aria-label="Open profile" className="rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink"><UserAvatar name={username} avatarUrl={avatarUrl} positionX={avatarPositionX} positionY={avatarPositionY} zoom={avatarZoom} /></button></header>;
}

function EmptyState({ icon: Icon, title, detail, action, onAction }: { icon: typeof Users; title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="rounded-[24px] border border-dashed border-white/14 bg-white/[.025] px-5 py-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/6 text-white/45"><Icon className="size-5" /></span><h3 className="mt-4 font-extrabold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-white/42">{detail}</p>{action && <Button onClick={onAction} className="mt-5 rounded-xl bg-lime font-bold text-ink hover:bg-[#d6ff6a]">{action}</Button>}</div>;
}

function ReactionButton({ emoji, count, selected, busy, onToggle, onShowDetails }: { emoji: Reaction["emoji"]; count: number; selected: boolean; busy: boolean; onToggle: () => void; onShowDetails: () => void }) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const clearHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; pointerStart.current = null; };
  useEffect(() => clearHold, []);
  function beginHold(event: React.PointerEvent<HTMLButtonElement>) {
    held.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    if (count > 0) holdTimer.current = setTimeout(() => { held.current = true; holdTimer.current = null; onShowDetails(); }, 500);
  }
  function movePointer(event: React.PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearHold();
  }
  return <button type="button" onPointerDown={beginHold} onPointerMove={movePointer} onPointerUp={clearHold} onPointerCancel={clearHold} onPointerLeave={clearHold} onContextMenu={event => event.preventDefault()} onClick={() => { if (held.current) { held.current = false; return; } onToggle(); }} disabled={busy} aria-label={`${selected ? "Remove" : "Add"} ${emoji} reaction${count > 0 ? "; hold to see who reacted" : ""}`} className={cn("flex h-8 min-w-10 touch-manipulation select-none items-center justify-center gap-1 rounded-full border px-2.5 text-sm transition disabled:opacity-45", selected ? "border-lime/45 bg-lime/12 text-white" : "border-white/8 bg-white/[.035] text-white/65 hover:bg-white/8")}><span>{emoji}</span>{count > 0 && <span className="text-xs font-bold">{count}</span>}</button>;
}

function WorkoutReactions({ workoutId, reactions, currentUserId, busy, onToggle, onShowDetails }: { workoutId: string; reactions: Reaction[]; currentUserId: string; busy: boolean; onToggle: (emoji: Reaction["emoji"]) => void; onShowDetails: (emoji: Reaction["emoji"]) => void }) {
  const emojis: Reaction["emoji"][] = ["🔥", "💪", "👏", "❤️"];
  const workoutReactions = reactions.filter(reaction => reaction.workout_id === workoutId);
  return <div className="flex flex-wrap gap-1.5 border-t border-white/6 px-3.5 py-3 sm:px-4">{emojis.map(emoji => { const count = workoutReactions.filter(reaction => reaction.emoji === emoji).length; const selected = workoutReactions.some(reaction => reaction.user_id === currentUserId && reaction.emoji === emoji); return <ReactionButton key={emoji} emoji={emoji} count={count} selected={selected} busy={busy} onToggle={() => onToggle(emoji)} onShowDetails={() => onShowDetails(emoji)} />; })}</div>;
}

function HomeView({ username, avatarUrl, avatarPositionX, avatarPositionY, avatarZoom, currentUserId, workouts, groups, feed, profiles, reactions, onProfile, onGroups, onDeleted, onReactionChanged }: { username: string; avatarUrl?: string; avatarPositionX?: number; avatarPositionY?: number; avatarZoom?: number; currentUserId: string; workouts: Workout[]; groups: Group[]; feed: Workout[]; profiles: Map<string, Profile>; reactions: Reaction[]; onProfile: () => void; onGroups: () => void; onDeleted: () => Promise<void>; onReactionChanged: () => Promise<void> }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [reactionDetails, setReactionDetails] = useState<{ workoutId: string; emoji: Reaction["emoji"] } | null>(null);
  const start = dateKey(weekStart());
  const weeklyCount = workouts.filter(workout => workout.workout_date >= start).length;
  const quota = groups.length ? Math.max(...groups.map(group => group.weekly_quota)) : null;
  const streak = calculateStreak(workouts).count;
  const percent = quota ? Math.min(100, Math.round((weeklyCount / quota) * 100)) : 0;
  async function deleteWorkout(workout: Workout) {
    if (workout.user_id !== currentUserId || !window.confirm("Delete this workout? It will be removed from your calendar, streak, quota, and group stats.")) return;
    const supabase = getSupabase(); if (!supabase) return;
    setDeletingId(workout.id);
    const { error } = await supabase.from("workouts").delete().eq("id", workout.id).eq("user_id", currentUserId);
    if (error) { setDeletingId(null); window.alert(error.message); return; }
    await supabase.storage.from("proof-photos").remove([workout.proof_path]);
    await onDeleted(); setDeletingId(null);
  }
  async function toggleReaction(workoutId: string, emoji: Reaction["emoji"]) {
    if (reactingId) return;
    const supabase = getSupabase(); if (!supabase) return;
    setReactingId(workoutId);
    const existing = reactions.find(reaction => reaction.workout_id === workoutId && reaction.user_id === currentUserId);
    if (existing) {
      const removed = await supabase.from("reactions").delete().eq("workout_id", workoutId).eq("user_id", currentUserId);
      if (removed.error) { setReactingId(null); window.alert(removed.error.message); return; }
      if (existing.emoji === emoji) { await onReactionChanged(); setReactingId(null); return; }
    }
    const added = await supabase.from("reactions").insert({ workout_id: workoutId, user_id: currentUserId, emoji });
    if (added.error) { setReactingId(null); window.alert(added.error.message); return; }
    await onReactionChanged(); setReactingId(null);
  }
  return <><Header eyebrow={friendlyDate()} title={`Hey, ${username}`} username={username} avatarUrl={avatarUrl} avatarPositionX={avatarPositionX} avatarPositionY={avatarPositionY} avatarZoom={avatarZoom} onProfile={onProfile} /><section className="hero-card relative overflow-hidden rounded-[28px] border border-white/10 p-5 sm:p-7"><div className="relative z-10 flex items-end justify-between gap-5"><div><p className="text-sm font-semibold text-white/55">This week</p><div className="mt-2 flex items-baseline gap-2"><span className="text-6xl font-black tracking-[-.075em]">{weeklyCount}</span><span className="text-2xl font-bold text-white/30">{quota ? `/ ${quota}` : "workouts"}</span></div>{streak > 0 && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-lime/12 px-3 py-1.5 text-sm font-bold text-lime"><Flame className="size-4 fill-lime" />{streak} day streak</div>}</div>
<div className="relative grid size-[112px] shrink-0 place-items-center sm:size-[132px]"><svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="10" /><circle cx="60" cy="60" r="52" fill="none" stroke="#caff4a" strokeWidth="10" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - percent} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-500" /></svg><div className="relative text-center"><span className="block text-2xl font-black">{quota ? `${percent}%` : "—"}</span><span className="text-xs text-white/45">{quota ? "complete" : "no quota"}</span></div></div></div>
<p className="relative z-10 mt-5 text-sm text-white/52">{quota ? weeklyCount >= quota ? "You hit your highest group quota this week." : `${quota - weeklyCount} workout${quota - weeklyCount === 1 ? "" : "s"} to hit your highest group quota.` : "Join or create a group to set your weekly quota."}</p></section><section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold tracking-tight">Group activity</h2></div>{groups.length === 0 ? <EmptyState icon={Users} title="No group activity yet" detail="Create or join a group to see your friends’ real workout posts here." action="Find or create a group" onAction={onGroups} /> : feed.length === 0 ? <EmptyState icon={Activity} title="Quiet week so far" detail="Nobody in your groups has logged a workout this week yet." /> : <div className="space-y-3">{feed.map(workout => { const author = profiles.get(workout.user_id); return <article key={workout.id} className="mx-1 max-w-[600px] overflow-hidden rounded-[20px] border border-white/8 bg-panel sm:mx-auto"><div className="flex gap-3 p-3.5 sm:p-4"><UserAvatar name={author?.username ?? "Member"} avatarUrl={author?.avatar_url} positionX={author?.avatar_position_x} positionY={author?.avatar_position_y} zoom={author?.avatar_zoom} /><div className="flex-1"><p className="font-bold">{author?.username ?? "Member"} logged {workout.workout_type}</p><p className="mt-0.5 text-xs text-white/42">{relativeTime(workout.created_at)}</p></div>{workout.user_id === currentUserId && <button onClick={() => deleteWorkout(workout)} disabled={deletingId === workout.id} aria-label="Delete workout" className="grid size-9 shrink-0 place-items-center rounded-xl text-white/35 transition hover:bg-red-400/10 hover:text-red-300">{deletingId === workout.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>}</div>{workout.proof_url && <div className="relative mx-3 overflow-hidden rounded-xl bg-black/35 sm:mx-4"><img src={workout.proof_url} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl" /><img src={workout.proof_url} alt={`${workout.workout_type} proof`} className="relative mx-auto block max-h-[420px] max-w-full object-contain sm:max-h-[520px]" /></div>}
{workout.note && <p className="px-3.5 py-3 text-sm text-white/55 sm:px-4">{workout.note}</p>}
<WorkoutReactions workoutId={workout.id} reactions={reactions} currentUserId={currentUserId} busy={reactingId === workout.id} onToggle={emoji => toggleReaction(workout.id, emoji)} onShowDetails={emoji => setReactionDetails({ workoutId: workout.id, emoji })} />
</article>; })}</div>}</section><Dialog open={Boolean(reactionDetails)} onOpenChange={open => { if (!open) setReactionDetails(null); }}><DialogContent className="rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:p-6"><DialogHeader><DialogTitle className="text-2xl font-black">Who reacted {reactionDetails?.emoji}</DialogTitle><DialogDescription className="text-white/42">People who used this reaction on the workout.</DialogDescription></DialogHeader><div className="mt-2 max-h-72 space-y-2 overflow-y-auto">{reactionDetails && reactions.filter(reaction => reaction.workout_id === reactionDetails.workoutId && reaction.emoji === reactionDetails.emoji).sort((a, b) => (profiles.get(a.user_id)?.username ?? "Member").localeCompare(profiles.get(b.user_id)?.username ?? "Member")).map(reaction => { const reactor = profiles.get(reaction.user_id); return <div key={reaction.user_id} className="flex items-center gap-3 rounded-2xl bg-white/[.045] p-3"><UserAvatar name={reactor?.username ?? "Member"} avatarUrl={reactor?.avatar_url} positionX={reactor?.avatar_position_x} positionY={reactor?.avatar_position_y} zoom={reactor?.avatar_zoom} /><p className="font-bold">{reactor?.username ?? "Member"}{reaction.user_id === currentUserId && <span className="ml-1.5 text-sm font-medium text-white/35">(you)</span>}</p></div>; })}</div></DialogContent></Dialog></>;
}

function CalendarView({ username, avatarUrl, avatarPositionX, avatarPositionY, avatarZoom, workouts, onProfile }: { username: string; avatarUrl?: string; avatarPositionX?: number; avatarPositionY?: number; avatarZoom?: number; workouts: Workout[]; onProfile: () => void }) {
  const [month, setMonth] = useState(today.getMonth());
  const [mode, setMode] = useState<"month" | "year">("month");
  const year = today.getFullYear();
  const workoutDates = new Set(workouts.map(workout => workout.workout_date));
  const workoutCounts = workouts.reduce((counts, workout) => counts.set(workout.workout_date, (counts.get(workout.workout_date) ?? 0) + 1), new Map<string, number>());
  const streak = calculateStreak(workouts);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthlyCount = workouts.filter(workout => { const d = new Date(`${workout.workout_date}T12:00:00`); return d.getFullYear() === year && d.getMonth() === month; }).length;

  return <>
    <Header eyebrow="Your consistency" title="Calendar" username={username} avatarUrl={avatarUrl} avatarPositionX={avatarPositionX} avatarPositionY={avatarPositionY} avatarZoom={avatarZoom} onProfile={onProfile} />
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">{[[monthlyCount, "this month"], [streak.count, "day streak"], [workouts.length, "this year"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-white/8 bg-panel p-3.5 sm:p-4"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs text-white/42">{label}</p></div>)}</div>
    <div className="mb-3 flex justify-end gap-1"><button onClick={() => setMode("month")} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", mode === "month" ? "bg-white text-ink" : "bg-white/6 text-white/45")}>Month</button><button onClick={() => setMode("year")} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", mode === "year" ? "bg-white text-ink" : "bg-white/6 text-white/45")}>Year</button></div>
    {mode === "month" ? <section className="rounded-[26px] border border-white/8 bg-panel p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between"><Button disabled={month === 0} onClick={() => setMonth(value => value - 1)} variant="ghost" size="icon-sm" className="text-white/55"><ChevronLeft /></Button><h2 className="text-lg font-extrabold">{new Date(year, month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><Button disabled={month === 11} onClick={() => setMonth(value => value + 1)} variant="ghost" size="icon-sm" className="text-white/55"><ChevronRight /></Button></div>
      <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <div key={`${day}-${index}`} className="pb-2 text-xs font-bold text-white/34">{day}</div>)}
        {Array.from({ length: offset }).map((_, index) => <div key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(day => {
          const key = dateKey(new Date(year, month, day));
          const worked = workoutDates.has(key);
          const multiple = (workoutCounts.get(key) ?? 0) > 1;
          const isStreak = streak.dates.has(key);
          const column = (offset + day - 1) % 7;
          const connectsLeft = isStreak && column > 0 && streak.dates.has(dateKey(new Date(year, month, day - 1)));
          const connectsRight = isStreak && column < 6 && streak.dates.has(dateKey(new Date(year, month, day + 1)));
          return <div key={day} className={cn("relative isolate grid aspect-square place-items-center text-sm font-semibold", worked && !isStreak && "rounded-xl bg-lime font-extrabold text-ink", isStreak && "bg-[#426b4f] font-extrabold text-white", isStreak && !connectsLeft && "rounded-l-xl", isStreak && !connectsRight && "rounded-r-xl", multiple && "ring-2 ring-amber-300 ring-offset-2 ring-offset-[#181e19]")}>{connectsLeft && <span className="absolute inset-y-0 -left-2 -z-10 w-2 bg-[#426b4f]" />}{connectsRight && <span className="absolute inset-y-0 -right-2 -z-10 w-2 bg-[#426b4f]" />}<span className="relative z-10">{day}</span></div>;
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-white/45"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-lime" />Workout</span><span className="flex items-center gap-2"><i className="h-2.5 w-5 rounded-full bg-[#426b4f]" />Current streak</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm border-2 border-amber-300" />Multiple workouts</span></div>
    </section> : <section className="grid grid-cols-2 gap-3 rounded-[26px] border border-white/8 bg-panel p-4 sm:grid-cols-3 sm:p-6">{Array.from({ length: 12 }, (_, monthIndex) => { const count = workouts.filter(workout => { const d = new Date(`${workout.workout_date}T12:00:00`); return d.getFullYear() === year && d.getMonth() === monthIndex; }).length; return <button key={monthIndex} onClick={() => { setMonth(monthIndex); setMode("month"); }} className="rounded-2xl bg-white/[.035] p-4 text-left"><p className="text-sm font-bold">{new Date(year, monthIndex).toLocaleDateString(undefined, { month: "short" })}</p><p className="mt-2 text-2xl font-black text-lime">{count}</p><p className="text-xs text-white/35">workouts</p></button>; })}</section>}
  </>;
}

function GroupSettingsDialog({ group, open, onOpenChange, onChanged, onManageMembers }: { group: Group; open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => Promise<void>; onManageMembers: () => void }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [quota, setQuota] = useState(group.weekly_quota);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group.name); setDescription(group.description); setQuota(group.weekly_quota); setPassword(""); setMessage(""); setIsError(false);
  }, [open, group.id, group.name, group.description, group.weekly_quota]);

  async function saveSettings() {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 50) { setIsError(true); setMessage("Enter a group name between 1 and 50 characters."); return; }
    if (quota < 1 || quota > 14) { setIsError(true); setMessage("Weekly quota must be between 1 and 14."); return; }
    if (password && password.length < 4) { setIsError(true); setMessage("A new password must be at least 4 characters."); return; }
    const supabase = getSupabase(); if (!supabase) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.rpc("update_group_settings", { p_group_id: group.id, p_name: trimmedName, p_description: description.trim(), p_quota: quota, p_password: password || null });
    if (error) { setSaving(false); setIsError(true); setMessage(error.message); return; }
    await onChanged(); setSaving(false); setPassword(""); setIsError(false); setMessage("Group settings saved.");
  }

  async function copyInviteCode() {
    try { await navigator.clipboard.writeText(group.invite_code); setIsError(false); setMessage("Invite code copied."); }
    catch { setIsError(true); setMessage("Could not copy automatically. Press and hold the code to copy it."); }
  }

  async function regenerateInviteCode() {
    if (!window.confirm("Regenerate the invite code? The current invite link and code will stop working.")) return;
    const supabase = getSupabase(); if (!supabase) return;
    setRegenerating(true); setMessage("");
    const { error } = await supabase.rpc("regenerate_group_invite", { p_group_id: group.id });
    if (error) { setRegenerating(false); setIsError(true); setMessage(error.message); return; }
    await onChanged(); setRegenerating(false); setIsError(false); setMessage("A new invite code was generated.");
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete ${group.name}? This removes the group for every member. Personal workout history will not be deleted.`)) return;
    const supabase = getSupabase(); if (!supabase) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.from("groups").delete().eq("id", group.id);
    if (error) { setSaving(false); setIsError(true); setMessage(error.message); return; }
    onOpenChange(false); await onChanged();
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:max-w-lg sm:p-6"><DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl font-black"><Settings className="size-5 text-lime" />Group settings</DialogTitle><DialogDescription className="text-white/42">Only the group owner can make these changes.</DialogDescription></DialogHeader><div className="space-y-5"><div className="space-y-4 rounded-2xl border border-white/8 bg-white/[.025] p-4"><div><label htmlFor="settings-name" className="mb-2 block text-sm font-bold">Group name</label><Input id="settings-name" value={name} onChange={event => setName(event.target.value)} maxLength={50} className="h-11 border-white/10 bg-white/5" /></div><div><label htmlFor="settings-description" className="mb-2 block text-sm font-bold">Description</label><Textarea id="settings-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={180} className="min-h-20 resize-none border-white/10 bg-white/5" /></div><div><label htmlFor="settings-quota" className="mb-2 block text-sm font-bold">Weekly quota</label><Input id="settings-quota" type="number" min={1} max={14} value={quota} onChange={event => setQuota(Number(event.target.value))} className="h-11 border-white/10 bg-white/5" /></div><div><label htmlFor="settings-password" className="mb-2 block text-sm font-bold">New group password <span className="font-normal text-white/35">optional</span></label><Input id="settings-password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={4} placeholder="Leave blank to keep current password" className="h-11 border-white/10 bg-white/5" /></div><Button onClick={saveSettings} disabled={saving || regenerating} className="h-11 w-full rounded-xl bg-lime font-black text-ink hover:bg-[#d6ff6a]">{saving && <Loader2 className="animate-spin" />}Save changes</Button></div><div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="font-extrabold">Invite code</p><p className="mt-1 text-xs text-white/40">Anyone with this code can join without the password.</p><div className="mt-3 flex items-center gap-2"><code className="min-w-0 flex-1 select-all truncate rounded-xl bg-black/20 px-3 py-2.5 text-sm font-bold tracking-wider text-lime">{group.invite_code}</code><Button onClick={copyInviteCode} variant="outline" size="icon" className="shrink-0 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" aria-label="Copy invite code"><Copy className="size-4" /></Button><Button onClick={regenerateInviteCode} disabled={regenerating || saving} variant="outline" size="icon" className="shrink-0 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" aria-label="Regenerate invite code">{regenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}</Button></div></div><Button onClick={() => { onOpenChange(false); onManageMembers(); }} variant="outline" className="h-11 w-full rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Users className="size-4" />Manage members</Button>{message && <p className={cn("rounded-xl p-3 text-sm", isError ? "bg-red-400/10 text-red-200" : "bg-lime/10 text-lime")}>{message}</p>}<div className="rounded-2xl border border-red-400/15 bg-red-400/[.045] p-4"><p className="font-extrabold text-red-200">Danger zone</p><p className="mt-1 text-xs leading-5 text-white/40">Deleting the group removes it for everyone. Members keep their personal workout history.</p><Button onClick={deleteGroup} disabled={saving || regenerating} variant="outline" className="mt-3 h-10 w-full rounded-xl border-red-400/20 bg-red-400/8 text-red-200 hover:bg-red-400/15 hover:text-red-100"><Trash2 className="size-4" />Delete group</Button></div></div></DialogContent></Dialog>;
}

function GroupsView({ username, avatarUrl, avatarPositionX, avatarPositionY, avatarZoom, currentUserId, groups, selectedId, setSelectedId, members, workouts, onProfile, onManage, onChanged }: { username: string; avatarUrl?: string; avatarPositionX?: number; avatarPositionY?: number; avatarZoom?: number; currentUserId: string; groups: Group[]; selectedId: string | null; setSelectedId: (id: string) => void; members: MemberProgress[]; workouts: Workout[]; onProfile: () => void; onManage: () => void; onChanged: () => Promise<void> }) {
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<"progress" | "stats">("progress");
  const [working, setWorking] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const selected = groups.find(group => group.id === selectedId) ?? groups[0];
  if (!selected) return <><Header eyebrow="Accountability together" title="Groups" username={username} avatarUrl={avatarUrl} avatarPositionX={avatarPositionX} avatarPositionY={avatarPositionY} avatarZoom={avatarZoom} onProfile={onProfile} /><EmptyState icon={Users} title="You’re not in a group yet" detail="Create a private group or find one and join with its password or invite code." action="Find or create a group" onAction={onManage} /></>;

  const isOwner = selected.owner_id === currentUserId;
  const memberIds = new Set(members.map(member => member.profile.id));
  const selectedWorkouts = workouts.filter(workout => memberIds.has(workout.user_id));
  const currentMonth = dateKey(new Date()).slice(0, 7);
  const monthlyWorkouts = selectedWorkouts.filter(workout => workout.workout_date.startsWith(currentMonth));
  const weeklyTotal = members.reduce((total, member) => total + member.count, 0);
  const highestWeekly = weeklyTotal ? Math.max(...members.map(member => member.count)) : 0;
  const lowestWeekly = weeklyTotal ? Math.min(...members.map(member => member.count)) : 0;
  const mostActive = weeklyTotal ? members.filter(member => member.count === highestWeekly) : [];
  const leastActive = weeklyTotal ? members.filter(member => member.count === lowestWeekly) : [];
  const activeDays = new Set(monthlyWorkouts.map(workout => workout.workout_date)).size;
  const averagePerMember = members.length ? monthlyWorkouts.length / members.length : 0;
  const quotaHits = members.filter(member => member.count >= selected.weekly_quota).length;
  const typeCounts = (["Gym", "Cardio", "Sports"] as WorkoutType[]).map(type => ({ type, count: monthlyWorkouts.filter(workout => workout.workout_type === type).length }));
  const topTypeCount = Math.max(0, ...typeCounts.map(item => item.count));
  const topTypes = topTypeCount ? typeCounts.filter(item => item.count === topTypeCount).map(item => item.type) : [];

  async function leaveGroup() {
    if (isOwner || !window.confirm(`Leave ${selected.name}? Your workouts will stay in your personal history.`)) return;
    const supabase = getSupabase(); if (!supabase) return;
    setWorking(true); setActionError("");
    const { error } = await supabase.from("group_members").delete().eq("group_id", selected.id).eq("user_id", currentUserId);
    setWorking(false);
    if (error) { setActionError(error.message); return; }
    await onChanged();
  }

  async function kickMember(member: MemberProgress) {
    if (!isOwner || member.role === "owner" || member.profile.id === currentUserId) return;
    if (!window.confirm(`Remove ${member.profile.username} from ${selected.name}? They can rejoin later with the group password or invite link.`)) return;
    const supabase = getSupabase(); if (!supabase) return;
    setKickingId(member.profile.id); setActionError("");
    const { error } = await supabase.from("group_members").delete().eq("group_id", selected.id).eq("user_id", member.profile.id);
    if (error) { setKickingId(null); setActionError(error.message); return; }
    await onChanged(); setKickingId(null);
  }

  return <>
    <Header eyebrow={`${groups.length} active group${groups.length === 1 ? "" : "s"}`} title={selected.name} username={username} avatarUrl={avatarUrl} avatarPositionX={avatarPositionX} avatarPositionY={avatarPositionY} avatarZoom={avatarZoom} onProfile={onProfile} />
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">{groups.map(group => <button key={group.id} onClick={() => { setSelectedId(group.id); setSection("progress"); setActionError(""); }} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-bold", selected.id === group.id ? "bg-white text-ink" : "bg-white/7 text-white/48")}>{group.name}</button>)}<button onClick={onManage} className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-white/45"><Plus className="size-4" /></button></div>
    <section className="rounded-[26px] border border-white/8 bg-panel p-5 sm:p-6">
      <div><p className="text-sm text-white/45">Weekly quota</p><p className="mt-1 text-2xl font-black">{selected.weekly_quota} workouts</p></div>
      {selected.description && <p className="mt-4 text-sm text-white/45">{selected.description}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button onClick={() => setMembersOpen(true)} variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Users className="size-4" />View members</Button>
        {isOwner
          ? <Button onClick={() => setSettingsOpen(true)} variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Settings className="size-4" />Group settings</Button>
          : <Button onClick={leaveGroup} disabled={working} variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">{working ? <Loader2 className="animate-spin" /> : <DoorOpen className="size-4" />}Leave group</Button>}
      </div>
      {actionError && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{actionError}</p>}
    </section>
    <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl bg-white/[.035] p-1.5"><button onClick={() => setSection("progress")} className={cn("rounded-xl py-2.5 text-sm font-bold transition", section === "progress" ? "bg-white text-ink" : "text-white/45")}>Weekly progress</button><button onClick={() => setSection("stats")} className={cn("rounded-xl py-2.5 text-sm font-bold transition", section === "stats" ? "bg-white text-ink" : "text-white/45")}>Group stats</button></div>
    {section === "progress" ? <section className="mt-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold">This week</h2><span className="text-xs text-white/40">Mon–Sun</span></div><div className="space-y-3">{members.map(member => <div key={member.profile.id} className="rounded-[20px] border border-white/8 bg-panel p-4"><div className="mb-3 flex items-center gap-3"><UserAvatar name={member.profile.username} avatarUrl={member.profile.avatar_url} positionX={member.profile.avatar_position_x} positionY={member.profile.avatar_position_y} zoom={member.profile.avatar_zoom} /><div className="flex-1 font-bold">{member.profile.username}{member.profile.id === currentUserId && <span className="ml-2 text-xs font-medium text-white/35">you</span>}</div><span className={cn("text-sm font-black", member.count >= selected.weekly_quota ? "text-lime" : "text-white/66")}>{member.count} / {selected.weekly_quota} {member.count >= selected.weekly_quota && <Check className="ml-1 inline size-4" />}</span></div><Progress value={Math.min(100, (member.count / selected.weekly_quota) * 100)} className="h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-lime" /></div>)}</div></section> : <section className="mt-6 space-y-5"><div><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold">Weekly titles</h2><span className="text-xs text-white/40">Resets Monday</span></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[22px] border border-lime/15 bg-lime/[.055] p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-lime">The Moment</p><p className="mt-3 text-xl font-black">{mostActive.length ? mostActive.map(member => member.profile.username).join(", ") : "—"}</p><p className="mt-1 text-sm text-white/40">{mostActive.length ? `${highestWeekly} workout${highestWeekly === 1 ? "" : "s"} this week` : "No workouts yet"}</p></div><div className="rounded-[22px] border border-[#fb7185]/15 bg-[#fb7185]/[.055] p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#fb8b9c]">Lazy Fuck</p><p className="mt-3 text-xl font-black">{leastActive.length ? leastActive.map(member => member.profile.username).join(", ") : "—"}</p><p className="mt-1 text-sm text-white/40">{leastActive.length ? `${lowestWeekly} workout${lowestWeekly === 1 ? "" : "s"} this week` : "No workouts yet"}</p></div></div></div><div><h2 className="mb-4 text-xl font-extrabold">This month</h2><div className="grid grid-cols-2 gap-3"><div className="rounded-[20px] border border-white/8 bg-panel p-4"><p className="text-3xl font-black">{monthlyWorkouts.length}</p><p className="mt-1 text-xs text-white/40">total workouts</p></div><div className="rounded-[20px] border border-white/8 bg-panel p-4"><p className="text-3xl font-black">{averagePerMember.toFixed(1)}</p><p className="mt-1 text-xs text-white/40">average per member</p></div><div className="rounded-[20px] border border-white/8 bg-panel p-4"><p className="text-3xl font-black">{activeDays}</p><p className="mt-1 text-xs text-white/40">active days</p></div><div className="rounded-[20px] border border-white/8 bg-panel p-4"><p className="truncate text-2xl font-black">{topTypes.length ? topTypes.join(" + ") : "—"}</p><p className="mt-1 text-xs text-white/40">top workout type</p></div></div></div><div className="rounded-[20px] border border-white/8 bg-panel p-4"><div className="flex items-center justify-between"><div><p className="font-extrabold">Weekly quota hits</p><p className="mt-1 text-xs text-white/40">Members who reached {selected.weekly_quota} workouts</p></div><p className="text-2xl font-black text-lime">{quotaHits}/{members.length}</p></div><Progress value={members.length ? (quotaHits / members.length) * 100 : 0} className="mt-4 h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-lime" /></div></section>}
    <button onClick={onManage} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/16 py-4 text-sm font-bold text-white/48 hover:border-lime/50 hover:text-lime"><Search className="size-4" />Find or create another group</button>
    <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
      <DialogContent className="rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{selected.name} members</DialogTitle>
          <DialogDescription className="text-white/42">{members.length} of 10 spots filled{isOwner ? " · You can remove members" : ""}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-2">{members.map(member => <div key={member.profile.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <UserAvatar name={member.profile.username} avatarUrl={member.profile.avatar_url} positionX={member.profile.avatar_position_x} positionY={member.profile.avatar_position_y} zoom={member.profile.avatar_zoom} />
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{member.profile.username}{member.profile.id === currentUserId && <span className="ml-2 text-xs font-medium text-white/35">you</span>}</p>{member.role === "owner" ? <p className="flex items-center gap-1 text-xs font-bold text-amber-300"><Crown className="size-3.5 fill-amber-300/20" />Owner</p> : <p className="text-xs capitalize text-white/40">Member</p>}</div>
          {isOwner && member.role !== "owner" && member.profile.id !== currentUserId && <button onClick={() => kickMember(member)} disabled={kickingId !== null} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-red-400/15 bg-red-400/8 px-3 text-xs font-bold text-red-200 transition hover:bg-red-400/15 disabled:opacity-45" aria-label={`Remove ${member.profile.username} from group`}>{kickingId === member.profile.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}Kick</button>}
        </div>)}</div>
        {actionError && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{actionError}</p>}
      </DialogContent>
    </Dialog>
    {isOwner && <GroupSettingsDialog group={selected} open={settingsOpen} onOpenChange={setSettingsOpen} onChanged={onChanged} onManageMembers={() => setMembersOpen(true)} />}
  </>;
}

function ProfileView({ profile, workoutCount, streak, groupCount, onChanged }: { profile: Profile; workoutCount: number; streak: number; groupCount: number; onChanged: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState("");
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(100);
  const dragRef = useRef<{ clientX: number; clientY: number; positionX: number; positionY: number; width: number; height: number } | null>(null);
  async function signOut() { await getSupabase()?.auth.signOut(); window.location.href = "/login"; }
  function closeCrop() {
    if (cropFile && cropPreview) URL.revokeObjectURL(cropPreview);
    setCropOpen(false); setCropFile(null); setCropPreview(""); dragRef.current = null;
  }
  function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Profile pictures must be under 5 MB."); return; }
    setPhotoError(""); setCropFile(file); setCropPreview(URL.createObjectURL(file)); setCropX(50); setCropY(50); setCropZoom(100); setCropOpen(true);
  }
  async function saveCrop() {
    const supabase = getSupabase(); if (!supabase) return;
    setUploading(true); setPhotoError("");
    let nextPath = profile.avatar_path;
    if (cropFile) {
      const extension = cropFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      nextPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("avatars").upload(nextPath, cropFile, { contentType: cropFile.type });
      if (upload.error) { setUploading(false); setPhotoError(upload.error.message); return; }
    }
    const update = await supabase.from("profiles").update({ avatar_path: nextPath, avatar_position_x: Math.round(cropX), avatar_position_y: Math.round(cropY), avatar_zoom: Math.round(cropZoom) }).eq("id", profile.id);
    if (update.error) { if (cropFile && nextPath) await supabase.storage.from("avatars").remove([nextPath]); setUploading(false); setPhotoError(update.error.message); return; }
    if (cropFile && profile.avatar_path && profile.avatar_path !== nextPath) await supabase.storage.from("avatars").remove([profile.avatar_path]);
    closeCrop(); await onChanged(); setUploading(false);
  }
  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return <><Header eyebrow="Your profile" title={profile.username} username={profile.username} avatarUrl={profile.avatar_url} avatarPositionX={profile.avatar_position_x} avatarPositionY={profile.avatar_position_y} avatarZoom={profile.avatar_zoom} /><section className="rounded-[28px] border border-white/8 bg-panel p-6 text-center"><div className="relative mx-auto w-fit"><UserAvatar name={profile.username} avatarUrl={profile.avatar_url} positionX={profile.avatar_position_x} positionY={profile.avatar_position_y} zoom={profile.avatar_zoom} large /><label htmlFor="profile-photo" className="absolute -bottom-1 -right-1 grid size-9 cursor-pointer place-items-center rounded-full border-4 border-panel bg-lime text-ink shadow-lg"><Camera className="size-4" /><input id="profile-photo" type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={event => { choosePhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div><div className="mt-4 flex justify-center"><button onClick={() => document.getElementById("profile-photo")?.click()} disabled={uploading} className="text-sm font-bold text-lime">{profile.avatar_path ? "Change picture" : "Add profile picture"}</button></div>{photoError && <p className="mx-auto mt-3 max-w-sm rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{photoError}</p>}<h2 className="mt-4 text-2xl font-black">@{profile.username}</h2><p className="mt-1 text-sm text-white/40">Member since {memberSince}</p><div className="mt-6 grid grid-cols-3 divide-x divide-white/8 rounded-2xl bg-white/[.035] py-4"><div><p className="text-2xl font-black">{workoutCount}</p><p className="text-xs text-white/40">this year</p></div><div><p className="text-2xl font-black">{streak}</p><p className="text-xs text-white/40">day streak</p></div><div><p className="text-2xl font-black">{groupCount}</p><p className="text-xs text-white/40">groups</p></div></div></section><button onClick={signOut} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-panel p-4 text-left font-bold text-white/65"><span className="grid size-9 place-items-center rounded-xl bg-white/6"><LogOut className="size-4" /></span>Log out</button><Dialog open={cropOpen} onOpenChange={open => { if (!open && !uploading) closeCrop(); }}><DialogContent className="rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:p-6"><DialogHeader><DialogTitle className="text-2xl font-black">Position your picture</DialogTitle><DialogDescription className="text-white/42">Drag the photo until it looks right inside the circle.</DialogDescription></DialogHeader><div className="flex justify-center py-4"><div className="relative size-[260px] touch-none cursor-grab overflow-hidden rounded-full border-4 border-lime/70 bg-black active:cursor-grabbing" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { clientX: event.clientX, clientY: event.clientY, positionX: cropX, positionY: cropY, width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight }; }} onPointerMove={event => { const drag = dragRef.current; if (!drag) return; setCropX(Math.max(0, Math.min(100, drag.positionX - ((event.clientX - drag.clientX) / drag.width) * 100))); setCropY(Math.max(0, Math.min(100, drag.positionY - ((event.clientY - drag.clientY) / drag.height) * 100))); }} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>{cropPreview && <img src={cropPreview} alt="Profile crop preview" draggable={false} className="pointer-events-none size-full select-none object-cover" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom / 100})`, transformOrigin: `${cropX}% ${cropY}%` }} />}<div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/30" /></div></div><label className="mb-5 block text-sm font-bold text-white/60">Zoom <span className="float-right text-white/35">{cropZoom}%</span><input type="range" min="100" max="300" step="5" value={cropZoom} onChange={event => setCropZoom(Number(event.target.value))} className="mt-3 w-full accent-lime" /></label><div className="grid grid-cols-2 gap-2"><Button onClick={closeCrop} disabled={uploading} variant="outline" className="h-11 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">Cancel</Button><Button onClick={saveCrop} disabled={uploading} className="h-11 rounded-xl bg-lime font-black text-ink hover:bg-[#d6ff6a]">{uploading && <Loader2 className="animate-spin" />}Save picture</Button></div></DialogContent></Dialog></>;
}

function LogDialog({ open, onOpenChange, onLogged }: { open: boolean; onOpenChange: (open: boolean) => void; onLogged: () => Promise<void> }) {
  const [type, setType] = useState<WorkoutType>("Gym"); const [photo, setPhoto] = useState<File | null>(null); const [date, setDate] = useState(dateKey(new Date())); const [note, setNote] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit() { if (!photo) return;
setSaving(true);
setError("");
const supabase = getSupabase();
if (!supabase) { setSaving(false); return; }
const { data: { user } } = await supabase.auth.getUser();
if (!user) { setSaving(false);
setError("Please log in again.");
return;
}
let preparedPhoto: File;
try { preparedPhoto = await compressWorkoutPhoto(photo); }
catch (compressionError) { setSaving(false); setError(compressionError instanceof Error ? compressionError.message : "Could not prepare that photo."); return; }
const path = `${user.id}/${crypto.randomUUID()}-${preparedPhoto.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
const upload = await supabase.storage.from("proof-photos").upload(path, preparedPhoto, { contentType: preparedPhoto.type, cacheControl: "3600" });
if (upload.error) { setSaving(false);
setError(upload.error.message);
return;
} const insert = await supabase.from("workouts").insert({ user_id: user.id, workout_type: type, workout_date: date, note, proof_path: path });
if (insert.error) { await supabase.storage.from("proof-photos").remove([path]);
setSaving(false);
setError(insert.error.message);
return;
} await onLogged();
setSaving(false);
setPhoto(null);
setNote("");
onOpenChange(false);
}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:p-6"><DialogHeader><DialogTitle className="text-2xl font-black">Log a workout</DialogTitle><DialogDescription className="text-white/42">Every valid workout counts as 1 in all your groups.</DialogDescription></DialogHeader><div className="mt-2 space-y-5"><fieldset><legend className="mb-2.5 text-sm font-bold">Workout type</legend><div className="grid grid-cols-3 gap-2">{(["Gym", "Cardio", "Sports"] as WorkoutType[]).map(item => <button key={item} onClick={() => setType(item)} className={cn("rounded-xl border px-2 py-3 text-sm font-bold", type === item ? "border-lime bg-lime text-ink" : "border-white/10 bg-white/4 text-white/55")}>{item}</button>)}</div></fieldset><div><label htmlFor="date" className="mb-2 block text-sm font-bold">Date</label><Input id="date" type="date" min={dateKey(addDays(new Date(), -1))} max={dateKey(new Date())} value={date} onChange={event => setDate(event.target.value)} className="h-12 border-white/10 bg-white/5 text-white [color-scheme:dark]" /></div><div><label htmlFor="proof" className="mb-2 block text-sm font-bold">Proof photo</label><label htmlFor="proof" className={cn("flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed", photo ? "border-lime bg-lime/8 text-lime" : "border-white/18 bg-white/[.025] text-white/44")}><ImagePlus className="size-5" /><span className="max-w-[85%] truncate text-sm font-bold">{photo?.name || "Take or choose a photo"}</span>
<input id="proof" type="file" accept="image/*" className="sr-only" onChange={event => setPhoto(event.target.files?.[0] ?? null)} />
</label></div><div><label htmlFor="note" className="mb-2 block text-sm font-bold">Note <span className="font-normal text-white/35">optional</span></label><Textarea id="note" value={note} onChange={event => setNote(event.target.value)} maxLength={280} className="min-h-20 resize-none border-white/10 bg-white/5" /></div>{error && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button onClick={submit} disabled={!photo || saving} className="h-12 w-full rounded-xl bg-lime text-base font-black text-ink hover:bg-[#d6ff6a]">{saving ? <Loader2 className="animate-spin" /> : <Activity className="size-5" />}Log {type}</Button></div></DialogContent></Dialog>;
}

function GroupDialog({ open, onOpenChange, discoverGroups, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; discoverGroups: Group[]; onChanged: (id?: string) => Promise<void> }) {
  const [mode, setMode] = useState<"create" | "join">("create"); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [quota, setQuota] = useState(4); const [password, setPassword] = useState(""); const [search, setSearch] = useState(""); const [selected, setSelected] = useState<Group | null>(null); const [inviteCode, setInviteCode] = useState(""); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const results = discoverGroups.filter(group => group.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  async function submit() { const supabase = getSupabase(); if (!supabase) return; setSaving(true); setMessage(""); const result = mode === "create" ? await supabase.rpc("create_group", { p_name: name, p_description: description, p_quota: quota, p_password: password }) : await supabase.rpc("join_group", { p_group_id: selected?.id ?? null, p_password: password || null, p_invite_code: inviteCode || null }); setSaving(false); if (result.error) { setMessage(result.error.message); return; } await onChanged(typeof result.data === "string" ? result.data : selected?.id); onOpenChange(false); setName(""); setDescription(""); setPassword(""); setInviteCode(""); setSelected(null); }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:p-6"><DialogHeader><DialogTitle className="text-2xl font-black">Groups</DialogTitle><DialogDescription className="text-white/42">You can belong to up to three groups.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode("create")} className={cn("rounded-xl py-2.5 text-sm font-bold", mode === "create" ? "bg-lime text-ink" : "bg-white/6 text-white/45")}>Create</button><button onClick={() => setMode("join")} className={cn("rounded-xl py-2.5 text-sm font-bold", mode === "join" ? "bg-lime text-ink" : "bg-white/6 text-white/45")}>Join</button></div>{mode === "create" ? <div className="space-y-4"><div><label className="mb-2 block text-sm font-bold" htmlFor="group-name">Group name</label><Input id="group-name" value={name} onChange={event => setName(event.target.value)} maxLength={50} className="h-12 border-white/10 bg-white/5" /></div><div><label className="mb-2 block text-sm font-bold" htmlFor="description">Description <span className="font-normal text-white/35">optional</span></label><Textarea id="description" value={description} onChange={event => setDescription(event.target.value)} maxLength={180} className="border-white/10 bg-white/5" /></div><div><label className="mb-2 block text-sm font-bold" htmlFor="quota">Weekly quota</label><Input id="quota" type="number" min={1} max={14} value={quota} onChange={event => setQuota(Number(event.target.value))} className="h-12 border-white/10 bg-white/5" /></div><div><label className="mb-2 block text-sm font-bold" htmlFor="create-password">Group password</label><Input id="create-password" type="password" minLength={4} value={password} onChange={event => setPassword(event.target.value)} className="h-12 border-white/10 bg-white/5" /></div></div> : <div className="space-y-4"><div><label className="mb-2 block text-sm font-bold" htmlFor="search">Find a group</label><Input id="search" value={search} onChange={event => { setSearch(event.target.value); setSelected(null); }} placeholder="Search by name" className="h-12 border-white/10 bg-white/5" /></div>{search && <div className="max-h-40 space-y-1 overflow-y-auto">{results.length ? results.map(group => <button key={group.id} onClick={() => setSelected(group)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold", selected?.id === group.id ? "bg-lime text-ink" : "bg-white/5 text-white/65")}><span>{group.name}</span><span>{group.weekly_quota}/wk</span></button>) : <p className="text-sm text-white/35">No matching groups.</p>}</div>}<div><label className="mb-2 block text-sm font-bold" htmlFor="join-password">Group password</label><Input id="join-password" type="password" value={password} onChange={event => setPassword(event.target.value)} className="h-12 border-white/10 bg-white/5" /></div><div className="flex items-center gap-3 text-xs text-white/25"><span className="h-px flex-1 bg-white/8" />or<span className="h-px flex-1 bg-white/8" /></div><div><label className="mb-2 block text-sm font-bold" htmlFor="invite">Invite code</label><Input id="invite" value={inviteCode} onChange={event => setInviteCode(event.target.value.trim())} placeholder="Paste invite code" className="h-12 border-white/10 bg-white/5" /></div></div>}{message && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{message}</p>}<Button onClick={submit} disabled={saving || (mode === "create" ? !name || !password || quota < 1 || quota > 14 : (!selected && !inviteCode))} className="h-12 w-full rounded-xl bg-lime font-black text-ink hover:bg-[#d6ff6a]">{saving && <Loader2 className="animate-spin" />}{mode === "create" ? "Create group" : "Join group"}</Button></DialogContent></Dialog>;
}

export default function LiftItApp() {
  const [view, setView] = useState<View>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [feed, setFeed] = useState<Workout[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [groupWorkouts, setGroupWorkouts] = useState<Workout[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const refresh = useCallback(async (preferredGroupId?: string) => {
    if (!isSupabaseConfigured()) { window.location.href = "/login"; return; }
    const supabase = getSupabase(); if (!supabase) return;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { await supabase.auth.signOut(); window.location.href = "/login"; return; }
    let { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!profileData) { const fallback = String(user.user_metadata.username || user.email?.split("@")[0] || "member").slice(0, 24); const inserted = await supabase.from("profiles").upsert({ id: user.id, username: fallback }).select("*").single(); if (inserted.error || !inserted.data) { await supabase.auth.signOut(); window.location.href = "/login"; return; } profileData = inserted.data; }
    const [ownProfile] = await addAvatarUrls([profileData as Profile]);
    if (ownProfile) setProfile(ownProfile);
    const yearStart = `${today.getFullYear()}-01-01`;
    const [{ data: ownWorkouts }, { data: myMemberships }, { data: searchable }] = await Promise.all([
      supabase.from("workouts").select("*").eq("user_id", user.id).gte("workout_date", yearStart).order("workout_date", { ascending: false }),
      supabase.from("group_members").select("*").eq("user_id", user.id),
      supabase.from("groups").select("id,owner_id,name,description,image_path,weekly_quota,invite_code,created_at").order("name").limit(50),
    ]);
    setWorkouts((ownWorkouts ?? []) as Workout[]); setDiscoverGroups((searchable ?? []) as Group[]);
    const ownMembershipRows = (myMemberships ?? []) as Membership[]; const groupIds = ownMembershipRows.map(row => row.group_id); setMemberships(ownMembershipRows);
    if (!groupIds.length) { setGroups([]); setFeed([]); setReactions([]); setGroupWorkouts([]); setProfiles(new Map(ownProfile ? [[ownProfile.id, ownProfile]] : [])); setSelectedGroupId(null); setLoading(false); return; }
    const [{ data: groupRows }, { data: allMemberships }, { data: visibleWorkouts }] = await Promise.all([
      supabase.from("groups").select("id,owner_id,name,description,image_path,weekly_quota,invite_code,created_at").in("id", groupIds),
      supabase.from("group_members").select("*").in("group_id", groupIds),
      supabase.from("workouts").select("*").gte("workout_date", yearStart).order("created_at", { ascending: false }),
    ]);
    const groupList = (groupRows ?? []) as Group[]; const membershipRows = (allMemberships ?? []) as Membership[]; const memberIds = [...new Set(membershipRows.map(row => row.user_id))];
    const { data: profileRows } = await supabase.from("profiles").select("*").in("id", memberIds);
    const profilesWithAvatars = await addAvatarUrls((profileRows ?? []) as Profile[]);
    const profileMap = new Map<string, Profile>(profilesWithAvatars.map(item => [item.id, item])); setProfiles(profileMap); setGroups(groupList); setMemberships(membershipRows);
    const memberSet = new Set(memberIds); const week = dateKey(weekStart()); const visible = ((visibleWorkouts ?? []) as Workout[]).filter(workout => memberSet.has(workout.user_id)); setGroupWorkouts(visible);
    const recent = visible.filter(workout => workout.workout_date >= week).slice(0, 20); const paths = recent.map(workout => workout.proof_path);
    if (paths.length) { const { data: signed } = await supabase.storage.from("proof-photos").createSignedUrls(paths, 3600); const urlMap = new Map((signed ?? []).map(item => [item.path, item.signedUrl ?? undefined])); recent.forEach(workout => { workout.proof_url = urlMap.get(workout.proof_path); }); }
    const recentIds = recent.map(workout => workout.id);
    if (recentIds.length) { const { data: reactionRows } = await supabase.from("reactions").select("*").in("workout_id", recentIds); setReactions((reactionRows ?? []) as Reaction[]); }
    else setReactions([]);
    setFeed(recent); setSelectedGroupId(preferredGroupId && groupIds.includes(preferredGroupId) ? preferredGroupId : current => current && groupIds.includes(current) ? current : groupList[0]?.id ?? null); setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const selectedGroup = groups.find(group => group.id === selectedGroupId) ?? groups[0]; const weeklyStart = dateKey(weekStart());
  const memberProgress = useMemo<MemberProgress[]>(() => { if (!selectedGroup) return []; const groupMembers = memberships.filter(row => row.group_id === selectedGroup.id); return groupMembers.map(row => ({ profile: profiles.get(row.user_id) ?? { id: row.user_id, username: "Member", avatar_path: null, avatar_position_x: 50, avatar_position_y: 50, avatar_zoom: 100, created_at: row.joined_at }, role: row.role, count: groupWorkouts.filter(workout => workout.user_id === row.user_id && workout.workout_date >= weeklyStart).length })).sort((a, b) => a.profile.username.localeCompare(b.profile.username)); }, [selectedGroup, memberships, profiles, groupWorkouts, weeklyStart]);
  if (loading || !profile) return <main className="grid min-h-screen place-items-center bg-ink text-lime"><Loader2 className="size-7 animate-spin" /></main>;
  const pageTitle = titleCase(view); const streak = calculateStreak(workouts).count;
  return <main className="min-h-screen bg-ink text-white"><div className="mx-auto flex min-h-screen max-w-[1180px]"><DesktopNav view={view} setView={setView} onLog={() => setLogOpen(true)} groupCount={groups.length} /><div className="min-w-0 flex-1"><div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-ink/88 px-5 backdrop-blur-xl md:hidden"><Brand /><span className="text-xs font-bold uppercase tracking-[.13em] text-white/35">{pageTitle}</span></div><div className="mx-auto w-full max-w-[720px] px-4 pb-28 pt-7 sm:px-7 md:pb-16 md:pt-10">
{view === "home" && <HomeView username={profile.username} avatarUrl={profile.avatar_url} avatarPositionX={profile.avatar_position_x} avatarPositionY={profile.avatar_position_y} avatarZoom={profile.avatar_zoom} currentUserId={profile.id} workouts={workouts} groups={groups} feed={feed} profiles={profiles} reactions={reactions} onProfile={() => setView("profile")} onGroups={() => setView("groups")} onDeleted={() => refresh(selectedGroupId ?? undefined)} onReactionChanged={() => refresh(selectedGroupId ?? undefined)} />}
{view === "calendar" && <CalendarView username={profile.username} avatarUrl={profile.avatar_url} avatarPositionX={profile.avatar_position_x} avatarPositionY={profile.avatar_position_y} avatarZoom={profile.avatar_zoom} workouts={workouts} onProfile={() => setView("profile")} />}
{view === "groups" && <GroupsView username={profile.username} avatarUrl={profile.avatar_url} avatarPositionX={profile.avatar_position_x} avatarPositionY={profile.avatar_position_y} avatarZoom={profile.avatar_zoom} currentUserId={profile.id} groups={groups} selectedId={selectedGroupId} setSelectedId={setSelectedGroupId} members={memberProgress} workouts={groupWorkouts} onProfile={() => setView("profile")} onManage={() => setGroupOpen(true)} onChanged={() => refresh()} />}
{view === "profile" && <ProfileView profile={profile} workoutCount={workouts.length} streak={streak} groupCount={groups.length} onChanged={() => refresh(selectedGroupId ?? undefined)} />}</div></div></div><AppNav view={view} setView={setView} onLog={() => setLogOpen(true)} /><LogDialog open={logOpen} onOpenChange={setLogOpen} onLogged={() => refresh(selectedGroupId ?? undefined)} /><GroupDialog open={groupOpen} onOpenChange={setGroupOpen} discoverGroups={discoverGroups.filter(group => !groups.some(own => own.id === group.id))} onChanged={refresh} /></main>;
}
