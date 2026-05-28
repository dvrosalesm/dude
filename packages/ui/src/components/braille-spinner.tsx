"use client";

import { cn } from "../lib/utils";

interface BrailleSpinnerProps {
  className?: string;
}

// Position (left, top), size (em), animation delay (s). Deliberately asymmetric.
const SPARKLES: Array<[string, string, string, string]> = [
  ["38%", "52%", "0.85em", "0s"],
  ["68%", "28%", "0.5em", "0.4s"],
  ["82%", "62%", "0.32em", "0.7s"],
  ["20%", "18%", "0.28em", "1s"],
  ["58%", "82%", "0.38em", "1.3s"],
];

// Animation shorthand is set inline (with explicit `infinite`) so the loop
// can't be short-circuited by Tailwind purge or a parent enter-animation.
// Keyframes (`braille-twinkle`) live in globals.css.
export function BrailleSpinner({ className }: BrailleSpinnerProps) {
  return (
    <span
      className={cn(
        "relative inline-block align-middle h-[1.4em] w-[1.4em] shrink-0",
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      {SPARKLES.map(([left, top, size, delay], i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute text-[#E7C59A] motion-reduce:hidden"
          style={{
            left,
            top,
            fontSize: size,
            lineHeight: 1,
            transform: "translate(-50%, -50%)",
            textShadow: "0 0 0.4em rgba(231,197,154,0.55)",
            animation: `braille-twinkle 1.8s ease-in-out ${delay} infinite`,
          }}
        >
          *
        </span>
      ))}
    </span>
  );
}
