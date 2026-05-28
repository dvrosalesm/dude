"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { cn } from "../lib/utils";

type AIGenerationOverlayProps = {
  /** Render the overlay when true, fade out when false. */
  active: boolean;
  /** Border radius applied to the overlay and glow. Default 0. */
  borderRadius?: number;
  /** When true, draws the glowing ring around the overlay edge. Default true. */
  showGlow?: boolean;
  /** Opacity of the soft backdrop layer. Default 0.1. */
  backdropOpacity?: number;
  className?: string;
  style?: CSSProperties;
  /** Stacking order. Default 999. */
  zIndex?: number;
};

/**
 * Lava-lamp + glow overlay shown over an editor while an agent is generating
 * or updating content. The component fills its nearest positioned ancestor —
 * wrap it in a `position: relative` container.
 *
 * Drifting white and light-blue blobs over a soft sky-blue backdrop, plus a
 * hue-shifting box-shadow ring. Pointer events are disabled so the user can
 * still see the editor under the overlay without it intercepting clicks.
 */
export function AIGenerationOverlay({
  active,
  borderRadius = 0,
  showGlow = true,
  backdropOpacity = 0.1,
  className,
  style,
  zIndex = 999,
}: AIGenerationOverlayProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="ai-generation-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={cn(
            "absolute inset-0 pointer-events-none overflow-hidden",
            className,
          )}
          style={{ borderRadius, zIndex, ...style }}
          aria-hidden
        >
          <div
            className="absolute inset-0"
            style={{ background: `rgba(186, 215, 255, ${backdropOpacity})` }}
          />
          <div className="lava-blob lava-1" />
          <div className="lava-blob lava-2" />
          <div className="lava-blob lava-3" />
          <div className="lava-blob lava-4" />
          <div className="lava-blob lava-5" />
          {showGlow && (
            <div
              className="ai-generation-glow absolute inset-0"
              style={{ borderRadius }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
