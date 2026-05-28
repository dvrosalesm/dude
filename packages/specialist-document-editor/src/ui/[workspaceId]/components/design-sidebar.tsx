"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@dude/ui/utils";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import {
  applyControlChange,
  parseSlideControls,
} from "@dude/presentation-editor/lib/html-slide-controls";
import { DESIGN_STYLES } from "@dude/presentation-editor/lib/design-styles";
import { FONT_PAIRS } from "@dude/presentation-editor/lib/font-pairs";
import { EffectsDialog } from "@dude/presentation-editor/components/effects-dialog";
import type {
  PptxContent,
  PptxHtmlShape,
  PptxShaderShape,
  PptxSlideShape,
  SlideTransitionType,
} from "@dude/presentation-editor/types";

const TRANSITION_TYPES: SlideTransitionType[] = [
  "none",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom-in",
  "zoom-out",
  "morph",
  "flip",
  "rotate",
  "blur",
  "bounce",
  "cube",
  "swirl",
];

function isSupportedLayer(shape: PptxSlideShape): shape is PptxHtmlShape | PptxShaderShape {
  return shape.type === "html" || shape.type === "shader";
}

function getLayerLabel(shape: PptxHtmlShape | PptxShaderShape): string {
  if (shape.type === "html") return shape.label || "HTML slide";
  return "Shader";
}

function HtmlControlsPanel({
  htmlContent,
  onUpdate,
}: {
  htmlContent: string;
  onUpdate: (newHtml: string) => void;
}) {
  const controls = parseSlideControls(htmlContent);
  if (controls.length === 0) {
    return (
      <div className="px-3 py-3 border-b border-gray-100 text-[11px] leading-relaxed text-gray-400">
        This HTML slide does not expose editable controls.
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-gray-100 space-y-2">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        HTML Controls
      </span>
      {controls.map((ctrl) => (
        <div key={ctrl.id} className="space-y-0.5">
          <label className="text-[10px] text-gray-500 font-medium">{ctrl.label}</label>
          {ctrl.type === "text" && (
            <input
              type="text"
              defaultValue={ctrl.value ?? ""}
              className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 transition-colors"
              onBlur={(e) => onUpdate(applyControlChange(htmlContent, ctrl, e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdate(applyControlChange(htmlContent, ctrl, (e.target as HTMLInputElement).value));
                }
              }}
            />
          )}
          {ctrl.type === "color" && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                defaultValue={ctrl.value}
                className="w-6 h-6 rounded border border-gray-300 cursor-pointer p-0"
                onChange={(e) => onUpdate(applyControlChange(htmlContent, ctrl, e.target.value))}
              />
              <span className="text-[11px] font-mono text-gray-500">{ctrl.value}</span>
            </div>
          )}
          {ctrl.type === "toggle" && (
            <button
              type="button"
              onClick={() => onUpdate(applyControlChange(htmlContent, ctrl, !ctrl.value))}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                ctrl.value ? "bg-blue-500" : "bg-gray-300",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                  ctrl.value ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function DesignSidebar({
  designStyle,
  onDesignStyleChange,
  fontPair,
  onFontPairChange,
}: {
  designStyle: string;
  onDesignStyleChange: (styleKey: string) => void;
  fontPair: string;
  onFontPairChange: (pairKey: string) => void;
}) {
  const [effectsDialogOpen, setEffectsDialogOpen] = useState(false);
  const doc = useDocumentEditorStore((s) => s.document);
  const editingSlideIndex = useDocumentEditorStore((s) => s.editingSlideIndex);
  const selectedSlideIndices = useDocumentEditorStore((s) => s.selectedSlideIndices);
  const selectedShapeId = useDocumentEditorStore((s) => s.selectedShapeId);
  const setContent = useDocumentEditorStore((s) => s.setContent);
  const selectShape = useDocumentEditorStore((s) => s.selectShape);
  const toggleShapeVisibility = useDocumentEditorStore((s) => s.toggleShapeVisibility);

  if (!doc) return null;

  const content = doc.content as PptxContent;
  const dims = content.slideDimensions || { width: 12192000, height: 6858000 };
  const activeSlideIndex = editingSlideIndex ?? selectedSlideIndices[0] ?? 0;
  const activeSlide = content.slides?.[activeSlideIndex];
  if (!activeSlide) return null;

  const supportedLayers = (activeSlide.shapes || []).filter(isSupportedLayer);
  const selectedLayer =
    selectedShapeId?.slideIndex === activeSlideIndex
      ? supportedLayers.find((shape) => shape.shapeIndex === selectedShapeId.shapeIndex) ?? null
      : null;

  const patchLayer = (shapeIndex: number, patch: Partial<PptxHtmlShape | PptxShaderShape>) => {
    const currentDoc = useDocumentEditorStore.getState().document;
    if (!currentDoc) return;
    const currentContent = currentDoc.content as PptxContent;
    const slides = currentContent.slides.map((slide, slideIndex) => {
      if (slideIndex !== activeSlideIndex) return slide;
      return {
        ...slide,
        shapes: (slide.shapes || [])
          .filter(isSupportedLayer)
          .map((shape) => (shape.shapeIndex === shapeIndex ? ({ ...shape, ...patch } as PptxSlideShape) : shape)),
      };
    });
    setContent({ ...currentContent, slides });
  };

  const handleHtmlControlUpdate = (newHtml: string) => {
    if (!selectedLayer || selectedLayer.type !== "html") return;
    patchLayer(selectedLayer.shapeIndex, { htmlContent: newHtml });
  };

  const handleSetLiveBackground = (
    fragment: string,
    seed: number,
    customUniforms?: Record<string, number>,
    textureDataUrl?: string,
  ) => {
    const currentDoc = useDocumentEditorStore.getState().document;
    if (!currentDoc) return;
    const currentContent = currentDoc.content as PptxContent;
    const slide = currentContent.slides?.[activeSlideIndex];
    if (!slide) return;

    const existingLayers = (slide.shapes || []).filter(isSupportedLayer);
    const shapeIndex = existingLayers.reduce((max, shape) => Math.max(max, shape.shapeIndex), -1) + 1;
    const shaderShape: PptxShaderShape = {
      type: "shader",
      shapeIndex,
      transform: { x: 0, y: 0, cx: dims.width, cy: dims.height },
      fragment,
      seed,
      customUniforms,
      textureDataUrl,
    };

    const slides = currentContent.slides.map((item, index) =>
      index === activeSlideIndex
        ? { ...item, shapes: [...existingLayers, shaderShape] }
        : item,
    );

    setContent({ ...currentContent, slides });
    selectShape(activeSlideIndex, shapeIndex);
  };

  const moveLayer = (shapeIndex: number, direction: "up" | "down") => {
    const currentDoc = useDocumentEditorStore.getState().document;
    if (!currentDoc) return;
    const currentContent = currentDoc.content as PptxContent;
    const slide = currentContent.slides?.[activeSlideIndex];
    if (!slide) return;
    const shapes = (slide.shapes || []).filter(isSupportedLayer);
    const from = shapes.findIndex((shape) => shape.shapeIndex === shapeIndex);
    if (from === -1) return;
    const to = direction === "up" ? Math.min(from + 1, shapes.length - 1) : Math.max(from - 1, 0);
    if (from === to) return;
    const [moved] = shapes.splice(from, 1);
    shapes.splice(to, 0, moved);
    const slides = currentContent.slides.map((item, index) =>
      index === activeSlideIndex ? { ...item, shapes } : item,
    );
    setContent({ ...currentContent, slides });
  };

  const updateSlideField = (updates: Partial<typeof activeSlide>) => {
    const currentDoc = useDocumentEditorStore.getState().document;
    if (!currentDoc) return;
    const currentContent = currentDoc.content as PptxContent;
    const slides = currentContent.slides.map((slide, index) =>
      index === activeSlideIndex ? { ...slide, ...updates } : slide,
    );
    setContent({ ...currentContent, slides });
  };

  return (
    <div className="w-[240px] shrink-0 py-3 pr-3 h-full min-h-0">
      <div className="h-full rounded-lg bg-card shadow-sm flex flex-col text-[11px] text-foreground/70 overflow-y-auto">
        <div className="px-4 pt-3 pb-2 border-b border-border/30">
          <span className="text-[11px] font-semibold text-foreground">Slide</span>
        </div>

        <div className="px-3 py-2.5 border-b border-gray-100 space-y-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            AI Style
          </span>
          <select
            className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-blue-300"
            value={designStyle}
            onChange={(e) => onDesignStyleChange(e.target.value)}
            title="Applied to future AI-generated HTML slides"
          >
            {DESIGN_STYLES.map((style) => (
              <option key={style.key} value={style.key}>
                {style.label}
              </option>
            ))}
          </select>
          <select
            className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-blue-300"
            value={fontPair}
            onChange={(e) => onFontPairChange(e.target.value)}
            title="Locks fonts for AI-generated HTML slides"
          >
            {FONT_PAIRS.map((pair) => (
              <option key={pair.key} value={pair.key}>
                {pair.label}
              </option>
            ))}
          </select>
        </div>

        <div className="px-3 py-2.5 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setEffectsDialogOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Add shader
          </button>
        </div>

        {selectedLayer?.type === "html" && (
          <HtmlControlsPanel htmlContent={selectedLayer.htmlContent} onUpdate={handleHtmlControlUpdate} />
        )}

        <div className="px-3 py-2.5 border-b border-gray-100 space-y-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Transition
          </span>
          <select
            className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px]"
            value={activeSlide.transition?.type || "none"}
            onChange={(e) => {
              const type = e.target.value as SlideTransitionType;
              updateSlideField({
                transition: type === "none" ? undefined : { type, durationMs: 500 },
              });
            }}
          >
            {TRANSITION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "none" ? "None" : type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              HTML / Shader Layers
            </span>
          </div>
          {supportedLayers.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Sparkles className="mx-auto mb-2 h-4 w-4 text-gray-300" />
              <p className="text-[11px] leading-relaxed text-gray-400">
                Ask the assistant to generate this slide, or add a shader background.
              </p>
            </div>
          ) : (
            <div>
              {[...supportedLayers].reverse().map((shape) => {
                const isSelected = selectedLayer?.shapeIndex === shape.shapeIndex;
                const isHidden = !!shape.hidden;
                const arrayIndex = supportedLayers.findIndex((item) => item.shapeIndex === shape.shapeIndex);
                return (
                  <div
                    key={shape.shapeIndex}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors group border-b border-gray-50",
                      isSelected ? "bg-blue-50/70 text-blue-700" : "hover:bg-gray-50 text-gray-600",
                      isHidden && "opacity-40",
                    )}
                    onClick={() => selectShape(activeSlideIndex, shape.shapeIndex)}
                  >
                    {shape.type === "html" ? (
                      <Code2 className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-blue-500" : "text-gray-400")} />
                    ) : (
                      <Wand2 className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-blue-500" : "text-gray-400")} />
                    )}
                    <span className="text-[11px] truncate flex-1">{getLayerLabel(shape)}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleShapeVisibility(activeSlideIndex, shape.shapeIndex);
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-opacity"
                      title={isHidden ? "Show layer" : "Hide layer"}
                    >
                      {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      disabled={arrayIndex >= supportedLayers.length - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveLayer(shape.shapeIndex, "up");
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 disabled:opacity-20 transition-opacity"
                      title="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={arrayIndex <= 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveLayer(shape.shapeIndex, "down");
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 disabled:opacity-20 transition-opacity"
                      title="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-gray-100">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
            Notes
          </span>
          <textarea
            placeholder="Speaker notes..."
            value={activeSlide.notes || ""}
            onChange={(e) => updateSlideField({ notes: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-600 resize-none focus:outline-none focus:border-blue-300 placeholder:text-gray-400"
            rows={3}
          />
        </div>

        <EffectsDialog
          open={effectsDialogOpen}
          onOpenChange={setEffectsDialogOpen}
          onSetLiveBackground={handleSetLiveBackground}
          slideAspect={dims.width / dims.height}
        />
      </div>
    </div>
  );
}
