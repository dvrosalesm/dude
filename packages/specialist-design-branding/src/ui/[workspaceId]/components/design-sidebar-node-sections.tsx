"use client";

import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
} from "lucide-react";
import {
  COLOR_PRESETS,
  FONT_FAMILIES,
  FONT_SIZES,
  Section,
  NumberRow,
  SelectRow,
  ColorRow,
  ToggleButton,
  defaultFill,
} from "./design-sidebar-controls";

export function DimensionsSection({
  node,
  onUpdateNode,
}: {
  node: Node;
  onUpdateNode: (id: string, patch: Partial<Node>) => void;
}) {
  const w = Math.round(node.width ?? (node as { measured?: { width?: number } }).measured?.width ?? 0);
  const h = Math.round(node.height ?? (node as { measured?: { height?: number } }).measured?.height ?? 0);
  const x = Math.round(node.position.x);
  const y = Math.round(node.position.y);

  return (
    <Section title="Position & size">
      <div className="grid grid-cols-2 gap-2">
        <NumberRow
          label="X"
          value={x}
          onChange={(v) => onUpdateNode(node.id, { position: { x: v, y: node.position.y } })}
        />
        <NumberRow
          label="Y"
          value={y}
          onChange={(v) => onUpdateNode(node.id, { position: { x: node.position.x, y: v } })}
        />
        <NumberRow
          label="W"
          value={w}
          min={20}
          onChange={(v) => onUpdateNode(node.id, { width: v })}
        />
        <NumberRow
          label="H"
          value={h}
          min={20}
          onChange={(v) => onUpdateNode(node.id, { height: v })}
        />
      </div>
    </Section>
  );
}

export function FillSection({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const data = (node.data || {}) as Record<string, unknown>;
  const supportsFill = useMemo(
    () => ["stickyNote", "textBlock", "shape", "frame"].includes(node.type ?? ""),
    [node.type],
  );
  if (!supportsFill) return null;

  // Different node types name the fill field differently. Resolve which
  // field this node uses so we read/write the right one.
  const field =
    node.type === "shape"
      ? "fill"
      : node.type === "stickyNote"
        ? "color"
        : "bgColor";
  const current = (data[field] as string | undefined) ?? defaultFill(node.type ?? "");

  return (
    <Section title="Fill">
      <ColorRow
        label="Background"
        value={current}
        onChange={(c) => onUpdateNodeData(node.id, { [field]: c })}
        showTransparent={node.type === "textBlock" || node.type === "frame"}
      />
    </Section>
  );
}

export function BorderSection({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const data = (node.data || {}) as Record<string, unknown>;
  const supportsBorder = useMemo(
    () => ["shape", "frame", "image", "textBlock"].includes(node.type ?? ""),
    [node.type],
  );
  if (!supportsBorder) return null;

  const colorField = node.type === "shape" ? "stroke" : node.type === "frame" ? "color" : "borderColor";
  const color = (data[colorField] as string | undefined) ?? "#0f172a";
  const width = (data.borderWidth as number | undefined) ?? (node.type === "shape" ? 1.5 : node.type === "frame" ? 2 : 0);
  const radius = (data.borderRadius as number | undefined) ?? 0;
  const style = (data.borderStyle as string | undefined) ?? (node.type === "frame" ? "dashed" : "solid");

  return (
    <Section title="Border">
      <ColorRow
        label="Color"
        value={color}
        onChange={(c) => onUpdateNodeData(node.id, { [colorField]: c })}
      />
      <NumberRow
        label="Width"
        value={width}
        min={0}
        max={20}
        step={0.5}
        onChange={(v) => onUpdateNodeData(node.id, { borderWidth: v })}
      />
      <NumberRow
        label="Radius"
        value={radius}
        min={0}
        max={64}
        onChange={(v) => onUpdateNodeData(node.id, { borderRadius: v })}
      />
      {node.type === "frame" && (
        <SelectRow
          label="Style"
          value={style}
          options={[
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
          onChange={(v) => onUpdateNodeData(node.id, { borderStyle: v })}
        />
      )}
    </Section>
  );
}

export function TextSection({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const data = (node.data || {}) as Record<string, unknown>;
  const supportsText = useMemo(
    () => ["stickyNote", "textBlock"].includes(node.type ?? ""),
    [node.type],
  );
  if (!supportsText) return null;

  const fontFamily = (data.fontFamily as string | undefined) ?? "Geist Sans";
  const fontSize = (data.fontSize as number | undefined) ?? 16;
  const textColor =
    (data.textColor as string | undefined) ??
    (data.color && node.type === "textBlock" ? (data.color as string) : "#0f172a");
  const bold = data.bold === true || (typeof data.weight === "number" && (data.weight as number) >= 600);
  const italic = data.italic === true;
  const align = (data.align as string | undefined) ?? "left";

  return (
    <Section title="Text">
      <SelectRow
        label="Font"
        value={fontFamily}
        options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
        onChange={(v) => onUpdateNodeData(node.id, { fontFamily: v })}
      />
      <SelectRow
        label="Size"
        value={String(fontSize)}
        options={FONT_SIZES.map((s) => ({ value: String(s), label: `${s}px` }))}
        onChange={(v) => onUpdateNodeData(node.id, { fontSize: Number(v) })}
      />
      <ColorRow
        label="Color"
        value={textColor}
        onChange={(c) => onUpdateNodeData(node.id, { textColor: c })}
      />
      <div className="flex items-center gap-1">
        <ToggleButton
          active={bold}
          onClick={() => onUpdateNodeData(node.id, { bold: !bold })}
          aria-label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToggleButton>
        <ToggleButton
          active={italic}
          onClick={() => onUpdateNodeData(node.id, { italic: !italic })}
          aria-label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToggleButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToggleButton
          active={align === "left"}
          onClick={() => onUpdateNodeData(node.id, { align: "left" })}
          aria-label="Align left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToggleButton>
        <ToggleButton
          active={align === "center"}
          onClick={() => onUpdateNodeData(node.id, { align: "center" })}
          aria-label="Align center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToggleButton>
        <ToggleButton
          active={align === "right"}
          onClick={() => onUpdateNodeData(node.id, { align: "right" })}
          aria-label="Align right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToggleButton>
        <ToggleButton
          active={align === "justify"}
          onClick={() => onUpdateNodeData(node.id, { align: "justify" })}
          aria-label="Justify"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </ToggleButton>
      </div>
    </Section>
  );
}

export function EffectsSection({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const data = (node.data || {}) as Record<string, unknown>;
  const supports = node.type === "image";
  if (!supports) return null;

  const opacity =
    typeof data.opacity === "number" ? (data.opacity as number) : 1;

  return (
    <Section title="Effects">
      <NumberRow
        label="Opacity"
        value={opacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => onUpdateNodeData(node.id, { opacity: v })}
      />
    </Section>
  );
}
