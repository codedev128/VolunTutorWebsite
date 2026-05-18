"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";

interface TutorApplication {
  id: string;
  name: string;
  email: string;
  password: string;
  cvFileName: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export default function BecomePendingPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [mounted, setMounted]           = useState(false);
  const [status, setStatus]             = useState<"pending" | "approved" | "denied" | "redirecting">("pending");
  const [reviewNote, setReviewNote]     = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [submittedAt, setSubmittedAt]   = useState("");
  const redirectingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const pendingEmail = localStorage.getItem("vt_pending_email");
    if (!pendingEmail) { router.replace("/become"); return; }

    function checkStatus() {
      if (redirectingRef.current) return;
      try {
        const apps: TutorApplication[] = JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
        const app = apps.find((a) => a.email === pendingEmail);
        if (!app) return;
        setApplicantName(app.name);
        setApplicantEmail(app.email);
        setSubmittedAt(app.submittedAt);
        setReviewNote(app.reviewNote ?? "");
        if (app.status === "approved") {
          redirectingRef.current = true;
          setStatus("redirecting");
          const result = signIn(app.email, app.password);
          if (result.ok) {
            localStorage.removeItem("vt_pending_email");
            router.push("/become/onboarding");
          }
        } else if (app.status === "denied") {
          setStatus("denied");
        }
      } catch { /* ignore */ }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [router, signIn]);

  if (!mounted) return null;

  return (
    <RhythmicRipplesBackground backgroundColor="#ffffff" rippleColor="rgba(247, 184, 1, 0.4)" rippleCount={18} rippleSpeed={0.4}>
      <div className="relative flex flex-col items-center px-6 text-center w-full max-w-md">

        {/* ── Pending ── */}
        {status === "pending" && (
          <>
            <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-amber-100 border-4 border-amber-200">
              <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animationDuration: "3s" }}>
                <path d="M5 22h14"/><path d="M5 2h14"/>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Application Under Review</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Hi <span className="font-semibold text-gray-700">{applicantName || "there"}</span>! Your application has been received and is being reviewed by a moderator.
            </p>

            <div className="w-full rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-left mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">Application Details</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Email</span>
                  <span className="font-medium text-gray-800 text-right truncate">{applicantEmail}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Submitted</span>
                  <span className="font-medium text-gray-800">
                    {submittedAt ? new Date(submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Status</span>
                  <span className="font-semibold text-amber-600">Pending review</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 mb-8">
              <span className="inline-block size-2 rounded-full bg-amber-400 animate-pulse" />
              Checking for updates automatically every few seconds…
            </div>
            <Link href="/" className="text-sm font-medium text-amber-600 hover:underline">← Back to home</Link>
          </>
        )}

        {/* ── Redirecting after approval ── */}
        {(status === "approved" || status === "redirecting") && (
          <>
            <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-green-100 border-4 border-green-200">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Application Approved!</h1>
            <p className="text-gray-500">Setting up your account…</p>
          </>
        )}

        {/* ── Denied ── */}
        {status === "denied" && (
          <>
            <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-red-100 border-4 border-red-200">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Application Not Approved</h1>
            {reviewNote ? (
              <div className="w-full rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-left mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">Moderator Note</p>
                <p className="text-sm text-red-700">{reviewNote}</p>
              </div>
            ) : (
              <p className="text-gray-500 mb-6 leading-relaxed">
                Unfortunately your application was not approved at this time. If you believe this is an error, please contact support.
              </p>
            )}
            <div className="flex flex-col gap-3 w-full">
              <Link href="/become"
                className="w-full rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white text-center shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700">
                Submit a new application
              </Link>
              <Link href="/" className="text-sm font-medium text-gray-400 hover:text-gray-600">← Back to home</Link>
            </div>
          </>
        )}

      </div>
    </RhythmicRipplesBackground>
  );
}
