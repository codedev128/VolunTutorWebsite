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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/auth-context";
import { validateEmail, verifyEmailDomain } from "@/lib/email-validation";
import { generateOTP, storeOTP, verifyOTP, sendOTP } from "@/lib/otp";

function BrandMark() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 border border-amber-300">
      <svg className="stroke-amber-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" strokeWidth="8" />
      </svg>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AmberButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed">
      {children}
    </button>
  );
}

/* ── Sign Up Dialog ──────────────────────────────────── */
function SignUpDialog() {
  const id = useId();
  const router = useRouter();
  const [step, setStep]             = useState<"form" | "otp">("form");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [cvFile, setCvFile]         = useState<File | null>(null);
  const [pendingCvDataUrl, setPendingCvDataUrl] = useState("");
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
    if (!cvFile) { setError("Please attach your CV or resume."); return; }
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) { setError(emailCheck.error!); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    // Check for duplicate application or account
    try {
      const apps: { email: string; status: string; reviewNote?: string }[] =
        JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
      const existing = apps.find((a) => a.email === email.trim().toLowerCase());
      if (existing) {
        if (existing.status === "pending") {
          localStorage.setItem("vt_pending_email", email.trim().toLowerCase());
          router.push("/become/pending"); return;
        }
        if (existing.status === "denied") {
          setError(`Your previous application was denied${existing.reviewNote ? `: "${existing.reviewNote}"` : ""}. Please contact support.`); return;
        }
        setError("An account with this email already exists. Please sign in."); return;
      }
      const users: { email: string }[] = JSON.parse(localStorage.getItem("vt_users") || "[]");
      if (users.find((u) => u.email === email.trim().toLowerCase())) {
        setError("An account with this email already exists. Please sign in."); return;
      }
    } catch { /* ignore */ }
    setVerifying(true);
    const domainCheck = await verifyEmailDomain(email);
    setVerifying(false);
    if (!domainCheck.ok) { setError(domainCheck.error!); return; }
    // Pre-read CV so it's ready after OTP verification
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(cvFile);
      });
      setPendingCvDataUrl(dataUrl);
    } catch {
      setError("Failed to read CV file. Please try a different file."); return;
    }
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
    try {
      const app = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        cvFileName: cvFile?.name ?? "cv",
        cvDataUrl: pendingCvDataUrl,
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
      const apps = JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
      apps.push(app);
      localStorage.setItem("vt_tutor_applications", JSON.stringify(apps));
      localStorage.setItem("vt_pending_email", app.email);
      router.push("/become/pending");
    } catch {
      setOtpError("Failed to submit application. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={() => { setStep("form"); setError(""); setEnteredOtp(""); setDevOtp(""); }}>
      <DialogTrigger asChild>
        <button className="w-full rounded-full bg-gray-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0">
          Apply to become a VolunTutor →
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col items-center gap-2">
          <BrandMark />
          <DialogHeader>
            <DialogTitle className="sm:text-center">
              {step === "otp" ? "Check your inbox" : "Apply to become a VolunTutor"}
            </DialogTitle>
            <DialogDescription className="sm:text-center">
              {step === "otp"
                ? `We sent a 6-digit code to ${email}`
                : "Submit your application — a moderator will review your CV and approve your account."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Step 1: Form ── */}
        {step === "form" && (
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>Full name</Label>
                <Input id={`${id}-name`} placeholder="Jane Smith" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input id={`${id}-email`} placeholder="jane@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-password`}>Password</Label>
                <Input id={`${id}-password`} placeholder="At least 8 characters" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-confirm`}>Confirm password</Label>
                <Input id={`${id}-confirm`} placeholder="Repeat your password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CV / Resume <span className="text-red-500 ml-0.5">*</span></Label>
                <label
                  htmlFor={`${id}-cv`}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 px-3 text-center transition ${
                    cvFile ? "border-amber-300 bg-amber-50" : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/50"
                  }`}
                >
                  {cvFile ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="truncate max-w-[180px]">{cvFile.name}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); setCvFile(null); }}
                        className="ml-1 text-amber-400 hover:text-amber-600 text-lg leading-none">×</button>
                    </div>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Click to upload your CV</p>
                        <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, or image</p>
                      </div>
                    </>
                  )}
                  <input id={`${id}-cv`} type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
            <AmberButton onClick={() => handleSignUp()} disabled={verifying || sending}>
              {verifying ? "Verifying email…" : sending ? "Sending code…" : "Continue →"}
            </AmberButton>
            <p className="text-center text-xs text-muted-foreground">
              By applying you agree to our <a className="underline hover:no-underline" href="#">Terms</a>.
            </p>
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
              <Input id={`${id}-otp`} placeholder="000000" maxLength={6} value={enteredOtp}
                onChange={(e) => { setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                onKeyDown={(e) => e.key === "Enter" && enteredOtp.length === 6 && handleVerifyOTP()}
                className="text-center text-2xl font-mono tracking-[0.5em] py-3" />
              <p className="text-xs text-muted-foreground">Check your spam folder if you don't see it.</p>
            </div>
            {otpError && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{otpError}</p>}
            <AmberButton onClick={handleVerifyOTP} disabled={enteredOtp.length !== 6 || loading}>
              {loading ? "Submitting application…" : "Verify & Submit Application"}
            </AmberButton>
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
  const [remember, setRemember] = useState(false);
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
    // Check moderator credentials
    try {
      const mods: { id: string; email: string; password: string }[] =
        JSON.parse(localStorage.getItem("vt_moderators") || "[]");
      const mod = mods.find((m) => m.email === email.trim().toLowerCase() && m.password === password);
      if (mod) {
        localStorage.setItem("vt_mod_session", mod.id);
        router.push("/mod/dashboard");
        return;
      }
    } catch { /* ignore */ }
    // Check tutor applications
    try {
      const apps: { email: string; password: string; status: string; reviewNote?: string }[] =
        JSON.parse(localStorage.getItem("vt_tutor_applications") || "[]");
      const app = apps.find((a) => a.email === email.trim().toLowerCase() && a.password === password);
      if (app) {
        if (app.status === "pending") {
          localStorage.setItem("vt_pending_email", app.email);
          router.push("/become/pending"); return;
        }
        if (app.status === "denied") {
          setError(`Your tutor application was denied${app.reviewNote ? `: "${app.reviewNote}"` : ""}. Please contact support.`); return;
        }
        // approved — account was created, fall through to normal sign-in
      }
    } catch { /* ignore */ }
    setLoading(true);
    const result = signIn(email.trim(), password);
    if (!result.ok) { setError(result.error ?? "Something went wrong."); setLoading(false); return; }
    if (result.user?.role === "student") { router.push("/find/dashboard"); return; }
    router.push("/become/dashboard");
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
            <DialogDescription className="sm:text-center">Enter your credentials to continue tutoring.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input id={`${id}-email`} placeholder="jane@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-remember`} checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              <Label htmlFor={`${id}-remember`} className="font-normal text-muted-foreground">Remember me</Label>
            </div>
            <a className="text-sm text-amber-600 underline hover:no-underline" href="#">Forgot password?</a>
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <AmberButton onClick={handleSignIn} disabled={loading}>{loading ? "Signing in…" : "Sign in"}</AmberButton>
        </div>
        <div className="flex items-center gap-3 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          <span className="text-xs text-muted-foreground">Or</span>
        </div>
        <button type="button" className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent">
          <GoogleIcon />Login with Google
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function BecomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "student") { router.replace("/find/dashboard"); return; }
      const hasProfile = !!localStorage.getItem(`vt_tutor_profile_${user.id}`);
      router.replace(hasProfile ? "/become/dashboard" : "/become/onboarding");
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
            Become a <span className="italic text-amber-500">VolunTutor.</span>
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-600">
            Share your knowledge, change a life. Help visually impaired students unlock their potential — always free, for you and your students.
          </p>
        </div>

        <div className="flex w-full max-w-2xl flex-col gap-5 sm:flex-row">
          <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-black/10 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">New here</p>
              <h2 className="text-xl font-bold text-gray-900">Apply to tutor</h2>
              <p className="mt-1 text-sm text-gray-500">Submit your application with your CV — a moderator will review and approve it.</p>
            </div>
            <SignUpDialog />
          </div>
          <div className="flex items-center justify-center sm:flex-col">
            <div className="h-px w-full bg-gray-200 sm:h-full sm:w-px" />
            <span className="shrink-0 px-3 py-2 text-xs font-medium text-gray-400">or</span>
            <div className="h-px w-full bg-gray-200 sm:h-full sm:w-px" />
          </div>
          <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-black/10 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Returning tutor</p>
              <h2 className="text-xl font-bold text-gray-900">Sign back in</h2>
              <p className="mt-1 text-sm text-gray-500">Pick up right where you left off.</p>
            </div>
            <SignInDialog />
          </div>
        </div>
      </div>
    </RhythmicRipplesBackground>
  );
}
