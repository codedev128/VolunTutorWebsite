"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface TutorApplication {
  id: string;
  name: string;
  email: string;
  password: string;
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
}

function Badge({ label, color }: { label: string; color: "green" | "amber" | "red" | "slate" }) {
  const cls = {
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-400/10 border-amber-400/20 text-amber-400",
    red:   "bg-red-500/10 border-red-500/20 text-red-400",
    slate: "bg-slate-700 border-slate-600 text-slate-300",
  }[color];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

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

export default function ModDashboard() {
  const router = useRouter();
  const [mounted, setMounted]       = useState(false);
  const [mod, setMod]               = useState<Moderator | null>(null);
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [filter, setFilter]         = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [denyNotes, setDenyNotes]   = useState<Record<string, string>>({});
  const [showDenyFor, setShowDenyFor] = useState<string | null>(null);
  const [confirm, setConfirm]       = useState<{ message: string; action: () => void } | null>(null);

  useEffect(() => {
    setMounted(true);
    const modId = localStorage.getItem("vt_mod_session");
    if (!modId) { router.replace("/mod"); return; }
    try {
      const mods: (Moderator & { password: string })[] = JSON.parse(localStorage.getItem("vt_moderators") || "[]");
      const found = mods.find((m) => m.id === modId);
      if (!found) { localStorage.removeItem("vt_mod_session"); router.replace("/mod"); return; }
      setMod({ id: found.id, name: found.name, email: found.email });
    } catch { router.replace("/mod"); return; }
    loadApplications();
  }, [router]);

  function loadApplications() {
    try {
      const apps: TutorApplication[] = JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
      setApplications(apps.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch { /* ignore */ }
  }

  const approveApplication = useCallback((app: TutorApplication) => {
    setConfirm({
      message: `Approve ${app.name}'s application? This will create their tutor account.`,
      action: () => {
        // Create user in vt_users
        try {
          const users: { id: string; name: string; email: string; role: string; password: string }[] =
            JSON.parse(localStorage.getItem("vt_users") || "[]");
          if (!users.find((u) => u.email === app.email)) {
            users.push({ id: Date.now().toString(), name: app.name, email: app.email, role: "tutor", password: app.password });
            localStorage.setItem("vt_users", JSON.stringify(users));
          }
        } catch { /* ignore */ }
        // Update application
        const apps: TutorApplication[] = JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
        const updated = apps.map((a) =>
          a.id === app.id ? { ...a, status: "approved" as const, reviewedAt: new Date().toISOString(), reviewedBy: mod?.name ?? "Moderator" } : a
        );
        localStorage.setItem("vt_tutor_applications", JSON.stringify(updated));
        loadApplications();
        setConfirm(null);
      },
    });
  }, [mod]);

  const denyApplication = useCallback((app: TutorApplication) => {
    const note = denyNotes[app.id] ?? "";
    setConfirm({
      message: `Deny ${app.name}'s application?${note ? ` Note: "${note}"` : ""}`,
      action: () => {
        const apps: TutorApplication[] = JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
        const updated = apps.map((a) =>
          a.id === app.id
            ? { ...a, status: "denied" as const, reviewedAt: new Date().toISOString(), reviewedBy: mod?.name ?? "Moderator", reviewNote: note || undefined }
            : a
        );
        localStorage.setItem("vt_tutor_applications", JSON.stringify(updated));
        setShowDenyFor(null);
        loadApplications();
        setConfirm(null);
      },
    });
  }, [mod, denyNotes]);

  function downloadCV(app: TutorApplication) {
    const a = document.createElement("a");
    a.href = app.cvDataUrl;
    a.download = app.cvFileName;
    a.click();
  }

  function signOut() {
    localStorage.removeItem("vt_mod_session");
    router.push("/mod");
  }

  if (!mounted) return null;

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);
  const pendingCount = applications.filter((a) => a.status === "pending").length;

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
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                {pendingCount} pending
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
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 mb-8 rounded-xl border border-slate-800 bg-slate-900 p-1.5 w-fit">
          {([
            { id: "pending",  label: `Pending (${applications.filter((a) => a.status === "pending").length})` },
            { id: "approved", label: `Approved (${applications.filter((a) => a.status === "approved").length})` },
            { id: "denied",   label: `Denied (${applications.filter((a) => a.status === "denied").length})` },
            { id: "all",      label: `All (${applications.length})` },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === id ? "bg-amber-400 text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Application list */}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 py-20 text-center">
            <p className="text-slate-500">No {filter === "all" ? "" : filter} applications.</p>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((app) => (
            <div key={app.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              {/* Top row */}
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
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>Submitted {new Date(app.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {app.reviewedAt && app.reviewedBy && (
                      <span>Reviewed by <span className="text-slate-300">{app.reviewedBy}</span> on {new Date(app.reviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    )}
                    {app.reviewNote && (
                      <span className="text-red-400">Note: &ldquo;{app.reviewNote}&rdquo;</span>
                    )}
                  </div>
                </div>
                {/* CV button */}
                <button
                  onClick={() => downloadCV(app)}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                  </svg>
                  {app.cvFileName}
                </button>
              </div>

              {/* Actions for pending */}
              {app.status === "pending" && (
                <div className="border-t border-slate-800 px-5 py-4">
                  {showDenyFor === app.id ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        rows={2}
                        placeholder="Optional: reason for denial (shown to applicant)"
                        value={denyNotes[app.id] ?? ""}
                        onChange={(e) => setDenyNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => denyApplication(app)}
                          className="flex-1 rounded-lg bg-red-500/20 border border-red-500/30 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition">
                          Confirm Deny
                        </button>
                        <button onClick={() => setShowDenyFor(null)}
                          className="flex-1 rounded-lg border border-slate-700 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => approveApplication(app)}
                        className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 transition">
                        Approve
                      </button>
                      <button onClick={() => setShowDenyFor(app.id)}
                        className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition">
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
