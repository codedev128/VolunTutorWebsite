"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/* ── Constants ───────────────────────────────────────── */
const SUBJECTS = [
  "Maths", "Physics", "Biology", "English", "History",
  "Economics", "Business", "Accounts", "Social", "Politics",
  "Geography", "Computer Science", "IT", "Arts", "Psychology",
];

const GRADE_OPTIONS = [
  { value: "GRADE_6",  label: "Grade 6"          },
  { value: "GRADE_7",  label: "Grade 7"          },
  { value: "GRADE_8",  label: "Grade 8"          },
  { value: "GRADE_9",  label: "Grade 9"          },
  { value: "GRADE_10", label: "Grade 10"         },
  { value: "GRADE_11", label: "Grade 11"         },
  { value: "GRADE_12", label: "Grade 12"         },
  { value: "UG",       label: "University (UG)"  },
  { value: "PG",       label: "University (PG)"  },
  { value: "PHD",      label: "PhD"              },
];

const MORNING_HOURS = Array.from({ length: 6 }, (_, i) => i + 6);  // 6 AM – 11 AM
const EVENING_HOURS = Array.from({ length: 10 }, (_, i) => i + 12); // 12 PM – 9 PM

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ── Date helpers ────────────────────────────────────── */
function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function slotKey(d: Date, h: number) {
  return `${isoDate(d)}-${h}`;
}

function formatHour(h: number) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatHourRange(h: number) {
  return `${formatHour(h)} – ${formatHour(h + 1)}`;
}

function formatWeekRange(dates: Date[]) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${dates[0].toLocaleDateString("en-GB", opts)} – ${dates[6].toLocaleDateString("en-GB", opts)}`;
}

/* ── Weekly timetable ────────────────────────────────── */
function WeeklyTimetable({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<"morning" | "evening">("morning");
  const dates = getWeekDates(weekOffset);
  const today = isoDate(new Date());
  const hours = tab === "morning" ? MORNING_HOURS : EVENING_HOURS;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="flex size-6 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600 transition"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-xs font-bold text-gray-600">{formatWeekRange(dates)}</span>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="flex size-6 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600 transition"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-2">
        {(["morning", "evening"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              tab === t
                ? "bg-amber-400 text-white shadow-sm"
                : "text-gray-500 hover:text-amber-600 hover:bg-amber-50"
            }`}
          >
            {t === "morning" ? "Morning" : "Evening"}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th className="w-24 border-b border-r border-gray-100 bg-gray-50 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Time
              </th>
              {dates.map((d, i) => {
                const isToday = isoDate(d) === today;
                return (
                  <th
                    key={i}
                    className={`border-b border-r border-gray-100 py-1.5 text-center last:border-r-0 ${isToday ? "bg-amber-50" : "bg-gray-50"}`}
                  >
                    <p className={`font-bold ${isToday ? "text-amber-600" : "text-gray-500"}`}>
                      {DAY_LABELS[i]}
                    </p>
                    <p className={`text-[10px] font-semibold ${isToday ? "text-amber-400" : "text-gray-400"}`}>
                      {d.getDate()}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border-b border-r border-gray-100 bg-gray-50 text-center text-[10px] font-semibold text-gray-400">
                  <div className="flex h-7 items-center justify-center px-1">
                    {formatHourRange(hour)}
                  </div>
                </td>
                {dates.map((d, i) => {
                  const key = slotKey(d, hour);
                  const isSelected = selected.has(key);
                  const isToday = isoDate(d) === today;
                  return (
                    <td
                      key={i}
                      onClick={() => onToggle(key)}
                      className={`h-7 cursor-pointer border-b border-r border-gray-100 last:border-r-0 transition-colors ${
                        isSelected
                          ? "bg-amber-400 hover:bg-amber-500"
                          : isToday
                          ? "bg-amber-50/60 hover:bg-amber-100"
                          : "hover:bg-amber-50"
                      }`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-gray-500">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-amber-50 border border-amber-200" />
          <span className="text-[10px] text-gray-500">Today</span>
        </div>
        <p className="ml-auto text-[10px] text-gray-400">
          {selected.size} slot{selected.size !== 1 ? "s" : ""} selected
        </p>
      </div>
    </div>
  );
}

/* ── Back button ─────────────────────────────────────── */
function BackButton() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-amber-600">
      <span className="flex size-8 items-center justify-center rounded-full border border-gray-200 bg-white/80 shadow-sm transition group-hover:border-amber-300 group-hover:bg-amber-50">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      Back
    </Link>
  );
}

/* ── Matching screen ─────────────────────────────────── */
function MatchingScreen({ subject }: { subject: string }) {
  return (
    <div className="relative flex flex-col items-center px-6 text-center">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-black/10 bg-white/90 p-10 shadow-sm backdrop-blur-sm max-w-md w-full">
        <div className="relative flex size-20 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-30" />
          <span className="relative flex size-14 items-center justify-center rounded-full bg-amber-100 border-2 border-amber-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Finding your VolunTutor</h2>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;re matching you with the best volunteer tutor for{" "}
            <span className="font-semibold text-amber-600">{subject}</span>.
          </p>
        </div>
        <div className="w-full rounded-xl bg-amber-50 border border-amber-100 px-5 py-4 text-left space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600">What happens next</p>
          <ol className="space-y-1.5 text-sm text-gray-600 list-none">
            {["We check availability & subject match", "You're paired with a compatible tutor", "You'll receive a notification with their details"].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <Link href="/" className="text-sm font-semibold text-amber-600 underline underline-offset-2 hover:no-underline">
          Back to homepage
        </Link>
      </div>
    </div>
  );
}

/* ── Select style shared class ───────────────────────── */
const selectCls = "flex h-9 w-full rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus-visible:border-amber-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-300/40";

/* ── Page ────────────────────────────────────────────── */
export default function FindPage() {
  const [subject, setSubject]       = useState("");
  const [gradeLevel, setGradeLevel] = useState("GRADE_9");
  const [helpMessage, setHelpMessage] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [submitted, setSubmitted]   = useState(false);

  const charLeft = 500 - helpMessage.length;

  const toggleSlot = useCallback((key: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  function handleSubmit() {
    setError("");
    if (!subject)             { setError("Please select a subject."); return; }
    if (!helpMessage.trim())  { setError("Please describe what you need help with."); return; }
    if (helpMessage.length > 500) { setError("Help message must be under 500 characters."); return; }
    if (selectedSlots.size === 0) { setError("Please select at least one availability slot in the timetable."); return; }

    const rawName = email.trim()
      ? email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : `Student${Math.floor(Math.random() * 9000) + 1000}`;
    const avatar = rawName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

    const request = {
      id: Date.now().toString(),
      studentName: rawName,
      avatar,
      subject,
      gradeLevel,
      helpMessage,
      availabilitySlots: [...selectedSlots],
      submittedAt: new Date().toISOString(),
      status: "pending",
    };
    try {
      const existing = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");
      localStorage.setItem("vt_student_requests", JSON.stringify([...existing, request]));
    } catch { /* ignore */ }
    setSubmitted(true);
  }

  return (
    <RhythmicRipplesBackground backgroundColor="#ffffff" rippleColor="rgba(247, 184, 1, 0.4)" rippleCount={18} rippleSpeed={0.4}>
      <div className="absolute top-6 left-6">
        <BackButton />
      </div>

      {submitted ? (
        <MatchingScreen subject={subject} />
      ) : (
        <div className="relative flex w-full max-w-2xl flex-col px-6 py-16 sm:py-10">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Find a <span className="italic text-amber-500">VolunTutor.</span>
            </h1>
            <p className="mt-3 text-base text-gray-500">
              Tell us what you need — we&apos;ll find the right volunteer for you, for free.
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-black/10 bg-white/85 p-8 shadow-sm backdrop-blur-sm space-y-6">

            {/* Grade + Subject side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="grade">Your grade / level</Label>
                <select
                  id="grade"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className={selectCls}
                >
                  {GRADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={selectCls}
                >
                  <option value="" disabled>Select a subject…</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Help message */}
            <div className="space-y-1.5">
              <Label htmlFor="help">What do you need help with?</Label>
              <textarea
                id="help"
                rows={3}
                maxLength={500}
                placeholder="Describe the specific topics, problems, or goals you'd like a tutor to help with…"
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
                className="flex w-full resize-none rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm placeholder:text-gray-500/60 focus-visible:border-amber-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-300/40"
              />
              <p className={`text-right text-xs ${charLeft < 50 ? "text-amber-600" : "text-gray-400"}`}>
                {charLeft} characters remaining
              </p>
            </div>

            {/* Timetable */}
            <div className="space-y-1.5">
              <Label>Weekly availability</Label>
              <p className="text-xs text-gray-400">Click the time slots you&apos;re free each week. You can navigate between weeks.</p>
              <WeeklyTimetable selected={selectedSlots} onToggle={toggleSlot} />
            </div>

            {/* Optional account */}
            <details className="group rounded-xl border border-dashed border-gray-200 p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-gray-600 group-open:text-amber-600">
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition group-open:rotate-90">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Create an account to track your match <span className="font-normal text-gray-400">(optional)</span>
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
            </details>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-full bg-gray-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0"
            >
              Find my VolunTutor →
            </button>

            <p className="text-center text-xs text-gray-400">Always free. No credit card required.</p>
          </div>
        </div>
      )}
    </RhythmicRipplesBackground>
  );
}
