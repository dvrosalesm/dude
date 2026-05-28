/**
 * Shared headless-browser rendering for tool-side visual feedback.
 *
 * Each agent process runs a single specialist, so a single lazy puppeteer
 * instance per process is reused across renders (slides, landing pages, etc).
 * Specialist-specific review prompts live in the calling tools.
 */

import type { Browser } from "puppeteer";

let _browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browserPromise) {
    _browserPromise = (async () => {
      const puppeteer = await import("puppeteer");
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      console.log(
        `[html-preview] Launching browser${executablePath ? ` (${executablePath})` : ""}...`,
      );
      return puppeteer.default.launch({
        headless: true,
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process",
        ],
      });
    })();
  }
  return _browserPromise;
}

export interface RenderOptions {
  /** Viewport width in CSS pixels. Defaults to 1280. */
  width?: number;
  /** Viewport height in CSS pixels. Defaults to 720. Ignored when fullPage is true. */
  height?: number;
  /** Capture the full scrollable height instead of just the viewport. */
  fullPage?: boolean;
  /** Extra time (ms) to wait after networkidle for animations to settle. Defaults to 500. */
  settleMs?: number;
  /** Page-load timeout (ms) for setContent. Defaults to 15000. */
  timeoutMs?: number;
}

/**
 * Render a complete HTML document to a PNG (base64, no data: prefix).
 * Caller is responsible for wrapping body-only HTML in a full document if needed.
 */
export async function renderHtmlToImage(
  html: string,
  options: RenderOptions = {},
): Promise<string> {
  const {
    width = 1280,
    height = 720,
    fullPage = false,
    settleMs = 500,
    timeoutMs = 15_000,
  } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: timeoutMs });
    if (settleMs > 0) {
      await new Promise((r) => setTimeout(r, settleMs));
    }
    const screenshot = await page.screenshot({
      type: "png",
      encoding: "base64",
      fullPage,
    });
    return screenshot as string;
  } finally {
    await page.close();
  }
}

/** Cleanup: close the browser (call on process exit). */
export async function closeBrowser(): Promise<void> {
  if (_browserPromise) {
    try {
      const browser = await _browserPromise;
      await browser.close();
    } catch {
      /* ignore */
    }
    _browserPromise = null;
  }
}
