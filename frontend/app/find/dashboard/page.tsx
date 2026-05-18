"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";

/* ── Types ───────────────────────────────────────────── */
type MatchStatus = "ACTIVE" | "AWAITING_FIRST_SESSION" | "PAUSED";

interface TutorMatch {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar: string;
  subject: string;
  gradeLevel: string;
  helpMessage: string;
  matchedAt: string;
  sessionCount: number;
  nextSession: string | null;
  bookedSlots: string[];
  status: MatchStatus;
  unreadMessages: number;
}

interface MyRequest {
  id: string;
  studentName: string;
  avatar: string;
  subject: string;
  gradeLevel: string;
  helpMessage: string;
  availabilitySlots: string[];
  recurrenceWeeks?: number;
  submittedAt: string;
  status: "pending" | "accepted" | "cancelled";
  studentId?: string;
  acceptedByTutorId?: string;
}

interface MessageEntry {
  from: "tutor" | "student";
  body: string;
  sentAt?: string;
}

const GRADE_LABELS: Record<string, string> = {
  GRADE_6: "Grade 6", GRADE_7: "Grade 7", GRADE_8: "Grade 8",
  GRADE_9: "Grade 9", GRADE_10: "Grade 10", GRADE_11: "Grade 11",
  GRADE_12: "Grade 12", UG: "University (UG)", PG: "University (PG)", PHD: "PhD",
};

const GRADE_OPTIONS = [
  { value: "GRADE_6", label: "Grade 6" }, { value: "GRADE_7", label: "Grade 7" },
  { value: "GRADE_8", label: "Grade 8" }, { value: "GRADE_9", label: "Grade 9" },
  { value: "GRADE_10", label: "Grade 10" }, { value: "GRADE_11", label: "Grade 11" },
  { value: "GRADE_12", label: "Grade 12" }, { value: "UG", label: "University (UG)" },
  { value: "PG", label: "University (PG)" }, { value: "PHD", label: "PhD" },
];

const SUBJECTS_LIST = [
  "Maths", "Physics", "Biology", "English", "History",
  "Economics", "Business", "Accounts", "Social", "Politics",
  "Geography", "Computer Science", "IT", "Arts", "Psychology",
];

const EDU_RANK: Record<string, number> = {
  high_school: 1, ug: 2, pg: 3, phd: 4, professional: 3,
};
const GRADE_RANK: Record<string, number> = {
  GRADE_6: 1, GRADE_7: 1, GRADE_8: 1, GRADE_9: 1, GRADE_10: 1, GRADE_11: 1, GRADE_12: 1,
  UG: 2, PG: 3, PHD: 4,
};

const PROFICIENCY_LABEL: Record<string, string> = {
  expert: "Expert", intermediate: "Proficient", beginner: "Familiar",
};

const RECURRENCE_LABELS: Record<number, string> = {
  1: "One-off", 2: "2 weeks", 3: "3 weeks", 4: "1 month", 8: "2 months",
};

interface TutorListing {
  id: string;
  name: string;
  initials: string;
  subjects: Array<{ name: string; proficiency: string; educationLevel: string }>;
  bookedSlotCount: number;
  avgRating: number | null;
  reviewCount: number;
}

/* ── Timetable helpers ───────────────────────────────── */
const MORNING_HOURS = Array.from({ length: 6 }, (_, i) => i + 6);
const EVENING_HOURS = Array.from({ length: 10 }, (_, i) => i + 12);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${dates[0].toLocaleDateString("en-GB", o)} – ${dates[6].toLocaleDateString("en-GB", o)}`;
}

function slotKeyToLabel(key: string): string {
  const parts = key.split("-");
  const hour = parseInt(parts[3]);
  const date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
  const dow = date.getDay();
  const dayIdx = dow === 0 ? 6 : dow - 1;
  return `${DAY_LABELS[dayIdx]}, ${date.getDate()} ${date.toLocaleDateString("en-GB", { month: "short" })} · ${formatHourRange(hour)}`;
}

/* ── Read-only student timetable ─────────────────────── */
function StudentTimetable({ matches }: { matches: TutorMatch[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<"morning" | "evening">("morning");
  const dates = getWeekDates(weekOffset);
  const today = isoDate(new Date());
  const hours = tab === "morning" ? MORNING_HOURS : EVENING_HOURS;

  const bookedSlots = new Map<string, { initials: string; name: string }>();
  matches.forEach((m) => {
    m.bookedSlots.forEach((k) => {
      bookedSlots.set(k, { initials: m.tutorAvatar, name: m.tutorName });
    });
  });

  const morningBooked = [...bookedSlots.keys()].some((k) => {
    const hour = parseInt(k.split("-")[3]);
    const ds = k.split("-").slice(0, 3).join("-");
    return hour < 12 && dates.some((d) => isoDate(d) === ds);
  });
  const eveningBooked = [...bookedSlots.keys()].some((k) => {
    const hour = parseInt(k.split("-")[3]);
    const ds = k.split("-").slice(0, 3).join("-");
    return hour >= 12 && dates.some((d) => isoDate(d) === ds);
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden text-xs">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <button type="button" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}
          className="flex size-5 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 hover:text-amber-600 transition">
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-[10px] font-bold text-gray-600">{formatWeekRange(dates)}</span>
        <button type="button" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}
          className="flex size-5 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 hover:text-amber-600 transition">
          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="flex gap-1 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        {(["morning", "evening"] as const).map((t) => {
          const hasBooked = t === "morning" ? morningBooked : eveningBooked;
          return (
            <button key={t} type="button" onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`relative flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                tab === t ? "bg-amber-400 text-white shadow-sm" : "text-gray-500 hover:text-amber-600"
              }`}>
              {t === "morning" ? "Morning" : "Evening"}
              {hasBooked && <span aria-hidden="true" className={`size-1.5 rounded-full ${tab === t ? "bg-white" : "bg-amber-400"}`} />}
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table role="grid" aria-label="Weekly class schedule" className="w-full border-collapse" style={{ minWidth: 480 }}>
          <caption className="sr-only">Weekly class schedule for {formatWeekRange(dates)}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20 border-b border-r border-gray-100 bg-gray-50 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-gray-400">Time</th>
              {dates.map((d, i) => {
                const isToday = isoDate(d) === today;
                return (
                  <th scope="col" key={i} className={`border-b border-r border-gray-100 py-1 text-center last:border-r-0 ${isToday ? "bg-amber-50" : "bg-gray-50"}`}>
                    <p className={`text-[10px] font-bold ${isToday ? "text-amber-600" : "text-gray-500"}`}>{DAY_LABELS[i]}</p>
                    <p className={`text-[9px] font-semibold ${isToday ? "text-amber-400" : "text-gray-400"}`}>{d.getDate()}</p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border-b border-r border-gray-100 bg-gray-50 text-center text-[9px] font-semibold text-gray-400">
                  <div className="flex h-8 items-center justify-center px-1">{formatHourRange(hour)}</div>
                </td>
                {dates.map((d, i) => {
                  const key = slotKey(d, hour);
                  const isToday = isoDate(d) === today;
                  const booked = bookedSlots.get(key);
                  return (
                    <td key={i}
                      title={booked ? `${booked.name} — your class` : undefined}
                      aria-label={booked ? `${booked.name} class session` : isToday ? "Today, available" : "Available slot"}
                      className={`h-8 relative border-b border-r border-gray-100 last:border-r-0 ${
                        booked ? "bg-amber-500 cursor-default"
                          : isToday ? "bg-amber-50/60"
                          : ""
                      }`}>
                      {booked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-0.5 gap-0.5">
                          <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-white/30 text-[7px] font-black text-white">{booked.initials}</span>
                          <span className="text-[8px] font-semibold leading-none text-white truncate w-full text-center">{booked.name.split(" ")[0]}</span>
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
      <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-3 py-1">
        <div className="flex items-center gap-1"><div className="size-2.5 rounded-sm bg-amber-500" /><span className="text-[9px] text-gray-500">Booked session</span></div>
        <div className="flex items-center gap-1"><div className="size-2.5 rounded-sm bg-amber-50 border border-amber-200" /><span className="text-[9px] text-gray-500">Today</span></div>
        <p className="ml-auto text-[9px] text-gray-400" aria-live="polite" aria-atomic="true">{bookedSlots.size} booked session{bookedSlots.size !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

/* ── Small components ────────────────────────────────── */
function Avatar({ initials, src, size = "md", color = "amber", onClick, ariaLabel }: {
  initials: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  color?: "teal" | "amber" | "blue" | "green" | "purple" | "rose";
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const sz = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl" }[size];
  const cl = {
    teal:   "bg-amber-100 text-amber-700 border-amber-200",
    amber:  "bg-amber-100 text-amber-700 border-amber-200",
    blue:   "bg-blue-100 text-blue-700 border-blue-200",
    green:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple: "bg-violet-100 text-violet-700 border-violet-200",
    rose:   "bg-rose-100 text-rose-700 border-rose-200",
  }[color];
  const interactiveCls = onClick ? "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-amber-400 transition" : "";
  if (src) {
    return (
      <div
        className={`${sz} shrink-0 rounded-full border border-amber-200 overflow-hidden ${interactiveCls}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={ariaLabel}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      >
        <img src={src} alt={ariaLabel ?? "Profile photo"} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${sz} ${cl} flex shrink-0 items-center justify-center rounded-full border font-bold ${interactiveCls}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <span aria-hidden="true">{initials}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-black/10 bg-white px-4 py-3">
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === "ACTIVE") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />Active
    </span>
  );
  if (status === "AWAITING_FIRST_SESSION") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-400" />Awaiting first session
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-gray-300" />Paused
    </span>
  );
}

function RequestStatusBadge({ status }: { status: MyRequest["status"] }) {
  if (status === "accepted") return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />Accepted
    </span>
  );
  if (status === "cancelled") return (
    <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-600">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-red-400" />Cancelled
    </span>
  );
  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-amber-400" />Pending
    </span>
  );
}

/* ── Tutor Reviews Modal ─────────────────────────────── */
interface GlobalReview {
  matchId?: string;
  tutorId?: string;
  name: string;
  rating: number;
  message: string;
  createdAt: string;
}

function TutorReviewsModal({
  tutorId,
  tutorName,
  avgRating,
  reviewCount,
  onClose,
}: {
  tutorId: string;
  tutorName: string;
  avgRating: number | null;
  reviewCount: number;
  onClose: () => void;
}) {
  const reviews: GlobalReview[] = JSON.parse(localStorage.getItem("vt_reviews") || "[]")
    .filter((r: GlobalReview) => r.tutorId === tutorId);

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="reviews-modal-title" className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
            <div>
              <h2 id="reviews-modal-title" className="font-bold text-gray-900">Reviews for {tutorName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {reviewCount > 0 ? `${reviewCount} review${reviewCount !== 1 ? "s" : ""}` : "No reviews yet"}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close reviews"
              className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {reviewCount === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
                <div className="flex size-12 items-center justify-center rounded-full bg-gray-50 border border-gray-100">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#e5e7eb" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No reviews yet for this tutor.</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex items-center gap-6 border-b border-gray-100 px-6 py-5">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-4xl font-black text-gray-900" aria-label={`Average rating: ${avgRating?.toFixed(1)} out of 5`}>{avgRating?.toFixed(1)}</span>
                    <div aria-hidden="true" className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
                          fill={i < Math.round(avgRating ?? 0) ? "#f59e0b" : "#e5e7eb"} stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</span>
                  </div>
                  {/* Bar breakdown */}
                  <div className="flex-1 space-y-1.5">
                    {breakdown.map(({ star, count }) => {
                      const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="w-4 text-right text-[10px] font-semibold text-gray-500">{star}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" className="shrink-0">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-4 text-[10px] text-gray-400">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual reviews */}
                <div className="divide-y divide-gray-50 px-6">
                  {reviews.map((r, i) => {
                    const initials = r.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    const date = new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <div key={i} className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 border border-amber-200">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                              <div aria-hidden="true" className="flex gap-0.5">
                                {Array.from({ length: 5 }, (_, si) => (
                                  <svg key={si} width="11" height="11" viewBox="0 0 24 24"
                                    fill={si < r.rating ? "#f59e0b" : "#e5e7eb"} stroke="none">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                  </svg>
                                ))}
                              </div>
                              <span className="text-[10px] text-gray-400">{date}</span>
                            </div>
                            {r.message && (
                              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{r.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Search VolunTutor tab ───────────────────────────── */
function SearchVolunTutor() {
  const router = useRouter();
  const [tutors, setTutors] = useState<TutorListing[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [viewReviews, setViewReviews] = useState<{ tutorId: string; tutorName: string; avgRating: number | null; reviewCount: number } | null>(null);

  useEffect(() => {
    try {
      const allUsers: Array<{ id: string; name: string; role: string }> =
        JSON.parse(localStorage.getItem("vt_users") || "[]");
      const listings: TutorListing[] = allUsers
        .filter((u) => u.role === "tutor")
        .map((u) => {
          const profile = JSON.parse(
            localStorage.getItem(`vt_tutor_profile_${u.id}`) || '{"subjects":[]}'
          );
          const matches: Array<{ bookedSlots?: string[] }> = JSON.parse(
            localStorage.getItem(`vt_tutor_matches_${u.id}`) || "[]"
          );
          const bookedSlotCount = new Set(
            matches.flatMap((m) => m.bookedSlots ?? [])
          ).size;
          const ratings: Array<{ rating: number }> = JSON.parse(
            localStorage.getItem(`vt_tutor_ratings_${u.id}`) || "[]"
          );
          const reviewCount = ratings.length;
          const avgRating = reviewCount > 0
            ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
            : null;
          return {
            id: u.id,
            name: u.name,
            initials: u.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
            subjects: profile.subjects ?? [],
            bookedSlotCount,
            avgRating,
            reviewCount,
          };
        })
        .filter((t) => t.subjects.length > 0);
      setTutors(listings);
    } catch { /* ignore */ }
  }, []);

  const filtered = tutors.filter((t) => {
    if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (subjectFilter) {
      if (!t.subjects.some((s) => s.name.toLowerCase() === subjectFilter.toLowerCase())) return false;
    }
    if (gradeFilter) {
      const gradeReq = GRADE_RANK[gradeFilter] ?? 1;
      const subjectsToCheck = subjectFilter
        ? t.subjects.filter((s) => s.name.toLowerCase() === subjectFilter.toLowerCase())
        : t.subjects;
      if (!subjectsToCheck.some((s) => (EDU_RANK[s.educationLevel] ?? 1) >= gradeReq)) return false;
    }
    return true;
  });

  const filterCls = "flex h-9 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100";

  return (
    <>
    {viewReviews && (
      <TutorReviewsModal
        tutorId={viewReviews.tutorId}
        tutorName={viewReviews.tutorName}
        avgRating={viewReviews.avgRating}
        reviewCount={viewReviews.reviewCount}
        onClose={() => setViewReviews(null)}
      />
    )}
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        {/* Text search */}
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            aria-label="Search tutors by name"
            placeholder="Search by tutor name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </div>
        {/* Subject filter */}
        <select aria-label="Filter by subject" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={filterCls}>
          <option value="">All subjects</option>
          {SUBJECTS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Grade filter */}
        <select aria-label="Filter by grade level" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className={filterCls}>
          <option value="">All grades</option>
          {GRADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(subjectFilter || gradeFilter || query) && (
          <button
            aria-label="Clear all filters"
            onClick={() => { setSubjectFilter(""); setGradeFilter(""); setQuery(""); }}
            className="text-xs font-semibold text-gray-400 hover:text-red-500 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results count */}
      <p aria-live="polite" aria-atomic="true" className="text-xs text-gray-400 font-medium">
        {filtered.length} tutor{filtered.length !== 1 ? "s" : ""} available
      </p>

      {/* Empty state */}
      {tutors.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gray-50 border border-gray-100">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-700">No tutors registered yet</p>
            <p className="mt-1 text-sm text-gray-400">Tutors will appear here once they create an account.</p>
          </div>
        </div>
      )}

      {tutors.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <p className="font-semibold text-gray-600">No tutors match your filters</p>
          <button onClick={() => { setSubjectFilter(""); setGradeFilter(""); setQuery(""); }}
            className="text-sm font-semibold text-amber-600 hover:underline">Clear filters</button>
        </div>
      )}

      {/* Tutor cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((tutor, idx) => {
          const colors = ["amber", "blue", "green", "purple", "rose", "teal"] as const;
          const color = colors[idx % colors.length];
          const colorMap = {
            amber:  "bg-amber-100 text-amber-700 border-amber-200",
            blue:   "bg-blue-100 text-blue-700 border-blue-200",
            green:  "bg-emerald-100 text-emerald-700 border-emerald-200",
            purple: "bg-violet-100 text-violet-700 border-violet-200",
            rose:   "bg-rose-100 text-rose-700 border-rose-200",
            teal:   "bg-amber-100 text-amber-700 border-amber-200",
          };
          const subjectsToShow = subjectFilter
            ? tutor.subjects.filter((s) => s.name.toLowerCase() === subjectFilter.toLowerCase())
            : tutor.subjects.slice(0, 5);

          return (
            <div key={tutor.id} className="flex flex-col rounded-2xl border border-black/10 bg-white p-5 shadow-sm gap-4">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${colorMap[color]}`}>
                  {tutor.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{tutor.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    {/* Rating — clickable */}
                    {tutor.avgRating !== null ? (
                      <button
                        type="button"
                        onClick={() => setViewReviews({ tutorId: tutor.id, tutorName: tutor.name, avgRating: tutor.avgRating, reviewCount: tutor.reviewCount })}
                        className="flex items-center gap-1 rounded-md px-1 -ml-1 hover:bg-amber-50 transition group"
                        title="View reviews"
                      >
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <svg key={i} width="11" height="11" viewBox="0 0 24 24"
                              fill={i < Math.round(tutor.avgRating!) ? "#f59e0b" : "#e5e7eb"}
                              stroke="none">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          ))}
                        </span>
                        <span className="font-semibold text-amber-600">{tutor.avgRating}</span>
                        <span className="text-gray-400 group-hover:text-amber-500 transition">({tutor.reviewCount} review{tutor.reviewCount !== 1 ? "s" : ""})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setViewReviews({ tutorId: tutor.id, tutorName: tutor.name, avgRating: null, reviewCount: 0 })}
                        className="italic text-gray-300 hover:text-gray-400 transition text-xs"
                      >
                        No reviews yet
                      </button>
                    )}
                    {/* Booked slots */}
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {tutor.bookedSlotCount} slot{tutor.bookedSlotCount !== 1 ? "s" : ""} booked
                    </span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Volunteer
                </span>
              </div>

              {/* Subjects */}
              <div className="flex flex-wrap gap-1.5">
                {subjectsToShow.map((s) => (
                  <span key={s.name} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {s.name}
                    {PROFICIENCY_LABEL[s.proficiency] && (
                      <span className="text-gray-400">· {PROFICIENCY_LABEL[s.proficiency]}</span>
                    )}
                  </span>
                ))}
                {!subjectFilter && tutor.subjects.length > 5 && (
                  <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-0.5 text-xs text-gray-400">
                    +{tutor.subjects.length - 5} more
                  </span>
                )}
              </div>

              {/* Grade compatibility */}
              {gradeFilter && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Can teach {GRADE_LABELS[gradeFilter] ?? gradeFilter}
                </p>
              )}

              {/* CTA */}
              <button
                onClick={() => router.push(`/find?tutorId=${tutor.id}`)}
                className="mt-auto w-full rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500"
              >
                Request {tutor.name.split(" ")[0]} →
              </button>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

/* ── Review Modal ───────────────────────────────────── */
const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent!"];

function ReviewModal({
  tutorName,
  subject,
  existing,
  onClose,
  onSubmit,
}: {
  tutorName: string;
  subject: string;
  existing?: { rating: number; body: string };
  onClose: () => void;
  onSubmit: (rating: number, body: string) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [done, setDone] = useState(false);
  const active = hovered || rating;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleSubmit() {
    if (rating === 0) return;
    onSubmit(rating, body.trim());
    setDone(true);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="review-modal-title" className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
          {done ? (
            <div role="status" aria-live="assertive" className="flex flex-col items-center gap-4 px-8 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
                <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Review submitted!</p>
                <p className="mt-1 text-sm text-gray-500">Thanks for rating {tutorName.split(" ")[0]}.</p>
              </div>
              <div aria-hidden="true" className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} width="22" height="22" viewBox="0 0 24 24"
                    fill={i < rating ? "#f59e0b" : "#e5e7eb"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ))}
              </div>
              <button onClick={onClose}
                className="rounded-full bg-amber-400 px-8 py-2.5 text-sm font-semibold text-white hover:bg-amber-300 transition">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h2 id="review-modal-title" className="font-bold text-gray-900">
                    {existing ? "Edit your review" : "Rate your tutor"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{tutorName} · {subject}</p>
                </div>
                <button onClick={onClose} aria-label="Close rating dialog"
                  className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="px-6 py-6 space-y-5">
                {/* Star picker */}
                <div className="flex flex-col items-center gap-3">
                  <div role="group" aria-label="Rating" className="flex gap-1"
                    onMouseLeave={() => setHovered(0)}>
                    {Array.from({ length: 5 }, (_, i) => {
                      const val = i + 1;
                      return (
                        <button key={val} type="button"
                          aria-label={`${val} star${val !== 1 ? 's' : ''}`}
                          aria-pressed={rating === val}
                          onClick={() => setRating(val)}
                          onMouseEnter={() => setHovered(val)}
                          className="transition-transform hover:scale-110 active:scale-95">
                          <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24"
                            fill={val <= active ? "#f59e0b" : "#e5e7eb"}
                            stroke={val <= active ? "#f59e0b" : "#d1d5db"}
                            strokeWidth="0.5"
                            className="transition-colors duration-100">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                  <p aria-live="polite" className={`text-sm font-semibold transition-colors ${active > 0 ? "text-amber-500" : "text-gray-300"}`}>
                    {STAR_LABELS[active] || "Tap to rate"}
                  </p>
                </div>

                {/* Written review */}
                <div className="space-y-1.5">
                  <label htmlFor="review-textarea" className="text-xs font-semibold text-gray-600">
                    Written review <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="review-textarea"
                    rows={3}
                    maxLength={300}
                    placeholder={`How was your experience with ${tutorName.split(" ")[0]}?`}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  />
                  <p className="text-right text-[10px] text-gray-400">{300 - body.length} left</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button onClick={onClose}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={rating === 0} aria-disabled={rating === 0}
                    className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed">
                    {existing ? "Update review" : "Submit review"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Profile Panel ───────────────────────────────────── */
function ProfilePanel({
  isOpen, onClose, initials, profilePic, bio, bioEditing, bioInput,
  matches, onAvatarClick, setBioInput, setBioEditing, saveBio, onSignOut,
}: {
  isOpen: boolean; onClose: () => void; initials: string; profilePic: string | null;
  bio: string; bioEditing: boolean; bioInput: string;
  matches: TutorMatch[];
  onAvatarClick: () => void; setBioInput: (v: string) => void;
  setBioEditing: (v: boolean) => void; saveBio: () => void; onSignOut: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const totalSessions = matches.reduce((a, m) => a + m.sessionCount, 0);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="My Profile" className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="text-sm font-bold text-gray-700">My Profile</span>
          <button onClick={onClose} aria-label="Close profile panel" className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-4 px-6 py-6 border-b border-gray-100">
            <div className="relative group">
              <div className="size-24 rounded-full overflow-hidden border-2 border-amber-200 shadow-md">
                {profilePic
                  ? <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  : <div className="size-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">{initials}</div>
                }
              </div>
              <button onClick={onAvatarClick} aria-label="Change profile photo"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            <button onClick={onAvatarClick}
              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
              Change photo
            </button>
          </div>
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Bio</span>
              {!bioEditing && (
                <button onClick={() => { setBioInput(bio); setBioEditing(true); }} aria-label="Edit bio"
                  className="text-xs font-semibold text-gray-400 hover:text-amber-600 transition">Edit</button>
              )}
            </div>
            {bioEditing ? (
              <div className="space-y-2">
                <textarea autoFocus value={bioInput} onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Tell your tutor a bit about yourself…" rows={4}
                  className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                <div className="flex gap-2">
                  <button onClick={saveBio} className="flex-1 rounded-lg bg-amber-400 py-1.5 text-xs font-semibold text-white hover:bg-amber-300 transition">Save</button>
                  <button onClick={() => setBioEditing(false)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-600">
                {bio || <span className="italic text-gray-400">No bio yet. Click Edit to add one.</span>}
              </p>
            )}
          </div>
          <div className="px-5 py-5 border-b border-gray-100">
            <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-amber-600">Statistics</span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Tutors", value: matches.length },
                { label: "Sessions", value: totalSessions },
                { label: "Active", value: matches.filter((m) => m.status === "ACTIVE").length },
                { label: "Hours Learned", value: totalSessions },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-4">
          <button onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function StudentDashboard() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();

  const [tutorMatches, setTutorMatches] = useState<TutorMatch[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "tutors" | "requests" | "messages">("tutors");
  const [activeTutorId, setActiveTutorId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<Record<string, MessageEntry[]>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [reviewTarget, setReviewTarget] = useState<{ matchId: string; tutorId: string; tutorName: string; subject: string } | null>(null);
  const [savedReviews, setSavedReviews] = useState<Record<string, { rating: number; body: string }>>({});
  const [meetInvites, setMeetInvites] = useState<Record<string, { active: boolean; gmeetUrl: string } | null>>({});
  const [meetToast, setMeetToast] = useState<{ matchId: string; tutorName: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/find");
    if (!isLoading && user && user.role !== "student") router.replace("/");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    try {
      const pic = localStorage.getItem(`vt_student_avatar_${user.id}`);
      if (pic) setProfilePic(pic);
      const savedBio = localStorage.getItem(`vt_student_bio_${user.id}`);
      if (savedBio) setBio(savedBio);
      const raw = localStorage.getItem(`vt_student_reviews_${user.id}`);
      if (raw) setSavedReviews(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const allReqs: MyRequest[] = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");
      const mine = allReqs.filter((r) => r.studentId === user.id);
      setMyRequests(mine);

      const matches: TutorMatch[] = [];
      const allUsers: { id: string; name: string }[] = JSON.parse(localStorage.getItem("vt_users") || "[]");
      for (const req of mine) {
        if (req.status === "accepted" && req.acceptedByTutorId) {
          const tutorMatchList = JSON.parse(localStorage.getItem(`vt_tutor_matches_${req.acceptedByTutorId}`) || "[]");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const match = tutorMatchList.find((m: any) => m.id === req.id);
          if (match) {
            const tutor = allUsers.find((u) => u.id === req.acceptedByTutorId);
            const tutorName = tutor?.name ?? "Your Tutor";
            matches.push({
              id: match.id,
              tutorId: req.acceptedByTutorId,
              tutorName,
              tutorAvatar: tutorName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
              subject: match.subject ?? req.subject,
              gradeLevel: match.gradeLevel ?? req.gradeLevel,
              helpMessage: req.helpMessage,
              matchedAt: match.matchedAt ?? "recently",
              sessionCount: match.sessionCount ?? 0,
              nextSession: match.nextSession ?? null,
              bookedSlots: match.bookedSlots ?? [],
              status: match.status ?? "ACTIVE",
              unreadMessages: 0,
            });
          }
        }
      }
      setTutorMatches(matches);

      const msgs: Record<string, MessageEntry[]> = {};
      matches.forEach((m) => {
        try { msgs[m.id] = JSON.parse(localStorage.getItem(`vt_messages_${m.id}`) || "[]"); }
        catch { msgs[m.id] = []; }
      });
      setMessages(msgs);
    } catch { /* ignore */ }
  }, [user]);

  // Poll for new data (tutor may accept while page is open)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      try {
        const allReqs: MyRequest[] = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");
        const mine = allReqs.filter((r) => r.studentId === user.id);
        setMyRequests(mine);

        const allUsers: { id: string; name: string }[] = JSON.parse(localStorage.getItem("vt_users") || "[]");
        const matches: TutorMatch[] = [];
        for (const req of mine) {
          if (req.status === "accepted" && req.acceptedByTutorId) {
            const tutorMatchList = JSON.parse(localStorage.getItem(`vt_tutor_matches_${req.acceptedByTutorId}`) || "[]");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const match = tutorMatchList.find((m: any) => m.id === req.id);
            if (match) {
              const tutor = allUsers.find((u) => u.id === req.acceptedByTutorId);
              const tutorName = tutor?.name ?? "Your Tutor";
              matches.push({
                id: match.id,
                tutorId: req.acceptedByTutorId,
                tutorName,
                tutorAvatar: tutorName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
                subject: match.subject ?? req.subject,
                gradeLevel: match.gradeLevel ?? req.gradeLevel,
                helpMessage: req.helpMessage,
                matchedAt: match.matchedAt ?? "recently",
                sessionCount: match.sessionCount ?? 0,
                nextSession: match.nextSession ?? null,
                bookedSlots: match.bookedSlots ?? [],
                status: match.status ?? "ACTIVE",
                unreadMessages: 0,
              });
            }
          }
        }
        setTutorMatches(matches);

        // Refresh messages for active thread
        setMessages((prev) => {
          const next = { ...prev };
          matches.forEach((m) => {
            try {
              const stored = JSON.parse(localStorage.getItem(`vt_messages_${m.id}`) || "[]");
              next[m.id] = stored;
            } catch { /* ignore */ }
          });
          return next;
        });

        // Poll meet invites
        setMeetInvites((prev) => {
          const next = { ...prev };
          matches.forEach((m) => {
            try {
              const raw = localStorage.getItem(`vt_meet_invite_${m.id}`);
              if (raw) {
                const parsed = JSON.parse(raw);
                const wasActive = prev[m.id]?.active;
                if (parsed.active && !wasActive) {
                  setMeetToast({ matchId: m.id, tutorName: m.tutorName });
                }
                next[m.id] = { active: parsed.active === true, gmeetUrl: parsed.gmeetUrl ?? "" };
              } else {
                next[m.id] = null;
              }
            } catch { /* ignore */ }
          });
          return next;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTutorId]);

  // Auto-dismiss meet toast after 6 seconds
  useEffect(() => {
    if (!meetToast) return;
    const t = setTimeout(() => setMeetToast(null), 6000);
    return () => clearTimeout(t);
  }, [meetToast]);

  const cancelRequest = useCallback((reqId: string) => {
    try {
      const allReqs: MyRequest[] = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");
      const updated = allReqs.map((r) => r.id === reqId ? { ...r, status: "cancelled" as const } : r);
      localStorage.setItem("vt_student_requests", JSON.stringify(updated));
      setMyRequests((prev) => prev.map((r) => r.id === reqId ? { ...r, status: "cancelled" } : r));
    } catch { /* ignore */ }
  }, []);

  function sendMessage() {
    if (!messageInput.trim() || !activeTutorId) return;
    const newMsg: MessageEntry = { from: "student", body: messageInput.trim(), sentAt: new Date().toISOString() };
    setMessages((prev) => ({
      ...prev,
      [activeTutorId]: [...(prev[activeTutorId] ?? []), newMsg],
    }));
    try {
      const key = `vt_messages_${activeTutorId}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([...existing, newMsg]));
    } catch { /* ignore */ }
    setMessageInput("");
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfilePic(dataUrl);
      try { localStorage.setItem(`vt_student_avatar_${user!.id}`, dataUrl); } catch { /* ignore */ }
    };
    reader.readAsDataURL(file);
  }

  function saveBio() {
    setBio(bioInput);
    try { localStorage.setItem(`vt_student_bio_${user!.id}`, bioInput); } catch { /* ignore */ }
    setBioEditing(false);
  }

  function submitReview(rating: number, body: string) {
    if (!user || !reviewTarget) return;
    const updated = { ...savedReviews, [reviewTarget.matchId]: { rating, body } };
    setSavedReviews(updated);
    try {
      // Persist per-student review map
      localStorage.setItem(`vt_student_reviews_${user.id}`, JSON.stringify(updated));
      // Write/update per-tutor rating list so Search tab can aggregate them
      const tutorRatingsKey = `vt_tutor_ratings_${reviewTarget.tutorId}`;
      const tutorRatings: Array<{ matchId: string; studentId: string; rating: number; body: string }> =
        JSON.parse(localStorage.getItem(tutorRatingsKey) || "[]");
      const idx = tutorRatings.findIndex((r) => r.matchId === reviewTarget.matchId);
      const entry = { matchId: reviewTarget.matchId, studentId: user.id, rating, body };
      if (idx >= 0) tutorRatings[idx] = entry; else tutorRatings.push(entry);
      localStorage.setItem(tutorRatingsKey, JSON.stringify(tutorRatings));
      // Also push into the global reviews feed so it appears on the landing page
      const globalReviews = JSON.parse(localStorage.getItem("vt_reviews") || "[]");
      const gIdx = globalReviews.findIndex((r: { matchId?: string }) => r.matchId === reviewTarget.matchId);
      const gEntry = {
        id: reviewTarget.matchId,
        matchId: reviewTarget.matchId,
        tutorId: reviewTarget.tutorId,
        name: user.name,
        role: "student",
        rating,
        message: body || `Great tutor for ${reviewTarget.subject}!`,
        createdAt: new Date().toISOString(),
      };
      if (gIdx >= 0) globalReviews[gIdx] = gEntry; else globalReviews.push(gEntry);
      localStorage.setItem("vt_reviews", JSON.stringify(globalReviews));
    } catch { /* ignore */ }
  }

  if (isLoading || !user) return null;

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const activeTutor = tutorMatches.find((m) => m.id === activeTutorId);
  const pendingCount = myRequests.filter((r) => r.status === "pending").length;
  const totalSessions = tutorMatches.reduce((a, m) => a + m.sessionCount, 0);

  const mySubjects = Array.from(
    new Map(
      myRequests.map((r) => [r.subject, { subject: r.subject, status: r.status }])
    ).values()
  );

  const TUTOR_COLORS: Array<"amber" | "blue" | "green" | "purple" | "rose" | "teal"> = ["amber", "blue", "green", "purple", "rose", "teal"];

  return (
    <div className="min-h-screen bg-[#fffbeb]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:rounded-lg focus:bg-amber-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg">
        Skip to main content
      </a>
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />

      {reviewTarget && (
        <ReviewModal
          tutorName={reviewTarget.tutorName}
          subject={reviewTarget.subject}
          existing={savedReviews[reviewTarget.matchId]}
          onClose={() => setReviewTarget(null)}
          onSubmit={(rating, body) => { submitReview(rating, body); }}
        />
      )}

      {/* Meet invite toast */}
      {meetToast && (() => {
        const invite = meetInvites[meetToast.matchId];
        return (
          <div
            role="alert"
            aria-live="assertive"
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-2xl animate-in slide-in-from-bottom-4"
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-200">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l4.553-2.669A1 1 0 0121 8.232v7.536a1 1 0 01-1.447.9L15 14"/><rect x="1" y="6" width="14" height="12" rx="2"/>
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{meetToast.tutorName} started a Meet!</p>
              <p className="text-xs text-gray-500">Your tutor is ready for you</p>
            </div>
            <button
              onClick={() => { if (invite?.gmeetUrl) window.open(invite.gmeetUrl, "_blank", "noopener,noreferrer"); setMeetToast(null); }}
              className="ml-2 shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-400"
            >
              Join Now
            </button>
            <button onClick={() => setMeetToast(null)} aria-label="Dismiss" className="shrink-0 text-gray-300 hover:text-gray-500 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        );
      })()}

      <ProfilePanel
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        initials={initials}
        profilePic={profilePic}
        bio={bio}
        bioEditing={bioEditing}
        bioInput={bioInput}
        matches={tutorMatches}
        onAvatarClick={() => avatarInputRef.current?.click()}
        setBioInput={setBioInput}
        setBioEditing={setBioEditing}
        saveBio={saveBio}
        onSignOut={() => { signOut(); router.push("/"); }}
      />

      {/* Navbar */}
      <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b border-black/10 bg-[#f7b801]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          <Link href="/find/dashboard" className="flex items-center">
            <Image src="/Guide_app_logo.png" alt="VolunTutor" width={160} height={56} className="h-14 w-auto object-contain mix-blend-multiply" priority />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-gray-800 sm:block">
              Hello, {user.name.split(" ")[0]} 👋
            </span>
            <Avatar initials={initials} src={profilePic} size="sm" color="amber" onClick={() => setProfileOpen(true)} ariaLabel="Open profile panel" />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">

          {/* Sidebar */}
          <aside aria-label="Student information" className="w-full lg:w-72 xl:w-80 shrink-0 space-y-5">

            {/* Profile card */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar initials={initials} src={profilePic} size="lg" color="amber" onClick={() => setProfileOpen(true)} />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                    Student
                  </span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat label="Tutors" value={tutorMatches.length} />
                <Stat label="Sessions" value={totalSessions} />
              </div>
            </div>

            {/* My Subjects */}
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-600">My Subjects</h3>
              {mySubjects.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No requests submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {mySubjects.map((s) => (
                    <div key={s.subject} className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">{s.subject}</p>
                      <RequestStatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              )}
              <Link href="/find" className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-500 transition">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                Request another subject
              </Link>
            </div>

            {/* Weekly Schedule (read-only) */}
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-600">My Class Schedule</h3>
              {tutorMatches.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No booked sessions yet. Once a tutor accepts your request, sessions will appear here.</p>
              ) : (
                <StudentTimetable matches={tutorMatches} />
              )}
            </div>
          </aside>

          {/* Main */}
          <main id="main-content" className="min-w-0 flex-1 space-y-6">

            {/* Request a tutor CTA */}
            <Link
              href="/find"
              className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-400 px-6 py-4 shadow-sm transition hover:bg-amber-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Request a VolunTutor</p>
                  <p className="text-xs text-amber-100">Submit a new tutor request for any subject</p>
                </div>
              </div>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70 group-hover:translate-x-1 transition-transform">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>

            {/* Tabs */}
            <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm w-fit">
              {([
                { id: "search",   label: "Search VolunTutor", badge: 0 },
                { id: "tutors",   label: "My Tutors",         badge: 0 },
                { id: "requests", label: "My Requests",       badge: pendingCount },
                { id: "messages", label: "Messages",          badge: 0 },
              ] as const).map(({ id, label, badge }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeTab === id}
                  aria-controls={`tabpanel-${id}`}
                  id={`tab-${id}`}
                  onClick={() => setActiveTab(id)}
                  className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab === id ? "bg-amber-400 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                  {label}
                  {badge > 0 && (
                    <>
                      <span aria-hidden="true" className={`absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${activeTab === id ? "bg-white text-amber-600" : "bg-amber-400 text-white"}`}>
                        {badge}
                      </span>
                      <span className="sr-only">({badge} pending)</span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Search tab */}
            {activeTab === "search" && (
              <div role="tabpanel" id="tabpanel-search" aria-labelledby="tab-search">
                <SearchVolunTutor />
              </div>
            )}

            {/* My Tutors tab */}
            {activeTab === "tutors" && (
              <div role="tabpanel" id="tabpanel-tutors" aria-labelledby="tab-tutors">
              <div className="space-y-4">
                {tutorMatches.length === 0 && (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600">No active tutors yet</p>
                      <p className="mt-1 text-sm text-gray-400">Once a tutor accepts one of your requests, they'll appear here.</p>
                    </div>
                    <Link href="/find"
                      className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-300 transition shadow-sm">
                      Find a tutor →
                    </Link>
                  </div>
                )}
                {tutorMatches.map((match, idx) => (
                  <div key={match.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex flex-1 gap-4">
                        <Avatar initials={match.tutorAvatar} size="md" color={TUTOR_COLORS[idx % TUTOR_COLORS.length]} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-gray-900">{match.tutorName}</h4>
                            <span className="text-xs text-gray-400">· Volunteer Tutor</span>
                            <StatusBadge status={match.status} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{match.subject}</span>
                            <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                              {GRADE_LABELS[match.gradeLevel] ?? match.gradeLevel}
                            </span>
                          </div>
                          <p className="mt-2.5 text-sm leading-relaxed text-gray-600 italic">&ldquo;{match.helpMessage}&rdquo;</p>
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              {match.sessionCount} session{match.sessionCount !== 1 ? "s" : ""}
                            </span>
                            {match.nextSession && (
                              <span className="flex items-center gap-1.5">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Next: {match.nextSession}
                              </span>
                            )}
                            <span className="text-gray-400">Matched {match.matchedAt}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          onClick={() => { setActiveTutorId(match.id); setActiveTab("messages"); }}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700">
                          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          Message
                        </button>
                        {(() => {
                          const invite = meetInvites[match.id];
                          const canJoin = invite?.active && !!invite?.gmeetUrl;
                          return (
                            <button
                              disabled={!canJoin}
                              onClick={() => canJoin && window.open(invite!.gmeetUrl, "_blank", "noopener,noreferrer")}
                              title={canJoin ? "Join your tutor's Google Meet" : "Waiting for tutor to start the session"}
                              className={`relative flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                                canJoin
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                  : "border-gray-200 bg-white text-gray-300 cursor-not-allowed"
                              }`}
                            >
                              {canJoin && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 size-2 rounded-full bg-emerald-400 animate-pulse" />}
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={canJoin ? "ml-3" : ""}>
                                <path d="M15 10l4.553-2.669A1 1 0 0121 8.232v7.536a1 1 0 01-1.447.9L15 14"/><rect x="1" y="6" width="14" height="12" rx="2"/>
                              </svg>
                              Join Meet
                            </button>
                          );
                        })()}
                        {(() => {
                          const review = savedReviews[match.id];
                          return (
                            <button
                              onClick={() => setReviewTarget({ matchId: match.id, tutorId: match.tutorId, tutorName: match.tutorName, subject: match.subject })}
                              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                                review
                                  ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                  : "border-gray-200 bg-white text-gray-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600"
                              }`}>
                              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24"
                                fill={review ? "#f59e0b" : "none"}
                                stroke={review ? "#f59e0b" : "currentColor"}
                                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                              </svg>
                              {review ? (
                                <span className="flex items-center gap-1">
                                  Reviewed
                                  <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-700">{review.rating}/5</span>
                                </span>
                              ) : "Review"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Booked slots summary */}
                    {match.bookedSlots.length > 0 && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-600">Booked sessions</p>
                        <div className="flex flex-wrap gap-2">
                          {match.bookedSlots.slice(0, 4).map((slot) => (
                            <span key={slot} className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                              {slotKeyToLabel(slot)}
                            </span>
                          ))}
                          {match.bookedSlots.length > 4 && (
                            <span className="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
                              +{match.bookedSlots.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
            )}

            {/* My Requests tab */}
            {activeTab === "requests" && (
              <div role="tabpanel" id="tabpanel-requests" aria-labelledby="tab-requests">
              <div className="space-y-4">
                {myRequests.length === 0 && (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600">No requests yet</p>
                      <p className="mt-1 text-sm text-gray-400">Submit a request to find a volunteer tutor.</p>
                    </div>
                    <Link href="/find"
                      className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-300 transition shadow-sm">
                      Find a tutor →
                    </Link>
                  </div>
                )}
                {myRequests.map((req) => (
                  <div key={req.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <Avatar initials={req.avatar} size="md" color="amber" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-gray-900">{req.subject}</h4>
                          <span className="text-xs text-gray-400">
                            · {new Date(req.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                            {GRADE_LABELS[req.gradeLevel] ?? req.gradeLevel}
                          </span>
                          {(req.recurrenceWeeks ?? 1) > 1 ? (
                            <span className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                                <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                              </svg>
                              Recurring · {RECURRENCE_LABELS[req.recurrenceWeeks ?? 1] ?? `${req.recurrenceWeeks}w`}
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-400">One-off</span>
                          )}
                          <RequestStatusBadge status={req.status} />
                        </div>
                        <p className="mt-2.5 text-sm leading-relaxed text-gray-600 italic">&ldquo;{req.helpMessage}&rdquo;</p>

                        {/* Requested slots */}
                        {req.availabilitySlots && req.availabilitySlots.length > 0 && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Requested slots</p>
                            <div className="flex flex-wrap gap-2">
                              {req.availabilitySlots.slice(0, 3).map((slot) => (
                                <span key={slot} className="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs text-gray-600">
                                  {slotKeyToLabel(slot)}
                                </span>
                              ))}
                              {req.availabilitySlots.length > 3 && (
                                <span className="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs text-gray-500">
                                  +{req.availabilitySlots.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {req.status === "pending" && (
                        <button
                          onClick={() => cancelRequest(req.id)}
                          title="Cancel this request"
                          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}

            {/* Messages tab */}
            {activeTab === "messages" && (
              <div role="tabpanel" id="tabpanel-messages" aria-labelledby="tab-messages">
              <div className="flex h-[600px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                {/* Tutor list */}
                <div className="w-56 shrink-0 border-r border-gray-100 flex flex-col">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Tutors</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {tutorMatches.length === 0 ? (
                      <p className="p-4 text-xs text-gray-400 italic">No matched tutors yet.</p>
                    ) : (
                      tutorMatches.map((m, idx) => (
                        <button key={m.id} onClick={() => setActiveTutorId(m.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${activeTutorId === m.id ? "bg-amber-50 border-r-2 border-amber-400" : "hover:bg-gray-50"}`}>
                          <Avatar initials={m.tutorAvatar} size="sm" color={TUTOR_COLORS[idx % TUTOR_COLORS.length]} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-800">{m.tutorName}</p>
                            <p className="truncate text-xs text-gray-400">{m.subject}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Thread */}
                <div className="flex flex-1 flex-col min-w-0">
                  {activeTutor ? (
                    <>
                      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                        <Avatar initials={activeTutor.tutorAvatar} size="sm" color="amber" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{activeTutor.tutorName}</p>
                          <p className="text-xs text-gray-400">{activeTutor.subject} · Volunteer Tutor</p>
                        </div>
                        {(() => {
                          const invite = meetInvites[activeTutor.id];
                          const canJoin = invite?.active && !!invite?.gmeetUrl;
                          return (
                            <button
                              disabled={!canJoin}
                              onClick={() => canJoin && window.open(invite!.gmeetUrl, "_blank", "noopener,noreferrer")}
                              title={canJoin ? "Join your tutor's Google Meet" : "No active meet session"}
                              className={`relative ml-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                canJoin
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                  : "border-gray-200 bg-white text-gray-300 cursor-not-allowed"
                              }`}
                            >
                              {canJoin && <span className="absolute left-2 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={canJoin ? "ml-2" : ""}>
                                <path d="M15 10l4.553-2.669A1 1 0 0121 8.232v7.536a1 1 0 01-1.447.9L15 14"/><rect x="1" y="6" width="14" height="12" rx="2"/>
                              </svg>
                              Join Meet
                            </button>
                          );
                        })()}
                      </div>
                      <div role="log" aria-label="Message thread" aria-live="polite" className="flex-1 overflow-y-auto space-y-3 px-5 py-4">
                        {(messages[activeTutor.id] ?? []).length === 0 && (
                          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello to your tutor!</p>
                        )}
                        {(messages[activeTutor.id] ?? []).map((msg, i) => (
                          <div key={i} className={`flex ${msg.from === "student" ? "justify-end" : "justify-start"}`}>
                            <div
                              aria-label={msg.from === "student" ? `You said: ${msg.body}` : `${activeTutor?.tutorName ?? 'Tutor'} said: ${msg.body}`}
                              className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${msg.from === "student" ? "bg-amber-400 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                              {msg.body}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
                        <input
                          type="text"
                          aria-label={`Message ${activeTutor?.tutorName ?? 'your tutor'}`}
                          placeholder="Message your tutor…"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        />
                        <button onClick={sendMessage} aria-label="Send message"
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white transition hover:bg-amber-300">
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
                      <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                      <p className="font-semibold text-gray-500">Select a tutor to view messages</p>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
