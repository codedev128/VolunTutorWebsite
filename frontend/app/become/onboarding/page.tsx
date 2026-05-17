"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";
import { useAuth } from "@/context/auth-context";

/* ── Constants ───────────────────────────────────────── */
const SUBJECTS = [
  "Maths", "Physics", "Biology", "English", "History",
  "Economics", "Business", "Accounts", "Social", "Politics",
  "Geography", "Computer Science", "IT", "Arts", "Psychology",
];

const PROFICIENCY_OPTIONS = [
  { value: "none",         label: "Not teaching"  },
  { value: "beginner",     label: "Beginner"       },
  { value: "intermediate", label: "Intermediate"   },
  { value: "advanced",     label: "Advanced"       },
  { value: "expert",       label: "Expert"         },
];

const EDUCATION_OPTIONS = [
  { value: "high_school",  label: "High School"            },
  { value: "ug",           label: "Undergraduate Degree"   },
  { value: "pg",           label: "Postgraduate Degree"    },
  { value: "phd",          label: "PhD"                    },
  { value: "professional", label: "Industry Professional"  },
];

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

/* ── Step 1: Subject proficiency ─────────────────────── */
function SubjectStep({
  proficiency,
  setProficiency,
  onContinue,
}: {
  proficiency: Record<string, string>;
  setProficiency: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onContinue: () => void;
}) {
  const [error, setError] = useState("");
  const selectedCount = SUBJECTS.filter((s) => proficiency[s] !== "none").length;

  function handleContinue() {
    if (selectedCount === 0) {
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
          Set your proficiency level for each subject. Leave &quot;Not teaching&quot; for subjects you won&apos;t tutor.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm">
        <div className="divide-y divide-gray-100">
          {SUBJECTS.map((subject) => {
            const isSelected = proficiency[subject] !== "none";
            return (
              <div key={subject} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex w-40 shrink-0 items-center gap-2">
                  {isSelected && (
                    <span className="flex size-2 rounded-full bg-amber-400" />
                  )}
                  <span className={`text-sm font-semibold ${isSelected ? "text-gray-900" : "text-gray-400"}`}>
                    {subject}
                  </span>
                </div>
                <select
                  value={proficiency[subject]}
                  onChange={(e) =>
                    setProficiency((prev) => ({ ...prev, [subject]: e.target.value }))
                  }
                  className={selectCls}
                >
                  {PROFICIENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-400">
            {selectedCount > 0 ? (
              <>
                <span className="font-bold text-amber-600">{selectedCount}</span>
                {" subject"}{selectedCount !== 1 ? "s" : ""} selected
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
  proficiency,
  education,
  setEducation,
  onBack,
  onFinish,
}: {
  selectedSubjects: string[];
  proficiency: Record<string, string>;
  education: Record<string, string>;
  setEducation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onBack: () => void;
  onFinish: () => void;
}) {
  const proficiencyLabel = (val: string) =>
    PROFICIENCY_OPTIONS.find((o) => o.value === val)?.label ?? val;

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
            <div key={subject} className="py-4 first:pt-0 last:pb-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-700">
                  {subject}
                </span>
                <span className="text-xs capitalize text-gray-400">
                  {proficiencyLabel(proficiency[subject])} proficiency
                </span>
              </div>
              <select
                value={education[subject] || "ug"}
                onChange={(e) =>
                  setEducation((prev) => ({ ...prev, [subject]: e.target.value }))
                }
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

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-gray-900/20 px-6 py-3.5 text-sm font-semibold text-gray-800 transition hover:border-gray-900/40 hover:bg-gray-900/5"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex-1 rounded-full bg-gray-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0"
        >
          Complete setup →
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
  const [proficiency, setProficiency] = useState<Record<string, string>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, "none"]))
  );
  const [education, setEducation] = useState<Record<string, string>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, "ug"]))
  );

  useEffect(() => {
    if (!isLoading && !user) router.replace("/become");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const selectedSubjects = SUBJECTS.filter((s) => proficiency[s] !== "none");

  function handleFinish() {
    const profile = {
      subjects: selectedSubjects.map((s) => ({
        name: s,
        proficiency: proficiency[s],
        educationLevel: education[s] || "ug",
      })),
    };
    localStorage.setItem(`vt_tutor_profile_${user!.id}`, JSON.stringify(profile));
    router.push("/become/dashboard");
  }

  return (
    <RhythmicRipplesBackground
      backgroundColor="#ffffff"
      rippleColor="rgba(247, 184, 1, 0.4)"
      rippleCount={18}
      rippleSpeed={0.4}
    >
      {step === 1 ? (
        <SubjectStep
          proficiency={proficiency}
          setProficiency={setProficiency}
          onContinue={() => setStep(2)}
        />
      ) : (
        <EducationStep
          selectedSubjects={selectedSubjects}
          proficiency={proficiency}
          education={education}
          setEducation={setEducation}
          onBack={() => setStep(1)}
          onFinish={handleFinish}
        />
      )}
    </RhythmicRipplesBackground>
  );
}
