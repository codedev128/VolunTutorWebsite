import { DottedSurface } from "@/components/ui/dotted-surface";
import { cn } from "@/lib/utils";

export default function DemoPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <DottedSurface />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-10 left-1/2 size-full -translate-x-1/2 rounded-full",
            "bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,currentColor_10%,transparent),transparent_50%)]",
            "blur-[30px]",
          )}
        />
        <h1 className="font-mono text-4xl font-semibold">Dotted Surface</h1>
      </div>
    </div>
  );
}
