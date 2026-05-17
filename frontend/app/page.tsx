import Link from "next/link";
import RhythmicRipplesBackground from "@/components/ui/rhythmic-ripples-background";
import { NestedSquares } from "@/components/ui/bloom";

export default function Home() {
  return (
    <RhythmicRipplesBackground
      backgroundColor="#ffffff"
      rippleColor="rgba(247, 184, 1, 0.4)"
      rippleCount={18}
      rippleSpeed={0.4}
    >
      {/* ── Hero ───────────────────────────────────── */}
      <div className="relative flex flex-col items-center px-6 text-center">

        {/* NestedSquares bloom — sits behind hero text, transparent bg */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <NestedSquares className="bg-transparent opacity-70 w-[680px] h-[680px]" />
        </div>

        {/* All hero content — z-10 so it floats above the bloom */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Headline */}
          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Every student deserves a{" "}
            <span className="italic text-amber-500">great teacher.</span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            VolunTutor connects students with passionate volunteer tutors — for
            free, always. Whether you need help or want to give it, there's a
            seat at the table for you.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/find"
              className="rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-gray-700 active:translate-y-0"
            >
              Find a VolunTutor →
            </Link>
            <Link
              href="/become"
              className="rounded-full border border-gray-900/20 px-8 py-3 text-sm font-semibold text-gray-800 transition hover:border-gray-900/40 hover:bg-gray-900/5"
            >
              Become a VolunTutor
            </Link>
          </div>

        </div>
      </div>
    </RhythmicRipplesBackground>
  );
}
