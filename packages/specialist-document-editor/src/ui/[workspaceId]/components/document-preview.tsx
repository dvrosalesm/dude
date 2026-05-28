"use client";

import { useCallback, useEffect } from "react";
import { FileText } from "lucide-react";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import { PptxPreview } from "@dude/presentation-editor/components/pptx-preview";
import { PresentationMode } from "@dude/presentation-editor/components/presentation-mode";
import type { PptxContent, PptxShapeTransform } from "@dude/presentation-editor/types";


function isSupportedLayerType(type: string): type is "html" | "shader" {
  return type === "html" || type === "shader";
}

type DocumentPreviewProps = {
  agentWorking?: boolean;
};

export function DocumentPreview({ agentWorking = false }: DocumentPreviewProps) {
  const document = useDocumentEditorStore((s) => s.document);
  const setPresentationHtml = useDocumentEditorStore((s) => s.setPresentationHtml);
  const showPresentation = useDocumentEditorStore((s) => s.showPresentation);
  const setShowPresentation = useDocumentEditorStore((s) => s.setShowPresentation);

  const editingSlideIndex = useDocumentEditorStore((s) => s.editingSlideIndex);
  const selectedShapeId = useDocumentEditorStore((s) => s.selectedShapeId);
  const localShapeOverrides = useDocumentEditorStore((s) => s.localShapeOverrides);
  const enterSlideEditMode = useDocumentEditorStore((s) => s.enterSlideEditMode);
  const selectShape = useDocumentEditorStore((s) => s.selectShape);
  const clearShapeSelection = useDocumentEditorStore((s) => s.clearShapeSelection);
  const setLocalShapeTransform = useDocumentEditorStore((s) => s.setLocalShapeTransform);
  const clearLocalShapeOverrides = useDocumentEditorStore((s) => s.clearLocalShapeOverrides);
  const setContent = useDocumentEditorStore((s) => s.setContent);

  // Auto-enter edit mode on first slide when document loads
  useEffect(() => {
    if (document && editingSlideIndex === null) {
      const slides = (document.content as PptxContent)?.slides;
      if (slides?.length) {
        enterSlideEditMode(0);
      }
    }
  }, [document, editingSlideIndex, enterSlideEditMode]);

  const handleShapeDragEnd = useCallback(
    (slideIndex: number, shapeIndex: number, transform: PptxShapeTransform) => {
      const doc = useDocumentEditorStore.getState().document;
      if (!doc) return;
      const content = doc.content as PptxContent;
      const slides = content.slides.map((slide, si) => {
        if (si !== slideIndex) return slide;
        return {
          ...slide,
          shapes: (slide.shapes || [])
            .filter((shape) => isSupportedLayerType(shape.type))
            .map((shape) => (shape.shapeIndex === shapeIndex ? { ...shape, transform } : shape)),
        };
      });
      setContent({ ...content, slides });
      clearLocalShapeOverrides();
    },
    [clearLocalShapeOverrides, setContent],
  );

  const handleLocalDrag = useCallback(
    (slideIndex: number, shapeIndex: number, transform: PptxShapeTransform) => {
      setLocalShapeTransform(slideIndex, shapeIndex, transform);
    },
    [setLocalShapeTransform],
  );

  const handleDeleteShape = useCallback(
    (slideIndex: number, shapeIndex: number) => {
      clearShapeSelection();
      const doc = useDocumentEditorStore.getState().document;
      if (!doc) return;
      const content = doc.content as PptxContent;
      const slides = content.slides.map((slide, si) => {
        if (si !== slideIndex) return slide;
        return {
          ...slide,
          shapes: (slide.shapes || [])
            .filter((shape) => isSupportedLayerType(shape.type))
            .filter((shape) => shape.shapeIndex !== shapeIndex),
        };
      });
      setContent({ ...content, slides });
    },
    [clearShapeSelection, setContent],
  );

  const handleDuplicateShape = useCallback(
    (slideIndex: number, shapeIndex: number) => {
      const doc = useDocumentEditorStore.getState().document;
      if (!doc) return;
      const content = doc.content as PptxContent;
      const slide = content.slides?.[slideIndex];
      const supportedShapes = (slide?.shapes || []).filter((shape) => isSupportedLayerType(shape.type));
      if (!supportedShapes.length) return;
      const shape = supportedShapes.find((s) => s.shapeIndex === shapeIndex);
      if (!shape) return;
      const maxIdx = supportedShapes.reduce((max, s) => Math.max(max, s.shapeIndex), -1);
      const duplicate = {
        ...JSON.parse(JSON.stringify(shape)),
        shapeIndex: maxIdx + 1,
      };
      const slides = content.slides.map((s, si) =>
        si === slideIndex ? { ...s, shapes: [...supportedShapes, duplicate] } : s,
      );
      setContent({ ...content, slides });
      selectShape(slideIndex, duplicate.shapeIndex);
    },
    [setContent, selectShape],
  );

  const undo = useDocumentEditorStore((s) => s.undo);
  const redo = useDocumentEditorStore((s) => s.redo);

  const handleHtmlUpdate = useCallback(
    (slideIndex: number, shapeIndex: number, htmlContent: string) => {
      const doc = useDocumentEditorStore.getState().document;
      if (!doc) return;
      const content = doc.content as PptxContent;
      const slides = content.slides.map((slide, si) => {
        if (si !== slideIndex) return slide;
        return {
          ...slide,
          shapes: (slide.shapes || []).filter((shape) => isSupportedLayerType(shape.type)).map((s) => {
            if (s.shapeIndex !== shapeIndex || s.type !== "html") return s;
            return { ...s, htmlContent } as typeof s;
          }),
        };
      });
      setContent({ ...content, slides });
    },
    [setContent],
  );

  const handleReorderShape = useCallback(
    (slideIndex: number, fromIdx: number, toIdx: number) => {
      const doc = useDocumentEditorStore.getState().document;
      if (!doc) return;
      const content = doc.content as PptxContent;
      const slide = content.slides?.[slideIndex];
      const shapes = (slide?.shapes || []).filter((shape) => isSupportedLayerType(shape.type));
      if (!shapes.length) return;
      if (fromIdx < 0 || fromIdx >= shapes.length || toIdx < 0 || toIdx >= shapes.length) return;
      const [moved] = shapes.splice(fromIdx, 1);
      shapes.splice(toIdx, 0, moved);
      const slides = content.slides.map((s, i) => i === slideIndex ? { ...s, shapes } : s);
      setContent({ ...content, slides });
    },
    [setContent],
  );

  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground pb-24">
        <FileText className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-sm">{"No document loaded"}</p>
      </div>
    );
  }

  const currentSlideIndex = editingSlideIndex ?? 0;

  return (
    <div className="flex-1 min-h-0 relative">
      <PptxPreview
        agentWorking={!!agentWorking}
        content={document.content as PptxContent}
        className="h-full"
        editingSlideIndex={currentSlideIndex}
        selectedShapeId={selectedShapeId}
        localShapeOverrides={localShapeOverrides}
        onShapeSelect={selectShape}
        onClearShapeSelection={clearShapeSelection}
        onShapeDragEnd={handleShapeDragEnd}
        onLocalDrag={handleLocalDrag}
        onDeleteShape={handleDeleteShape}
        onReorderShape={handleReorderShape}
        onHtmlUpdate={handleHtmlUpdate}
        onHtmlReady={(html) => setPresentationHtml(html)}
        onDuplicateShape={handleDuplicateShape}
        onUndo={undo}
        onRedo={redo}
      />

      {showPresentation && (() => {
        const content = document.content as PptxContent;
        const slides = content.slides || [];
        if (slides.length === 0) return null;
        return (
          <PresentationMode
            slides={slides}
            onClose={() => setShowPresentation(false)}
            startSlide={currentSlideIndex}
            slideDimensions={content.slideDimensions}
          />
        );
      })()}
    </div>
  );
}
