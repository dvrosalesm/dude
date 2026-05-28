"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import {
  Brush,
  Eraser,
  ImageMinus,
  Loader2,
  Maximize2,
  Scissors,
  Send,
  Sparkles,
} from "lucide-react";
import { useDesignBrandingStore } from "@dude/subagent-design-branding/store";
import { callWorkspaceAction } from "@dude/workspaces";
import {
  Section,
  NumberRow,
  SliderRow,
  SelectRow,
  ColorRow,
} from "./design-sidebar-controls";

type ImageEditModelId = "gemini-3-pro-image-preview" | "gpt-image-2";
type BackgroundRemovalMode = "transparent" | "color";
type ResizeMode = "crop" | "regenerate";
type EditPreset = "remove-background" | "rescale" | "restyle" | "split-image";

const IMAGE_OPERATIONS: Array<{
  id: EditPreset;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "restyle",
    label: "Reimagine",
    description: "Change the image or its visual direction.",
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  {
    id: "remove-background",
    label: "Remove background",
    description: "Create a cutout or replace the backdrop.",
    icon: <ImageMinus className="h-3.5 w-3.5" />,
  },
  {
    id: "rescale",
    label: "Resize / extend",
    description: "Change dimensions and choose cut or regenerate.",
    icon: <Maximize2 className="h-3.5 w-3.5" />,
  },
  {
    id: "split-image",
    label: "Split image",
    description: "Isolate separate visual components.",
    icon: <Scissors className="h-3.5 w-3.5" />,
  },
];

const IMAGE_EDIT_MODELS: Array<{
  id: ImageEditModelId;
  label: string;
}> = [
  { id: "gemini-3-pro-image-preview", label: "Gemini 3 Pro Image" },
  { id: "gpt-image-2", label: "GPT Image 2" },
];

const SPLIT_COMPONENTS = [
  "the primary foreground subject or largest distinct object",
  "the second most prominent distinct object, subject, or natural element",
  "the third most prominent distinct object, subject, or background element",
  "the fourth most prominent distinct object, subject, or separable visual element",
];

type ImageNodeData = {
  url?: string;
  alt?: string;
  maskImage?: string;
  maskTool?: "brush" | "erase" | null;
  maskBrushSize?: number;
  maskClearToken?: number;
};

type ComponentEnumerationResponse = {
  components?: string[];
};

export function ImageOperationsSection({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const data = (node.data || {}) as ImageNodeData;
  const imageUrl = data.url ?? "";
  const maskTool = data.maskTool ?? null;
  const maskBrushSize = data.maskBrushSize ?? 44;
  const hasMask = Boolean(data.maskImage);
  const workspaceId = useDesignBrandingStore((s) => s.workspaceId);
  const { addNodes, setNodes } = useReactFlow();
  const [operation, setOperation] = useState<EditPreset>("restyle");
  const [modelId, setModelId] = useState<ImageEditModelId>("gemini-3-pro-image-preview");
  const [prompt, setPrompt] = useState("");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundRemovalMode>("transparent");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [resizeMode, setResizeMode] = useState<ResizeMode>("regenerate");
  const [targetW, setTargetW] = useState(Math.round(node.width ?? 1024));
  const [targetH, setTargetH] = useState(Math.round(node.height ?? 1024));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTargetW(Math.round(node.width ?? 1024));
    setTargetH(Math.round(node.height ?? 1024));
    setPrompt("");
    setError(null);
  }, [node.id, node.width, node.height]);

  const canGenerate = Boolean(
    imageUrl &&
      workspaceId &&
      !generating &&
      (operation !== "restyle" || prompt.trim().length > 0),
  );

  async function runEditJob(editPrompt: string): Promise<string> {
    if (!workspaceId) throw new Error("Workspace not loaded");
    const transparentOutput =
      operation === "split-image" ||
      (operation === "remove-background" && backgroundMode === "transparent");
    const result = (await callWorkspaceAction("design-branding", workspaceId, "edit-image", {
      method: "POST",
      body: {
        imageUrl,
        prompt: editPrompt,
        maskImage: operation === "restyle" ? data.maskImage : undefined,
        targetWidth: operation === "rescale" ? targetW : undefined,
        targetHeight: operation === "rescale" ? targetH : undefined,
        resizeMode: operation === "rescale" ? resizeMode : undefined,
        modelId,
        outputBackground: transparentOutput ? "transparent" : undefined,
        outputFormat: transparentOutput ? "png" : undefined,
      },
    })) as { imageUrl?: string };
    if (!result.imageUrl) throw new Error("No image returned from edit job");
    return result.imageUrl;
  }

  function buildPrompt(extra?: string) {
    const lines: string[] = [];
    if (operation === "remove-background") {
      lines.push("Remove the background cleanly while preserving subject edges and natural detail.");
      lines.push(
        backgroundMode === "transparent"
          ? "Output as a transparent-background PNG cutout."
          : `Replace the removed background with a clean solid ${backgroundColor} background.`,
      );
    } else if (operation === "rescale") {
      lines.push(
        resizeMode === "crop"
          ? "Crop/cut the image to the requested output dimensions. Do not invent new content."
          : "Regenerate and adapt the image to the requested output dimensions, extending content naturally as needed.",
      );
      lines.push(`Output exactly ${targetW}x${targetH}px.`);
    } else if (operation === "split-image") {
      lines.push("Split the image into isolated visual components as independent clean assets.");
    } else {
      lines.push("Reimagine the image while keeping the composition professionally useful for graphic design.");
    }
    if (prompt.trim()) lines.push(prompt.trim());
    if (extra) lines.push(extra);
    return lines.join("\n");
  }

  async function enumerateSplitComponents() {
    if (!workspaceId) return SPLIT_COMPONENTS;
    try {
      const data = (await callWorkspaceAction("design-branding", workspaceId, "edit-image", {
        method: "POST",
        body: {
          operation: "enumerate-components",
          imageUrl,
          prompt: buildPrompt(),
        },
      })) as ComponentEnumerationResponse;
      const components = Array.isArray(data.components)
        ? data.components.filter((item) => item.trim().length > 0).slice(0, 10)
        : [];
      return components.length >= 2 ? components : SPLIT_COMPONENTS;
    } catch {
      return SPLIT_COMPONENTS;
    }
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      if (operation === "split-image") {
        const components = await enumerateSplitComponents();
        const splitWidth = Math.min(320, Math.max(180, (node.width ?? 320) * 0.48));
        const splitHeight = Math.min(320, Math.max(160, (node.height ?? 240) * 0.48));
        const columns = components.length <= 4 ? 2 : components.length <= 6 ? 3 : 4;
        const placeholders = components.map((component, index) => ({
          id: crypto.randomUUID(),
          component,
          position: {
            x: node.position.x + (node.width ?? 320) + 60 + (index % columns) * (splitWidth + 24),
            y: node.position.y + Math.floor(index / columns) * (splitHeight + 24),
          },
        }));

        addNodes(
          placeholders.map((placeholder, index) => ({
            id: placeholder.id,
            type: "image",
            position: placeholder.position,
            data: { pending: true, alt: `Split image ${index + 1}` },
            width: splitWidth,
            height: splitHeight,
          })),
        );

        await Promise.all(placeholders.map(async (placeholder, index) => {
          try {
            const resultUrl = await runEditJob(
              buildPrompt(`Extraction ${index + 1} of ${components.length}: isolate ${placeholder.component}. Remove every other object and background element. Do not add labels, frames, shadows, text, or a collage.`),
            );
            setNodes((nds) =>
              nds.map((n) =>
                n.id === placeholder.id
                  ? { ...n, data: { ...n.data, pending: false, url: resultUrl, alt: `Split image ${index + 1}` } }
                  : n,
              ),
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Could not split image";
            setNodes((nds) =>
              nds.map((n) =>
                n.id === placeholder.id
                  ? { ...n, data: { ...n.data, pending: false, error: message } }
                  : n,
              ),
            );
          }
        }));
        return;
      }

      const placeholderId = crypto.randomUUID();
      const width = operation === "rescale" ? Math.min(520, Math.max(180, targetW)) : node.width ?? 320;
      const height = operation === "rescale" ? Math.min(520, Math.max(180, targetH)) : node.height ?? 240;
      addNodes({
        id: placeholderId,
        type: "image",
        position: { x: node.position.x + (node.width ?? 320) + 60, y: node.position.y },
        data: { pending: true, alt: prompt || IMAGE_OPERATIONS.find((item) => item.id === operation)?.label },
        width,
        height,
      });
      const resultUrl = await runEditJob(buildPrompt());
      setNodes((nds) =>
        nds.map((n) =>
          n.id === placeholderId
            ? { ...n, data: { ...n.data, pending: false, url: resultUrl, alt: prompt || "Generated image" } }
            : n,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Section title="Operation">
        <div className="grid gap-1.5">
          {IMAGE_OPERATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOperation(item.id)}
              className={`flex w-full min-w-0 items-start gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors ${
                operation === item.id
                  ? "border-border bg-muted text-foreground shadow-sm"
                  : "border-border/60 bg-background text-foreground hover:bg-muted"
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground ${
                operation === item.id ? "bg-background" : "bg-muted"
              }`}>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block truncate text-xs font-semibold">{item.label}</span>
                <span className="line-clamp-2 block text-[10px] leading-3 opacity-70">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Model">
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border/60 bg-background">
          {IMAGE_EDIT_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setModelId(model.id)}
              className={`h-9 min-w-0 px-2 text-xs font-medium transition-colors ${
                modelId === model.id
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${model.id === "gemini-3-pro-image-preview" ? "border-r border-border/60" : ""}`}
            >
              <span className="block truncate">{model.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {operation === "restyle" && (
        <Section title="Mask">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border/60 bg-background">
            <button
              type="button"
              onClick={() => onUpdateNodeData(node.id, { maskTool: maskTool === "brush" ? null : "brush", maskBrushSize })}
              className={`inline-flex h-9 items-center justify-center gap-1.5 border-r border-border/60 text-xs font-medium transition-colors ${
                maskTool === "brush"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Brush className="h-3.5 w-3.5" />
              Brush
            </button>
            <button
              type="button"
              onClick={() => onUpdateNodeData(node.id, { maskTool: maskTool === "erase" ? null : "erase", maskBrushSize })}
              className={`inline-flex h-9 items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                maskTool === "erase"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              Erase
            </button>
          </div>
          <SliderRow
            label="Brush size"
            value={maskBrushSize}
            min={4}
            max={160}
            unit="px"
            onChange={(value) => onUpdateNodeData(node.id, { maskBrushSize: value })}
          />
          <button
            type="button"
            onClick={() => onUpdateNodeData(node.id, { maskImage: undefined, maskTool: null, maskClearToken: Date.now() })}
            disabled={!hasMask}
            className="h-8 w-full rounded-md border border-border/60 bg-background text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            Clear mask
          </button>
        </Section>
      )}

      {operation === "remove-background" && (
        <Section title="Background">
          <SelectRow
            label="Output"
            value={backgroundMode}
            options={[
              { value: "transparent", label: "Transparent PNG" },
              { value: "color", label: "Solid color" },
            ]}
            onChange={(value) => setBackgroundMode(value === "color" ? "color" : "transparent")}
          />
          {backgroundMode === "color" && (
            <ColorRow label="Color" value={backgroundColor} onChange={setBackgroundColor} />
          )}
        </Section>
      )}

      {operation === "rescale" && (
        <Section title="Resize">
          <SelectRow
            label="Mode"
            value={resizeMode}
            options={[
              { value: "regenerate", label: "Regenerate" },
              { value: "crop", label: "Cut / crop" },
            ]}
            onChange={(value) => setResizeMode(value === "crop" ? "crop" : "regenerate")}
          />
          <NumberRow label="W" value={targetW} min={64} onChange={setTargetW} />
          <NumberRow label="H" value={targetH} min={64} onChange={setTargetH} />
        </Section>
      )}

      <Section title="Prompt">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            operation === "split-image"
              ? "Optional: what should be isolated..."
              : operation === "rescale"
                ? "Optional: how to reframe or extend..."
                : "Describe the result..."
          }
          className="min-h-24 w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-xs outline-none focus:border-foreground"
          disabled={generating}
        />
        {error && <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{error}</div>}
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {generating ? "Generating..." : "Generate"}
        </button>
      </Section>
    </>
  );
}
