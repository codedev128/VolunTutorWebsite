"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";

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

const GRADE_LABELS: Record<string, string> = {
  GRADE_6: "Grade 6", GRADE_7: "Grade 7", GRADE_8: "Grade 8",
  GRADE_9: "Grade 9", GRADE_10: "Grade 10", GRADE_11: "Grade 11",
  GRADE_12: "Grade 12", UG: "University (UG)", PG: "University (PG)", PHD: "PhD",
};

const RECURRENCE_LABELS: Record<number, string> = {
  1: "One-off session", 2: "2 weeks", 3: "3 weeks", 4: "1 month", 8: "2 months",
};

const MORNING_HOURS = Array.from({ length: 6 }, (_, i) => i + 6);
const EVENING_HOURS = Array.from({ length: 10 }, (_, i) => i + 12);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ── Date helpers ────────────────────────────────────── */
function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const dow = now.getDay();
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slotKey(d: Date, h: number) { return `${isoDate(d)}-${h}`; }

function formatHour(h: number) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatHourRange(h: number) { return `${formatHour(h)} – ${formatHour(h + 1)}`; }

function formatWeekRange(dates: Date[]) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${dates[0].toLocaleDateString("en-GB", opts)} – ${dates[6].toLocaleDateString("en-GB", opts)}`;
}

function slotKeyToLabel(key: string): string {
  const parts = key.split("-");
  const hour = parseInt(parts[3]);
  const date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${dayNames[date.getDay()]}, ${date.getDate()} ${date.toLocaleDateString("en-GB", { month: "long" })} · ${formatHourRange(hour)}`;
}

/* ── Weekly timetable ────────────────────────────────── */
function WeeklyTimetable({
  selected,
  onToggle,
  bookedSlots = new Set<string>(),
  pendingSlots = new Set<string>(),
  tutorBookedSlots = new Set<string>(),
  tutorName,
}: {
  selected: Set<string>;
  onToggle: (key: string) => void;
  bookedSlots?: Set<string>;
  pendingSlots?: Set<string>;
  tutorBookedSlots?: Set<string>;
  tutorName?: string;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<"morning" | "evening">("morning");
  const dates = getWeekDates(weekOffset);
  const today = isoDate(new Date());
  const hours = tab === "morning" ? MORNING_HOURS : EVENING_HOURS;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
        <button type="button" onClick={() => setWeekOffset((w) => w - 1)}
          className="flex size-6 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600 transition">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-xs font-bold text-gray-600">{formatWeekRange(dates)}</span>
        <button type="button" onClick={() => setWeekOffset((w) => w + 1)}
          className="flex size-6 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600 transition">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="flex gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-2">
        {(["morning", "evening"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              tab === t ? "bg-amber-400 text-white shadow-sm" : "text-gray-500 hover:text-amber-600 hover:bg-amber-50"
            }`}>
            {t === "morning" ? "Morning" : "Evening"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th className="w-24 border-b border-r border-gray-100 bg-gray-50 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Time</th>
              {dates.map((d, i) => {
                const isToday = isoDate(d) === today;
                return (
                  <th key={i} className={`border-b border-r border-gray-100 py-1.5 text-center last:border-r-0 ${isToday ? "bg-amber-50" : "bg-gray-50"}`}>
                    <p className={`font-bold ${isToday ? "text-amber-600" : "text-gray-500"}`}>{DAY_LABELS[i]}</p>
                    <p className={`text-[10px] font-semibold ${isToday ? "text-amber-400" : "text-gray-400"}`}>{d.getDate()}</p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border-b border-r border-gray-100 bg-gray-50 text-center text-[10px] font-semibold text-gray-400">
                  <div className="flex h-7 items-center justify-center px-1">{formatHourRange(hour)}</div>
                </td>
                {dates.map((d, i) => {
                  const key = slotKey(d, hour);
                  // Priority: student-booked > tutor-booked > student-pending > selected > today > free
                  const isStudentBooked  = bookedSlots.has(key);
                  const isTutorBooked    = !isStudentBooked && tutorBookedSlots.has(key);
                  const isPending        = !isStudentBooked && !isTutorBooked && pendingSlots.has(key);
                  const isBlocked        = isStudentBooked || isTutorBooked || isPending;
                  const isSelected       = !isBlocked && selected.has(key);
                  const isToday          = isoDate(d) === today;
                  return (
                    <td key={i}
                      onClick={() => !isBlocked && onToggle(key)}
                      title={
                        isStudentBooked ? "Your booked session"
                        : isTutorBooked ? `${tutorName ?? "Tutor"} is busy`
                        : isPending ? "Your request pending"
                        : undefined
                      }
                      className={`h-7 relative border-b border-r border-gray-100 last:border-r-0 transition-colors ${
                        isStudentBooked ? "cursor-not-allowed bg-teal-600"
                        : isTutorBooked ? "cursor-not-allowed bg-violet-500"
                        : isPending     ? "cursor-not-allowed bg-amber-300"
                        : isSelected    ? "cursor-pointer bg-amber-400 hover:bg-amber-500"
                        : isToday       ? "cursor-pointer bg-amber-50/60 hover:bg-amber-100"
                        : "cursor-pointer hover:bg-amber-50"
                      }`}>
                      {isStudentBooked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      {isTutorBooked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="4.5" r="2.5" stroke="white" strokeWidth="1.5"/>
                            <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                      )}
                      {isPending && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5"/>
                            <path d="M7 4v3.5l2 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-gray-500">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-teal-600" />
          <span className="text-[10px] text-gray-500">Your booked</span>
        </div>
        {tutorName && (
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm bg-violet-500" />
            <span className="text-[10px] text-gray-500">{tutorName.split(" ")[0]}&apos;s schedule</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-amber-300" />
          <span className="text-[10px] text-gray-500">Request pending</span>
        </div>
        <p className="ml-auto text-[10px] text-gray-400">{selected.size} slot{selected.size !== 1 ? "s" : ""} selected</p>
      </div>
    </div>
  );
}

const selectCls = "flex h-9 w-full rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus-visible:border-amber-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-300/40";

/* ── Page ────────────────────────────────────────────── */
function FindPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetTutorId = searchParams.get("tutorId");
  const { user, isLoading } = useAuth();
  const [subject, setSubject]       = useState("");
  const [gradeLevel, setGradeLevel] = useState("GRADE_9");
  const [helpMessage, setHelpMessage] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(1);
  const [error, setError]           = useState("");
  const [bookedSlots, setBookedSlots]         = useState<Set<string>>(new Set());
  const [pendingSlots, setPendingSlots]       = useState<Set<string>>(new Set());
  const [tutorBookedSlots, setTutorBookedSlots] = useState<Set<string>>(new Set());
  const [targetTutor, setTargetTutor]         = useState<{ id: string; name: string; initials: string } | null>(null);
  const [submitted, setSubmitted]             = useState(false);
  const [confirmedSlots, setConfirmedSlots]   = useState<string[]>([]);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Require login — redirect to auth page if not signed in
  useEffect(() => {
    if (!isLoading && !user) router.replace("/find/auth");
    if (!isLoading && user?.role === "tutor") router.replace("/become/dashboard");
  }, [user, isLoading, router]);

  // Load already-booked and pending slots for this student
  useEffect(() => {
    if (!user) return;
    try {
      const allRequests: Array<{
        id: string;
        studentId?: string;
        status: string;
        availabilitySlots: string[];
        acceptedByTutorId?: string;
      }> = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");

      const myRequests = allRequests.filter((r) => r.studentId === user.id);

      const booked = new Set<string>();
      const pending = new Set<string>();

      for (const req of myRequests) {
        if (req.status === "accepted" && req.acceptedByTutorId) {
          const matches: Array<{ bookedSlots?: string[]; studentId?: string }> =
            JSON.parse(localStorage.getItem(`vt_tutor_matches_${req.acceptedByTutorId}`) || "[]");
          const match = matches.find((m) => m.studentId === user.id);
          if (match?.bookedSlots) {
            match.bookedSlots.forEach((k) => booked.add(k));
          }
          // Also block the full availability set the student originally offered
          req.availabilitySlots?.forEach((k) => booked.add(k));
        } else if (req.status === "pending") {
          req.availabilitySlots?.forEach((k) => pending.add(k));
        }
      }

      setBookedSlots(booked);
      setPendingSlots(pending);
    } catch { /* ignore */ }
  }, [user]);

  // Load selected tutor's info and block their already-booked slots
  useEffect(() => {
    if (!targetTutorId) return;
    try {
      const allUsers: Array<{ id: string; name: string; role: string }> =
        JSON.parse(localStorage.getItem("vt_users") || "[]");
      const tutor = allUsers.find((u) => u.id === targetTutorId && u.role === "tutor");
      if (!tutor) return;
      const initials = tutor.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      setTargetTutor({ id: tutor.id, name: tutor.name, initials });

      // Load tutor's booked slots into a separate set so they show a distinct colour
      const tutorMatches: Array<{ bookedSlots?: string[] }> =
        JSON.parse(localStorage.getItem(`vt_tutor_matches_${targetTutorId}`) || "[]");
      const tbs = new Set<string>();
      tutorMatches.forEach((m) => m.bookedSlots?.forEach((k) => tbs.add(k)));
      setTutorBookedSlots(tbs);
    } catch { /* ignore */ }
  }, [targetTutorId]);

  useEffect(() => {
    if (submitted) confirmRef.current?.focus();
  }, [submitted]);

  const charLeft = 500 - helpMessage.length;

  const toggleSlot = useCallback((key: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  function handleSubmit() {
    if (!user) return;
    setError("");
    if (!subject)             { setError("Please select a subject."); return; }
    if (!helpMessage.trim())  { setError("Please describe what you need help with."); return; }
    if (helpMessage.length > 500) { setError("Help message must be under 500 characters."); return; }
    const cleanSlots = new Set([...selectedSlots].filter((k) => !bookedSlots.has(k) && !pendingSlots.has(k) && !tutorBookedSlots.has(k)));
    if (cleanSlots.size === 0) { setError("Please select at least one availability slot."); return; }

    const avatar = user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    const request = {
      id: Date.now().toString(),
      studentName: user.name,
      avatar,
      subject,
      gradeLevel,
      helpMessage,
      availabilitySlots: [...cleanSlots],
      recurrenceWeeks,
      submittedAt: new Date().toISOString(),
      status: "pending",
      studentId: user.id,
      targetTutorId: targetTutorId ?? undefined,
    };
    try {
      const existing = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");
      localStorage.setItem("vt_student_requests", JSON.stringify([...existing, request]));
    } catch { /* ignore */ }
    setConfirmedSlots([...cleanSlots].sort());
    setSubmitted(true);
  }

  if (isLoading || !user) return null;

  if (submitted) {
    return (
      <RhythmicRipplesBackground backgroundColor="#ffffff" rippleColor="rgba(247, 184, 1, 0.4)" rippleCount={18} rippleSpeed={0.4}>
        <div
          ref={confirmRef}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          tabIndex={-1}
          className="relative flex w-full max-w-xl flex-col px-6 py-12 outline-none"
        >
          <div className="rounded-2xl border border-black/10 bg-white/90 p-8 shadow-sm backdrop-blur-sm space-y-6">
            {/* Success icon + heading */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex size-16 items-center justify-center rounded-full bg-amber-100 border-2 border-amber-300">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Request submitted!</h1>
              <p className="text-sm text-gray-500 max-w-xs">
                {targetTutor
                  ? `Your request has been sent directly to ${targetTutor.name}.`
                  : "We're finding the right VolunTutor for you."}
              </p>
            </div>

            {/* Summary card */}
            <div className="space-y-3" aria-label="Booking summary">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Booking Summary</p>

              {/* Subject + grade */}
              <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Subject</p>
                  <p className="font-bold text-gray-900">{subject}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Level</p>
                  <p className="font-semibold text-gray-800">{GRADE_LABELS[gradeLevel] ?? gradeLevel}</p>
                </div>
              </div>

              {/* Target tutor */}
              {targetTutor && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white" aria-hidden="true">
                    {targetTutor.initials}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Requested Tutor</p>
                    <p className="font-bold text-gray-900">{targetTutor.name}</p>
                  </div>
                </div>
              )}

              {/* Recurrence */}
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Duration</p>
                  <p className="font-semibold text-gray-800">{RECURRENCE_LABELS[recurrenceWeeks] ?? `${recurrenceWeeks} weeks`}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Slots requested</p>
                  <p className="font-semibold text-gray-800">{confirmedSlots.length}</p>
                </div>
              </div>

              {/* Time slots */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Requested time slots
                </p>
                <ul className="space-y-2" aria-label={`${confirmedSlots.length} requested session slot${confirmedSlots.length !== 1 ? "s" : ""}`}>
                  {confirmedSlots.map((slot) => (
                    <li key={slot} className="flex items-center gap-2.5 text-sm text-gray-800">
                      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 border border-amber-200">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </span>
                      {slotKeyToLabel(slot)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={() => router.push("/find/dashboard")}
              className="w-full rounded-full bg-gray-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0"
            >
              Go to my dashboard →
            </button>
          </div>
        </div>
      </RhythmicRipplesBackground>
    );
  }

  return (
    <RhythmicRipplesBackground backgroundColor="#ffffff" rippleColor="rgba(247, 184, 1, 0.4)" rippleCount={18} rippleSpeed={0.4}>
      {/* Back to dashboard */}
      <div className="absolute top-6 left-6">
        <Link href="/find/dashboard" className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-amber-600">
          <span className="flex size-8 items-center justify-center rounded-full border border-gray-200 bg-white/80 shadow-sm transition group-hover:border-amber-300 group-hover:bg-amber-50">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Dashboard
        </Link>
      </div>

      <div className="relative flex w-full max-w-2xl flex-col px-6 py-16 sm:py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {targetTutor ? (
              <>Request <span className="italic text-amber-500">{targetTutor.name}.</span></>
            ) : (
              <>Find a <span className="italic text-amber-500">VolunTutor.</span></>
            )}
          </h1>
          <p className="mt-3 text-base text-gray-500">
            {targetTutor
              ? "Tell them what you need — your request goes directly to this tutor."
              : "Tell us what you need — we’ll find the right volunteer for you, for free."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {/* Submitting as chip */}
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-1.5 text-xs">
              <span className="size-1.5 rounded-full bg-teal-500" />
              <span className="text-gray-500">Submitting as</span>
              <span className="font-semibold text-gray-800">{user.name}</span>
            </div>
            {/* Target tutor chip */}
            {targetTutor && (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs">
                <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-white">{targetTutor.initials}</span>
                <span className="text-gray-500">Requesting</span>
                <span className="font-semibold text-gray-800">{targetTutor.name}</span>
                <button
                  type="button"
                  onClick={() => { setTargetTutor(null); setTutorBookedSlots(new Set()); router.replace("/find"); }}
                  className="ml-1 text-gray-400 hover:text-red-500 transition"
                  title="Remove specific tutor"
                >
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                    <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-black/10 bg-white/85 p-8 shadow-sm backdrop-blur-sm space-y-6">
          {/* Grade + Subject */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="grade">Your grade / level</Label>
              <select id="grade" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={selectCls}>
                {GRADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls}>
                <option value="" disabled>Select a subject…</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Help message */}
          <div className="space-y-1.5">
            <Label htmlFor="help">What do you need help with?</Label>
            <textarea id="help" rows={3} maxLength={500}
              placeholder="Describe the specific topics, problems, or goals you'd like a tutor to help with…"
              value={helpMessage} onChange={(e) => setHelpMessage(e.target.value)}
              className="flex w-full resize-none rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm placeholder:text-gray-500/60 focus-visible:border-amber-400 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-300/40" />
            <p className={`text-right text-xs ${charLeft < 50 ? "text-amber-600" : "text-gray-400"}`}>
              {charLeft} characters remaining
            </p>
          </div>

          {/* Timetable */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Weekly availability</Label>
                <p className="text-xs text-gray-400 mt-0.5">Click the time slots you&apos;re free each week.</p>
              </div>
              <div className="shrink-0 space-y-1">
                <Label htmlFor="recurrence" className="text-xs">How long do you need classes?</Label>
                <select id="recurrence" value={recurrenceWeeks} onChange={(e) => setRecurrenceWeeks(Number(e.target.value))} className={selectCls + " text-xs py-1.5"}>
                  <option value={1}>1 week (one-off)</option>
                  <option value={2}>2 weeks</option>
                  <option value={3}>3 weeks</option>
                  <option value={4}>1 month</option>
                  <option value={8}>2 months</option>
                </select>
              </div>
            </div>
            <WeeklyTimetable
              selected={selectedSlots}
              onToggle={toggleSlot}
              bookedSlots={bookedSlots}
              pendingSlots={pendingSlots}
              tutorBookedSlots={tutorBookedSlots}
              tutorName={targetTutor?.name}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button type="button" onClick={handleSubmit}
            className="w-full rounded-full bg-gray-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0">
            Find my VolunTutor →
          </button>

          <p className="text-center text-xs text-gray-400">Always free. No credit card required.</p>
        </div>
      </div>
    </RhythmicRipplesBackground>
  );
}

export default function FindPage() {
  return (
    <Suspense fallback={null}>
      <FindPageContent />
    </Suspense>
  );
}
