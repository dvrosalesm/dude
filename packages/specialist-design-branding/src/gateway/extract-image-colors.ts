/**
 * Extract Image Colors tool — downloads an image from a URL, decodes it with
 * sharp, and returns dominant colors ranked by how much screen area they take.
 *
 * The design-branding agent uses this to derive an accurate brand palette from
 * an uploaded logo or reference image rather than eyeballing hex values.
 */

import { Type } from "@sinclair/typebox";
import sharp from "sharp";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolError, toolText } from "@dude/sdk/gateway-runtime";

const MAX_BYTES = 20 * 1024 * 1024;
const SAMPLE_SIZE = 100;
const DEFAULT_TOP_N = 8;
const MAX_TOP_N = 32;
const DEFAULT_BUCKET = 16;

function toHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function downloadImage(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:[^;]+;base64,(.*)$/);
    if (!m) throw new Error("invalid data URL");
    const buf = Buffer.from(m[1], "base64");
    if (buf.byteLength > MAX_BYTES) throw new Error("image exceeds 20MB");
    return buf;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error("image exceeds 20MB");
  const arr = await res.arrayBuffer();
  if (arr.byteLength > MAX_BYTES) throw new Error("image exceeds 20MB");
  return Buffer.from(arr);
}

export function createExtractImageColorsTool(): ToolDefinition {
  return {
    name: "extract_image_colors",
    label: "Extract Image Colors",
    description:
      "Download an image from a URL and return its dominant colors ranked by " +
      "how much area they occupy. Use this to derive an accurate brand " +
      "palette from a logo or reference image — don't eyeball hex values when " +
      "this tool gives you exact ones. Returns up to `topN` colors as " +
      "`{ hex, rgb, percentage, count }` ordered most-frequent first.",
    parameters: Type.Object({
      imageUrl: Type.String({
        description:
          "Public HTTPS URL or data: URL of the image. PNG, JPEG, WebP, GIF, " +
          "AVIF, TIFF supported.",
      }),
      topN: Type.Optional(
        Type.Number({
          description:
            "How many top colors to return. Default 8, max 32. For palette " +
            "derivation, 4–8 is usually enough.",
        }),
      ),
      bucketSize: Type.Optional(
        Type.Number({
          description:
            "Quantization granularity per RGB channel (1–64). Default 16: " +
            "colors within ~16 levels of each other are grouped. Lower = " +
            "more distinct shades; higher = stronger grouping.",
        }),
      ),
      ignoreTransparent: Type.Optional(
        Type.Boolean({
          description: "Skip fully-transparent pixels. Default true.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const imageUrl = String(params?.imageUrl || "").trim();
      const topN = clampInt(params?.topN, DEFAULT_TOP_N, 1, MAX_TOP_N);
      const bucket = clampInt(params?.bucketSize, DEFAULT_BUCKET, 1, 64);
      const ignoreTransparent = params?.ignoreTransparent !== false;

      if (!imageUrl) return toolError("imageUrl is required");

      try {
        const buf = await downloadImage(imageUrl);
        const { data, info } = await sharp(buf)
          .resize(SAMPLE_SIZE, SAMPLE_SIZE, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const counts = new Map<
          number,
          { r: number; g: number; b: number; n: number }
        >();
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (ignoreTransparent && a < 8) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const half = Math.floor(bucket / 2);
          const qr = Math.min(255, Math.floor(r / bucket) * bucket + half);
          const qg = Math.min(255, Math.floor(g / bucket) * bucket + half);
          const qb = Math.min(255, Math.floor(b / bucket) * bucket + half);
          const key = (qr << 16) | (qg << 8) | qb;
          const entry = counts.get(key);
          if (entry) {
            entry.r += r;
            entry.g += g;
            entry.b += b;
            entry.n += 1;
          } else {
            counts.set(key, { r, g, b, n: 1 });
          }
          total += 1;
        }

        if (total === 0) return toolError("no opaque pixels in image");

        const sorted = Array.from(counts.values())
          .map((c) => {
            const r = Math.round(c.r / c.n);
            const g = Math.round(c.g / c.n);
            const b = Math.round(c.b / c.n);
            return {
              hex: toHex(r, g, b),
              rgb: [r, g, b],
              count: c.n,
              percentage: +((c.n / total) * 100).toFixed(2),
            };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, topN);

        const result = {
          width: info.width,
          height: info.height,
          sampledPixels: total,
          colors: sorted,
        };
        return toolText(result, { ...result });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
