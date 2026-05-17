"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";

/* ── Types ───────────────────────────────────────────── */
type MatchStatus = "ACTIVE" | "AWAITING_FIRST_SESSION" | "PAUSED";

interface StudentRequest {
  id: string;
  studentName: string;
  avatar: string;
  subject: string;
  gradeLevel: string;
  helpMessage: string;
  availabilitySlots: string[];
  submittedAt: string;
  status: "pending" | "accepted";
  acceptedByTutorId?: string;
}

const GRADE_LABELS: Record<string, string> = {
  GRADE_6: "Grade 6", GRADE_7: "Grade 7", GRADE_8: "Grade 8",
  GRADE_9: "Grade 9", GRADE_10: "Grade 10", GRADE_11: "Grade 11",
  GRADE_12: "Grade 12", UG: "University (UG)", PG: "University (PG)", PHD: "PhD",
};
const GRADE_RANK: Record<string, number> = {
  GRADE_6: 1, GRADE_7: 1, GRADE_8: 1, GRADE_9: 1, GRADE_10: 1, GRADE_11: 1, GRADE_12: 1,
  UG: 2, PG: 3, PHD: 4,
};
const EDU_RANK: Record<string, number> = {
  high_school: 1, ug: 2, pg: 3, phd: 4, professional: 3,
};

interface ActiveMatch {
  id: string;
  studentName: string;
  avatar: string;
  subject: string;
  gradeLevel: string;
  proficiency: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  helpMessage: string;
  matchedAt: string;
  sessionCount: number;
  nextSession: string | null;
  status: MatchStatus;
  unreadMessages: number;
}

interface Subject {
  name: string;
  level: "Expert" | "Proficient" | "Familiar";
  education: string;
}


/* ── Timetable helpers ───────────────────────────────── */
const MORNING_HOURS = Array.from({ length: 6 }, (_, i) => i + 6);   // 6 AM – 11 AM
const EVENING_HOURS = Array.from({ length: 10 }, (_, i) => i + 12); // 12 PM – 9 PM
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
function isoDate(d: Date) { return d.toISOString().split("T")[0]; }
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

function parseNextSessionKey(weekDates: Date[], nextSession: string): string | null {
  const m = nextSession.match(/^(\w+)\s+(\d+):(\d+)\s+(AM|PM)$/);
  if (!m) return null;
  const [, day, hourStr, , ampm] = m;
  const dayIdx = DAY_LABELS.indexOf(day);
  if (dayIdx === -1) return null;
  let hour = parseInt(hourStr);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return slotKey(weekDates[dayIdx], hour);
}

function getDefaultTab(matches: ActiveMatch[]): "morning" | "evening" {
  for (const m of matches) {
    if (!m.nextSession) continue;
    const match = m.nextSession.match(/(\d+):(\d+)\s+(AM|PM)/);
    if (!match) continue;
    let h = parseInt(match[1]);
    if (match[3] === "PM" && h !== 12) h += 12;
    if (h >= 12) return "evening";
  }
  return "morning";
}

function DashboardTimetable({
  selected,
  onToggle,
  matches,
}: {
  selected: Set<string>;
  onToggle: (key: string) => void;
  matches: ActiveMatch[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<"morning" | "evening">(() => getDefaultTab(matches));
  const dates = getWeekDates(weekOffset);
  const today = isoDate(new Date());
  const hours = tab === "morning" ? MORNING_HOURS : EVENING_HOURS;

  const bookedSlots = new Map<string, { initials: string; name: string }>();
  if (weekOffset === 0) {
    matches.forEach((m) => {
      if (m.nextSession) {
        const key = parseNextSessionKey(dates, m.nextSession);
        if (key) bookedSlots.set(key, { initials: m.avatar, name: m.studentName });
      }
    });
  }

  const morningBooked = weekOffset === 0 && matches.some((m) => {
    if (!m.nextSession) return false;
    const match = m.nextSession.match(/(\d+):(\d+)\s+(AM|PM)/);
    if (!match) return false;
    let h = parseInt(match[1]);
    if (match[3] === "PM" && h !== 12) h += 12;
    return h < 12;
  });
  const eveningBooked = weekOffset === 0 && matches.some((m) => {
    if (!m.nextSession) return false;
    const match = m.nextSession.match(/(\d+):(\d+)\s+(AM|PM)/);
    if (!match) return false;
    let h = parseInt(match[1]);
    if (match[3] === "PM" && h !== 12) h += 12;
    return h >= 12;
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden text-xs">
      {/* Week nav */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <button type="button" onClick={() => setWeekOffset((w) => w - 1)}
          className="flex size-5 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 hover:text-amber-600 transition">
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-[10px] font-bold text-gray-600">{formatWeekRange(dates)}</span>
        <button type="button" onClick={() => setWeekOffset((w) => w + 1)}
          className="flex size-5 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 hover:text-amber-600 transition">
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        {(["morning", "evening"] as const).map((t) => {
          const hasBooked = t === "morning" ? morningBooked : eveningBooked;
          return (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`relative flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                tab === t ? "bg-amber-400 text-white shadow-sm" : "text-gray-500 hover:text-amber-600"
              }`}>
              {t === "morning" ? "Morning" : "Evening"}
              {hasBooked && (
                <span className={`size-1.5 rounded-full ${tab === t ? "bg-white" : "bg-amber-500"}`} />
              )}
            </button>
          );
        })}
      </div>
      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th className="w-20 border-b border-r border-gray-100 bg-gray-50 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-gray-400">Time</th>
              {dates.map((d, i) => {
                const isToday = isoDate(d) === today;
                return (
                  <th key={i} className={`border-b border-r border-gray-100 py-1 text-center last:border-r-0 ${isToday ? "bg-amber-50" : "bg-gray-50"}`}>
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
                  const isSelected = selected.has(key);
                  const isToday = isoDate(d) === today;
                  const booked = bookedSlots.get(key);
                  return (
                    <td key={i}
                      title={booked ? booked.name : undefined}
                      onClick={booked ? undefined : () => onToggle(key)}
                      className={`h-8 relative border-b border-r border-gray-100 last:border-r-0 transition-colors ${
                        booked       ? "bg-amber-600 cursor-default"
                          : isSelected ? "bg-amber-400 hover:bg-amber-500 cursor-pointer"
                          : isToday   ? "bg-amber-50/60 hover:bg-amber-100 cursor-pointer"
                          : "hover:bg-amber-50 cursor-pointer"
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
      {/* Legend */}
      <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-3 py-1">
        <div className="flex items-center gap-1"><div className="size-2.5 rounded-sm bg-amber-400" /><span className="text-[9px] text-gray-500">Available</span></div>
        <div className="flex items-center gap-1"><div className="size-2.5 rounded-sm bg-amber-600" /><span className="text-[9px] text-gray-500">Booked</span></div>
        <p className="ml-auto text-[9px] text-gray-400">{selected.size} slot{selected.size !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

/* ── Mock data ───────────────────────────────────────── */
const ACTIVE_MATCHES: ActiveMatch[] = [
  {
    id: "m1", studentName: "Aisha Patel", avatar: "AP", subject: "Mathematics",
    gradeLevel: "GCSE", proficiency: "INTERMEDIATE",
    helpMessage: "I need help understanding quadratic equations and algebraic fractions. My mocks are in 8 weeks.",
    matchedAt: "3 days ago", sessionCount: 14, nextSession: "Mon 4:00 PM",
    status: "ACTIVE", unreadMessages: 2,
  },
  {
    id: "m2", studentName: "Daniel Osei", avatar: "DO", subject: "Physics",
    gradeLevel: "A-Level", proficiency: "INTERMEDIATE",
    helpMessage: "Struggling with electromagnetism and quantum concepts. Need someone to explain the intuition.",
    matchedAt: "1 week ago", sessionCount: 8, nextSession: "Tue 5:30 PM",
    status: "ACTIVE", unreadMessages: 0,
  },
  {
    id: "m3", studentName: "Mei Lin", avatar: "ML", subject: "Chemistry",
    gradeLevel: "GCSE", proficiency: "BEGINNER",
    helpMessage: "The periodic table and chemical bonding are confusing. I want to understand reactions, not just memorise.",
    matchedAt: "2 weeks ago", sessionCount: 22, nextSession: "Wed 4:00 PM",
    status: "ACTIVE", unreadMessages: 0,
  },
  {
    id: "m4", studentName: "Carlos Rivera", avatar: "CR", subject: "Mathematics",
    gradeLevel: "Middle School", proficiency: "BEGINNER",
    helpMessage: "I keep getting confused with fractions and negative numbers. Need patient, step-by-step help.",
    matchedAt: "2 days ago", sessionCount: 0, nextSession: null,
    status: "AWAITING_FIRST_SESSION", unreadMessages: 1,
  },
];

const EDUCATION_LABELS: Record<string, string> = {
  high_school:  "High School",
  ug:           "Undergraduate Degree",
  pg:           "Postgraduate Degree",
  phd:          "PhD",
  professional: "Industry Professional",
};

function mapProficiencyLevel(p: string): Subject["level"] {
  if (p === "expert")   return "Expert";
  if (p === "advanced") return "Proficient";
  if (p === "intermediate") return "Proficient";
  return "Familiar";
}


/* ── Small components ────────────────────────────────── */
function Avatar({ initials, src, size = "md", color = "amber", onClick }: {
  initials: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  color?: "amber" | "blue" | "green" | "purple" | "rose";
  onClick?: () => void;
}) {
  const sz = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl" }[size];
  const cl = {
    amber:  "bg-amber-100 text-amber-700 border-amber-200",
    blue:   "bg-blue-100 text-blue-700 border-blue-200",
    green:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple: "bg-violet-100 text-violet-700 border-violet-200",
    rose:   "bg-rose-100 text-rose-700 border-rose-200",
  }[color];
  const interactiveCls = onClick ? "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-amber-400 transition" : "";
  if (src) {
    return (
      <div className={`${sz} shrink-0 rounded-full border border-amber-200 overflow-hidden ${interactiveCls}`} onClick={onClick}>
        <img src={src} alt="Profile" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${sz} ${cl} flex shrink-0 items-center justify-center rounded-full border font-bold ${interactiveCls}`} onClick={onClick}>
      {initials}
    </div>
  );
}

/* ── Profile Panel ───────────────────────────────────── */
function ProfilePanel({
  isOpen, onClose, initials, profilePic, bio, bioEditing, bioInput,
  matches, totalSessions, onAvatarClick, setBioInput, setBioEditing, saveBio, onSignOut,
}: {
  isOpen: boolean; onClose: () => void; initials: string; profilePic: string | null;
  bio: string; bioEditing: boolean; bioInput: string;
  matches: ActiveMatch[]; totalSessions: number;
  onAvatarClick: () => void; setBioInput: (v: string) => void;
  setBioEditing: (v: boolean) => void; saveBio: () => void; onSignOut: () => void;
}) {
  if (!isOpen) return null;
  const hoursWorked = totalSessions;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="text-sm font-bold text-gray-700">My Profile</span>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-4 px-6 py-6 border-b border-gray-100">
            <div className="relative group">
              <div className="size-24 rounded-full overflow-hidden border-2 border-amber-200 shadow-md">
                {profilePic
                  ? <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  : <div className="size-full bg-amber-100 flex items-center justify-center text-2xl font-bold text-amber-700">{initials}</div>
                }
              </div>
              <button
                onClick={onAvatarClick}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                title="Change photo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            <button
              onClick={onAvatarClick}
              className="rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
            >
              Change photo
            </button>
          </div>

          {/* Bio */}
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Bio</span>
              {!bioEditing && (
                <button
                  onClick={() => { setBioInput(bio); setBioEditing(true); }}
                  className="text-xs font-semibold text-gray-400 hover:text-amber-600 transition"
                >
                  Edit
                </button>
              )}
            </div>
            {bioEditing ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Tell students a bit about yourself…"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                <div className="flex gap-2">
                  <button onClick={saveBio} className="flex-1 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition">Save</button>
                  <button onClick={() => setBioEditing(false)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-600">
                {bio || <span className="italic text-gray-400">No bio yet. Click Edit to add one.</span>}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="px-5 py-5 border-b border-gray-100">
            <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-amber-600">Statistics</span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Students", value: matches.length },
                { label: "Sessions", value: totalSessions },
                { label: "Avg Rating", value: "4.9 ★" },
                { label: "Hours Worked", value: hoursWorked },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
          >
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

function LevelBadge({ level }: { level: Subject["level"] }) {
  const cls = {
    Expert:     "bg-amber-100 text-amber-700 border-amber-200",
    Proficient: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Familiar:   "bg-gray-100 text-gray-600 border-gray-200",
  }[level];
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{level}</span>;
}

function ProficiencyBadge({ level }: { level: ActiveMatch["proficiency"] }) {
  const cls = {
    BEGINNER:     "bg-blue-50 text-blue-700 border-blue-200",
    INTERMEDIATE: "bg-amber-50 text-amber-700 border-amber-200",
    ADVANCED:     "bg-purple-50 text-purple-700 border-purple-200",
  }[level];
  const label = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" }[level];
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === "ACTIVE") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
      <span className="size-1.5 rounded-full bg-emerald-500" />Active
    </span>
  );
  if (status === "AWAITING_FIRST_SESSION") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
      <span className="size-1.5 rounded-full bg-amber-400" />Awaiting first session
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
      <span className="size-1.5 rounded-full bg-gray-300" />Paused
    </span>
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

/* ── Page ────────────────────────────────────────────── */
export default function TutorDashboard() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [matches, setMatches] = useState<ActiveMatch[]>(ACTIVE_MATCHES);
  const [profileSubjects, setProfileSubjects] = useState<Subject[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<StudentRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"matches" | "requests" | "messages">("matches");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Record<string, { from: "tutor" | "student"; body: string }[]>>({
    m1: [
      { from: "student", body: "Hi! I'm having trouble with completing the square. Can we start there?" },
      { from: "tutor",   body: "Of course! Let's work through a few examples step by step." },
    ],
    m2: [],
    m3: [{ from: "student", body: "Thank you for explaining ionic bonding last session — it finally clicked!" }],
    m4: [{ from: "student", body: "Hello! Looking forward to our first session. When works best for you?" }],
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace("/become");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`vt_tutor_schedule_${user.id}`);
      if (raw) setSelectedSlots(new Set(JSON.parse(raw)));
      const pic = localStorage.getItem(`vt_tutor_avatar_${user.id}`);
      if (pic) setProfilePic(pic);
      const savedBio = localStorage.getItem(`vt_tutor_bio_${user.id}`);
      if (savedBio) setBio(savedBio);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const profileRaw = localStorage.getItem(`vt_tutor_profile_${user.id}`);
      const profile = profileRaw ? JSON.parse(profileRaw) : { subjects: [] };
      const rejected: string[] = JSON.parse(localStorage.getItem(`vt_tutor_rejected_${user.id}`) || "[]");
      const allRequests: StudentRequest[] = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");

      const matching = allRequests.filter((req) => {
        if (req.status !== "pending") return false;
        if (rejected.includes(req.id)) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ts = profile.subjects.find((s: any) => s.name.toLowerCase() === req.subject.toLowerCase());
        if (!ts) return false;
        return (EDU_RANK[ts.educationLevel] ?? 1) >= (GRADE_RANK[req.gradeLevel] ?? 1);
      });
      setPendingRequests(matching);

      const savedMatches: ActiveMatch[] = JSON.parse(localStorage.getItem(`vt_tutor_matches_${user.id}`) || "[]");
      if (savedMatches.length > 0) {
        setMatches((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...prev, ...savedMatches.filter((m) => !ids.has(m.id))];
        });
        setMessages((prev) => {
          const next = { ...prev };
          savedMatches.forEach((m) => { if (!next[m.id]) next[m.id] = []; });
          return next;
        });
      }
    } catch { /* ignore */ }
  }, [user]);

  function handleAccept(req: StudentRequest) {
    const newMatch: ActiveMatch = {
      id: req.id,
      studentName: req.studentName,
      avatar: req.avatar,
      subject: req.subject,
      gradeLevel: GRADE_LABELS[req.gradeLevel] ?? req.gradeLevel,
      proficiency: "BEGINNER",
      helpMessage: req.helpMessage,
      matchedAt: "just now",
      sessionCount: 0,
      nextSession: null,
      status: "AWAITING_FIRST_SESSION",
      unreadMessages: 0,
    };
    setMatches((prev) => [...prev, newMatch]);
    setMessages((prev) => ({ ...prev, [req.id]: [] }));
    const existing: ActiveMatch[] = JSON.parse(localStorage.getItem(`vt_tutor_matches_${user!.id}`) || "[]");
    localStorage.setItem(`vt_tutor_matches_${user!.id}`, JSON.stringify([...existing, newMatch]));
    const allReqs: StudentRequest[] = JSON.parse(localStorage.getItem("vt_student_requests") || "[]");
    localStorage.setItem("vt_student_requests", JSON.stringify(
      allReqs.map((r) => r.id === req.id ? { ...r, status: "accepted", acceptedByTutorId: user!.id } : r)
    ));
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
    setActiveTab("matches");
  }

  function handleReject(req: StudentRequest) {
    const rejected: string[] = JSON.parse(localStorage.getItem(`vt_tutor_rejected_${user!.id}`) || "[]");
    localStorage.setItem(`vt_tutor_rejected_${user!.id}`, JSON.stringify([...rejected, req.id]));
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
  }

  const toggleSlot = useCallback((key: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem(`vt_tutor_schedule_${user!.id}`, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`vt_tutor_profile_${user.id}`);
      if (raw) {
        const profile = JSON.parse(raw);
        setProfileSubjects(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          profile.subjects.map((s: any) => ({
            name: s.name,
            level: mapProficiencyLevel(s.proficiency),
            education: EDUCATION_LABELS[s.educationLevel] ?? s.educationLevel,
          }))
        );
      }
    } catch { /* ignore malformed data */ }
  }, [user]);

  if (isLoading || !user) return null;

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const totalSessions = matches.reduce((a, m) => a + m.sessionCount, 0);
  const activeMatch = matches.find((m) => m.id === activeMatchId);

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfilePic(dataUrl);
      try { localStorage.setItem(`vt_tutor_avatar_${user!.id}`, dataUrl); } catch { /* ignore */ }
    };
    reader.readAsDataURL(file);
  }

  function saveBio() {
    setBio(bioInput);
    try { localStorage.setItem(`vt_tutor_bio_${user!.id}`, bioInput); } catch { /* ignore */ }
    setBioEditing(false);
  }

  function sendMessage() {
    if (!messageInput.trim() || !activeMatchId) return;
    setMessages((prev) => ({
      ...prev,
      [activeMatchId]: [...(prev[activeMatchId] ?? []), { from: "tutor", body: messageInput.trim() }],
    }));
    setMessageInput("");
  }

  return (
    <div className="min-h-screen bg-[#fef9ee]">
      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />
      {/* Profile panel */}
      <ProfilePanel
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        initials={initials}
        profilePic={profilePic}
        bio={bio}
        bioEditing={bioEditing}
        bioInput={bioInput}
        matches={matches}
        totalSessions={totalSessions}
        onAvatarClick={() => avatarInputRef.current?.click()}
        setBioInput={setBioInput}
        setBioEditing={setBioEditing}
        saveBio={saveBio}
        onSignOut={() => { signOut(); router.push("/"); }}
      />
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-black/10 bg-[#f7b801]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          <Link href="/" className="flex items-center">
            <Image src="/Guide_app_logo.png" alt="VolunTutor" width={160} height={56} className="h-14 w-auto object-contain mix-blend-multiply" priority />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-gray-800 sm:block">
              Hello, {user.name.split(" ")[0]} 👋
            </span>
            <Avatar initials={initials} src={profilePic} size="sm" color="amber" onClick={() => setProfileOpen(true)} />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 space-y-5">

            {/* Profile */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar initials={initials} src={profilePic} size="lg" color="amber" onClick={() => setProfileOpen(true)} />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 14 14" fill={s <= 4 ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="1">
                      <path d="M7 1l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7 8.885l-3.09 1.624.59-3.44L2 4.632l3.455-.502L7 1z"/>
                    </svg>
                  ))}
                  <span className="text-xs text-gray-500">4.9</span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat label="Students" value={matches.length} />
                <Stat label="Sessions" value={totalSessions} />
              </div>
            </div>

            {/* Subjects */}
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-600">Subject Proficiency</h3>
              {profileSubjects.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No subjects added yet.</p>
              ) : (
                <div className="space-y-3">
                  {profileSubjects.map((s) => (
                    <div key={s.name} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400 truncate">{s.education}</p>
                      </div>
                      <LevelBadge level={s.level} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule */}
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-600">Weekly Schedule</h3>
              <DashboardTimetable selected={selectedSlots} onToggle={toggleSlot} matches={matches} />
            </div>
          </aside>

          {/* ── Main ── */}
          <main className="min-w-0 flex-1 space-y-6">

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm w-fit">
              {(["matches", "requests", "messages"] as const).map((tab) => {
                const unread = matches.reduce((a, m) => a + m.unreadMessages, 0);
                const badge = tab === "messages" ? unread : tab === "requests" ? pendingRequests.length : 0;
                const label = tab === "matches" ? "Current Students" : tab === "requests" ? "Requests" : "Messages";
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab === tab ? "bg-amber-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                    {label}
                    {badge > 0 && (
                      <span className={`absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${activeTab === tab ? "bg-white text-amber-600" : "bg-amber-500 text-white"}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Current Students tab ── */}
            {activeTab === "matches" && (
              <div className="space-y-4">
                {matches.length === 0 && (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600">No active matches yet</p>
                      <p className="mt-1 text-sm text-gray-400">The matching engine will pair you with students automatically based on your subjects and availability.</p>
                    </div>
                  </div>
                )}
                {matches.map((match) => (
                  <div key={match.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {/* Student info */}
                      <div className="flex flex-1 gap-4">
                        <Avatar initials={match.avatar} size="md"
                          color={["blue","green","purple","rose"][parseInt(match.id.replace("m",""))-1] as "blue" | "green" | "purple" | "rose"} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-gray-900">{match.studentName}</h4>
                            <StatusBadge status={match.status} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{match.subject}</span>
                            <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">{match.gradeLevel}</span>
                            <ProficiencyBadge level={match.proficiency} />
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
                      {/* Action */}
                      <button
                        onClick={() => { setActiveMatchId(match.id); setActiveTab("messages"); }}
                        className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${match.unreadMessages > 0 ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Message
                        {match.unreadMessages > 0 && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{match.unreadMessages}</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Requests tab ── */}
            {activeTab === "requests" && (
              <div className="space-y-4">
                {pendingRequests.length === 0 && (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600">No pending requests</p>
                      <p className="mt-1 text-sm text-gray-400">New student requests matching your subjects will appear here.</p>
                    </div>
                  </div>
                )}
                {pendingRequests.map((req) => (
                  <div key={req.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <Avatar initials={req.avatar} size="md" color="blue" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-gray-900">{req.studentName}</h4>
                          <span className="text-xs text-gray-400">· {new Date(req.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{req.subject}</span>
                          <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{GRADE_LABELS[req.gradeLevel] ?? req.gradeLevel}</span>
                        </div>
                        <p className="mt-2.5 text-sm leading-relaxed text-gray-600 italic">&ldquo;{req.helpMessage}&rdquo;</p>
                      </div>
                      {/* Accept / Reject */}
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleReject(req)}
                          title="Decline request"
                          className="flex size-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100 hover:border-red-300"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleAccept(req)}
                          title="Accept request"
                          className="flex size-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 hover:border-emerald-300"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Messages tab ── */}
            {activeTab === "messages" && (
              <div className="flex h-[600px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                {/* Student list */}
                <div className="w-56 shrink-0 border-r border-gray-100 flex flex-col">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Students</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {matches.map((m) => (
                      <button key={m.id} onClick={() => setActiveMatchId(m.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${activeMatchId === m.id ? "bg-amber-50 border-r-2 border-amber-400" : "hover:bg-gray-50"}`}>
                        <div className="relative">
                          <Avatar initials={m.avatar} size="sm" color="amber" />
                          {m.unreadMessages > 0 && (
                            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">{m.unreadMessages}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">{m.studentName}</p>
                          <p className="truncate text-xs text-gray-400">{m.subject}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thread */}
                <div className="flex flex-1 flex-col min-w-0">
                  {activeMatch ? (
                    <>
                      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                        <Avatar initials={activeMatch.avatar} size="sm" color="amber" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{activeMatch.studentName}</p>
                          <p className="text-xs text-gray-400">{activeMatch.subject} · {activeMatch.gradeLevel}</p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 px-5 py-4">
                        {(messages[activeMatch.id] ?? []).length === 0 && (
                          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello!</p>
                        )}
                        {(messages[activeMatch.id] ?? []).map((msg, i) => (
                          <div key={i} className={`flex ${msg.from === "tutor" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${msg.from === "tutor" ? "bg-amber-500 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                              {msg.body}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
                        <input
                          type="text"
                          placeholder="Type a message…"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        />
                        <button onClick={sendMessage}
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition hover:bg-amber-400">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
                      <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                      <p className="font-semibold text-gray-500">Select a student to view messages</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
