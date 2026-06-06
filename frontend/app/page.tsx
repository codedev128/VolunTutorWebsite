import Link from "next/link";
import { ReviewsSection } from "@/components/reviews-section";
import { AuthRedirect } from "@/components/auth-redirect";
import { FloatingPaths } from "@/components/ui/floating-paths";

export default function Home() {
  return (
    <>
      <AuthRedirect />
      {/* ── Hero ───────────────────────────────────── */}
      <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-white px-6">
        {/* Floating paths background animation */}
        <div className="pointer-events-none absolute inset-0 text-amber-400/40">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Learning with{" "}
            <span className="italic text-amber-500">no limits.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
            Take your first step with VolunTutor towards free, personalised online tutoring for visually impaired students.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/find/auth"
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

          {/* Scroll indicator */}
          <div className="mt-16 flex flex-col items-center gap-1.5 opacity-40">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Reviews</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce text-gray-400">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Why VolunTutor ──────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-amber-500">Why volunteer?</p>
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Advantages of becoming a{" "}
            <span className="italic text-amber-500">VolunTutor</span>
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                n: "01",
                title: "Make a Meaningful Impact",
                body: "One lesson from you could open a world of possibilities for them.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
              },
              {
                n: "02",
                title: "Grow Your Teaching Skills",
                body: "Teaching differently makes you teach better.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                ),
              },
              {
                n: "03",
                title: "Join a Purpose-Driven Community",
                body: "Surround yourself with people who teach with heart.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
              },
              {
                n: "04",
                title: "Earn a Recognised Social-Impact Certificate",
                body: "Receive an official certificate from partnered blind schools — proof that your time and effort truly mattered.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                ),
              },
            ].map(({ n, title, body, icon }) => (
              <div key={n} className="flex gap-4 rounded-2xl border border-black/8 bg-gray-50 p-6 transition hover:border-amber-200 hover:bg-amber-50/40">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 border border-amber-200">
                  {icon}
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">{n}</p>
                  <p className="font-bold text-gray-900">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ─────────────────────────────────── */}
      <ReviewsSection />
    </>
  );
}
