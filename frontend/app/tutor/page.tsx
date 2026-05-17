"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";

/* ── Types ───────────────────────────────────────────── */
interface StudentRequest {
  id: string;
  name: string;
  age: number;
  grade: string;
  subject: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  message: string;
  requestedTimes: string;
  avatar: string;
}

interface EnrolledStudent {
  id: string;
  name: string;
  subject: string;
  grade: string;
  avatar: string;
  sessionCount: number;
  nextSession: string;
}

interface Subject {
  name: string;
  level: "Expert" | "Proficient" | "Familiar";
  education: string;
}

interface ScheduleSlot {
  time: string;
  studentName?: string;
  studentAvatar?: string;
  subject?: string;
}

/* ── Mock data ───────────────────────────────────────── */
const MOCK_ENROLLED: EnrolledStudent[] = [
  { id: "e1", name: "Aisha Patel", subject: "Mathematics", grade: "Grade 9", avatar: "AP", sessionCount: 14, nextSession: "Mon 4:00 PM" },
  { id: "e2", name: "Daniel Osei", subject: "Physics", grade: "Grade 11", avatar: "DO", sessionCount: 8, nextSession: "Tue 5:30 PM" },
  { id: "e3", name: "Mei Lin", subject: "Chemistry", grade: "Grade 10", avatar: "ML", sessionCount: 22, nextSession: "Wed 4:00 PM" },
  { id: "e4", name: "Carlos Rivera", subject: "Mathematics", grade: "Grade 8", avatar: "CR", sessionCount: 6, nextSession: "Thu 6:00 PM" },
];

const INITIAL_REQUESTS: StudentRequest[] = [
  {
    id: "r1",
    name: "Priya Sharma",
    age: 15,
    grade: "Grade 10",
    subject: "Physics",
    level: "Beginner",
    message: "I'm really struggling with Newton's laws and motion problems. My exams are in 6 weeks and I'd love a patient tutor who can explain concepts from scratch.",
    requestedTimes: "Weekdays 5–7 PM or Saturday mornings",
    avatar: "PS",
  },
  {
    id: "r2",
    name: "James Okafor",
    age: 17,
    grade: "Grade 12",
    subject: "Mathematics",
    level: "Intermediate",
    message: "I need help with calculus — derivatives and integration specifically. I understand the basics but keep making errors on complex problems.",
    requestedTimes: "Mon, Wed, Fri after 4 PM",
    avatar: "JO",
  },
  {
    id: "r3",
    name: "Sofia Reyes",
    age: 14,
    grade: "Grade 9",
    subject: "Chemistry",
    level: "Beginner",
    message: "The periodic table and chemical bonding are really confusing to me. I want to understand the 'why' behind reactions, not just memorise them.",
    requestedTimes: "Tuesdays and Thursdays 3–5 PM",
    avatar: "SR",
  },
  {
    id: "r4",
    name: "Liam Kowalski",
    age: 16,
    grade: "Grade 11",
    subject: "Physics",
    level: "Advanced",
    message: "Looking for a tutor to help me prepare for the Physics Olympiad. I'm comfortable with the standard curriculum but want to tackle harder problem sets.",
    requestedTimes: "Weekends, flexible timing",
    avatar: "LK",
  },
];

const SUBJECTS: Subject[] = [
  { name: "Mathematics", level: "Expert",     education: "M.Sc. Pure Mathematics" },
  { name: "Physics",     level: "Expert",     education: "B.Sc. Physics (Hons.)" },
  { name: "Chemistry",   level: "Proficient", education: "B.Sc. Chemistry" },
  { name: "Biology",     level: "Familiar",   education: "Minor — Life Sciences" },
];

const SCHEDULE: { day: string; slots: ScheduleSlot[] }[] = [
  { day: "Mon", slots: [
    { time: "4:00 PM", studentName: "Aisha Patel",   studentAvatar: "AP", subject: "Mathematics" },
    { time: "5:30 PM" },
  ]},
  { day: "Tue", slots: [
    { time: "5:30 PM", studentName: "Daniel Osei",   studentAvatar: "DO", subject: "Physics" },
  ]},
  { day: "Wed", slots: [
    { time: "4:00 PM", studentName: "Mei Lin",       studentAvatar: "ML", subject: "Chemistry" },
    { time: "6:00 PM" },
  ]},
  { day: "Thu", slots: [
    { time: "6:00 PM", studentName: "Carlos Rivera", studentAvatar: "CR", subject: "Mathematics" },
  ]},
  { day: "Fri",  slots: [] },
  { day: "Sat",  slots: [{ time: "10:00 AM" }, { time: "11:30 AM" }] },
  { day: "Sun",  slots: [] },
];

/* ── Avatar ──────────────────────────────────────────── */
function Avatar({ initials, size = "md", color = "amber" }: { initials: string; size?: "sm" | "md" | "lg"; color?: "amber" | "blue" | "green" | "purple" | "rose" }) {
  const sizeClass = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl" }[size];
  const colorClass = {
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    blue:  "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple:"bg-violet-100 text-violet-700 border-violet-200",
    rose:  "bg-rose-100 text-rose-700 border-rose-200",
  }[color];
  return (
    <div className={`${sizeClass} ${colorClass} flex shrink-0 items-center justify-center rounded-full border font-bold`}>
      {initials}
    </div>
  );
}

/* ── Subject level badge ─────────────────────────────── */
function LevelBadge({ level }: { level: Subject["level"] }) {
  const cls = {
    Expert: "bg-amber-100 text-amber-700 border-amber-200",
    Proficient: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Familiar: "bg-gray-100 text-gray-600 border-gray-200",
  }[level];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{level}</span>
  );
}

/* ── Request level badge ─────────────────────────────── */
function ReqLevel({ level }: { level: StudentRequest["level"] }) {
  const cls = {
    Beginner: "bg-blue-50 text-blue-700 border-blue-200",
    Intermediate: "bg-amber-50 text-amber-700 border-amber-200",
    Advanced: "bg-purple-50 text-purple-700 border-purple-200",
  }[level];
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{level}</span>;
}

/* ── Stat pill ───────────────────────────────────────── */
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
  const [requests, setRequests] = useState<StudentRequest[]>(INITIAL_REQUESTS);
  const [enrolled, setEnrolled] = useState<EnrolledStudent[]>(MOCK_ENROLLED);
  const [activeTab, setActiveTab] = useState<"requests" | "students">("requests");
  const [declinedId, setDeclinedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/become-a-tutor");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleAccept(req: StudentRequest) {
    const newStudent: EnrolledStudent = {
      id: req.id,
      name: req.name,
      subject: req.subject,
      grade: req.grade,
      avatar: req.avatar,
      sessionCount: 0,
      nextSession: req.requestedTimes.split(" ")[0] + " — TBD",
    };
    setEnrolled((prev) => [newStudent, ...prev]);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  }

  function handleDecline(id: string) {
    setDeclinedId(id);
    setTimeout(() => {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setDeclinedId(null);
    }, 400);
  }

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#fef9ee]">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-black/10 bg-[#f7b801]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center">
            <Image
              src="/Guide_app_logo.png"
              alt="VolunTutor"
              width={160}
              height={56}
              className="h-14 w-auto object-contain mix-blend-multiply"
              priority
            />
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-gray-800 sm:block">
              Hello, {user.name.split(" ")[0]} 👋
            </span>
            <div className="flex items-center gap-2">
              <Avatar initials={initials} size="sm" color="amber" />
              <button
                onClick={handleSignOut}
                className="rounded-full border border-gray-900/20 bg-white/40 px-4 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-white/70"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 space-y-5">

            {/* Profile card */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar initials={initials} size="lg" color="amber" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 14 14" fill={s <= 4 ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="1" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 1l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7 8.885l-3.09 1.624.59-3.44L2 4.632l3.455-.502L7 1z"/>
                    </svg>
                  ))}
                  <span className="text-xs text-gray-500">4.9</span>
                </div>
              </div>

              {/* Quick stats */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat label="Students" value={enrolled.length} />
                <Stat label="Sessions" value={enrolled.reduce((a, s) => a + s.sessionCount, 0)} />
              </div>
            </div>

            {/* Subjects */}
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-600">Subject Proficiency</h3>
              <div className="space-y-3">
                {SUBJECTS.map((s) => (
                  <div key={s.name} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.education}</p>
                    </div>
                    <LevelBadge level={s.level} />
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-600">Weekly Schedule</h3>
              <div className="space-y-2.5">
                {SCHEDULE.map((d) => (
                  <div key={d.day} className="flex items-start gap-3">
                    <span className="w-8 shrink-0 pt-0.5 text-xs font-bold text-gray-400">{d.day}</span>
                    {d.slots.length > 0 ? (
                      <div className="flex flex-col gap-1.5 flex-1">
                        {d.slots.map((slot) => (
                          <div
                            key={slot.time}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                              slot.studentName
                                ? "border-amber-200 bg-amber-50"
                                : "border-dashed border-gray-200 bg-gray-50"
                            }`}
                          >
                            <span className={`shrink-0 text-xs font-semibold tabular-nums ${slot.studentName ? "text-amber-700" : "text-gray-400"}`}>
                              {slot.time}
                            </span>
                            {slot.studentName ? (
                              <>
                                <span className="text-gray-300">·</span>
                                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[9px] font-bold text-amber-800">
                                  {slot.studentAvatar}
                                </div>
                                <span className="truncate text-xs font-medium text-gray-700">
                                  {slot.studentName}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Open</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="pt-0.5 text-xs text-gray-300">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="min-w-0 flex-1 space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm w-fit">
              {(["requests", "students"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab === "requests" ? "Student Requests" : "My Students"}
                  {tab === "requests" && requests.length > 0 && (
                    <span className={`absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${activeTab === "requests" ? "bg-white text-amber-600" : "bg-amber-500 text-white"}`}>
                      {requests.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Student Requests ── */}
            {activeTab === "requests" && (
              <div className="space-y-4">
                {requests.length === 0 && (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-amber-50 border border-amber-100">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <p className="font-semibold text-gray-500">No pending requests</p>
                    <p className="text-sm text-gray-400">New student requests will appear here.</p>
                  </div>
                )}
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className={`rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition-all duration-300 ${
                      declinedId === req.id ? "opacity-0 scale-95" : "opacity-100 scale-100"
                    }`}
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      {/* Student info */}
                      <div className="flex flex-1 gap-4">
                        <Avatar
                          initials={req.avatar}
                          size="md"
                          color={["blue","green","purple","rose"][parseInt(req.id.replace("r",""))-1] as "blue" | "green" | "purple" | "rose"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-gray-900">{req.name}</h4>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-sm text-gray-500">{req.grade}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-sm text-gray-500">Age {req.age}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{req.subject}</span>
                            <ReqLevel level={req.level} />
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-gray-600 italic">&ldquo;{req.message}&rdquo;</p>
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span>Preferred: {req.requestedTimes}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-2 sm:flex-col">
                        <button
                          onClick={() => handleAccept(req)}
                          className="flex-1 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400 active:bg-amber-600 sm:flex-none sm:w-full"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDecline(req.id)}
                          className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 sm:flex-none sm:w-full"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── My Students ── */}
            {activeTab === "students" && (
              <div className="space-y-4">
                {enrolled.length === 0 && (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                    <p className="font-semibold text-gray-500">No enrolled students yet</p>
                    <p className="text-sm text-gray-400">Accept student requests to see them here.</p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {enrolled.map((s) => (
                    <div key={s.id} className="flex gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                      <Avatar
                        initials={s.avatar}
                        size="md"
                        color="amber"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{s.name}</p>
                        <p className="text-sm text-gray-500">{s.grade} · {s.subject}</p>
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Next: {s.nextSession}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {s.sessionCount} session{s.sessionCount !== 1 ? "s" : ""} completed
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
