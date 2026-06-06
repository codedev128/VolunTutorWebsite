"use client";

import { useState, useId, useEffect } from "react";
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
import { PasswordInput } from "@/components/ui/password-input";
import { generateOTP, storeOTP, verifyOTP, clearOTP, sendOTP } from "@/lib/otp";
import * as db from "@/lib/db";

type Step = "email" | "blocked" | "otp" | "reset" | "done";

const fieldCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function ForgotPasswordDialog({ role }: { role: "student" | "tutor" }) {
  const id = useId();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [modName, setModName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function reset() {
    setStep("email");
    setEmail("");
    setModName(null);
    setUserId(null);
    setUserName("");
    setEnteredOtp("");
    setDevOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setLoading(false);
    setCooldown(0);
  }

  async function handleEmailSubmit() {
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!normalized) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      const user = await db.getUserByEmail(normalized);
      if (!user) { setError("No account found with this email."); setLoading(false); return; }
      if (user.role !== role) {
        setError(`That email belongs to a ${user.role} account.`);
        setLoading(false);
        return;
      }

      // Students in a school must contact their moderator
      if (user.role === "student") {
        const classroom = await db.getStudentClassroom(user.id).catch(() => null);
        if (classroom) {
          const mods = await db.getModerators().catch(() => []);
          const mod = mods.find((m) => m.id === classroom.mod_id);
          setModName(mod?.name ?? "your school's moderator");
          setStep("blocked");
          setLoading(false);
          return;
        }
      }

      setUserId(user.id);
      setUserName(user.name);
      await dispatchOTP(normalized, user.name);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function dispatchOTP(toEmail: string, toName: string) {
    setLoading(true);
    const otp = generateOTP();
    storeOTP(toEmail, otp);
    const result = await sendOTP(toEmail, toName, otp);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Failed to send code."); return; }
    setDevOtp(result.devMode ? otp : "");
    setEnteredOtp("");
    setError("");
    setCooldown(60);
    setStep("otp");
  }

  function handleVerifyOtp() {
    setError("");
    const result = verifyOTP(email.trim().toLowerCase(), enteredOtp);
    if (!result.ok) { setError(result.error!); return; }
    setStep("reset");
  }

  async function handleReset() {
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!userId) { setError("Something went wrong. Please restart."); return; }
    setLoading(true);
    try {
      await db.setUserPassword(userId, newPassword);
      clearOTP(email.trim().toLowerCase());
      setStep("done");
    } catch {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) reset(); }}>
      <DialogTrigger asChild>
        <button type="button" className="text-xs font-semibold text-amber-600 hover:underline">
          Forgot password?
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sm:text-center">
            {step === "done" ? "Password reset" : step === "blocked" ? "Contact your school" : "Reset your password"}
          </DialogTitle>
          <DialogDescription className="sm:text-center">
            {step === "email" && "Enter your account email to receive a verification code."}
            {step === "blocked" && "Your account is managed by a school moderator."}
            {step === "otp" && `We sent a 6-digit code to ${email}`}
            {step === "reset" && "Choose a new password for your account."}
            {step === "done" && "You can now sign in with your new password."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Email step ── */}
        {step === "email" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-fp-email`}>Email</Label>
              <Input id={`${id}-fp-email`} type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()} />
            </div>
            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={handleEmailSubmit} disabled={loading}
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50">
              {loading ? "Checking…" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── Blocked (school student) step ── */}
        {step === "blocked" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-amber-100 border border-amber-300">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              <p className="text-sm text-gray-700">
                Your account belongs to <span className="font-semibold text-amber-700">{modName}</span>&apos;s school.
                Please contact your school moderator to reset your password.
              </p>
            </div>
          </div>
        )}

        {/* ── OTP step ── */}
        {step === "otp" && (
          <div className="space-y-4">
            {devOtp && (
              <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center text-sm text-amber-700">
                Dev mode code: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${id}-fp-otp`}>Verification code</Label>
              <Input id={`${id}-fp-otp`} placeholder="6-digit code" inputMode="numeric" maxLength={6}
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()} />
            </div>
            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={handleVerifyOtp}
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500">
              Verify →
            </button>
            <div className="text-center text-xs text-muted-foreground">
              {cooldown > 0 ? (
                <span>Resend code in {cooldown}s</span>
              ) : (
                <button type="button" onClick={() => dispatchOTP(email.trim().toLowerCase(), userName)} disabled={loading}
                  className="text-amber-600 hover:underline disabled:opacity-50">
                  {loading ? "Sending…" : "Resend code"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Reset step ── */}
        {step === "reset" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-fp-new`}>New password</Label>
              <PasswordInput id={`${id}-fp-new`} placeholder="At least 8 characters"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} inputClassName={fieldCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-fp-confirm`}>Confirm password</Label>
              <PasswordInput id={`${id}-fp-confirm`} placeholder="Repeat your password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReset()} inputClassName={fieldCls} />
            </div>
            {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={handleReset} disabled={loading}
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50">
              {loading ? "Resetting…" : "Reset password"}
            </button>
          </div>
        )}

        {/* ── Done step ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 border border-emerald-200">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <p className="text-sm text-gray-600">Your password has been reset. Close this window and sign in.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
