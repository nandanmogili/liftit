"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Edit3, Loader2, Plus, Scale, Trash2 } from "lucide-react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";

type WeightUnit = "lb" | "kg";
type WeightRange = "30D" | "3M" | "1Y";
type WeightEntry = { id: string; user_id: string; weight_kg: number; logged_on: string; created_at: string };

const poundsPerKilogram = 2.2046226218;
const todayKey = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function displayWeight(kilograms: number, unit: WeightUnit) {
  return unit === "lb" ? kilograms * poundsPerKilogram : kilograms;
}

function storedKilograms(value: number, unit: WeightUnit) {
  return unit === "lb" ? value / poundsPerKilogram : value;
}

function rangeStart(range: WeightRange) {
  const date = new Date();
  const days = range === "30D" ? 30 : range === "3M" ? 90 : 365;
  date.setDate(date.getDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

export function WeightTracker({ userId, initialEnabled = false, initialUnit = "lb", onProfileChanged }: { userId: string; initialEnabled?: boolean; initialUnit?: WeightUnit; onProfileChanged: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<WeightRange>("30D");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [entryDate, setEntryDate] = useState(todayKey());
  const [entryWeight, setEntryWeight] = useState("");
  const [loading, setLoading] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [error, setError] = useState("");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; startX: number; startY: number; active: boolean }>({ timer: null, startX: 0, startY: 0, active: false });

  async function loadEntries() {
    const supabase = getSupabase(); if (!supabase) return;
    setLoading(true); setError("");
    const { data, error: loadError } = await supabase.from("weight_entries").select("*").eq("user_id", userId).order("logged_on", { ascending: true });
    if (loadError) setError(loadError.message);
    else setEntries((data ?? []) as WeightEntry[]);
    setLoading(false);
  }

  useEffect(() => { setEnabled(initialEnabled); }, [initialEnabled]);
  useEffect(() => { setUnit(initialUnit); }, [initialUnit]);
  useEffect(() => { if (enabled) loadEntries(); }, [enabled, userId]);
  useEffect(() => () => { if (gestureRef.current.timer) clearTimeout(gestureRef.current.timer); }, []);

  const visibleEntries = useMemo(() => entries.filter(entry => entry.logged_on >= rangeStart(range)), [entries, range]);
  const chartData = useMemo(() => visibleEntries.map(entry => ({ ...entry, shownWeight: Number(displayWeight(Number(entry.weight_kg), unit).toFixed(1)) })), [visibleEntries, unit]);
  const selectedEntry = chartData.find(entry => entry.id === selectedId) ?? chartData.at(-1);
  const currentEntry = entries.at(-1);
  const periodChange = chartData.length > 1 ? chartData.at(-1)!.shownWeight - chartData[0].shownWeight : 0;

  function selectAt(clientX: number) {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds || !chartData.length) return;
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const index = Math.round(ratio * Math.max(0, chartData.length - 1));
    setSelectedId(chartData[index]?.id ?? null);
  }

  function clearGestureTimer() {
    if (gestureRef.current.timer) clearTimeout(gestureRef.current.timer);
    gestureRef.current.timer = null;
  }

  function openForm(entry?: WeightEntry) {
    setEditing(entry ?? null); setEntryDate(entry?.logged_on ?? todayKey());
    setEntryWeight(entry ? displayWeight(Number(entry.weight_kg), unit).toFixed(1) : "");
    setError(""); setFormOpen(true);
  }

  async function toggleEnabled() {
    const supabase = getSupabase(); if (!supabase) return;
    setSettingsBusy(true); setError("");
    const next = !enabled;
    const { error: updateError } = await supabase.from("profiles").update({ weight_tracking_enabled: next }).eq("id", userId);
    if (updateError) { setError(updateError.message); setSettingsBusy(false); return; }
    setEnabled(next); await onProfileChanged(); setSettingsBusy(false);
  }

  async function changeUnit(next: WeightUnit) {
    if (next === unit) return;
    const supabase = getSupabase(); if (!supabase) return;
    setSettingsBusy(true); setError("");
    const { error: updateError } = await supabase.from("profiles").update({ preferred_weight_unit: next }).eq("id", userId);
    if (updateError) { setError(updateError.message); setSettingsBusy(false); return; }
    setUnit(next); await onProfileChanged(); setSettingsBusy(false);
  }

  async function saveEntry() {
    const numericWeight = Number(entryWeight);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) { setError("Enter a valid weight."); return; }
    const kilograms = storedKilograms(numericWeight, unit);
    if (kilograms < 20 || kilograms > 500) { setError(`Enter a weight between ${unit === "lb" ? "44 and 1,102 lb" : "20 and 500 kg"}.`); return; }
    const supabase = getSupabase(); if (!supabase) return;
    setSaving(true); setError("");
    const { error: saveError } = await supabase.from("weight_entries").upsert({ user_id: userId, logged_on: entryDate, weight_kg: Number(kilograms.toFixed(2)) }, { onConflict: "user_id,logged_on" });
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    await loadEntries(); setSaving(false); setFormOpen(false); setEditing(null);
  }

  async function deleteEntry(entry: WeightEntry) {
    if (!window.confirm(`Delete the weight entry from ${dateLabel(entry.logged_on)}?`)) return;
    const supabase = getSupabase(); if (!supabase) return;
    setSaving(true); setError("");
    const { error: deleteError } = await supabase.from("weight_entries").delete().eq("id", entry.id).eq("user_id", userId);
    if (deleteError) setError(deleteError.message); else await loadEntries();
    setSaving(false);
  }

  if (!enabled) return <section className="mt-5 rounded-[24px] border border-white/8 bg-panel p-5"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-300/10 text-teal-200"><Scale className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-extrabold">Weight tracking</h2><p className="mt-1 text-sm leading-6 text-white/42">Privately track your weight and see how it changes over time. This never appears in workouts, groups, or the activity feed.</p></div></div>{error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button onClick={toggleEnabled} disabled={settingsBusy} className="mt-5 h-11 w-full rounded-xl bg-teal-300 font-black text-[#10201d] hover:bg-teal-200">{settingsBusy && <Loader2 className="animate-spin" />}Enable weight tracking</Button></section>;

  return <section className="mt-5 rounded-[24px] border border-white/8 bg-panel p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-teal-200">Private</p><h2 className="mt-1 text-xl font-black">Weight progress</h2></div><div className="flex rounded-xl bg-white/5 p-1">{(["lb", "kg"] as WeightUnit[]).map(option => <button key={option} onClick={() => changeUnit(option)} disabled={settingsBusy} className={cn("rounded-lg px-3 py-1.5 text-xs font-black uppercase", unit === option ? "bg-white text-ink" : "text-white/40")}>{option}</button>)}</div></div>
    <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/[.035] p-4"><p className="text-xs text-white/40">Current</p><p className="mt-1 text-2xl font-black">{currentEntry ? `${displayWeight(Number(currentEntry.weight_kg), unit).toFixed(1)} ${unit}` : "—"}</p></div><div className="rounded-2xl bg-white/[.035] p-4"><p className="text-xs text-white/40">Change · {range}</p><p className={cn("mt-1 text-2xl font-black", periodChange === 0 ? "text-white" : "text-teal-200")}>{chartData.length > 1 ? `${periodChange > 0 ? "+" : ""}${periodChange.toFixed(1)} ${unit}` : "—"}</p></div></div>
    <div className="mt-4 flex gap-1 rounded-xl bg-white/[.035] p-1">{(["30D", "3M", "1Y"] as WeightRange[]).map(option => <button key={option} onClick={() => { setRange(option); setSelectedId(null); }} className={cn("flex-1 rounded-lg py-1.5 text-xs font-black", range === option ? "bg-white/10 text-white" : "text-white/35")}>{option}</button>)}</div>
    <div className="mt-4 rounded-[20px] border border-white/6 bg-black/10 p-3"><div className="mb-1 min-h-11 text-center">{selectedEntry ? <><p className="text-xl font-black text-teal-200">{selectedEntry.shownWeight.toFixed(1)} {unit}</p><p className="text-xs text-white/40">{dateLabel(selectedEntry.logged_on)}</p></> : <><p className="text-sm font-bold text-white/55">No entries in this range</p><p className="text-xs text-white/30">Log a weight to begin your graph.</p></>}</div><div ref={chartRef} className="relative h-52 w-full select-none touch-pan-y" onContextMenu={event => event.preventDefault()} onPointerDown={event => { if (event.pointerType === "mouse") { selectAt(event.clientX); return; } clearGestureTimer(); gestureRef.current.startX = event.clientX; gestureRef.current.startY = event.clientY; gestureRef.current.active = false; gestureRef.current.timer = setTimeout(() => { gestureRef.current.active = true; selectAt(event.clientX); }, 350); }} onPointerMove={event => { if (event.pointerType === "mouse") { selectAt(event.clientX); return; } const gesture = gestureRef.current; if (!gesture.active && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 10) clearGestureTimer(); if (gesture.active) { event.preventDefault(); selectAt(event.clientX); } }} onPointerUp={() => { clearGestureTimer(); gestureRef.current.active = false; }} onPointerCancel={() => { clearGestureTimer(); gestureRef.current.active = false; }}>
      {loading ? <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-teal-200" /></div> : chartData.length ? <><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 18, right: 12, bottom: 4, left: 12 }}><XAxis dataKey="logged_on" hide /><YAxis dataKey="shownWeight" hide domain={["dataMin - 2", "dataMax + 2"]} /><Line type="monotone" dataKey="shownWeight" stroke="#5eead4" strokeWidth={3} dot={{ r: 3, fill: "#5eead4", strokeWidth: 0 }} isAnimationActive={false} />{selectedEntry && <ReferenceLine x={selectedEntry.logged_on} stroke="rgba(255,255,255,.32)" strokeDasharray="3 4" />}</LineChart></ResponsiveContainer><div className="pointer-events-none absolute inset-x-2 bottom-0 flex justify-between text-[10px] text-white/28"><span>{dateLabel(chartData[0].logged_on).replace(/, \d{4}$/, "")}</span><span>{dateLabel(chartData.at(-1)!.logged_on).replace(/, \d{4}$/, "")}</span></div></> : <div className="grid h-full place-items-center text-sm text-white/30">Your graph will appear here.</div>}
    </div><p className="mt-2 text-center text-[11px] text-white/30">Hold and drag to inspect · Hover on desktop</p></div>
    <Button onClick={() => openForm()} className="mt-4 h-11 w-full rounded-xl bg-teal-300 font-black text-[#10201d] hover:bg-teal-200"><Plus className="size-4" />Log weight</Button>
    {entries.length > 0 && <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-[.12em] text-white/30">Recent entries</p><div className="space-y-1.5">{[...entries].reverse().slice(0, 5).map(entry => <div key={entry.id} className="flex items-center gap-3 rounded-xl bg-white/[.035] px-3 py-2.5"><div className="min-w-0 flex-1"><p className="font-bold">{displayWeight(Number(entry.weight_kg), unit).toFixed(1)} {unit}</p><p className="text-xs text-white/35">{dateLabel(entry.logged_on)}</p></div><button onClick={() => openForm(entry)} className="grid size-8 place-items-center rounded-lg text-white/40 hover:bg-white/8 hover:text-white" aria-label={`Edit weight from ${dateLabel(entry.logged_on)}`}><Edit3 className="size-4" /></button><button onClick={() => deleteEntry(entry)} disabled={saving} className="grid size-8 place-items-center rounded-lg text-white/35 hover:bg-red-400/10 hover:text-red-300" aria-label={`Delete weight from ${dateLabel(entry.logged_on)}`}><Trash2 className="size-4" /></button></div>)}</div></div>}
    {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button onClick={toggleEnabled} disabled={settingsBusy} className="mt-5 w-full text-center text-xs font-bold text-white/30 hover:text-white/55">{settingsBusy ? "Updating…" : "Hide weight tracking"}</button>
    <Dialog open={formOpen} onOpenChange={open => { if (!saving) { setFormOpen(open); if (!open) setEditing(null); } }}><DialogContent className="rounded-[26px] border-white/10 bg-[#181e19] p-5 text-white sm:p-6"><DialogHeader><DialogTitle className="text-2xl font-black">{editing ? "Edit weight" : "Log weight"}</DialogTitle><DialogDescription className="text-white/42">One entry per day. Saving the same date again updates that entry.</DialogDescription></DialogHeader><div className="space-y-4"><div><label htmlFor="weight-date" className="mb-2 block text-sm font-bold">Date</label><Input id="weight-date" type="date" max={todayKey()} value={entryDate} onChange={event => setEntryDate(event.target.value)} disabled={Boolean(editing)} className="h-12 border-white/10 bg-white/5 text-white [color-scheme:dark]" /></div><div><label htmlFor="weight-value" className="mb-2 block text-sm font-bold">Weight ({unit})</label><Input id="weight-value" type="number" inputMode="decimal" min={unit === "lb" ? 44 : 20} max={unit === "lb" ? 1102 : 500} step="0.1" value={entryWeight} onChange={event => setEntryWeight(event.target.value)} placeholder={unit === "lb" ? "172.4" : "78.2"} className="h-12 border-white/10 bg-white/5" /></div>{error && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button onClick={saveEntry} disabled={saving || !entryDate || !entryWeight} className="h-12 w-full rounded-xl bg-teal-300 font-black text-[#10201d] hover:bg-teal-200">{saving ? <Loader2 className="animate-spin" /> : <Check className="size-4" />}{editing ? "Save changes" : "Save weight"}</Button></div></DialogContent></Dialog>
  </section>;
}
