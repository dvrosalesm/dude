import { LocalWorkspaceApiError } from "./errors";
import { localUploadKeyFromUrl, readLocalUpload, type UploadBody } from "./uploads";

function createBlankPresentationContent(body: Record<string, unknown>) {
  const width = typeof body.slideWidth === "number" ? body.slideWidth : 12192000;
  const height = typeof body.slideHeight === "number" ? body.slideHeight : 6858000;
  return {
    originalBase64: "",
    currentBase64: "",
    textContent: "Untitled presentation",
    slideDimensions: { width, height },
    slides: [
      {
        index: 0,
        uid: `slide-${Date.now()}`,
        content:
          '<section style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#262626;color:#f4f1ea;font-family:Inter,sans-serif;"><div><p style="letter-spacing:.08em;text-transform:uppercase;color:#d6d6d6;font-size:14px;">Dude</p><h1 style="font-size:54px;line-height:.95;margin:0;">Untitled presentation</h1></div></section>',
        notes: "",
      },
    ],
  };
}

export async function uploadPresentationImage(
  body: UploadBody & { imageUrl?: string; base64?: string; contentType?: string },
) {
  const inputUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
  const base64 = typeof body.base64 === "string" ? body.base64 : body.bytesBase64 ?? "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType : body.fileType || "image/png";
  return {
    url: inputUrl || (base64 ? `data:${contentType};base64,${base64}` : body.dataUrl ?? ""),
    name: typeof body.fileName === "string" ? body.fileName : "image",
  };
}

export async function createPresentation(body: Record<string, unknown> = {}) {
  return {
    name: "Untitled presentation",
    type: "pptx",
    content: createBlankPresentationContent(body),
  };
}

export async function extractTextFromFile(body: UploadBody) {
  return {
    name: typeof body.fileName === "string" ? body.fileName : "Reference",
    text: typeof body.text === "string" ? body.text : "",
  };
}

export async function exportDocumentWriter(body: {
  title?: string;
  blocks?: unknown[];
  filename?: string;
  pageLayout?: unknown;
}) {
  const title = typeof body.title === "string" ? body.title : "Document";
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const text = [
    title,
    "",
    ...blocks.map((block) => {
      if (!block || typeof block !== "object") return "";
      const content = "content" in block ? block.content : "";
      return typeof content === "string" ? content : "";
    }),
  ].join("\n");
  return {
    text,
    filename: typeof body.filename === "string" && body.filename.trim()
      ? body.filename.trim()
      : "document.txt",
  };
}

async function loadImageSource(imageUrl: string): Promise<HTMLImageElement> {
  const key = localUploadKeyFromUrl(imageUrl);
  if (key) {
    const { upload } = await readLocalUpload(key);
    if (upload.dataUrl) {
      imageUrl = upload.dataUrl;
    } else if (upload.bytesBase64) {
      imageUrl = `data:${upload.fileType || "application/octet-stream"};base64,${upload.bytesBase64}`;
    }
  }

  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for export"));
    image.src = imageUrl;
  });
}

export async function imageExportDesignBranding(body: {
  imageUrl: string;
  format: "jpg" | "png" | "webp" | "gif";
}) {
  const image = await loadImageSource(body.imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new LocalWorkspaceApiError("Could not create export canvas", 500);
  }

  if (body.format === "jpg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);

  const mimeType =
    body.format === "jpg"
      ? "image/jpeg"
      : body.format === "webp"
        ? "image/webp"
        : body.format === "gif"
          ? "image/gif"
          : "image/png";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not export image"));
      },
      mimeType,
      body.format === "jpg" ? 0.92 : undefined,
    );
  });

  return blob;
}

export async function generatePresentationImage(body: { prompt?: string }) {
  void body;
  return {
    success: false as const,
    error: "AI image generation is not available in local mode.",
  };
}
