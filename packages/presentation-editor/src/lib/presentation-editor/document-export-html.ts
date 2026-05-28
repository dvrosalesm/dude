/**
 * Build a self-contained HTML file from a presentation for export.
 * Each slide becomes a full-viewport section with keyboard/click navigation.
 */

import type { DocumentState, PptxContent, PptxHtmlShape, Slide } from "@dude/presentation-editor/types";
import { baseExportName, downloadBlob } from "./document-export-raster";

const REFERENCE_WIDTH = 960;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderSlideHtml(slide: Slide, dims: { width: number; height: number }, index: number): string {
  const shapes = (slide.shapes || []).filter((shape) => shape.type === "html" || shape.type === "shader");
  const bg = slide.background || "#000000";

  // Check for an HTML shape — if present, use it as the full slide content
  const htmlShape = shapes.find((s): s is PptxHtmlShape => s.type === "html");
  const htmlSrc = htmlShape?.htmlContent ?? null;
  if (htmlSrc) {
    return `<section class="slide" data-index="${index}" style="background:${bg}">
      <div class="slide-frame" style="background:${bg}">
        <iframe srcdoc="${escapeHtml(htmlSrc)}" class="slide-iframe" sandbox="allow-scripts"></iframe>
      </div>
    </section>`;
  }

  // Fallback: shader-only or empty slide. Shader pixels are live-rendered in the editor.
  const shapesHtml = shapes.map((shape) => {
    const left = (shape.transform.x / dims.width) * 100;
    const top = (shape.transform.y / dims.height) * 100;
    const width = (shape.transform.cx / dims.width) * 100;
    const height = (shape.transform.cy / dims.height) * 100;
    const posStyle = `position:absolute;left:${left}%;top:${top}%;width:${width}%;height:${height}%`;

    if (shape.type === "shader") {
      return `<div style="${posStyle}"></div>`;
    }

    return "";
  }).join("\n");

  return `<section class="slide" data-index="${index}" style="background:${bg}">
    <div class="slide-frame" style="background:${bg}">${shapesHtml}</div>
  </section>`;
}

export function buildExportHtml(doc: DocumentState): string {
  const content = doc.content as PptxContent;
  const slides = content.slides || [];
  const dims = content.slideDimensions || { width: 12192000, height: 6858000 };
  const title = doc.name.replace(/\.\w+$/, "") || "Presentation";
  const referenceHeight = (dims.height / dims.width) * REFERENCE_WIDTH;

  const slidesHtml = slides.map((s, i) => renderSlideHtml(s, dims, i)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Segoe UI',system-ui,sans-serif}
body{--slide-scale:1;--slide-width:${REFERENCE_WIDTH}px;--slide-height:${referenceHeight}px}
.slide{position:absolute;inset:0;display:none;overflow:hidden;align-items:center;justify-content:center}
.slide.active{display:flex}
.slide-frame{
  position:relative;
  width:var(--slide-width);
  height:var(--slide-height);
  overflow:hidden;
  transform:scale(var(--slide-scale));
  transform-origin:center center;
  box-shadow:0 0 0 1px rgba(255,255,255,0.04);
}
.slide-iframe{width:100%;height:100%;border:0}
.counter{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:#fff;font-size:14px;padding:6px 16px;border-radius:20px;z-index:100;pointer-events:none;opacity:0;transition:opacity 0.3s}
.counter.visible{opacity:1}
</style>
</head>
<body>
${slidesHtml}
<div class="counter" id="counter"></div>
<script>
(function(){
  var slides=document.querySelectorAll('.slide');
  var current=0;
  var total=slides.length;
  var counter=document.getElementById('counter');
  var hideTimer;
  var refWidth=${REFERENCE_WIDTH};
  var refHeight=${referenceHeight};
  function updateScale(){
    var scaleX=window.innerWidth/refWidth;
    var scaleY=window.innerHeight/refHeight;
    document.body.style.setProperty('--slide-scale', String(Math.min(scaleX, scaleY)));
  }
  function show(i){
    slides.forEach(function(s){s.classList.remove('active')});
    slides[i].classList.add('active');
    current=i;
    counter.textContent=(i+1)+' / '+total;
    counter.classList.add('visible');
    clearTimeout(hideTimer);
    hideTimer=setTimeout(function(){counter.classList.remove('visible')},2000);
  }
  function next(){if(current<total-1)show(current+1)}
  function prev(){if(current>0)show(current-1)}
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' ')next();
    else if(e.key==='ArrowLeft')prev();
  });
  document.addEventListener('click',function(e){
    if(e.clientX<window.innerWidth/3)prev();else next();
  });
  window.addEventListener('resize', updateScale);
  updateScale();
  show(0);
})();
</script>
</body>
</html>`;
}

export async function exportPresentationAsHtml(doc: DocumentState, filename?: string): Promise<void> {
  const html = buildExportHtml(doc);
  const base = filename?.trim().replace(/\.html$/i, "") || baseExportName(doc.name);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `${base}.html`);
}
