'use client';
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
}

export const Component = ({ children, className }: ComponentProps) => {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("min-h-screen w-full relative bg-white", className)}>
      {/* Soft Yellow Glow */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, #FFF991 0%, transparent 70%)
          `,
          opacity: 0.6,
          mixBlendMode: "multiply",
        }}
      />
      {/* Content slot */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
