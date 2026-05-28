import type { PptxContent, Slide } from "@dude/presentation-editor/types";

const RENDER_SIZE = 1920;

export type SlideDimensions = PptxContent["slideDimensions"];

export function getSlideDimensions(content: PptxContent) {
  return content.slideDimensions || { width: 12192000, height: 6858000 };
}

export function computeRenderDimensions(dims: NonNullable<SlideDimensions>) {
  const isLandscape = dims.width >= dims.height;
  const renderWidth = isLandscape
    ? RENDER_SIZE
    : Math.round((dims.width / dims.height) * RENDER_SIZE);
  const renderHeight = isLandscape
    ? Math.round((dims.height / dims.width) * RENDER_SIZE)
    : RENDER_SIZE;

  return { renderWidth, renderHeight };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function baseExportName(name: string): string {
  const extensionIndex = name.lastIndexOf(".");
  const base = extensionIndex >= 0 ? name.slice(0, extensionIndex) : name;
  return base.trim() || "presentation";
}

function buildExportImageProxyUrl(url: string): string {
  return url;
}

function rewriteRemoteAssetUrls(htmlDocument: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlDocument, "text/html");

  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && /^https?:\/\//i.test(src)) {
      img.setAttribute("src", buildExportImageProxyUrl(src));
    }
    img.removeAttribute("srcset");
    img.setAttribute("loading", "eager");
    img.setAttribute("fetchpriority", "high");
    img.setAttribute("decoding", "sync");
  });

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

export async function waitForImages(container: HTMLElement, timeoutMs = 10000): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return;

  await new Promise<void>((resolve) => {
    let settled = 0;
    const complete = () => {
      settled += 1;
      if (settled >= images.length) {
        clearTimeout(timer);
        resolve();
      }
    };
    const timer = window.setTimeout(resolve, timeoutMs);

    for (const image of images) {
      if (image.complete) {
        complete();
        continue;
      }
      image.addEventListener("load", complete, { once: true });
      image.addEventListener("error", complete, { once: true });
    }
  });
}

async function waitForFonts(timeoutMs = 5000): Promise<void> {
  const fontSet = document.fonts;
  if (!fontSet?.ready) return;

  await Promise.race([
    fontSet.ready.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

async function waitForFontsInDocument(doc: Document, timeoutMs = 5000): Promise<void> {
  const fontSet = doc.fonts;
  if (!fontSet?.ready) return;

  await Promise.race([
    fontSet.ready.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

function extractCssUrls(value: string): string[] {
  const matches = value.match(/url\((['"]?)(.*?)\1\)/g) || [];
  return matches
    .map((match) => match.match(/url\((['"]?)(.*?)\1\)/)?.[2] || "")
    .filter(Boolean);
}

async function waitForBackgroundImages(container: HTMLElement, timeoutMs = 10000): Promise<void> {
  const urls = new Set<string>();

  for (const element of Array.from(container.querySelectorAll("*"))) {
    const backgroundImage = getComputedStyle(element).backgroundImage;
    for (const url of extractCssUrls(backgroundImage)) {
      urls.add(url);
    }
  }

  if (urls.size === 0) return;

  await new Promise<void>((resolve) => {
    let settled = 0;
    const total = urls.size;
    const complete = () => {
      settled += 1;
      if (settled >= total) {
        clearTimeout(timer);
        resolve();
      }
    };
    const timer = window.setTimeout(resolve, timeoutMs);

    for (const url of urls) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = complete;
      image.onerror = complete;
      image.src = url;
      if (image.complete) complete();
    }
  });
}

function forceEagerImageLoading(root: ParentNode): void {
  root.querySelectorAll("img").forEach((image) => {
    image.crossOrigin = "anonymous";
    image.loading = "eager";
    image.decoding = "sync";
    image.removeAttribute("loading");
    image.setAttribute("fetchpriority", "high");
  });
}

async function waitForStableLayout(frames = 2): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function waitForStableLayoutInWindow(targetWindow: Window, frames = 2): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await new Promise<void>((resolve) => targetWindow.requestAnimationFrame(() => resolve()));
  }
}

function slideWidthPoints(dims: NonNullable<SlideDimensions>): number {
  return dims.width / 12700;
}

function shapeTransformCss(transform: Slide["shapes"][number]["transform"]): string | undefined {
  const transforms: string[] = [];
  if (transform.rot) transforms.push(`rotate(${transform.rot}deg)`);
  if (transform.flipH) transforms.push("scaleX(-1)");
  if (transform.flipV) transforms.push("scaleY(-1)");
  return transforms.length ? transforms.join(" ") : undefined;
}

function isFullSlideHtmlShape(slide: Slide, dims: NonNullable<SlideDimensions>) {
  return (slide.shapes || []).find((shape) =>
    !shape.hidden &&
    shape.type === "html" &&
    shape.transform.x === 0 &&
    shape.transform.y === 0 &&
    shape.transform.cx === dims.width &&
    shape.transform.cy === dims.height,
  );
}

async function waitForIframeLoad(iframe: HTMLIFrameElement, timeoutMs = 10000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Timed out loading export iframe.")), timeoutMs);
    const complete = () => {
      window.clearTimeout(timer);
      resolve();
    };

    iframe.addEventListener("load", complete, { once: true });
  });
}

async function renderFullSlideHtmlShapeToCanvas(
  htmlContent: string,
  renderWidth: number,
  renderHeight: number,
): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const rewrittenHtml = rewriteRemoteAssetUrls(htmlContent);
  const iframe = document.createElement("iframe");
  iframe.sandbox.add("allow-scripts", "allow-same-origin");
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${renderWidth}px`,
    `height:${renderHeight}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "background:transparent",
    "z-index:-1",
  ].join(";");
  iframe.srcdoc = rewrittenHtml;
  document.body.appendChild(iframe);

  try {
    await waitForIframeLoad(iframe);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      throw new Error("Export iframe did not initialize correctly.");
    }

    const root = doc.documentElement;
    const body = doc.body;
    root.style.width = `${renderWidth}px`;
    root.style.height = `${renderHeight}px`;
    body.style.width = `${renderWidth}px`;
    body.style.height = `${renderHeight}px`;
    body.style.margin = "0";
    body.style.overflow = "hidden";
    forceEagerImageLoading(doc);

    await waitForImages(body);
    await waitForBackgroundImages(body);
    await waitForFontsInDocument(doc);
    await waitForStableLayoutInWindow(win, 3);
    await new Promise((resolve) => win.setTimeout(resolve, 350));

    return await html2canvas(root, {
      width: renderWidth,
      height: renderHeight,
      windowWidth: renderWidth,
      windowHeight: renderHeight,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: null,
    });
  } finally {
    iframe.remove();
  }
}

function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  for (const char of selectorText) {
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    if (char === "[") bracketDepth += 1;
    if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);

    if (char === "," && parenDepth === 0 && bracketDepth === 0) {
      if (current.trim()) selectors.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

function scopeSingleSelector(selector: string, scopeSelector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;

  const rootScoped = trimmed
    .replace(/:root\b/g, scopeSelector)
    .replace(/\bhtml\b/g, scopeSelector)
    .replace(/\bbody\b/g, scopeSelector);

  if (rootScoped === scopeSelector || rootScoped.startsWith(`${scopeSelector} `) || rootScoped.startsWith(`${scopeSelector}:`)) {
    return rootScoped;
  }

  if (rootScoped.startsWith(":")) {
    return `${scopeSelector}${rootScoped}`;
  }

  return `${scopeSelector} ${rootScoped}`;
}

function extractRulePrelude(cssText: string): string {
  const braceIndex = cssText.indexOf("{");
  return braceIndex >= 0 ? cssText.slice(0, braceIndex).trim() : cssText.trim();
}

function scopeCssText(cssText: string, scopeSelector: string, height: number): string {
  const normalizedCss = cssText.replace(/100(d|s)?vh/g, `${height}px`);

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(normalizedCss);

    const serializeRules = (rules: CSSRuleList): string => {
      return Array.from(rules).map((rule) => {
        if (rule.type === CSSRule.STYLE_RULE) {
          const styleRule = rule as CSSStyleRule;
          const scopedSelectors = splitSelectorList(styleRule.selectorText)
            .map((selector) => scopeSingleSelector(selector, scopeSelector))
            .join(", ");
          return `${scopedSelectors} { ${styleRule.style.cssText} }`;
        }

        if (rule.type === CSSRule.KEYFRAMES_RULE) {
          return rule.cssText;
        }

        if ("cssRules" in rule) {
          const nestedRules = serializeRules((rule as CSSGroupingRule).cssRules);
          return `${extractRulePrelude(rule.cssText)} { ${nestedRules} }`;
        }

        return rule.cssText;
      }).join("\n");
    };

    return serializeRules(sheet.cssRules);
  } catch {
    return normalizedCss
      .replace(/:root\b/g, scopeSelector)
      .replace(/\bhtml\b/g, scopeSelector)
      .replace(/\bbody\b/g, scopeSelector);
  }
}

function injectHtmlIntoDiv(
  parent: HTMLElement,
  htmlDocument: string,
  width: number,
  height: number,
): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rewriteRemoteAssetUrls(htmlDocument), "text/html");
  const scope = document.createElement("div");
  scope.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    "position:relative",
    "overflow:hidden",
    "container-type:size",
  ].join(";");

  const scopeId = `s${Math.random().toString(36).slice(2, 8)}`;
  const scopeSelector = `[data-export-scope="${scopeId}"]`;
  scope.setAttribute("data-export-scope", scopeId);

  for (const styleElement of doc.querySelectorAll("style")) {
    const scopedStyle = document.createElement("style");
    scopedStyle.textContent = scopeCssText(styleElement.textContent || "", scopeSelector, height);
    scope.appendChild(scopedStyle);
  }

  const freezeStyle = document.createElement("style");
  freezeStyle.textContent = `${scopeSelector}, ${scopeSelector} *, ${scopeSelector} *::before, ${scopeSelector} *::after { animation: none !important; transition: none !important; }`;
  scope.appendChild(freezeStyle);

  if (doc.body.className) scope.className = doc.body.className;
  const bodyStyle = doc.body.getAttribute("style");
  if (bodyStyle) {
    scope.style.cssText += `;${bodyStyle.replace(/100(d|s)?vh/g, `${height}px`)}`;
  }
  const background = doc.body.style.background || doc.body.style.backgroundColor;
  if (background) scope.style.background = background;

  const bodyClone = doc.body.cloneNode(true) as HTMLElement;
  bodyClone.querySelectorAll("script").forEach((script) => script.remove());
  scope.innerHTML += bodyClone.innerHTML;
  forceEagerImageLoading(scope);

  parent.appendChild(scope);
}

export function buildSlideContainer(
  slide: Slide,
  dims: NonNullable<SlideDimensions>,
  renderWidth: number,
  renderHeight: number,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${renderWidth}px`,
    `height:${renderHeight}px`,
    "overflow:hidden",
    `background:${slide.background || "#ffffff"}`,
    "z-index:-1",
    "opacity:0",
    "pointer-events:none",
    "font-family:'Segoe UI',system-ui,sans-serif",
    "container-type:inline-size",
  ].join(";");

  const slideWidthPt = slideWidthPoints(dims);

  for (const [arrayIndex, shape] of (slide.shapes || [])
    .filter((item) => item.type === "html" || item.type === "shader")
    .entries()) {
    if (shape.hidden) continue;

    const left = (shape.transform.x / dims.width) * 100;
    const top = (shape.transform.y / dims.height) * 100;
    const width = (shape.transform.cx / dims.width) * 100;
    const height = (shape.transform.cy / dims.height) * 100;

    const element = document.createElement("div");
    element.style.cssText = `position:absolute;left:${left}%;top:${top}%;width:${width}%;height:${height}%;overflow:hidden;z-index:${arrayIndex + 1}`;
    const shapeTransform = shapeTransformCss(shape.transform);
    if (shapeTransform) {
      element.style.transform = shapeTransform;
      element.style.transformOrigin = "center center";
    }

    if (shape.fill?.type === "solid") {
      element.style.background = shape.fill.color;
    }

    if (shape.type === "html" && shape.htmlContent) {
      const htmlWidth = Math.round((shape.transform.cx / dims.width) * renderWidth);
      const htmlHeight = Math.round((shape.transform.cy / dims.height) * renderHeight);
      injectHtmlIntoDiv(element, shape.htmlContent, htmlWidth, htmlHeight);
    } else if (shape.type === "text") {
      const textContainer = document.createElement("div");
      textContainer.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:4px;font-size:${((18 / slideWidthPt) * 100).toFixed(4)}cqw`;
      for (const paragraph of shape.paragraphs) {
        const paragraphElement = document.createElement("p");
        paragraphElement.style.cssText = `margin:0;line-height:1.25;text-align:${
          paragraph.align === "ctr" ? "center" : paragraph.align === "r" ? "right" : paragraph.align === "just" ? "justify" : "left"
        }`;
        for (const run of paragraph.runs) {
          const span = document.createElement("span");
          if (run.bold) span.style.fontWeight = "bold";
          if (run.italic) span.style.fontStyle = "italic";
          if (run.underline) span.style.textDecoration = "underline";
          if (run.color) span.style.color = run.color;
          if (run.fontSize) span.style.fontSize = `${(((run.fontSize / 100) / slideWidthPt) * 100).toFixed(4)}cqw`;
          if (run.fontFamily) span.style.fontFamily = `'${run.fontFamily}', sans-serif`;
          span.style.whiteSpace = "pre-wrap";
          span.style.wordBreak = "break-word";
          span.textContent = run.text;
          paragraphElement.appendChild(span);
        }
        if (paragraph.runs.length === 0) paragraphElement.innerHTML = "&nbsp;";
        textContainer.appendChild(paragraphElement);
      }
      element.appendChild(textContainer);
    } else if (shape.type === "table") {
      const tableWrap = document.createElement("div");
      tableWrap.style.cssText = "width:100%;height:100%;overflow:auto";
      const table = document.createElement("table");
      table.style.cssText = "width:100%;height:100%;border-collapse:collapse;font-size:0.8em";
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      for (const header of shape.headers) {
        const th = document.createElement("th");
        th.style.cssText = `padding:4px 8px;border:1px solid #ccc;${header.bold ? "font-weight:bold;" : ""}${header.color ? `color:${header.color};` : ""}${header.bgColor ? `background:${header.bgColor};` : ""}${header.fontSize ? `font-size:${header.fontSize / 100}pt;` : ""}`;
        th.textContent = header.text;
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of shape.rows) {
        const tr = document.createElement("tr");
        for (const cell of row) {
          const td = document.createElement("td");
          td.style.cssText = `padding:4px 8px;border:1px solid #ccc;${cell.bold ? "font-weight:bold;" : ""}${cell.color ? `color:${cell.color};` : ""}${cell.bgColor ? `background:${cell.bgColor};` : ""}${cell.fontSize ? `font-size:${cell.fontSize / 100}pt;` : ""}`;
          td.textContent = cell.text;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      element.appendChild(tableWrap);
    } else if (shape.type === "shader") {
      // Preserve layout and background fill even though shader pixels are rasterized separately in preview.
      element.style.background = shape.fill?.type === "solid" ? shape.fill.color : element.style.background;
    } else if (shape.type === "image" && shape.data) {
      const image = document.createElement("img");
      image.src = shape.data;
      image.style.cssText = "width:100%;height:100%;object-fit:fill";
      image.crossOrigin = "anonymous";
      element.appendChild(image);
    }

    wrapper.appendChild(element);
  }

  return wrapper;
}

export async function renderSlideToCanvas(
  slide: Slide,
  dims: NonNullable<SlideDimensions>,
  renderWidth: number,
  renderHeight: number,
): Promise<HTMLCanvasElement> {
  const fullSlideHtmlShape = isFullSlideHtmlShape(slide, dims);
  if (fullSlideHtmlShape) {
    return renderFullSlideHtmlShapeToCanvas(fullSlideHtmlShape.htmlContent, renderWidth, renderHeight);
  }

  const { default: html2canvas } = await import("html2canvas-pro");
  const container = buildSlideContainer(slide, dims, renderWidth, renderHeight);
  document.body.appendChild(container);

  await waitForImages(container);
  await waitForBackgroundImages(container);
  await waitForFonts();
  await waitForStableLayout(3);
  await new Promise((resolve) => window.setTimeout(resolve, 350));

  try {
    return await html2canvas(container, {
      width: renderWidth,
      height: renderHeight,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: slide.background || "#ffffff",
    });
  } finally {
    container.remove();
  }
}
