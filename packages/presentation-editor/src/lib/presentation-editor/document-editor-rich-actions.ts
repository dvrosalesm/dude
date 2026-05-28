"use client";

import { uploadPresentationImage } from "@dude/workspaces";
import { getContent, commitContent, recordDocumentChange } from "./document-editor-mutation";
import { getEditorDocument } from "./document-editor-store-bridge";
import type { ApplyEditResult } from "./document-editor-types";
import type {
  PptxContent,
  PptxHtmlShape,
  PptxTextShape,
  PptxImageShape,
  PptxTableShape,
  PptxTableCell,
  PptxSlideShape,
  Slide,
  SlideTransition,
  SlideTransitionType,
} from "@dude/presentation-editor/types";
import {
  deriveSlideContent,
  escapeHtml,
  findShape,
  nextShapeIndex,
  plainTextToHtml,
  replaceAllCaseInsensitive,
  stripHtmlText,
  updateSlide,
} from "./pptx-slide-helpers";

export function addPptxTable(
  slideIndex: number,
  table: { headers: string[]; rows: string[][]; style?: PptxTableStyle },
  position?: { x: number; y: number; cx: number; cy: number },
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const transform = position
    ? { x: position.x, y: position.y, cx: position.cx, cy: position.cy }
    : { x: 457200, y: 1524000, cx: 8229600, cy: 3048000 };

  const style = table.style;
  const headers: PptxTableCell[] = table.headers.map((h) => ({
    text: h,
    bold: true,
    bgColor: style?.headerBgColor ? `#${style.headerBgColor.replace(/^#/, "")}` : undefined,
    color: style?.headerTextColor ? `#${style.headerTextColor.replace(/^#/, "")}` : undefined,
    fontSize: style?.fontSize ? style.fontSize * 100 : undefined,
  }));
  const rows: PptxTableCell[][] = table.rows.map((row) =>
    row.map((cell) => ({
      text: cell,
      fontSize: style?.fontSize ? style.fontSize * 100 : undefined,
    })),
  );

  const newShape: PptxTableShape = {
    type: "table",
    transform,
    headers,
    rows,
    shapeIndex: nextShapeIndex(slide),
  };

  const slides = updateSlide(c.slides, slideIndex, (s) => ({
    ...s,
    shapes: [...(s.shapes || []), newShape],
  }));

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "insert",
    oldValue: null,
    newValue: `table (${table.headers.length} cols, ${table.rows.length} rows)`,
  });

  return { success: true, message: `Added table with ${table.headers.length} columns and ${table.rows.length} rows to slide ${slideIndex + 1}.` };
}

export function updatePptxTable(
  slideIndex: number,
  shapeIndex: number,
  table: { headers: string[]; rows: string[][]; style?: PptxTableStyle },
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found || found.shape.type !== "table") return { success: false, error: "Table shape not found." };

  const style = table.style;
  const headers: PptxTableCell[] = table.headers.map((h) => ({
    text: h,
    bold: true,
    bgColor: style?.headerBgColor ? `#${style.headerBgColor.replace(/^#/, "")}` : undefined,
    color: style?.headerTextColor ? `#${style.headerTextColor.replace(/^#/, "")}` : undefined,
  }));
  const rows: PptxTableCell[][] = table.rows.map((row) =>
    row.map((cell) => ({ text: cell })),
  );

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = { ...found.shape, headers, rows } as PptxTableShape;
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `table (${table.headers.length} cols, ${table.rows.length} rows)`,
  });

  return { success: true, message: `Updated table on slide ${slideIndex + 1}.` };
}

// ==================== Image Operations (async — local upload) ====================

async function uploadImageLocally(imageUrl: string): Promise<string> {
  const result = await uploadPresentationImage({ imageUrl });
  return result.url;
}

async function uploadBase64Locally(base64: string, contentType: string): Promise<string> {
  const result = await uploadPresentationImage({ base64, contentType });
  return result.url;
}

export async function addPptxImage(
  slideIndex: number,
  imageUrl: string,
  position?: { x: number; y: number; cx: number; cy: number },
  altText?: string,
): Promise<ApplyEditResult> {
  void altText;
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  try {
    const storedUrl = await uploadImageLocally(imageUrl);

    const transform = position
      ? { x: position.x, y: position.y, cx: position.cx, cy: position.cy }
      : { x: 1524000, y: 1524000, cx: 6096000, cy: 4572000 };

    const newShape: PptxImageShape = {
      type: "image",
      transform,
      data: storedUrl,
      shapeIndex: nextShapeIndex(slide),
    };

    const freshC = getContent();
    if (!freshC) return { success: false, error: "Document unloaded." };

    const slides = updateSlide(freshC.slides, slideIndex, (s) => ({
      ...s,
      shapes: [...(s.shapes || []), newShape],
    }));

    commitContent({ ...freshC, slides });
    recordDocumentChange({
      path: `pptx.slides.${slideIndex}`,
      type: "insert",
      oldValue: null,
      newValue: `image from ${imageUrl}`,
    });

    return { success: true, message: `Added image to slide ${slideIndex + 1}.` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add image" };
  }
}

export async function pasteImageToPptx(
  slideIndex: number,
  imageBase64: string,
  contentType: string,
  position?: { x: number; y: number; cx: number; cy: number },
): Promise<ApplyEditResult> {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const estimatedSize = Math.floor((imageBase64.length * 3) / 4);
  if (estimatedSize > 5 * 1024 * 1024) {
    return { success: false, error: "Image too large (max 5MB)." };
  }

  try {
    const storedUrl = await uploadBase64Locally(imageBase64, contentType);

    let transform: { x: number; y: number; cx: number; cy: number };
    if (position) {
      transform = { x: position.x, y: position.y, cx: position.cx, cy: position.cy };
    } else {
      // Load image to get natural dimensions and fit within the slide
      const dims = c.slideDimensions || { width: 12192000, height: 6858000 };
      let imgCx = dims.width * 0.5;
      let imgCy = dims.height * 0.5;
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = `data:${contentType};base64,${imageBase64}`;
        });
        const EMU_PER_PX = 9525;
        const natCx = img.naturalWidth * EMU_PER_PX;
        const natCy = img.naturalHeight * EMU_PER_PX;
        const maxCx = dims.width * 0.9;
        const maxCy = dims.height * 0.9;
        const scale = Math.min(1, maxCx / natCx, maxCy / natCy);
        imgCx = Math.round(natCx * scale);
        imgCy = Math.round(natCy * scale);
      } catch { /* fallback to 50% of slide */ }
      transform = {
        x: Math.round((dims.width - imgCx) / 2),
        y: Math.round((dims.height - imgCy) / 2),
        cx: imgCx,
        cy: imgCy,
      };
    }

    const newShape: PptxImageShape = {
      type: "image",
      transform,
      data: storedUrl,
      shapeIndex: nextShapeIndex(slide),
    };

    const freshC = getContent();
    if (!freshC) return { success: false, error: "Document unloaded." };

    const slides = updateSlide(freshC.slides, slideIndex, (s) => ({
      ...s,
      shapes: [...(s.shapes || []), newShape],
    }));

    commitContent({ ...freshC, slides });
    recordDocumentChange({
      path: `pptx.slides.${slideIndex}`,
      type: "insert",
      oldValue: null,
      newValue: "pasted image",
    });

    return { success: true, message: `Pasted image to slide ${slideIndex + 1}.` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to paste image" };
  }
}

// ==================== Chart (rendered as HTML shape) ====================

export type PptxChartData = {
  chartType: "bar" | "line" | "pie" | "donut" | "area" | "scatter";
  title?: string;
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string | string[];
  colors?: string[];
};

export function addPptxChart(
  slideIndex: number,
  chart: PptxChartData,
  position?: { x: number; y: number; cx: number; cy: number },
): ApplyEditResult {
  // Render chart as an HTML shape (canvas-based chart rendered in iframe)
  const yKeys = Array.isArray(chart.yKey) ? chart.yKey : [chart.yKey];
  const colors = chart.colors || ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"];
  const dataJson = JSON.stringify(chart.data);
  const xKey = chart.xKey;
  const title = chart.title || "";

  const htmlContent = `<!DOCTYPE html><html><head><style>
body{margin:0;font-family:Arial,sans-serif;background:transparent;display:flex;align-items:center;justify-content:center;height:100vh}
canvas{max-width:95%;max-height:90%}
.title{position:absolute;top:8px;left:0;right:0;text-align:center;font-size:14px;font-weight:bold;color:#333}
</style></head><body>
${title ? `<div class="title">${title}</div>` : ""}
<canvas id="c"></canvas>
<script>
const data=${dataJson};
const xKey="${xKey}";
const yKeys=${JSON.stringify(yKeys)};
const colors=${JSON.stringify(colors)};
const type="${chart.chartType}";
const c=document.getElementById("c");
const ctx=c.getContext("2d");
c.width=600;c.height=400;
const labels=data.map(d=>String(d[xKey]));
const pad={t:${title ? 40 : 20},r:20,b:40,l:50};
const w=c.width-pad.l-pad.r,h=c.height-pad.t-pad.b;
let allVals=[];
yKeys.forEach(k=>data.forEach(d=>{const v=Number(d[k]);if(!isNaN(v))allVals.push(v)}));
const maxVal=Math.max(...allVals,1)*1.1;
ctx.strokeStyle="#ddd";ctx.lineWidth=1;
for(let i=0;i<=4;i++){const y=pad.t+h-h*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();ctx.fillStyle="#666";ctx.font="10px Arial";ctx.textAlign="right";ctx.fillText((maxVal*i/4).toFixed(0),pad.l-5,y+3)}
if(type==="bar"){const gw=w/labels.length;const bw=gw*0.7/yKeys.length;labels.forEach((l,i)=>{yKeys.forEach((k,ki)=>{const v=Number(data[i][k])||0;const bh=h*(v/maxVal);ctx.fillStyle=colors[ki%colors.length];ctx.fillRect(pad.l+i*gw+ki*bw+(gw*0.15),pad.t+h-bh,bw,bh)});ctx.fillStyle="#666";ctx.font="9px Arial";ctx.textAlign="center";ctx.fillText(l.length>8?l.slice(0,8)+"..":l,pad.l+i*gw+gw/2,pad.t+h+15)})}
else if(type==="line"||type==="area"){yKeys.forEach((k,ki)=>{ctx.beginPath();ctx.strokeStyle=colors[ki%colors.length];ctx.lineWidth=2;const pts=data.map((d,i)=>[pad.l+i*(w/(labels.length-1||1)),pad.t+h-h*(Number(d[k])||0)/maxVal]);pts.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));ctx.stroke();if(type==="area"){ctx.lineTo(pts[pts.length-1][0],pad.t+h);ctx.lineTo(pts[0][0],pad.t+h);ctx.closePath();ctx.fillStyle=colors[ki%colors.length]+"33";ctx.fill()}});labels.forEach((l,i)=>{ctx.fillStyle="#666";ctx.font="9px Arial";ctx.textAlign="center";ctx.fillText(l.length>8?l.slice(0,8)+"..":l,pad.l+i*(w/(labels.length-1||1)),pad.t+h+15)})}
else if(type==="pie"||type==="donut"){const vals=data.map(d=>Number(d[yKeys[0]])||0);const total=vals.reduce((a,b)=>a+b,0)||1;let angle=-Math.PI/2;const cx=c.width/2,cy=pad.t+h/2,r=Math.min(w,h)/2.5;vals.forEach((v,i)=>{const slice=2*Math.PI*(v/total);ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+slice);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();angle+=slice});if(type==="donut"){ctx.beginPath();ctx.arc(cx,cy,r*0.5,0,2*Math.PI);ctx.fillStyle="#fff";ctx.fill()}}
else if(type==="scatter"){yKeys.forEach((k,ki)=>{ctx.fillStyle=colors[ki%colors.length];data.forEach(d=>{const x=pad.l+w*((Number(d[xKey])||0)/maxVal);const y=pad.t+h-h*((Number(d[k])||0)/maxVal);ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill()})})}
</script></body></html>`;

  return addHtmlContentToSlide(slideIndex, htmlContent, `${chart.chartType} chart${chart.title ? `: ${chart.title}` : ""}`, position);
}

// ==================== HTML Content (Client-Only) ====================

export function addHtmlContentToSlide(
  slideIndex: number,
  htmlContent: string,
  label?: string,
  position?: { x: number; y: number; cx: number; cy: number },
): ApplyEditResult {
  const doc = getEditorDocument();
  if (!doc) return { success: false, error: "No document loaded." };
  const content = doc.content as PptxContent;
  const slide = content.slides?.[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const dims = content.slideDimensions || { width: 12192000, height: 6858000 };
  const transform = position
    ? { x: position.x, y: position.y, cx: position.cx, cy: position.cy }
    : { x: 0, y: 0, cx: dims.width, cy: dims.height };

  // HTML/shader-only editor: replace existing HTML and discard legacy primitive layers.
  const baseShapes = (slide.shapes || []).filter((s) => s.type === "shader");
  const shapeIndex = nextShapeIndex({ ...slide, shapes: baseShapes });

  const htmlShape: PptxHtmlShape = {
    type: "html",
    transform,
    shapeIndex,
    htmlContent,
    label,
  };
  const updatedSlides = content.slides.map((s, i) =>
    i === slideIndex
      ? { ...s, shapes: [...baseShapes, htmlShape] }
      : s,
  );

  commitContent({ ...content, slides: updatedSlides });

  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "insert",
    oldValue: null,
    newValue: `HTML content: ${label || "animation"}`,
  });

  return { success: true, message: `Added HTML content to slide ${slideIndex + 1}.` };
}

// ==================== Slide Transitions (Client-Only) ====================

const VALID_TRANSITIONS = new Set<SlideTransitionType>([
  "none", "fade", "slide-left", "slide-right", "slide-up", "slide-down",
  "zoom-in", "zoom-out", "morph", "flip", "rotate", "blur", "bounce",
  "cube", "swirl",
]);

export function setSlideTransition(
  slideIndex: number,
  transition: SlideTransition,
): ApplyEditResult {
  const doc = getEditorDocument();
  if (!doc) return { success: false, error: "No document loaded." };
  const content = doc.content as PptxContent;
  const slide = content.slides?.[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  if (!VALID_TRANSITIONS.has(transition.type)) {
    return { success: false, error: `Invalid transition type: ${transition.type}` };
  }

  const updatedSlides = content.slides.map((s, i) =>
    i === slideIndex ? { ...s, transition } : s,
  );

  commitContent({ ...content, slides: updatedSlides });

  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `transition: ${transition.type}`,
  });

  return { success: true, message: `Set ${transition.type} transition on slide ${slideIndex + 1}.` };
}
