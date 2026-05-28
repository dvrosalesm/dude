import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { join } from "path";
import { tmpdir } from "os";
import { readFile, unlink } from "fs/promises";
import type { PresentationVideoProps } from "./presentation-video";

let bundleLocationPromise: Promise<string> | null = null;

async function getBundleLocation() {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({
      entryPoint: join(
        process.cwd(),
        "src/lib/presentation-editor/remotion/root.tsx",
      ),
      onProgress: () => undefined,
    });
  }

  return bundleLocationPromise;
}

export async function renderPresentationVideo(props: PresentationVideoProps): Promise<Buffer> {
  const serveUrl = await getBundleLocation();
  const composition = await selectComposition({
    serveUrl,
    id: "PresentationVideo",
    inputProps: props as Record<string, unknown>,
  });

  const outputPath = join(
    tmpdir(),
    `presentation-video-${Date.now()}-${crypto.randomUUID()}.mp4`,
  );

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: props as Record<string, unknown>,
  });

  try {
    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}
