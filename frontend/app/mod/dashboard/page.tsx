"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as db from "@/lib/db";
import { PasswordInput } from "@/components/ui/password-input";

/* ── Types ───────────────────────────────────────────── */
interface TutorApplication {
  id: string; name: string; email: string; password: string;
  phoneNumber?: string; cvFileName: string; cvDataUrl: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string; reviewedAt?: string; reviewedBy?: string; reviewNote?: string;
}
interface Moderator { id: string; name: string; email: string; }
interface ClassroomStudent {
  id: string; name: string; email: string; joinedAt: string;
  tutorName?: string; subject?: string; sessionCount?: number;
}
interface ClassroomTutor {
  id: string; name: string; email: string;
  students: Array<{ id: string; name: string; subject: string }>;
  classroomHours: number;
}

/* ── Badge ───────────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: "green" | "amber" | "red" | "slate" }) {
  const cls = {
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-400/10 border-amber-400/20 text-amber-400",
    red:   "bg-red-500/10 border-red-500/20 text-red-400",
    slate: "bg-slate-700 border-slate-600 text-slate-300",
  }[color];
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>;
}

/* ── Confirm Dialog ──────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl">
          <p className="text-sm font-semibold text-white mb-1">Are you sure?</p>
          <p className="text-sm text-slate-400 mb-5">{message}</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-600 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-700 transition">Cancel</button>
            <button onClick={onConfirm} className="flex-1 rounded-lg bg-amber-400 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition">Confirm</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function ModDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mod, setMod] = useState<Moderator | null>(null);

  // Applications
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [denyNotes, setDenyNotes] = useState<Record<string, string>>({});
  const [showDenyFor, setShowDenyFor] = useState<string | null>(null);

  // Reports
  const [reports, setReports] = useState<db.DbTutorReport[]>([]);

  // Classroom
  const [classroomStudents, setClassroomStudents] = useState<ClassroomStudent[]>([]);
  const [newStudent, setNewStudent] = useState({ name: "", email: "", password: "" });
  const [addEmail, setAddEmail] = useState("");
  const [createError, setCreateError] = useState("");
  const [addError, setAddError] = useState("");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "add">("create");

  // Classroom Tutors
  const [classroomTutors, setClassroomTutors] = useState<ClassroomTutor[]>([]);
  const [editingHours, setEditingHours] = useState<Record<string, string>>({});
  const [openChatTutorId, setOpenChatTutorId] = useState<string | null>(null);
  const [tutorMessages, setTutorMessages] = useState<Record<string, db.DbModTutorMessage[]>>({});
  const [tutorMsgInput, setTutorMsgInput] = useState("");

  // UI
  const [mainTab, setMainTab] = useState<"applications" | "reports" | "classroom" | "tutors">("applications");
  const [confirm, setConfirm] = useState<{ message: string; action: () => void | Promise<void> } | null>(null);

  useEffect(() => {
    setMounted(true);
    const modId = localStorage.getItem("vt_mod_session");
    if (!modId) { router.replace("/mod"); return; }
    async function init() {
      try {
        const found = await db.getModeratorById(modId!);
        if (!found) { localStorage.removeItem("vt_mod_session"); router.replace("/mod"); return; }
        setMod({ id: found.id, name: found.name, email: found.email });
        loadApplications();
        loadReports();
        loadClassroom(found.id);
      } catch { router.replace("/mod"); }
    }
    init();
  }, [router]);

  function loadReports() {
    db.getReports().then(setReports).catch(() => {});
  }

  function loadApplications() {
    db.getApplications().then((apps) => {
      setApplications(
        apps.map((a): TutorApplication => ({
          id: a.id, name: a.name, email: a.email, password: a.password,
          phoneNumber: a.phone_number, cvFileName: a.cv_file_name ?? "", cvDataUrl: a.cv_data_url ?? "",
          status: a.status, submittedAt: a.submitted_at,
          reviewedAt: a.reviewed_at, reviewedBy: a.reviewed_by, reviewNote: a.review_note,
        })).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      );
    }).catch(() => {});
  }

  async function loadClassroom(modId: string) {
    try {
      const members = await db.getModClassroom(modId);
      if (members.length === 0) { setClassroomStudents([]); setClassroomTutors([]); return; }

      const allUsers = await db.getUsers().catch(() => [] as db.DbUser[]);
      const allMatches = await db.getAllMatches().catch(() => [] as db.DbTutorMatch[]);
      const allRequests = await db.getRequests().catch(() => [] as db.DbRequest[]);
      const classHours = await db.getClassroomHours(modId).catch(() => [] as db.DbClassroomHours[]);

      // Resolve each member's name once
      const memberInfo = members.map((m) => {
        const u = allUsers.find((x) => x.id === m.student_id);
        return { studentId: m.student_id, joinedAt: m.joined_at, name: u?.name ?? "Unknown", email: u?.email ?? "" };
      });

      const sameName = (a?: string, b?: string) =>
        (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

      // Find a student's tutor connection from EITHER a match row OR an accepted
      // request (the request is authoritative even if the match row failed to save).
      const connectionFor = (studentId: string, studentName: string): { tutorId: string; subject?: string } | null => {
        const match = allMatches.find(
          (x) => x.student_id === studentId || sameName(x.student_name, studentName)
        );
        if (match?.tutor_id) return { tutorId: match.tutor_id, subject: match.subject };
        const req = allRequests.find(
          (r) =>
            r.status === "accepted" &&
            r.accepted_by_tutor_id &&
            (r.student_id === studentId || sameName(r.student_name, studentName))
        );
        if (req?.accepted_by_tutor_id) return { tutorId: req.accepted_by_tutor_id, subject: req.subject };
        return null;
      };

      // Build classroom students list
      const students: ClassroomStudent[] = memberInfo.map((m) => {
        const conn = connectionFor(m.studentId, m.name);
        const tutor = conn ? allUsers.find((u) => u.id === conn.tutorId) : undefined;
        return {
          id: m.studentId,
          name: m.name,
          email: m.email,
          joinedAt: m.joinedAt,
          tutorName: tutor?.name,
          subject: conn?.subject,
          sessionCount: conn ? 1 : 0,
        };
      });
      setClassroomStudents(students);

      // Build classroom tutors list (tutors who teach mod's students)
      const tutorMap = new Map<string, ClassroomTutor>();
      for (const m of memberInfo) {
        const conn = connectionFor(m.studentId, m.name);
        if (!conn) continue;
        const tutor = allUsers.find((u) => u.id === conn.tutorId);
        if (!tutor) continue;
        if (!tutorMap.has(conn.tutorId)) {
          const hrs = classHours.find((h) => h.tutor_id === conn.tutorId)?.hours ?? 0;
          tutorMap.set(conn.tutorId, { id: conn.tutorId, name: tutor.name, email: tutor.email, students: [], classroomHours: hrs });
        }
        tutorMap.get(conn.tutorId)!.students.push({ id: m.studentId, name: m.name, subject: conn.subject ?? "" });
      }
      setClassroomTutors(Array.from(tutorMap.values()));
    } catch { /* ignore */ }
  }

  const approveApplication = useCallback((app: TutorApplication) => {
    setConfirm({
      message: `Approve ${app.name}'s application? This will create their tutor account.`,
      action: async () => {
        try {
          const existing = await db.getUserByEmail(app.email);
          if (!existing) await db.createUser({ id: Date.now().toString(), name: app.name, email: app.email, password: app.password, role: "tutor" });
        } catch { /* ignore */ }
        await db.updateApplicationStatus(app.id, "approved", mod?.name ?? "Moderator").catch(() => {});
        loadApplications();
        setConfirm(null);
      },
    });
  }, [mod]);

  const denyApplication = useCallback((app: TutorApplication) => {
    const note = denyNotes[app.id] ?? "";
    setConfirm({
      message: `Deny ${app.name}'s application?${note ? ` Note: "${note}"` : ""}`,
      action: async () => {
        await db.updateApplicationStatus(app.id, "denied", mod?.name ?? "Moderator", note || undefined).catch(() => {});
        setShowDenyFor(null);
        loadApplications();
        setConfirm(null);
      },
    });
  }, [mod, denyNotes]);

  async function createStudent() {
    setCreateError("");
    if (!newStudent.name.trim() || !newStudent.email.trim() || !newStudent.password.trim()) {
      setCreateError("All fields are required."); return;
    }
    if (newStudent.password.length < 8) { setCreateError("Password must be at least 8 characters."); return; }
    setCreating(true);
    try {
      const existing = await db.getUserByEmail(newStudent.email.trim().toLowerCase());
      if (existing) { setCreateError("An account with this email already exists."); setCreating(false); return; }
      const studentId = `s-${Date.now()}`;
      await db.createUser({ id: studentId, name: newStudent.name.trim(), email: newStudent.email.trim().toLowerCase(), password: newStudent.password, role: "student" });
      await db.addModClassroomStudent(mod!.id, studentId);
      setNewStudent({ name: "", email: "", password: "" });
      await loadClassroom(mod!.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create student.");
    } finally { setCreating(false); }
  }

  async function addExistingStudent() {
    setAddError("");
    if (!addEmail.trim()) { setAddError("Enter the student's email."); return; }
    setAdding(true);
    try {
      const user = await db.getUserByEmail(addEmail.trim().toLowerCase());
      if (!user) { setAddError("No account found with that email."); setAdding(false); return; }
      if (user.role !== "student") { setAddError("That account is not a student account."); setAdding(false); return; }
      // Check if already in classroom
      const current = await db.getModClassroom(mod!.id);
      if (current.some((m) => m.student_id === user.id)) { setAddError("That student is already in your school."); setAdding(false); return; }
      await db.addModClassroomStudent(mod!.id, user.id);
      setAddEmail("");
      await loadClassroom(mod!.id);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add student.");
    } finally { setAdding(false); }
  }

  // Poll mod-tutor messages for the open chat
  useEffect(() => {
    if (!mod || !openChatTutorId) return;
    const load = async () => {
      const msgs = await db.getModTutorMessages(mod.id, openChatTutorId).catch(() => [] as db.DbModTutorMessage[]);
      setTutorMessages((prev) => ({ ...prev, [openChatTutorId]: msgs }));
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [mod, openChatTutorId]);

  async function sendTutorMessage() {
    if (!tutorMsgInput.trim() || !openChatTutorId || !mod) return;
    const body = tutorMsgInput.trim();
    setTutorMsgInput("");
    setTutorMessages((prev) => ({
      ...prev,
      [openChatTutorId]: [...(prev[openChatTutorId] ?? []), {
        id: `tmp-${Date.now()}`, mod_id: mod.id, tutor_id: openChatTutorId,
        from_role: "mod" as const, body, sent_at: new Date().toISOString(),
      }],
    }));
    await db.sendModTutorMessage(mod.id, openChatTutorId, "mod", body).catch(console.error);
  }

  function signOut() {
    localStorage.removeItem("vt_mod_session");
    router.push("/mod");
  }

  if (!mounted) return null;

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);
  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;

  const tabBtn = (id: typeof mainTab, label: React.ReactNode) => (
    <button
      key={id}
      onClick={() => { setMainTab(id); if (id === "classroom" || id === "tutors") loadClassroom(mod!.id); }}
      className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${mainTab === id ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/20 border border-amber-400/30">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Moderator Dashboard</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{mod?.name ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(pendingCount + pendingReports) > 0 && (
              <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                {pendingCount + pendingReports} pending
              </span>
            )}
            <button onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-red-500/40 hover:text-red-400 transition">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Main tabs */}
        <div className="flex flex-wrap gap-1 mb-6 rounded-xl border border-slate-800 bg-slate-900 p-1.5 w-fit">
          {tabBtn("applications", <>Applications {pendingCount > 0 && <span className="ml-1.5 rounded-full bg-amber-200/20 px-1.5 text-[10px] font-black">{pendingCount}</span>}</>)}
          {tabBtn("reports", <>Reports {pendingReports > 0 && <span className="ml-1.5 rounded-full bg-red-400/20 px-1.5 text-[10px] font-black text-red-400">{pendingReports}</span>}</>)}
          {tabBtn("classroom", <>School ({classroomStudents.length})</>)}
          {tabBtn("tutors", <>Tutors ({classroomTutors.length})</>)}
        </div>

        {/* ── Applications ── */}
        {mainTab === "applications" && (
          <>
            <div className="flex flex-wrap gap-1 mb-8 rounded-xl border border-slate-800 bg-slate-900 p-1.5 w-fit">
              {([
                { id: "pending",  label: `Pending (${applications.filter((a) => a.status === "pending").length})` },
                { id: "approved", label: `Approved (${applications.filter((a) => a.status === "approved").length})` },
                { id: "denied",   label: `Denied (${applications.filter((a) => a.status === "denied").length})` },
                { id: "all",      label: `All (${applications.length})` },
              ] as const).map(({ id, label }) => (
                <button key={id} onClick={() => setFilter(id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === id ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-20 text-center">
                <p className="text-slate-500">No {filter === "all" ? "" : filter} applications.</p>
              </div>
            )}
            <div className="space-y-4">
              {filtered.map((app) => (
                <div key={app.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-white">{app.name}</p>
                        <Badge label={app.status} color={app.status === "approved" ? "green" : app.status === "pending" ? "amber" : "red"} />
                      </div>
                      <p className="text-sm text-slate-400">{app.email}</p>
                      {app.phoneNumber && <p className="text-xs text-slate-500">{app.phoneNumber}</p>}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Submitted {new Date(app.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {app.reviewedBy && <span>Reviewed by <span className="text-slate-300">{app.reviewedBy}</span></span>}
                        {app.reviewNote && <span className="text-red-400">Note: &ldquo;{app.reviewNote}&rdquo;</span>}
                      </div>
                    </div>
                    <button onClick={() => { const a = document.createElement("a"); a.href = app.cvDataUrl; a.download = app.cvFileName; a.click(); }}
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                      </svg>
                      {app.cvFileName}
                    </button>
                  </div>
                  {app.status === "pending" && (
                    <div className="border-t border-slate-800 px-5 py-4">
                      {showDenyFor === app.id ? (
                        <div className="flex flex-col gap-3">
                          <textarea rows={2} placeholder="Optional: reason for denial"
                            value={denyNotes[app.id] ?? ""}
                            onChange={(e) => setDenyNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none resize-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => denyApplication(app)} className="flex-1 rounded-lg bg-red-500/20 border border-red-500/30 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition">Confirm Deny</button>
                            <button onClick={() => setShowDenyFor(null)} className="flex-1 rounded-lg border border-slate-700 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={() => approveApplication(app)} className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 transition">Approve</button>
                          <button onClick={() => setShowDenyFor(app.id)} className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition">Deny</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Reports ── */}
        {mainTab === "reports" && (
          <div className="space-y-3">
            {reports.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-20 text-center">
                <p className="text-slate-500">No reports submitted yet.</p>
              </div>
            )}
            {reports.map((r) => (
              <div key={r.id} className={`rounded-2xl border bg-slate-900 p-5 ${r.status === "pending" ? "border-red-500/30" : "border-slate-800 opacity-70"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge label={r.status} color={r.status === "pending" ? "red" : r.status === "reviewed" ? "green" : "slate"} />
                      <p className="font-bold text-white">{r.reason}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className="text-slate-300 font-medium">{r.student_name}</span> reported <span className="text-slate-300 font-medium">{r.tutor_name}</span>
                    </p>
                    {r.details && <p className="mt-2 text-sm text-slate-400 italic">&ldquo;{r.details}&rdquo;</p>}
                    <p className="mt-1.5 text-xs text-slate-600">
                      {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {r.reviewed_by && ` · Reviewed by ${r.reviewed_by}`}
                    </p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex shrink-0 flex-col gap-2">
                      <button onClick={async () => { await db.updateReportStatus(r.id, "reviewed", mod?.name ?? "Moderator").catch(() => {}); loadReports(); }}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition">
                        Mark Reviewed
                      </button>
                      <button onClick={async () => { await db.updateReportStatus(r.id, "dismissed", mod?.name ?? "Moderator").catch(() => {}); loadReports(); }}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-400 hover:border-slate-600 transition">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Classroom ── */}
        {mainTab === "classroom" && (
          <div className="space-y-6">
            {/* Form card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-bold text-white">Add Student to School</p>
                {/* Toggle */}
                <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
                  <button onClick={() => { setFormMode("create"); setCreateError(""); setAddError(""); }}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition ${formMode === "create" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}>
                    Create new
                  </button>
                  <button onClick={() => { setFormMode("add"); setCreateError(""); setAddError(""); }}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition ${formMode === "add" ? "bg-amber-400 text-slate-900" : "text-slate-400 hover:text-white"}`}>
                    Add existing
                  </button>
                </div>
              </div>

              {formMode === "create" ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Full name</label>
                      <input type="text" placeholder="Student name" value={newStudent.name}
                        onChange={(e) => setNewStudent((p) => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                      <input type="email" placeholder="student@example.com" value={newStudent.email}
                        onChange={(e) => setNewStudent((p) => ({ ...p, email: e.target.value }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Password</label>
                      <PasswordInput placeholder="Min. 8 characters" value={newStudent.password}
                        onChange={(e) => setNewStudent((p) => ({ ...p, password: e.target.value }))}
                        inputClassName="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                    </div>
                  </div>
                  {createError && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{createError}</p>}
                  <button onClick={createStudent} disabled={creating}
                    className="mt-4 rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300 transition disabled:opacity-50">
                    {creating ? "Creating…" : "Create Student Account"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-400 mb-3">Enter the email of an existing student account to add them to your school.</p>
                  <div className="flex gap-3">
                    <input type="email" placeholder="student@example.com" value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addExistingStudent()}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                    <button onClick={addExistingStudent} disabled={adding}
                      className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300 transition disabled:opacity-50">
                      {adding ? "Adding…" : "Add to School"}
                    </button>
                  </div>
                  {addError && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{addError}</p>}
                </>
              )}
            </div>

            {/* Student list */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {classroomStudents.length} student{classroomStudents.length !== 1 ? "s" : ""}
              </p>
              <button onClick={() => loadClassroom(mod!.id)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-amber-400/40 hover:text-amber-400 transition">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>
            {classroomStudents.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">No students in your school yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classroomStudents.map((s) => {
                  const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-sm font-bold text-teal-400 border border-teal-400/20">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.email}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                            {s.tutorName ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                                  Tutor: <span className="text-slate-200 font-medium">{s.tutorName}</span>
                                </span>
                                {s.subject && <span>· {s.subject}</span>}
                              </>
                            ) : (
                              <span className="italic text-slate-600">No tutor assigned yet</span>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-600">Joined {new Date(s.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                        <button
                          onClick={() => setConfirm({ message: `Remove ${s.name} from your classroom?`, action: async () => { await db.removeModClassroomStudent(mod!.id, s.id).catch(() => {}); await loadClassroom(mod!.id); setConfirm(null); } })}
                          className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition">
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Classroom Tutors ── */}
        {mainTab === "tutors" && (
          <div className="space-y-3">
            {classroomTutors.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-16 text-center">
                <p className="text-slate-500">No tutors have been matched with your students yet.</p>
              </div>
            ) : (
              classroomTutors.map((t) => {
                const initials = t.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                const isEditing = t.id in editingHours;
                return (
                  <div key={t.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-sm font-bold text-amber-400 border border-amber-400/20">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.email}</p>

                        {/* Students from this class */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.students.map((s) => (
                            <span key={s.id} className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                              {s.name}{s.subject ? ` · ${s.subject}` : ""}
                            </span>
                          ))}
                        </div>

                        {/* Message button */}
                        <button
                          onClick={() => setOpenChatTutorId(openChatTutorId === t.id ? null : t.id)}
                          className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 transition w-fit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          {openChatTutorId === t.id ? "Hide chat" : "Message tutor"}
                        </button>

                        {/* Classroom-specific hours */}
                        <div className="mt-2.5 flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <input type="number" min="0" step="0.5"
                                value={editingHours[t.id]}
                                onChange={(e) => setEditingHours((p) => ({ ...p, [t.id]: e.target.value }))}
                                className="w-24 rounded-lg border border-amber-400/40 bg-slate-800 px-2 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                                autoFocus />
                              <span className="text-xs text-slate-400">hrs (this school)</span>
                              <button
                                onClick={async () => {
                                  const h = parseFloat(editingHours[t.id]);
                                  if (!isNaN(h) && h >= 0) {
                                    await db.setClassroomHours(mod!.id, t.id, h).catch(() => {});
                                    setClassroomTutors((prev) => prev.map((x) => x.id === t.id ? { ...x, classroomHours: h } : x));
                                  }
                                  setEditingHours((p) => { const n = { ...p }; delete n[t.id]; return n; });
                                }}
                                className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-900 hover:bg-amber-300 transition">
                                Save
                              </button>
                              <button onClick={() => setEditingHours((p) => { const n = { ...p }; delete n[t.id]; return n; })}
                                className="text-slate-500 hover:text-slate-300 transition">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              <span className="text-xs text-slate-400">
                                <span className="font-semibold text-slate-200">{t.classroomHours}</span> hrs in this school
                              </span>
                              <button onClick={() => setEditingHours((p) => ({ ...p, [t.id]: String(t.classroomHours) }))}
                                className="ml-1 text-slate-600 hover:text-amber-400 transition" title="Edit hours">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Inline chat panel */}
                    {openChatTutorId === t.id && (
                      <div className="mt-4 border-t border-slate-800 pt-4">
                        <div className="flex h-64 flex-col rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
                          <div className="flex-1 overflow-y-auto space-y-2.5 px-4 py-3">
                            {(tutorMessages[t.id] ?? []).length === 0 && (
                              <p className="text-center text-xs text-slate-500 mt-6">No messages yet. Start the conversation.</p>
                            )}
                            {(tutorMessages[t.id] ?? []).map((msg, i) => (
                              <div key={i} className={`flex ${msg.from_role === "mod" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-xs rounded-xl px-3 py-2 text-xs ${msg.from_role === "mod" ? "bg-amber-400 text-slate-900 rounded-br-sm" : "bg-slate-700 text-slate-200 rounded-bl-sm"}`}>
                                  {msg.body}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 border-t border-slate-700 px-3 py-2">
                            <input type="text" placeholder="Message tutor…"
                              value={tutorMsgInput}
                              onChange={(e) => setTutorMsgInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && sendTutorMessage()}
                              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                            />
                            <button onClick={sendTutorMessage}
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-300 transition">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
