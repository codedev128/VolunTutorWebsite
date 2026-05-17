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

/* ── Brand icon ──────────────────────────────────────── */
function BrandMark() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 border border-amber-300">
      <svg className="stroke-amber-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" strokeWidth="8" />
      </svg>
    </div>
  );
}

/* ── Google icon ─────────────────────────────────────── */
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

/* ── Amber submit button ─────────────────────────────── */
function AmberButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

/* ── Sign Up Dialog ──────────────────────────────────── */
function SignUpDialog() {
  const id = useId();
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSignUp() {
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const result = signUp(name.trim(), email.trim(), password);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    router.push("/tutor");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full rounded-full bg-gray-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0">
          Create an account →
        </button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col items-center gap-2">
          <BrandMark />
          <DialogHeader>
            <DialogTitle className="sm:text-center">Join as a Tutor</DialogTitle>
            <DialogDescription className="sm:text-center">
              We just need a few details to get started.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>Full name</Label>
              <Input
                id={`${id}-name`}
                placeholder="Jane Smith"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input
                id={`${id}-email`}
                placeholder="jane@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-password`}>Password</Label>
              <Input
                id={`${id}-password`}
                placeholder="At least 6 characters"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <AmberButton onClick={handleSignUp} disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </AmberButton>
        </div>

        <div className="flex items-center gap-3 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          <span className="text-xs text-muted-foreground">Or</span>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our{" "}
          <a className="underline hover:no-underline" href="#">Terms</a>.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sign In Dialog ──────────────────────────────────── */
function SignInDialog() {
  const id = useId();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const result = signIn(email.trim(), password);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    router.push("/tutor");
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
            <DialogDescription className="sm:text-center">
              Enter your credentials to continue tutoring.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input
                id={`${id}-email`}
                placeholder="jane@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-password`}>Password</Label>
              <Input
                id={`${id}-password`}
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              />
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-remember`}
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              <Label htmlFor={`${id}-remember`} className="font-normal text-muted-foreground">
                Remember me
              </Label>
            </div>
            <a className="text-sm text-amber-600 underline hover:no-underline" href="#">
              Forgot password?
            </a>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <AmberButton onClick={handleSignIn} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </AmberButton>
        </div>

        <div className="flex items-center gap-3 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          <span className="text-xs text-muted-foreground">Or</span>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent"
        >
          <GoogleIcon />
          Login with Google
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function BecomeATutorPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace("/tutor");
  }, [user, isLoading, router]);

  if (isLoading) return null;

  return (
    <RhythmicRipplesBackground
      backgroundColor="#ffffff"
      rippleColor="rgba(247, 184, 1, 0.4)"
      rippleCount={18}
      rippleSpeed={0.4}
    >
      {/* Back button — top left, styled to match UI */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-amber-600"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-gray-200 bg-white/80 shadow-sm transition group-hover:border-amber-300 group-hover:bg-amber-50">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Back
        </Link>
      </div>

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Heading */}
        <div className="mb-10 flex flex-col items-center">
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Become a{" "}
            <span className="italic text-amber-500">VolunTutor.</span>
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-600">
            Share your knowledge, change a life. It&apos;s completely free — for you and your students.
          </p>
        </div>

        {/* Auth cards */}
        <div className="flex w-full max-w-2xl flex-col gap-5 sm:flex-row">
          {/* New here */}
          <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-black/10 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">New here</p>
              <h2 className="text-xl font-bold text-gray-900">Create an account</h2>
              <p className="mt-1 text-sm text-gray-500">Join thousands of tutors making a difference.</p>
            </div>
            <SignUpDialog />
          </div>

          {/* Divider */}
          <div className="flex items-center justify-center sm:flex-col">
            <div className="h-px w-full bg-gray-200 sm:h-full sm:w-px" />
            <span className="shrink-0 px-3 py-2 text-xs font-medium text-gray-400">or</span>
            <div className="h-px w-full bg-gray-200 sm:h-full sm:w-px" />
          </div>

          {/* Returning */}
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
