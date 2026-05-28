"use client";

/**
 * Floating chat panel — a collapsible overlay for subagents with
 * canvas-first UIs (presentation editor, image studio, etc.).
 *
 * The input bar is always visible at the bottom. Opening expands the
 * card upward to reveal message history. The bubble floats above the
 * input when collapsed.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type FloatingChatPanelProps = {
  children: React.ReactNode;
  messageCount: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  autoOpenOnMessage?: boolean;
  sending?: boolean;
  className?: string;
};

export function FloatingChatPanel({
  children,
  messageCount,
  open: controlledOpen,
  onOpenChange,
  autoOpenOnMessage = true,
  sending,
  className,
}: FloatingChatPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const measuredRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messageCount);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "tween" as const, duration: 0.2, ease: "easeOut" };

  const captureCollapsedHeight = useCallback(() => {
    if (!measuredRef.current) return;
    const collapsedAnchor = measuredRef.current.querySelector<HTMLElement>("[data-floating-chat-anchor]");
    const nextHeight = collapsedAnchor?.offsetHeight ?? measuredRef.current.scrollHeight;
    if (nextHeight > 0) {
      setCollapsedHeight((current) => (current === nextHeight ? current : nextHeight));
    }
  }, []);

  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      // Snapshot collapsed height right before opening
      if (v && !isOpen) {
        captureCollapsedHeight();
      }
      if (onOpenChange) onOpenChange(v);
      else setInternalOpen(v);
    },
    [captureCollapsedHeight, onOpenChange, isOpen],
  );

  // Measure initial collapsed height
  useLayoutEffect(() => {
    if (!isOpen) captureCollapsedHeight();
  }, [captureCollapsedHeight, isOpen]);

  useEffect(() => {
    if (isOpen || !measuredRef.current || typeof ResizeObserver === "undefined") return;
    const collapsedAnchor = measuredRef.current.querySelector<HTMLElement>("[data-floating-chat-anchor]");
    const observedNode = collapsedAnchor ?? measuredRef.current;
    const observer = new ResizeObserver(() => captureCollapsedHeight());
    observer.observe(observedNode);
    return () => observer.disconnect();
  }, [captureCollapsedHeight, isOpen]);

  // Auto-open when new messages arrive
  useEffect(() => {
    if (!autoOpenOnMessage) return;
    if (messageCount > prevCountRef.current) {
      setOpen(true);
    }
    prevCountRef.current = messageCount;
  }, [messageCount, autoOpenOnMessage, setOpen]);

  // Auto-open when sending starts
  useEffect(() => {
    if (sending) setOpen(true);
  }, [sending, setOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setOpen]);

  const closedHeight = collapsedHeight ?? "auto";

  return (
    <div
      ref={panelRef}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-2xl px-2 sm:px-4 pb-2 ${className ?? ""}`}
    >
      <div className="pointer-events-auto flex flex-col items-end w-full">
        {/* Chat content — messages get card styling via SubagentChat, input is bare */}
        <motion.div
          ref={measuredRef}
          className="w-full flex flex-col"
          initial={false}
          animate={{ opacity: 1 }}
          transition={transition}
          onAnimationComplete={() => {
            if (!isOpen) captureCollapsedHeight();
          }}
          onFocusCapture={!isOpen && messageCount > 0 ? () => setOpen(true) : undefined}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
