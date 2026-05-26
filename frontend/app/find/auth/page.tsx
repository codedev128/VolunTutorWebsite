"use client";

import { useState, useId, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { validateEmail, verifyEmailDomain } from "@/lib/email-validation";
import { generateOTP, storeOTP, verifyOTP, sendOTP } from "@/lib/otp";
import { ShineBorder } from "@/components/ui/shine-border";

function BrandMark() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 border border-amber-300">
      <svg className="stroke-amber-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" fill="none">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

/* ── Sign Up Dialog ──────────────────────────────────── */
function SignUpDialog() {
  const id = useId();
  const router = useRouter();
  const { signUp } = useAuth();
  const [step, setStep]             = useState<"form" | "otp">("form");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [error, setError]           = useState("");
  const [verifying, setVerifying]   = useState(false);
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError]     = useState("");
  const [cooldown, setCooldown]     = useState(0);
  const [devOtp, setDevOtp]         = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSignUp() {
    setError("");
    if (!name.trim() || !email.trim() || !password.trim() || !confirm.trim()) {
      setError("Please fill in all fields."); return;
    }
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) { setError(emailCheck.error!); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setVerifying(true);
    const domainCheck = await verifyEmailDomain(email);
    setVerifying(false);
    if (!domainCheck.ok) { setError(domainCheck.error!); return; }
    await dispatchOTP();
  }

  async function dispatchOTP() {
    setSending(true);
    const otp = generateOTP();
    storeOTP(email.trim().toLowerCase(), otp);
    const result = await sendOTP(email.trim(), name.trim(), otp);
    setSending(false);
    if (!result.ok) { setError(result.error ?? "Failed to send code."); return; }
    setDevOtp(result.devMode ? otp : "");
    setEnteredOtp("");
    setOtpError("");
    setCooldown(60);
    setStep("otp");
  }

  function handleVerifyOTP() {
    const result = verifyOTP(email.trim().toLowerCase(), enteredOtp);
    if (!result.ok) { setOtpError(result.error!); return; }
    setLoading(true);
    const r = signUp(name.trim(), email.trim(), password, "student");
    if (!r.ok) { setOtpError(r.error ?? "Something went wrong."); setLoading(false); return; }
    router.push("/find/dashboard");
  }

  return (
    <Dialog onOpenChange={() => { setStep("form"); setError(""); setEnteredOtp(""); setDevOtp(""); }}>
      <DialogTrigger asChild>
        <button className="w-full rounded-full bg-gray-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0">
          Create an account →
        </button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col items-center gap-2">
          <BrandMark />
          <DialogHeader>
            <DialogTitle className="sm:text-center">
              {step === "otp" ? "Check your inbox" : "Find your VolunTutor"}
            </DialogTitle>
            <DialogDescription className="sm:text-center">
              {step === "otp"
                ? `We sent a 6-digit code to ${email}`
                : "Create a free student account to submit requests and track your matches."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Step 1: Form ── */}
        {step === "form" && (
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>Full name</Label>
                <Input id={`${id}-name`} placeholder="Your name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input id={`${id}-email`} placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-password`}>Password</Label>
                <Input id={`${id}-password`} placeholder="At least 8 characters" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-confirm`}>Confirm password</Label>
                <Input id={`${id}-confirm`} placeholder="Repeat your password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSignUp()} />
              </div>
            </div>
            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={() => handleSignUp()} disabled={verifying || sending}
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {verifying ? "Verifying email…" : sending ? "Sending code…" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── Step 2: OTP ── */}
        {step === "otp" && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 border border-amber-200">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
            </div>
            {devOtp && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-center text-sm">
                <span className="text-blue-600 font-medium">Dev mode — EmailJS not configured.</span>
                <br />
                <span className="text-blue-500 text-xs">Your code: </span>
                <span className="font-mono font-bold text-blue-800 text-base tracking-widest">{devOtp}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${id}-otp`}>Verification code</Label>
              <Input
                id={`${id}-otp`}
                placeholder="000000"
                maxLength={6}
                value={enteredOtp}
                onChange={(e) => { setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                onKeyDown={(e) => e.key === "Enter" && enteredOtp.length === 6 && handleVerifyOTP()}
                className="text-center text-2xl font-mono tracking-[0.5em] py-3"
              />
              <p className="text-xs text-muted-foreground">Check your spam folder if you don't see it.</p>
            </div>
            {otpError && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{otpError}</p>}
            <button type="button" onClick={handleVerifyOTP} disabled={enteredOtp.length !== 6 || loading}
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating account…" : "Verify & Create Account"}
            </button>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <button type="button" onClick={() => { setStep("form"); setEnteredOtp(""); setOtpError(""); }}
                className="hover:text-gray-600 transition">← Back</button>
              {cooldown > 0 ? (
                <span>Resend in {cooldown}s</span>
              ) : (
                <button type="button" onClick={dispatchOTP} disabled={sending}
                  className="text-amber-600 hover:underline disabled:opacity-50">
                  {sending ? "Sending…" : "Resend code"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "form" && (
          <p className="text-center text-xs text-muted-foreground">
            Always free. By signing up you agree to our <a className="underline hover:no-underline" href="#">Terms</a>.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Sign In Dialog ──────────────────────────────────── */
function SignInDialog() {
  const id = useId();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  function handleSignIn() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    if (email.trim() === "admin@voluntutor.app" && password === "Admin@1234") {
      localStorage.setItem("vt_admin_session", "1");
      router.push("/admin/dashboard");
      return;
    }
    setLoading(true);
    const result = signIn(email.trim(), password);
    if (!result.ok) { setError(result.error ?? "Something went wrong."); setLoading(false); return; }
    if (result.user?.role === "tutor") {
      setError("That email belongs to a tutor account. Sign in at the Become a VolunTutor page.");
      setLoading(false);
      return;
    }
    router.push("/find/dashboard");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full rounded-full border border-gray-900/20 px-8 py-3.5 text-sm font-semibold text-gray-800 transition hover:border-gray-900/40 hover:bg-gray-900/5">
          Sign in to my account
        </button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col items-center gap-2">
          <BrandMark />
          <DialogHeader>
            <DialogTitle className="sm:text-center">Welcome back</DialogTitle>
            <DialogDescription className="sm:text-center">Sign in to view your matches and submit new requests.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input id={`${id}-email`} placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-password`}>Password</Label>
              <div className="relative">
                <Input id={`${id}-password`} placeholder="Enter your password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSignIn()} className="pr-10" />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function FindAuthPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === "student" ? "/find/dashboard" : "/become/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;

  return (
    <RhythmicRipplesBackground backgroundColor="#ffffff" rippleColor="rgba(247, 184, 1, 0.4)" rippleCount={18} rippleSpeed={0.4}>
      <div className="absolute top-6 left-6">
        <Link href="/" className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-amber-600">
          <span className="flex size-8 items-center justify-center rounded-full border border-gray-200 bg-white/80 shadow-sm transition group-hover:border-amber-300 group-hover:bg-amber-50">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Back
        </Link>
      </div>

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="mb-10 flex flex-col items-center">
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Find your <span className="italic text-amber-500">VolunTutor.</span>
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-600">
            Create a free account or sign back in — your matched tutors are waiting.
          </p>
        </div>

        <div className="flex w-full max-w-2xl flex-col gap-5 sm:flex-row">
          {/* Sign up card */}
          <ShineBorder borderRadius={16} borderWidth={1.5} duration={10} className="flex flex-1 flex-col gap-5 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">New student</p>
              <h2 className="text-xl font-bold text-gray-900">Create an account</h2>
              <p className="mt-1 text-sm text-gray-500">Get matched with a volunteer tutor for free.</p>
            </div>
            <SignUpDialog />
          </ShineBorder>

          {/* Divider */}
          <div className="flex items-center justify-center sm:flex-col">
            <div className="h-px w-full bg-gray-200 sm:h-full sm:w-px" />
            <span className="shrink-0 px-3 py-2 text-xs font-medium text-gray-400">or</span>
            <div className="h-px w-full bg-gray-200 sm:h-full sm:w-px" />
          </div>

          {/* Sign in card */}
          <ShineBorder borderRadius={16} borderWidth={1.5} duration={10} className="flex flex-1 flex-col gap-5 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Returning student</p>
              <h2 className="text-xl font-bold text-gray-900">Sign back in</h2>
              <p className="mt-1 text-sm text-gray-500">Pick up right where you left off.</p>
            </div>
            <SignInDialog />
          </ShineBorder>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Are you a tutor?{" "}
          <Link href="/become" className="font-semibold text-amber-600 hover:underline">
            Sign in here →
          </Link>
        </p>
      </div>
    </RhythmicRipplesBackground>
  );
}
