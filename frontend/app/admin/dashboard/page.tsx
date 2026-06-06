"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as db from "@/lib/db";
import { PasswordInput } from "@/components/ui/password-input";

/* ── Types ───────────────────────────────────────────── */
interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: "tutor" | "student";
}

interface TutorApplication {
  id: string;
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  cvFileName: string;
  cvDataUrl: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

interface Moderator {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

interface ReviewRecord {
  id: string;
  tutorId: string;
  tutorName?: string;
  reviewerName?: string;
  studentName?: string;
  rating: number;
  text?: string;
  comment?: string;
  createdAt?: string;
}

interface Request {
  id: string;
  studentId?: string;
  studentName: string;
  subject: string;
  gradeLevel: string;
  helpMessage: string;
  availabilitySlots: string[];
  submittedAt: string;
  status: "pending" | "accepted" | "cancelled";
  acceptedByTutorId?: string;
  targetTutorId?: string;
  recurrenceWeeks?: number;
}

interface TutorMatch {
  id: string;
  studentId?: string;
  subject?: string;
  gradeLevel?: string;
  bookedSlots?: string[];
  matchedAt?: string;
  status?: string;
}

const GRADE_LABELS: Record<string, string> = {
  GRADE_6: "Grade 6", GRADE_7: "Grade 7", GRADE_8: "Grade 8", GRADE_9: "Grade 9",
  GRADE_10: "Grade 10", GRADE_11: "Grade 11", GRADE_12: "Grade 12",
  UG: "University (UG)", PG: "University (PG)", PHD: "PhD",
};

/* ── Confirm Dialog ──────────────────────────────────── */
function ConfirmDialog({
  message, onConfirm, onCancel,
}: { message: string; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex size-11 items-center justify-center rounded-full bg-red-50 border border-red-100 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Are you sure?</p>
          <p className="text-sm text-gray-500 mb-5">{message}</p>
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 transition">
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Stat card ───────────────────────────────────────── */
function StatCard({ label, value, icon, color }: {
  label: string; value: number | string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
      <div className={`flex size-10 items-center justify-center rounded-xl ${color} mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

/* ── Badge ───────────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: "green" | "amber" | "red" | "slate" | "blue" }) {
  const cls = {
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-400/10 border-amber-400/20 text-amber-400",
    red:   "bg-red-500/10 border-red-500/20 text-red-400",
    slate: "bg-slate-700 border-slate-600 text-slate-300",
    blue:  "bg-blue-500/10 border-blue-500/20 text-blue-400",
  }[color];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

type SessionRow = {
  matchId: string; tutorId: string; tutorName: string;
  studentId: string; studentName: string;
  subject: string; gradeLevel: string;
  bookedSlots: string[]; matchedAt: string; status: string;
};

type EnrichedTutor = StoredUser & {
  subjects: Array<{ name: string }>;
  matchCount: number;
  ratings: Array<{ rating: number }>;
  avg: string | null;
  hoursWorked: number;
};

/* ── Page ────────────────────────────────────────────── */
export default function AdminDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"overview" | "tutors" | "students" | "requests" | "sessions" | "applications" | "moderators" | "reviews" | "reports">("overview");
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reports, setReports] = useState<db.DbTutorReport[]>([]);
  const [classroomMap, setClassroomMap] = useState<Record<string, string>>({}); // studentId → mod name
  const [enrichedTutors, setEnrichedTutors] = useState<EnrichedTutor[]>([]);
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [newMod, setNewMod] = useState({ name: "", email: "", password: "" });
  const [newModError, setNewModError] = useState("");
  const [appDenyNotes, setAppDenyNotes] = useState<Record<string, string>>({});
  const [showDenyFor, setShowDenyFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void | Promise<void> } | null>(null);
  const [search, setSearch] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");
  const [editingHours, setEditingHours] = useState<Record<string, string>>({});
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem("vt_admin_session")) {
      router.replace("/find/auth");
      return;
    }
    loadData();
  }, [router]);

  async function loadData() {
    try {
      const allUsers = await db.getUsers();
      const mappedUsers: StoredUser[] = allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      setUsers(mappedUsers);

      const allReqs = await db.getRequests();
      const mappedReqs: Request[] = allReqs.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name,
        subject: r.subject,
        gradeLevel: r.grade_level,
        helpMessage: r.help_message ?? "",
        availabilitySlots: r.availability_slots ?? [],
        submittedAt: r.submitted_at,
        status: r.status,
        acceptedByTutorId: r.accepted_by_tutor_id,
        targetTutorId: r.target_tutor_id,
        recurrenceWeeks: r.recurrence_weeks,
      }));
      setRequests(mappedReqs);

      // Build banned set from is_banned column
      const banned = new Set<string>();
      allUsers.forEach((u) => { if (u.is_banned) banned.add(u.id); });
      setBannedIds(banned);

      const tutorList = allUsers.filter((u) => u.role === "tutor");
      const studentList = allUsers.filter((u) => u.role === "student");

      // Build sessions
      const computedSessions: SessionRow[] = [];
      await Promise.all(tutorList.map(async (t) => {
        try {
          const matches = await db.getTutorMatches(t.id);
          matches.forEach((m) => {
            const student = studentList.find((s) => s.id === m.student_id);
            computedSessions.push({
              matchId: m.id,
              tutorId: t.id,
              tutorName: t.name,
              studentId: m.student_id ?? "",
              studentName: student?.name ?? "Unknown",
              subject: m.subject ?? "—",
              gradeLevel: m.grade_level ?? "—",
              bookedSlots: m.booked_slots ?? [],
              matchedAt: m.matched_at ?? "",
              status: m.status ?? "ACTIVE",
            });
          });
        } catch { /* ignore */ }
      }));
      setSessions(computedSessions);

      // Enrich tutors
      const enriched: EnrichedTutor[] = await Promise.all(tutorList.map(async (t) => {
        const profile = await db.getTutorProfile(t.id).catch(() => null);
        const subjects: Array<{ name: string }> = profile?.subjects ?? [];
        const hoursWorked: number = profile?.hours_worked ?? 0;
        const matches = await db.getTutorMatches(t.id).catch(() => []);
        const matchCount = matches.length;
        const ratings = await db.getTutorRatings(t.id).catch(() => []);
        const avg = ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : null;
        return { id: t.id, name: t.name, email: t.email, role: t.role as "tutor" | "student", subjects, matchCount, ratings, avg, hoursWorked };
      }));
      setEnrichedTutors(enriched);

      // Reviews
      const computedReviews = await db.getReviews();
      setReviews(computedReviews.map((r) => ({
        id: r.id,
        tutorId: r.tutor_id ?? "",
        tutorName: r.tutor_name,
        reviewerName: r.reviewer_name,
        studentName: r.student_name,
        rating: r.rating,
        text: r.text,
        comment: r.comment,
        createdAt: r.created_at,
      })));

      // Reports
      const rpts = await db.getReports().catch(() => []);
      setReports(rpts);

      // Applications
      const apps = await db.getApplications();
      setApplications(
        apps
          .map((a): TutorApplication => ({
            id: a.id,
            name: a.name,
            email: a.email,
            password: a.password,
            phoneNumber: a.phone_number,
            cvFileName: a.cv_file_name ?? "",
            cvDataUrl: a.cv_data_url ?? "",
            status: a.status,
            submittedAt: a.submitted_at,
            reviewedAt: a.reviewed_at,
            reviewedBy: a.reviewed_by,
            reviewNote: a.review_note,
          }))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      );

      // Moderators
      const mods = await db.getModerators();
      setModerators(mods.map((m) => ({ id: m.id, name: m.name, email: m.email, password: m.password, createdAt: m.created_at ?? "" })));

      // Classroom membership map: studentId → mod name
      try {
        const classroomRows = await db.getAllClassroomMembers();
        const map: Record<string, string> = {};
        for (const row of classroomRows) {
          const m = mods.find((x) => x.id === row.mod_id);
          if (m) map[row.student_id] = m.name;
        }
        setClassroomMap(map);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }

  const tutors = users.filter((u) => u.role === "tutor");
  const students = users.filter((u) => u.role === "student");

  const pendingCount       = requests.filter((r) => r.status === "pending").length;
  const acceptedCount      = requests.filter((r) => r.status === "accepted").length;
  const activeSessionCount = sessions.filter((s) => s.status === "ACTIVE").length;

  /* Actions */
  const toggleBan = useCallback((userId: string, currentlyBanned: boolean) => {
    const action = async () => {
      await db.setBanned(userId, !currentlyBanned).catch(() => { /* ignore */ });
      if (!currentlyBanned) {
        // Force sign-out the banned user if they are currently logged in
        try {
          const sess = JSON.parse(localStorage.getItem("vt_session") || "null");
          if (sess?.id === userId) localStorage.removeItem("vt_session");
        } catch { /* ignore */ }
        setBannedIds((prev) => new Set([...prev, userId]));
      } else {
        setBannedIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
      }
      setConfirm(null);
    };
    setConfirm({
      message: currentlyBanned
        ? `Unban this user? They will be able to sign in again.`
        : `Ban this user? They will be immediately signed out and blocked from logging in.`,
      action,
    });
  }, []);

  const deleteRequest = useCallback((reqId: string) => {
    setConfirm({
      message: "Delete this request permanently? This cannot be undone.",
      action: async () => {
        await db.deleteRequest(reqId).catch(() => { /* ignore */ });
        setRequests((prev) => prev.filter((r) => r.id !== reqId));
        setConfirm(null);
      },
    });
  }, []);

  const deleteSession = useCallback((tutorId: string, matchId: string) => {
    setConfirm({
      message: "Delete this session/match permanently? Both the tutor and student will lose this record.",
      action: async () => {
        await db.deleteMatch(tutorId, matchId).catch(() => { /* ignore */ });
        // Cancel the associated request if it exists
        await db.updateRequestStatus(matchId, "cancelled").catch(() => { /* ignore */ });
        await loadData();
        setConfirm(null);
      },
    });
  }, []); // eslint-disable-line

  const deleteAccount = useCallback((userId: string, userName: string, userEmail?: string) => {
    setConfirm({
      message: `Permanently delete ${userName}'s account? All their data will be removed. This cannot be undone.`,
      action: async () => {
        await db.deleteUser(userId).catch(() => { /* ignore */ });
        // Also remove any associated tutor application so the email can be reused
        if (userEmail) {
          const app = await db.getApplicationByEmail(userEmail).catch(() => null);
          if (app) await db.deleteApplication(app.id).catch(() => { /* ignore */ });
        }
        // Sign out the deleted user if they are currently logged in
        try {
          const sess = JSON.parse(localStorage.getItem("vt_session") || "null");
          if (sess?.id === userId) localStorage.removeItem("vt_session");
        } catch { /* ignore */ }
        await loadData();
        setConfirm(null);
      },
    });
  }, []); // eslint-disable-line

  const deleteReview = useCallback((reviewId: string) => {
    setConfirm({
      message: "Delete this review permanently?",
      action: async () => {
        await db.deleteReview(reviewId).catch(() => { /* ignore */ });
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        setConfirm(null);
      },
    });
  }, []);

  const adminApproveApp = useCallback((app: TutorApplication) => {
    setConfirm({
      message: `Approve ${app.name}'s application? This will create their tutor account.`,
      action: async () => {
        try {
          const existing = await db.getUserByEmail(app.email);
          if (!existing) {
            await db.createUser({ id: Date.now().toString(), name: app.name, email: app.email, password: app.password, role: "tutor" });
          }
        } catch { /* ignore */ }
        await db.updateApplicationStatus(app.id, "approved", "Admin").catch(() => { /* ignore */ });
        await loadData();
        setConfirm(null);
      },
    });
  }, []); // eslint-disable-line

  const deleteApplication = useCallback((appId: string, appName: string) => {
    setConfirm({
      message: `Delete ${appName}'s application permanently? This cannot be undone.`,
      action: async () => {
        await db.deleteApplication(appId).catch(() => { /* ignore */ });
        setApplications((prev) => prev.filter((a) => a.id !== appId));
        setConfirm(null);
      },
    });
  }, []);

  const adminDenyApp = useCallback((app: TutorApplication) => {
    const note = appDenyNotes[app.id] ?? "";
    setConfirm({
      message: `Deny ${app.name}'s application?`,
      action: async () => {
        await db.updateApplicationStatus(app.id, "denied", "Admin", note || undefined).catch(() => { /* ignore */ });
        setShowDenyFor(null);
        await loadData();
        setConfirm(null);
      },
    });
  }, [appDenyNotes]);

  async function createModerator() {
    setNewModError("");
    if (!newMod.name.trim() || !newMod.email.trim() || !newMod.password.trim()) {
      setNewModError("All fields are required."); return;
    }
    if (newMod.password.length < 8) { setNewModError("Password must be at least 8 characters."); return; }
    const existing = moderators.find((m) => m.email === newMod.email.trim().toLowerCase());
    if (existing) { setNewModError("A moderator with this email already exists."); return; }
    const mod: Moderator = {
      id: Date.now().toString(),
      name: newMod.name.trim(),
      email: newMod.email.trim().toLowerCase(),
      password: newMod.password,
      createdAt: new Date().toISOString(),
    };
    await db.createModerator({ id: mod.id, name: mod.name, email: mod.email, password: mod.password, created_at: mod.createdAt }).catch(() => { /* ignore */ });
    setModerators((prev) => [...prev, mod]);
    setNewMod({ name: "", email: "", password: "" });
  }

  const removeModerator = useCallback((modId: string, modName: string) => {
    setConfirm({
      message: `Remove ${modName} as a moderator? They will lose access immediately.`,
      action: async () => {
        await db.deleteModerator(modId).catch(() => { /* ignore */ });
        if (localStorage.getItem("vt_mod_session") === modId) localStorage.removeItem("vt_mod_session");
        setModerators((prev) => prev.filter((m) => m.id !== modId));
        setConfirm(null);
      },
    });
  }, []);

  function signOut() {
    localStorage.removeItem("vt_admin_session");
    router.push("/find/auth");
  }

  async function handleReset() {
    if (resetPhrase !== "RESET") return;
    setResetting(true);
    try {
      await db.resetAllData();
      localStorage.removeItem("vt_session");
      setShowResetModal(false);
      setResetPhrase("");
      await loadData();
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      setResetting(false);
    }
  }

  const q = search.toLowerCase();
  const filteredTutors   = tutors.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  const filteredStudents = students.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  const filteredRequests = requests.filter((r) => !q || r.studentName.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q));
  const filteredSessions = sessions.filter((s) => !q || s.tutorName.toLowerCase().includes(q) || s.studentName.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q));

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

      {/* Reset modal */}
      {showResetModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => { setShowResetModal(false); setResetPhrase(""); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl">
              <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-base font-black text-white mb-1">Reset All Platform Data</p>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                This will permanently delete <span className="text-red-400 font-semibold">all users, applications, sessions, requests, and reviews</span>. Moderator accounts are preserved. This action cannot be undone.
              </p>
              <p className="text-xs text-slate-500 mb-2">Type <span className="font-mono font-bold text-red-400">RESET</span> to confirm</p>
              <input
                type="text"
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                placeholder="RESET"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-red-400 focus:outline-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowResetModal(false); setResetPhrase(""); }}
                  className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition">
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetPhrase !== "RESET" || resetting}
                  className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
                  {resetting ? "Resetting…" : "Reset Everything"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">VolunTutor Admin</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Management Console</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search users, sessions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56 rounded-lg border border-slate-700 bg-slate-800 pl-8 pr-3 text-xs text-white placeholder:text-slate-600 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <button onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-red-500/40 hover:text-red-400 transition">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Tab nav */}
        <div className="flex flex-wrap gap-1 mb-8 rounded-xl border border-slate-800 bg-slate-900 p-1.5 w-fit">
          {([
            { id: "overview",      label: "Overview" },
            { id: "tutors",        label: `Tutors (${tutors.length})` },
            { id: "students",      label: `Students (${students.length})` },
            { id: "requests",      label: `Requests (${requests.filter((r) => r.status === "pending").length} pending)` },
            { id: "sessions",      label: `Sessions (${sessions.length})` },
            { id: "applications",  label: `Applications (${applications.filter((a) => a.status === "pending").length} pending)` },
            { id: "moderators",    label: `Moderators (${moderators.length})` },
            { id: "reviews",       label: `Reviews (${reviews.length})` },
            { id: "reports",       label: `Reports (${reports.filter((r) => r.status === "pending").length} pending)` },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === id ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Total Tutors" value={tutors.length} color="bg-amber-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              />
              <StatCard label="Total Students" value={students.length} color="bg-teal-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
              />
              <StatCard label="Active Sessions" value={activeSessionCount} color="bg-blue-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              />
              <StatCard label="Pending Requests" value={pendingCount} color="bg-violet-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard label="Accepted Requests" value={acceptedCount} color="bg-emerald-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              />
              <StatCard label="Total Reviews" value={reviews.length} color="bg-amber-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
              />
              <StatCard label="Banned Users" value={bannedIds.size} color="bg-red-400/20"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
              />
            </div>

            {/* Recent requests */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="border-b border-slate-800 px-6 py-4">
                <p className="text-sm font-bold text-white">Recent Requests</p>
              </div>
              <div className="divide-y divide-slate-800">
                {requests.slice(-5).reverse().map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.studentName}</p>
                      <p className="text-xs text-slate-400">{r.subject} · {GRADE_LABELS[r.gradeLevel] ?? r.gradeLevel}</p>
                    </div>
                    <Badge
                      label={r.status}
                      color={r.status === "accepted" ? "green" : r.status === "pending" ? "amber" : "slate"}
                    />
                  </div>
                ))}
                {requests.length === 0 && (
                  <p className="px-6 py-8 text-sm text-slate-500 text-center">No requests yet.</p>
                )}
              </div>
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">Danger Zone</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Reset All Platform Data</p>
                  <p className="text-xs text-slate-500 mt-0.5">Permanently delete all users, applications, sessions, requests, and reviews. Moderators are preserved.</p>
                </div>
                <button
                  onClick={() => setShowResetModal(true)}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Reset Everything
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tutors ── */}
        {tab === "tutors" && (
          <div className="space-y-3">
            {filteredTutors.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">{search ? "No tutors match your search." : "No tutors registered yet."}</p>
              </div>
            )}
            {filteredTutors.map((t) => {
              const enriched = enrichedTutors.find((e) => e.id === t.id);
              const isBanned = bannedIds.has(t.id);
              const subjects = enriched?.subjects ?? [];
              const matchCount = enriched?.matchCount ?? 0;
              const ratings = enriched?.ratings ?? [];
              const avg = enriched?.avg ?? null;
              const hoursWorked = enriched?.hoursWorked ?? 0;
              const initials = t.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const isEditingHours = t.id in editingHours;
              return (
                <div key={t.id} className={`rounded-2xl border bg-slate-900 p-5 ${isBanned ? "border-red-500/30 opacity-60" : "border-slate-800"}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-4 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-sm font-bold text-amber-400 border border-amber-400/20">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white">{t.name}</p>
                          <Badge label="Tutor" color="amber" />
                          {isBanned && <Badge label="Banned" color="red" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{t.email}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                          <span>{subjects.length} subject{subjects.length !== 1 ? "s" : ""}</span>
                          <span>·</span>
                          <span>{matchCount} student{matchCount !== 1 ? "s" : ""}</span>
                          {avg && <><span>·</span><span className="text-amber-400">★ {avg} ({ratings.length})</span></>}
                        </div>
                        {/* Hours worked */}
                        <div className="mt-2.5 flex items-center gap-2">
                          {isEditingHours ? (
                            <>
                              <input
                                type="number" min="0" step="0.5"
                                value={editingHours[t.id]}
                                onChange={(e) => setEditingHours((p) => ({ ...p, [t.id]: e.target.value }))}
                                className="w-24 rounded-lg border border-amber-400/40 bg-slate-800 px-2 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                                autoFocus
                              />
                              <span className="text-xs text-slate-400">hrs</span>
                              <button
                                onClick={async () => {
                                  const h = parseFloat(editingHours[t.id]);
                                  if (!isNaN(h) && h >= 0) {
                                    await db.setTutorHours(t.id, h).catch(() => {});
                                    setEnrichedTutors((prev) => prev.map((e) => e.id === t.id ? { ...e, hoursWorked: h } : e));
                                  }
                                  setEditingHours((p) => { const n = { ...p }; delete n[t.id]; return n; });
                                }}
                                className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-900 hover:bg-amber-300 transition">
                                Save
                              </button>
                              <button
                                onClick={() => setEditingHours((p) => { const n = { ...p }; delete n[t.id]; return n; })}
                                className="text-slate-500 hover:text-slate-300 transition">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              <span className="text-xs text-slate-400"><span className="font-semibold text-slate-200">{hoursWorked}</span> hrs worked</span>
                              <button
                                onClick={() => setEditingHours((p) => ({ ...p, [t.id]: String(hoursWorked) }))}
                                className="ml-1 text-slate-600 hover:text-amber-400 transition" title="Edit hours">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            </>
                          )}
                        </div>
                        {subjects.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {subjects.slice(0, 6).map((s) => (
                              <span key={s.name} className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{s.name}</span>
                            ))}
                            {subjects.length > 6 && <span className="text-[10px] text-slate-500">+{subjects.length - 6}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => toggleBan(t.id, isBanned)}
                        className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
                          isBanned
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}>
                        {isBanned ? "Unban" : "Ban"}
                      </button>
                      <button
                        onClick={() => deleteAccount(t.id, t.name, t.email)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-400 hover:border-red-500/40 hover:text-red-400 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Students ── */}
        {tab === "students" && (
          <div className="space-y-3">
            {filteredStudents.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">{search ? "No students match your search." : "No students registered yet."}</p>
              </div>
            )}
            {filteredStudents.map((s) => {
              const isBanned = bannedIds.has(s.id);
              const studentReqs = requests.filter((r) => r.studentId === s.id);
              const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={s.id} className={`rounded-2xl border bg-slate-900 p-5 ${isBanned ? "border-red-500/30 opacity-60" : "border-slate-800"}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-4 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-sm font-bold text-teal-400 border border-teal-400/20">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white">{s.name}</p>
                          <Badge label="Student" color="blue" />
                          {isBanned && <Badge label="Banned" color="red" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{s.email}</p>
                        {classroomMap[s.id] && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            <span className="text-xs font-semibold text-amber-400">{classroomMap[s.id]}&apos;s school</span>
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                          <span>{studentReqs.filter((r) => r.status === "pending").length} pending</span>
                          <span>·</span>
                          <span>{studentReqs.filter((r) => r.status === "accepted").length} accepted</span>
                          <span>·</span>
                          <span>{studentReqs.filter((r) => r.status === "cancelled").length} cancelled</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => toggleBan(s.id, isBanned)}
                        className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
                          isBanned
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}>
                        {isBanned ? "Unban" : "Ban"}
                      </button>
                      <button
                        onClick={() => deleteAccount(s.id, s.name, s.email)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-400 hover:border-red-500/40 hover:text-red-400 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                  {/* Requests summary */}
                  {studentReqs.length > 0 && (
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Requests</p>
                      <div className="space-y-2">
                        {studentReqs.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 px-3 py-2">
                            <span className="text-xs text-slate-300">{r.subject} · {GRADE_LABELS[r.gradeLevel] ?? r.gradeLevel}</span>
                            <div className="flex items-center gap-2">
                              <Badge
                                label={r.status}
                                color={r.status === "accepted" ? "green" : r.status === "pending" ? "amber" : "slate"}
                              />
                              <button onClick={() => deleteRequest(r.id)}
                                className="rounded p-1 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition" title="Delete request">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Requests ── */}
        {tab === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">No student requests yet.</p>
              </div>
            )}
            {requests.filter((r) => !search || r.studentName.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q)).map((r) => {
              const tutor = tutors.find((t) => t.id === r.acceptedByTutorId);
              return (
                <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-white">{r.studentName}</p>
                        <Badge label={r.subject} color="slate" />
                        <Badge label={GRADE_LABELS[r.gradeLevel] ?? r.gradeLevel} color="slate" />
                        <Badge
                          label={r.status}
                          color={r.status === "accepted" ? "green" : r.status === "pending" ? "amber" : "slate"}
                        />
                      </div>
                      {r.helpMessage && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">&ldquo;{r.helpMessage}&rdquo;</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Submitted {new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {r.recurrenceWeeks && <span>{r.recurrenceWeeks === 1 ? "One-off" : `${r.recurrenceWeeks} weeks`}</span>}
                        {r.availabilitySlots.length > 0 && <span>{r.availabilitySlots.length} slot{r.availabilitySlots.length !== 1 ? "s" : ""} offered</span>}
                        {tutor && <span>Accepted by <span className="text-slate-300 font-medium">{tutor.name}</span></span>}
                        {r.targetTutorId && !tutor && <span className="text-amber-400">Targeted request</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteRequest(r.id)}
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Sessions ── */}
        {tab === "sessions" && (
          <div className="space-y-3">
            {filteredSessions.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">{search ? "No sessions match your search." : "No active sessions yet."}</p>
              </div>
            )}
            {filteredSessions.map((s) => (
              <div key={s.matchId} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-white">{s.subject}</p>
                      <Badge label={GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel} color="slate" />
                      <Badge label={s.status} color={s.status === "ACTIVE" ? "green" : "amber"} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        <span>Tutor: <span className="text-white font-medium">{s.tutorName}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        <span>Student: <span className="text-white font-medium">{s.studentName}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>{s.bookedSlots.length} booked slot{s.bookedSlots.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {s.bookedSlots.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {s.bookedSlots.slice(0, 3).map((slot) => {
                          const parts = slot.split("-");
                          const h = parseInt(parts[3]);
                          const ampm = h < 12 ? "AM" : "PM";
                          const h12 = h === 0 || h === 12 ? 12 : h % 12;
                          return (
                            <span key={slot} className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                              {parts[2]}/{parts[1]} · {h12} {ampm}
                            </span>
                          );
                        })}
                        {s.bookedSlots.length > 3 && <span className="text-[10px] text-slate-500">+{s.bookedSlots.length - 3} more</span>}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteSession(s.tutorId, s.matchId)}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete Session
                  </button>
                </div>
              </div>
            ))}

            {/* All requests (pending/cancelled too) */}
            {filteredRequests.filter((r) => r.status !== "accepted").length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Pending & Cancelled Requests</p>
                <div className="space-y-2">
                  {filteredRequests.filter((r) => r.status !== "accepted").map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{r.studentName} — {r.subject}</p>
                        <p className="text-xs text-slate-400">{GRADE_LABELS[r.gradeLevel] ?? r.gradeLevel} · {new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge label={r.status} color={r.status === "pending" ? "amber" : "slate"} />
                        <button onClick={() => deleteRequest(r.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* ── Applications ── */}
        {tab === "applications" && (
          <div className="space-y-4">
            {applications.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">No tutor applications yet.</p>
              </div>
            )}
            {applications.map((app) => (
              <div key={app.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-white">{app.name}</p>
                      <Badge
                        label={app.status}
                        color={app.status === "approved" ? "green" : app.status === "pending" ? "amber" : "red"}
                      />
                    </div>
                    <p className="text-sm text-slate-400">{app.email}</p>
                    {app.phoneNumber && <p className="text-xs text-slate-500">{app.phoneNumber}</p>}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Submitted {new Date(app.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {app.reviewedBy && <span>Reviewed by <span className="text-slate-300">{app.reviewedBy}</span></span>}
                      {app.reviewNote && <span className="text-red-400">Note: &ldquo;{app.reviewNote}&rdquo;</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {app.cvDataUrl && (
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = app.cvDataUrl;
                          a.download = app.cvFileName;
                          a.click();
                        }}
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                        </svg>
                        {app.cvFileName}
                      </button>
                    )}
                    <button
                      onClick={() => deleteApplication(app.id, app.name)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
                {app.status === "pending" && (
                  <div className="border-t border-slate-800 px-5 py-4">
                    {showDenyFor === app.id ? (
                      <div className="flex flex-col gap-3">
                        <textarea rows={2} placeholder="Optional: reason for denial"
                          value={appDenyNotes[app.id] ?? ""}
                          onChange={(e) => setAppDenyNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => adminDenyApp(app)} className="flex-1 rounded-lg bg-red-500/20 border border-red-500/30 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition">Confirm Deny</button>
                          <button onClick={() => setShowDenyFor(null)} className="flex-1 rounded-lg border border-slate-700 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => adminApproveApp(app)} className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 transition">Approve</button>
                        <button onClick={() => setShowDenyFor(app.id)} className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition">Deny</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Moderators ── */}
        {tab === "moderators" && (
          <div className="space-y-6">
            {/* Create form */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm font-bold text-white mb-4">Create Moderator Account</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Full name</label>
                  <input type="text" placeholder="Jane Smith" value={newMod.name}
                    onChange={(e) => setNewMod((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                  <input type="email" placeholder="mod@voluntutor.app" value={newMod.email}
                    onChange={(e) => setNewMod((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Password</label>
                  <PasswordInput placeholder="At least 8 characters" value={newMod.password}
                    onChange={(e) => setNewMod((p) => ({ ...p, password: e.target.value }))}
                    inputClassName="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                </div>
              </div>
              {newModError && <p className="mt-3 text-xs text-red-400">{newModError}</p>}
              <button onClick={createModerator}
                className="mt-4 rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300 transition">
                Create Moderator
              </button>
            </div>

            {/* Moderator list */}
            {moderators.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-12 text-center">
                <p className="text-slate-500">No moderators yet. Create one above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {moderators.map((m) => {
                  const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-sm font-bold text-violet-400 border border-violet-400/20">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.email}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Created {new Date(m.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <button onClick={() => removeModerator(m.id, m.name)}
                        className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Reviews ── */}
        {tab === "reviews" && (
          <div className="space-y-3">
            {reviews.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">No reviews yet.</p>
              </div>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <p className="font-semibold text-white">{r.reviewerName ?? r.studentName ?? "Anonymous"}</p>
                    <span className="text-amber-400 text-sm">{"★".repeat(Math.max(0, Math.min(5, r.rating ?? 0)))}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1.5">
                    For tutor: <span className="text-slate-300">{r.tutorName ?? r.tutorId}</span>
                    {r.createdAt && <span> · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                  </p>
                  {(r.text ?? r.comment) && (
                    <p className="text-sm text-slate-400 leading-relaxed">&ldquo;{r.text ?? r.comment}&rdquo;</p>
                  )}
                </div>
                <button onClick={() => deleteReview(r.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Reports ── */}
        {tab === "reports" && (
          <div className="space-y-3">
            {reports.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">No reports submitted yet.</p>
              </div>
            )}
            {reports.map((r) => (
              <div key={r.id} className={`rounded-2xl border bg-slate-900 p-5 ${r.status === "pending" ? "border-red-500/30" : "border-slate-800 opacity-70"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        r.status === "pending" ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : r.status === "reviewed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-slate-700 border-slate-600 text-slate-300"
                      }`}>{r.status}</span>
                      <p className="font-bold text-white">{r.reason}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className="text-slate-300 font-medium">{r.student_name}</span> reported <span className="text-slate-300 font-medium">{r.tutor_name}</span>
                    </p>
                    {r.details && <p className="mt-2 text-sm text-slate-400 italic leading-relaxed">&ldquo;{r.details}&rdquo;</p>}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {r.reviewed_by && <span>Reviewed by <span className="text-slate-300">{r.reviewed_by}</span></span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {r.status === "pending" && (
                      <>
                        <button
                          onClick={async () => { await db.updateReportStatus(r.id, "reviewed", "Admin").catch(() => {}); await loadData(); }}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition">
                          Mark Reviewed
                        </button>
                        <button
                          onClick={async () => { await db.updateReportStatus(r.id, "dismissed", "Admin").catch(() => {}); await loadData(); }}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-400 hover:border-slate-600 transition">
                          Dismiss
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setConfirm({ message: "Delete this report permanently?", action: async () => { await db.deleteReport(r.id).catch(() => {}); setReports((p) => p.filter((x) => x.id !== r.id)); setConfirm(null); } })}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
