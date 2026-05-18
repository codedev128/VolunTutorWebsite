"use client";

import { useState, useId, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ModLoginPage() {
  const id = useId();
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && localStorage.getItem("vt_mod_session")) {
      router.replace("/mod/dashboard");
    }
  }, [router]);

  function handleSignIn() {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter your credentials."); return; }
    try {
      const mods: { id: string; email: string; password: string }[] =
        JSON.parse(localStorage.getItem("vt_moderators") || "[]");
      const mod = mods.find((m) => m.email === email.trim().toLowerCase() && m.password === password);
      if (!mod) { setError("Invalid moderator credentials."); return; }
      setLoading(true);
      localStorage.setItem("vt_mod_session", mod.id);
      router.push("/mod/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  if (!mounted) return null;

  return (
    <RhythmicRipplesBackground backgroundColor="#0f172a" rippleColor="rgba(251, 191, 36, 0.15)" rippleCount={14} rippleSpeed={0.3}>
      <div className="relative flex w-full max-w-sm flex-col items-center px-6">
        {/* Logo */}
        <div className="mb-8 flex size-14 items-center justify-center rounded-2xl bg-amber-400/20 border border-amber-400/30">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Moderator Portal</h1>
        <p className="text-sm text-slate-400 mb-8 text-center">Sign in to review tutor applications</p>

        <div className="w-full rounded-2xl border border-slate-700 bg-slate-800/80 p-7 backdrop-blur-sm space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`${id}-email`} className="text-slate-300">Email</Label>
            <Input
              id={`${id}-email`}
              type="email"
              placeholder="mod@voluntutor.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-password`} className="text-slate-300">Password</Label>
            <div className="relative">
              <Input
                id={`${id}-password`}
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-400 pr-10"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                {showPw ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-600">
          Not a moderator?{" "}
          <Link href="/become" className="text-amber-500 hover:underline">Tutor sign-in →</Link>
        </p>
      </div>
    </RhythmicRipplesBackground>
  );
}
