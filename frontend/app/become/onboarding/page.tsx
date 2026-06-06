"use client";

import { useState, useEffect, useCallback } from "react";
import * as db from "@/lib/db";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { FloatingPathsBg } from "@/components/ui/floating-paths";

/* ── Constants ───────────────────────────────────────── */
const SUBJECTS = [
  "Maths", "Physics", "Chemistry", "Biology", "English", "History",
  "Economics", "Business", "Accounts", "Social", "Politics",
  "Geography", "Computer Science", "IT", "Arts", "Psychology",
];

const EDUCATION_OPTIONS = [
  { value: "high_school",  label: "High School"           },
  { value: "ug",           label: "Undergraduate Degree"  },
  { value: "pg",           label: "Postgraduate Degree"   },
  { value: "phd",          label: "PhD"                   },
  { value: "professional", label: "Industry Professional" },
];

/*
 * Four proficiency categories, grouped from the education options:
 *   High School            → Foundation
 *   Undergraduate / Postgraduate Degree → Proficient
 *   PhD                    → Expert
 *   Industry Professional  → Specialist
 */
export function educationToProficiency(education: string): string {
  switch (education) {
    case "high_school":  return "foundation";
    case "ug":           return "proficient";
    case "pg":           return "proficient";
    case "phd":          return "expert";
    case "professional": return "specialist";
    default:             return "proficient";
  }
}

const selectCls =
  "w-full rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300/40";

/* ── Progress bar ────────────────────────────────────── */
function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex gap-1.5">
        <div className="h-1.5 w-10 rounded-full bg-amber-400" />
        <div className={`h-1.5 w-10 rounded-full transition-colors ${step === 2 ? "bg-amber-400" : "bg-amber-200"}`} />
      </div>
      <span className="text-xs font-medium text-gray-400">Step {step} of 2</span>
    </div>
  );
}

/* ── Step 1: Subject selection ───────────────────────── */
function SubjectStep({
  selected,
  onToggle,
  onContinue,
}: {
  selected: Set<string>;
  onToggle: (subject: string) => void;
  onContinue: () => void;
}) {
  const [error, setError] = useState("");

  function handleContinue() {
    if (selected.size === 0) {
      setError("Please select at least one subject you can teach.");
      return;
    }
    setError("");
    onContinue();
  }

  return (
    <div className="w-full max-w-2xl px-6 py-12">
      <ProgressBar step={1} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          What can you <span className="italic text-amber-500">teach?</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Tap the subjects you&apos;re able to tutor. You can select as many as you like.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap gap-2.5">
          {SUBJECTS.map((subject) => {
            const isSelected = selected.has(subject);
            return (
              <button
                key={subject}
                type="button"
                onClick={() => onToggle(subject)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isSelected
                    ? "border-amber-400 bg-amber-400 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                }`}
              >
                {isSelected && <span className="mr-1.5">✓</span>}
                {subject}
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-400">
            {selected.size > 0 ? (
              <>
                <span className="font-bold text-amber-600">{selected.size}</span>
                {" subject"}{selected.size !== 1 ? "s" : ""} selected
              </>
            ) : (
              "No subjects selected yet"
            )}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        className="mt-6 w-full rounded-full bg-gray-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0"
      >
        Continue →
      </button>
    </div>
  );
}

/* ── Step 2: Education per subject ───────────────────── */
function EducationStep({
  selectedSubjects,
  education,
  setEducation,
  onBack,
  onFinish,
  saving,
  saveError,
}: {
  selectedSubjects: string[];
  education: Record<string, string>;
  setEducation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onBack: () => void;
  onFinish: () => Promise<void> | void;
  saving: boolean;
  saveError: string;
}) {
  return (
    <div className="w-full max-w-2xl px-6 py-12">
      <ProgressBar step={2} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Your <span className="italic text-amber-500">education</span> background
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          For each subject you&apos;re teaching, select your highest level of education in that area.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm">
        <div className="divide-y divide-gray-100">
          {selectedSubjects.map((subject) => (
            <div key={subject} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
              <span className="w-36 shrink-0 rounded-full border border-amber-300 bg-amber-100 px-3 py-0.5 text-center text-xs font-bold text-amber-700">
                {subject}
              </span>
              <select
                value={education[subject] ?? "ug"}
                onChange={(e) => setEducation((prev) => ({ ...prev, [subject]: e.target.value }))}
                className={selectCls}
              >
                {EDUCATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {saveError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="rounded-full border border-gray-900/20 px-6 py-3.5 text-sm font-semibold text-gray-800 transition hover:border-gray-900/40 hover:bg-gray-900/5 disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={saving}
          className="flex-1 rounded-full bg-gray-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          {saving ? "Saving…" : "Complete setup →"}
        </button>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [education, setEducation] = useState<Record<string, string>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, "ug"]))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/become");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const selectedSubjects = SUBJECTS.filter((s) => selected.has(s));

  function toggleSubject(subject: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  }

  const handleFinish = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      await db.setTutorProfile(user!.id, {
        subjects: selectedSubjects.map((s) => {
          const educationLevel = education[s] ?? "ug";
          return {
            name: s,
            proficiency: educationToProficiency(educationLevel),
            educationLevel,
          };
        }),
      });
      router.push("/become/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error("Profile save failed:", msg);
      setSaveError(`Save failed: ${msg}`);
      setSaving(false);
    }
  }, [selectedSubjects, education, user, router]);

  return (
    <FloatingPathsBg>
      {step === 1 ? (
        <SubjectStep
          selected={selected}
          onToggle={toggleSubject}
          onContinue={() => setStep(2)}
        />
      ) : (
        <EducationStep
          selectedSubjects={selectedSubjects}
          education={education}
          setEducation={setEducation}
          onBack={() => setStep(1)}
          onFinish={handleFinish}
          saving={saving}
          saveError={saveError}
        />
      )}
    </FloatingPathsBg>
  );
}
