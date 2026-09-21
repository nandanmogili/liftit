"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Dumbbell, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";

type StrengthUnit = "lb" | "kg";
type LiftKey = "incline_dumbbell_press" | "triceps_pushdown" | "overhead_press" | "incline_curl" | "seated_cable_row" | "lat_pulldown" | "leg_extension" | "leg_curl" | "hip_thrust" | "calf_raise" | "cable_crunch";
type MuscleKey = "chest" | "triceps" | "shoulders" | "biceps" | "upperBack" | "lats" | "quads" | "hamstrings" | "glutes" | "calves" | "core";
type Tier = "needs" | "developing" | "balanced" | "strong" | "dominant";
type StrengthProfile = { user_id: string; unit: StrengthUnit; updated_at: string } & Record<LiftKey, number | null>;

const poundsPerKilogram = 2.2046226218;
const lifts: { key: LiftKey; muscle: MuscleKey; label: string; detail: string; referenceLb: number }[] = [
  { key: "incline_dumbbell_press", muscle: "chest", label: "Incline dumbbell press", detail: "Weight per dumbbell", referenceLb: 50 },
  { key: "triceps_pushdown", muscle: "triceps", label: "Triceps pushdown", detail: "Displayed stack weight", referenceLb: 60 },
  { key: "overhead_press", muscle: "shoulders", label: "Overhead press", detail: "Total weight", referenceLb: 95 },
  { key: "incline_curl", muscle: "biceps", label: "Incline dumbbell curl", detail: "Weight per dumbbell", referenceLb: 25 },
  { key: "seated_cable_row", muscle: "upperBack", label: "Seated cable row", detail: "Displayed stack weight", referenceLb: 110 },
  { key: "lat_pulldown", muscle: "lats", label: "Lat pulldown", detail: "Displayed stack weight", referenceLb: 110 },
  { key: "leg_extension", muscle: "quads", label: "Leg extension", detail: "Displayed stack weight", referenceLb: 100 },
  { key: "leg_curl", muscle: "hamstrings", label: "Leg curl", detail: "Displayed stack weight", referenceLb: 80 },
  { key: "hip_thrust", muscle: "glutes", label: "Hip thrust", detail: "Total weight", referenceLb: 185 },
  { key: "calf_raise", muscle: "calves", label: "Calf raise", detail: "Total weight", referenceLb: 140 },
  { key: "cable_crunch", muscle: "core", label: "Cable crunch", detail: "Displayed stack weight", referenceLb: 80 },
];

const tiers: Record<Tier, { label: string; color: string; text: string }> = {
  needs: { label: "Needs work", color: "#ef6461", text: "text-[#ef8a87]" },
  developing: { label: "Developing", color: "#e89b4a", text: "text-[#f1b46f]" },
  balanced: { label: "Balanced", color: "#4fa86f", text: "text-[#73c990]" },
  strong: { label: "Strong", color: "#4f8fcf", text: "text-[#79afe5]" },
  dominant: { label: "Dominant", color: "#9b72cf", text: "text-[#bb92ec]" },
};

const blankValues = () => Object.fromEntries(lifts.map(lift => [lift.key, ""])) as Record<LiftKey, string>;
const displayValue = (kilograms: number, unit: StrengthUnit) => unit === "lb" ? kilograms * poundsPerKilogram : kilograms;
const storedKilograms = (value: number, unit: StrengthUnit) => unit === "lb" ? value / poundsPerKilogram : value;

function BodyDiagram({ colors }: { colors: Partial<Record<MuscleKey, string>> }) {
  const fill = (muscle: MuscleKey) => colors[muscle] ?? "#3a413b";
  const region = (muscle: MuscleKey) => ({ fill: fill(muscle), stroke: "rgba(255,255,255,.16)", strokeWidth: 1.2, className: "transition-colors duration-300" });
  return <div className="grid grid-cols-2 gap-3">
    <figure className="rounded-2xl border border-white/6 bg-black/10 p-3"><svg viewBox="0 0 180 330" className="mx-auto h-64 w-auto" role="img" aria-label="Front muscle development diagram">
      <circle cx="90" cy="28" r="20" fill="#59605a" /><path d="M73 48 Q90 58 107 48 L115 68 103 78H77L65 68Z" fill="#59605a" />
      <path d="M76 70 Q58 70 49 88L59 105 76 94Z" {...region("shoulders")} /><path d="M104 70 Q122 70 131 88L121 105 104 94Z" {...region("shoulders")} />
      <path d="M77 72 Q90 67 90 96Q79 105 65 96L65 82Z" {...region("chest")} /><path d="M103 72 Q90 67 90 96Q101 105 115 96L115 82Z" {...region("chest")} />
      <path d="M56 96 Q43 110 45 137L58 142 66 106Z" {...region("biceps")} /><path d="M124 96 Q137 110 135 137L122 142 114 106Z" {...region("biceps")} />
      <path d="M45 139 Q39 160 43 181L54 181 59 143Z" fill="#59605a" /><path d="M135 139 Q141 160 137 181L126 181 121 143Z" fill="#59605a" />
      <path d="M68 100 Q90 111 112 100L110 160Q90 172 70 160Z" {...region("core")} /><path d="M90 108V160M72 125H108M71 143H109" fill="none" stroke="rgba(255,255,255,.2)" />
      <path d="M70 160 Q55 190 58 242L82 242 90 168Z" {...region("quads")} /><path d="M110 160 Q125 190 122 242L98 242 90 168Z" {...region("quads")} />
      <path d="M59 244 Q55 275 62 306L78 306 81 244Z" {...region("calves")} /><path d="M121 244 Q125 275 118 306L102 306 99 244Z" {...region("calves")} />
      <path d="M59 306H80L84 318H55Z" fill="#59605a" /><path d="M121 306H100L96 318H125Z" fill="#59605a" />
    </svg><figcaption className="text-center text-[11px] font-bold uppercase tracking-wider text-white/28">Front</figcaption></figure>
    <figure className="rounded-2xl border border-white/6 bg-black/10 p-3"><svg viewBox="0 0 180 330" className="mx-auto h-64 w-auto" role="img" aria-label="Back muscle development diagram">
      <circle cx="90" cy="28" r="20" fill="#59605a" /><path d="M73 48 Q90 58 107 48 L115 68 103 78H77L65 68Z" fill="#59605a" />
      <path d="M76 70 Q58 70 49 88L59 105 76 94Z" {...region("shoulders")} /><path d="M104 70 Q122 70 131 88L121 105 104 94Z" {...region("shoulders")} />
      <path d="M72 74 Q90 66 108 74L110 111Q90 125 70 111Z" {...region("upperBack")} />
      <path d="M69 94 Q58 109 62 151L82 162 89 113Z" {...region("lats")} /><path d="M111 94 Q122 109 118 151L98 162 91 113Z" {...region("lats")} />
      <path d="M56 96 Q43 110 45 139L58 144 66 106Z" {...region("triceps")} /><path d="M124 96 Q137 110 135 139L122 144 114 106Z" {...region("triceps")} />
      <path d="M45 141 Q39 160 43 181L54 181 59 145Z" fill="#59605a" /><path d="M135 141 Q141 160 137 181L126 181 121 145Z" fill="#59605a" />
      <path d="M70 157 Q90 149 110 157L111 189Q90 204 69 189Z" {...region("glutes")} />
      <path d="M70 188 Q55 207 58 244L82 244 90 193Z" {...region("hamstrings")} /><path d="M110 188 Q125 207 122 244L98 244 90 193Z" {...region("hamstrings")} />
      <path d="M59 246 Q55 275 62 306L78 306 81 246Z" {...region("calves")} /><path d="M121 246 Q125 275 118 306L102 306 99 246Z" {...region("calves")} />
      <path d="M59 306H80L84 318H55Z" fill="#59605a" /><path d="M121 306H100L96 318H125Z" fill="#59605a" />
    </svg><figcaption className="text-center text-[11px] font-bold uppercase tracking-wider text-white/28">Back</figcaption></figure>
  </div>;
}

export function StrengthTracker({ userId, initialEnabled = false, initialUnit = "lb", onProfileChanged }: { userId: string; initialEnabled?: boolean; initialUnit?: StrengthUnit; onProfileChanged: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [unit, setUnit] = useState<StrengthUnit>(initialUnit);
  const [values, setValues] = useState<Record<LiftKey, string>>(blankValues);
  const [loading, setLoading] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.from("strength_profiles").select("*").eq("user_id", userId).maybeSingle().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message);
      else if (data) {
        const profile = data as StrengthProfile;
        const storedUnit = profile.unit ?? initialUnit;
        setUnit(storedUnit);
        setValues(Object.fromEntries(lifts.map(lift => [lift.key, profile[lift.key] == null ? "" : displayValue(Number(profile[lift.key]), storedUnit).toFixed(1)])) as Record<LiftKey, string>);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [enabled, initialUnit, userId]);

  const entered = useMemo(() => lifts.flatMap(lift => { const value = Number(values[lift.key]); return Number.isFinite(value) && value > 0 ? [{ ...lift, value, normalized: (unit === "lb" ? value : value * poundsPerKilogram) / lift.referenceLb }] : []; }), [values, unit]);
  const muscleTiers = useMemo(() => {
    if (!entered.length) return {} as Partial<Record<MuscleKey, Tier>>;
    const sorted = entered.map(item => item.normalized).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return Object.fromEntries(entered.map(item => { const relative = item.normalized / Math.max(median, .01); const tier: Tier = relative < .7 ? "needs" : relative < .9 ? "developing" : relative <= 1.1 ? "balanced" : relative <= 1.35 ? "strong" : "dominant"; return [item.muscle, tier]; })) as Partial<Record<MuscleKey, Tier>>;
  }, [entered]);
  const colors = useMemo(() => Object.fromEntries(Object.entries(muscleTiers).map(([muscle, tier]) => [muscle, tiers[tier].color])) as Partial<Record<MuscleKey, string>>, [muscleTiers]);

  async function toggleEnabled() {
    const supabase = getSupabase(); if (!supabase) return;
    setSettingsBusy(true); setError("");
    const next = !enabled;
    const { error: updateError } = await supabase.from("profiles").update({ strength_tracking_enabled: next }).eq("id", userId);
    if (updateError) setError(updateError.message); else { setEnabled(next); await onProfileChanged(); }
    setSettingsBusy(false);
  }

  function changeUnit(next: StrengthUnit) {
    if (next === unit) return;
    setValues(Object.fromEntries(lifts.map(lift => { const numeric = Number(values[lift.key]); if (!Number.isFinite(numeric) || numeric <= 0) return [lift.key, ""]; return [lift.key, (next === "lb" ? numeric * poundsPerKilogram : numeric / poundsPerKilogram).toFixed(1)]; })) as Record<LiftKey, string>);
    setUnit(next); setMessage("");
  }

  async function saveProfile() {
    const invalid = lifts.find(lift => values[lift.key] !== "" && (!Number.isFinite(Number(values[lift.key])) || Number(values[lift.key]) <= 0 || Number(values[lift.key]) > (unit === "lb" ? 2200 : 1000)));
    if (invalid) { setError(`Enter a valid weight for ${invalid.label}.`); return; }
    const supabase = getSupabase(); if (!supabase) return;
    setSaving(true); setError(""); setMessage("");
    const payload = Object.fromEntries(lifts.map(lift => { const numeric = Number(values[lift.key]); return [lift.key, values[lift.key] === "" ? null : Number(storedKilograms(numeric, unit).toFixed(2))]; }));
    const { error: saveError } = await supabase.from("strength_profiles").upsert({ user_id: userId, unit, ...payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) setError(saveError.message); else setMessage(entered.length ? "Strength profile updated." : "Empty strength profile saved. Add a lift whenever you're ready.");
    setSaving(false);
  }

  async function clearProfile() {
    if (!window.confirm("Clear every saved strength entry?")) return;
    const supabase = getSupabase(); if (!supabase) return;
    setSaving(true); setError(""); setMessage("");
    const { error: deleteError } = await supabase.from("strength_profiles").delete().eq("user_id", userId);
    if (deleteError) setError(deleteError.message); else { setValues(blankValues()); setMessage("Strength profile cleared."); }
    setSaving(false);
  }

  if (!enabled) return <section className="mt-5 rounded-[24px] border border-white/8 bg-panel p-5"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-400/10 text-blue-300"><Dumbbell className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-extrabold">Strength tracking</h2><p className="mt-1 text-sm leading-6 text-white/42">Privately save your latest benchmark lifts and see your muscular balance. No field is required.</p></div></div>{error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button onClick={toggleEnabled} disabled={settingsBusy} className="mt-5 h-11 w-full rounded-xl bg-blue-400 font-black text-[#0e1822] hover:bg-blue-300">{settingsBusy && <Loader2 className="animate-spin" />}Enable strength tracking</Button></section>;

  return <section className="mt-5 rounded-[24px] border border-white/8 bg-panel p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-blue-300">Private · latest entries</p><h2 className="mt-1 text-xl font-black">Strength balance</h2><p className="mt-1 text-xs leading-5 text-white/35">All lifts assume 3 sets of 8–10 reps.</p></div><div className="flex rounded-xl bg-white/5 p-1">{(["lb", "kg"] as StrengthUnit[]).map(option => <button key={option} onClick={() => changeUnit(option)} className={cn("rounded-lg px-3 py-1.5 text-xs font-black uppercase", unit === option ? "bg-white text-ink" : "text-white/40")}>{option}</button>)}</div></div>
    <div className="mt-5"><BodyDiagram colors={colors} /></div>
    <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-2">{(Object.keys(tiers) as Tier[]).map(tier => <span key={tier} className="flex items-center gap-1.5 text-[10px] font-bold text-white/45"><i className="size-2.5 rounded-full" style={{ backgroundColor: tiers[tier].color }} />{tiers[tier].label}</span>)}<span className="flex items-center gap-1.5 text-[10px] font-bold text-white/45"><i className="size-2.5 rounded-full bg-[#3a413b]" />Not entered</span></div>
    <div className="mt-5 rounded-2xl bg-white/[.035] p-4"><div className="flex items-center justify-between"><div><p className="font-extrabold">Your benchmark lifts</p><p className="text-xs text-white/35">{entered.length ? `${entered.length} of ${lifts.length} entered · ${entered.length < 3 ? "Partial profile" : "Balance calculated"}` : "Nothing entered yet"}</p></div><Activity className="size-5 text-blue-300/70" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{lifts.map(lift => { const tier = muscleTiers[lift.muscle]; return <label key={lift.key} className="block rounded-xl border border-white/6 bg-black/10 p-3"><span className="flex items-center justify-between gap-2 text-sm font-bold"><span>{lift.label}</span>{tier && <span className={cn("text-[10px]", tiers[tier].text)}>{tiers[tier].label}</span>}</span><span className="mt-0.5 block text-[10px] text-white/30">{lift.detail}</span><div className="relative mt-2"><Input type="number" inputMode="decimal" min="0" max={unit === "lb" ? 2200 : 1000} step="0.5" value={values[lift.key]} onChange={event => { setValues(current => ({ ...current, [lift.key]: event.target.value })); setMessage(""); setError(""); }} placeholder="—" className="h-10 border-white/8 bg-white/[.035] pr-10" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/28">{unit}</span></div></label>; })}</div></div>
    <p className="mt-4 text-xs leading-5 text-white/30">Colors compare your entered lifts with one another using exercise-specific benchmarks. Machine stacks vary, so this is an estimate of personal balance—not a medical assessment or public ranking.</p>
    {message && <p className="mt-4 rounded-xl bg-blue-400/10 p-3 text-sm text-blue-200">{message}</p>}{error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <Button onClick={saveProfile} disabled={saving || loading} className="mt-4 h-11 w-full rounded-xl bg-blue-400 font-black text-[#0e1822] hover:bg-blue-300">{saving || loading ? <Loader2 className="animate-spin" /> : <Check className="size-4" />}Save strength profile</Button>
    <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={clearProfile} disabled={saving || entered.length === 0} className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white/30 hover:bg-white/5 hover:text-white/55 disabled:opacity-30"><RotateCcw className="size-3.5" />Clear entries</button><button onClick={toggleEnabled} disabled={settingsBusy} className="h-9 rounded-xl text-xs font-bold text-white/30 hover:bg-white/5 hover:text-white/55">{settingsBusy ? "Updating…" : "Hide strength tracking"}</button></div>
  </section>;
}
