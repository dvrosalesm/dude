/**
 * Pi SDK agent turn — shared by the adapter-http runner and Pi child process.
 */

import { setMaxListeners } from "node:events";
import { join } from "node:path";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import { config } from "@dude/sdk/gateway-runtime";
import sandboxExtension from "./pi/sandbox/index.js";
import { getSpecialistForGateway as getSpecialist } from "../tool-host/index.js";
import {
  beginActiveTurn,
  endActiveTurn,
  getActiveTurnControl,
} from "../turn-control.js";
import type { GatewayMessage } from "./adapter-http.js";

setMaxListeners(500);

export type PiAgentTurnInput = {
  message: string;
  history?: GatewayMessage[];
  images?: string[];
  sendEvent: (event: string, data: unknown) => void;
};

function extractPartialHtml(partialJson: string): string | null {
  const marker = '"html":"';
  const idx = partialJson.indexOf(marker);
  if (idx === -1) return null;

  const raw = partialJson.slice(idx + marker.length);
  let result = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "n") result += "\n";
      else if (next === "t") result += "\t";
      else if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else if (next === "/") result += "/";
      else result += next;
      i += 2;
    } else if (raw[i] === '"') {
      break;
    } else {
      result += raw[i];
      i++;
    }
  }
  return result || null;
}

let draftSaveInFlight = false;

function saveDraftLocally(html: string) {
  if (draftSaveInFlight || !config.workspaceId) return;
  draftSaveInFlight = true;
  const url = `http://127.0.0.1:${config.gatewayInternalPort}/v1/internal/workspace/${config.workspaceId}/landing-page-draft`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
    signal: AbortSignal.timeout(10_000),
  })
    .catch(() => {})
    .finally(() => {
      draftSaveInFlight = false;
    });
}

async function buildPromptImages(imageUrls?: string[]) {
  if (!imageUrls?.length) return undefined;

  const images = await Promise.all(
    imageUrls.map(async (imageUrl) => {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.warn(
            `[agent] Failed to fetch prompt image (${response.status}): ${imageUrl.slice(0, 120)}`,
          );
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const mimeType = response.headers.get("content-type") || "image/png";

        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            mediaType: mimeType,
            data: Buffer.from(arrayBuffer).toString("base64"),
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[agent] Failed to prepare prompt image: ${message}`);
        return null;
      }
    }),
  );

  const filtered = images.filter(Boolean);
  return filtered.length > 0 ? filtered : undefined;
}

type PiSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

let sessionPromise: Promise<PiSession> | null = null;
let historyInjected = false;
let envScrubbed = false;

const SAFE_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "LANG",
  "NODE_ENV",
  "GATEWAY_PORT",
  "HOSTNAME",
  "PUPPETEER_EXECUTABLE_PATH",
  "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD",
  "DUDE_SESSION_MANIFEST_PATH",
]);

function scrubProcessEnv() {
  if (envScrubbed) return;
  envScrubbed = true;
  for (const key of Object.keys(process.env)) {
    if (!SAFE_ENV_KEYS.has(key)) {
      delete process.env[key];
    }
  }
}

async function getPiSession(): Promise<PiSession> {
  if (!sessionPromise) {
    sessionPromise = initPiSession();
  }
  return sessionPromise;
}

async function initPiSession(): Promise<PiSession> {
  const workDir = process.cwd();
  const authStorage = AuthStorage.create(join(workDir, ".pi-auth.json"));
  if (config.apiKey) {
    authStorage.setRuntimeApiKey(config.modelProvider, config.apiKey);
  }

  const modelRegistry = new ModelRegistry(authStorage);
  const baseModel = getModel(config.modelProvider, config.modelId) ?? {
    id: config.modelId,
    name: config.modelId,
    api: "openai-completions" as const,
    provider: config.modelProvider,
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: false,
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 32000,
  };

  const MAX_OUTPUT_TOKENS_FLOOR = 32000;
  const model = {
    ...baseModel,
    maxTokens: Math.max(baseModel.maxTokens ?? 0, MAX_OUTPUT_TOKENS_FLOOR),
  };

  console.log(
    `[pi-agent] Model resolved: ${model.provider}/${model.id} (maxTokens=${model.maxTokens})`,
  );

  const specialist = getSpecialist(config.specialistId);
  console.log(`[pi-agent] Specialist: ${specialist.name}`);
  if (specialist.skillPaths.length) {
    console.log(
      `[pi-agent] Skill packs: ${specialist.skillPaths.length} (${specialist.skillPaths.join(", ")})`,
    );
  }

  const resourceLoader = new DefaultResourceLoader({
    systemPromptOverride: () => config.systemPrompt,
    appendSystemPromptOverride: () => [],
    additionalExtensionPaths: [],
    additionalSkillPaths: specialist.skillPaths,
    extensionFactories: [
      (pi) => {
        sandboxExtension(pi);
      },
      (pi) => {
        specialist.setup(pi);
      },
    ],
  });
  await resourceLoader.reload();

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: true },
    retry: { enabled: true, maxRetries: 2 },
  });

  const { session } = await createAgentSession({
    cwd: workDir,
    agentDir: join(workDir, ".pi-agent"),
    model,
    thinkingLevel: "off",
    authStorage,
    modelRegistry,
    resourceLoader,
    tools: [],
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });

  scrubProcessEnv();
  return session;
}

function parseImagesFromResponse(
  images: unknown,
): Array<{ url: string; alt?: string; caption?: string }> | undefined {
  if (!Array.isArray(images)) return undefined;
  const valid = images
    .filter(
      (img): img is Record<string, unknown> =>
        Boolean(img) && typeof img === "object",
    )
    .map((img) => ({
      url: String(img.url || img.src || ""),
      alt: img.alt ? String(img.alt) : undefined,
      caption: img.caption ? String(img.caption) : undefined,
    }))
    .filter((img) => img.url && /^https?:\/\//.test(img.url));
  return valid.length > 0 ? valid : undefined;
}

function persistMessages(
  message: string,
  answer: string,
  images?: string[],
) {
  if (!config.workspaceId || (!message && !answer)) return;
  const callbackUrl = `http://127.0.0.1:${config.gatewayInternalPort}/v1/internal/workspace/${config.workspaceId}/save-messages`;
  fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessage: message,
      assistantMessage: answer,
      images: images?.length ? images : undefined,
      isBootMessage:
        message.startsWith("<conversation_history>") ||
        message.includes("Introduce yourself"),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => {
    console.error(
      "[agent] Failed to persist messages:",
      err instanceof Error ? err.message : err,
    );
  });
}

export async function runPiAgentTurn(
  input: PiAgentTurnInput,
): Promise<Record<string, unknown>> {
  const session = await getPiSession();
  const { message, history, images, sendEvent } = input;

  beginActiveTurn({
    emitProgress: (progressMessage) => {
      sendEvent("progress_message", { message: progressMessage });
    },
    requestAbort: () => {
      void session.abort().catch((error) => {
        console.warn(
          "[agent] finish_turn abort:",
          error instanceof Error ? error.message : error,
        );
      });
    },
  });

  let responseText = "";
  let currentToolName = "";
  let currentToolArgs = "";
  let currentToolArgsLen = 0;
  let turnFinish: { answer: string; suggestions?: string[] } | undefined;

  console.log(
    `\n[agent] ← User: ${message.slice(0, 200)}${message.length > 200 ? "..." : ""}`,
  );

  const unsubscribe = session.subscribe((event: any) => {
    if (event.type === "auto_compaction_end" && event.result?.summary) {
      console.log(
        `[agent] 📦 Auto-compaction completed. Summary: ${event.result.summary.slice(0, 200)}...`,
      );
      sendEvent("compaction", {
        summary: event.result.summary,
        firstKeptEntryId: event.result.firstKeptEntryId,
        tokensBefore: event.result.tokensBefore,
      });
    }

    const evt = event.assistantMessageEvent;
    if (!evt) return;

    switch (evt.type) {
      case "text_delta":
        responseText += evt.delta;
        sendEvent("text_delta", { delta: evt.delta });
        break;

      case "thinking_start":
        sendEvent("thinking_start", {});
        console.log("[agent] 💭 Thinking...");
        break;
      case "thinking_delta":
        if (evt.delta) {
          sendEvent("thinking", { delta: evt.delta });
        }
        break;
      case "thinking_end":
        sendEvent("thinking_end", {});
        break;

      case "toolcall_start": {
        currentToolName = evt.name || evt.toolName || evt.tool_name || "";
        if (!currentToolName && evt.partial?.content) {
          const tc = (evt.partial.content as any[]).find(
            (c: any) => c.type === "toolCall" && c.name,
          );
          if (tc) currentToolName = tc.name;
        }
        currentToolArgs = "";
        currentToolArgsLen = 0;
        console.log(
          `[agent] 🔧 Tool call starting: ${currentToolName || "(unknown)"}`,
        );
        sendEvent("tool_call_start", { tool: currentToolName });
        break;
      }
      case "toolcall_delta":
        if (evt.delta) {
          currentToolArgs += evt.delta;
          currentToolArgsLen += evt.delta.length;
          if (currentToolArgsLen % 2048 < (evt.delta.length || 1)) {
            console.log(
              `[agent]   ⏳ ${currentToolName}: ${(currentToolArgsLen / 1024).toFixed(1)}KB generated...`,
            );
          }
          if (
            currentToolName === "update_landing_page" &&
            currentToolArgsLen > 1024 &&
            currentToolArgsLen % 4096 < (evt.delta.length || 1)
          ) {
            const partial = extractPartialHtml(currentToolArgs);
            if (partial && partial.length > 200) {
              saveDraftLocally(partial);
              sendEvent("preview_draft", { size: partial.length });
            }
          }
        }
        break;
      case "toolcall_end": {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(currentToolArgs);
        } catch {
          parsedArgs = { raw: currentToolArgs };
        }
        console.log(
          `[agent] 🔧 Tool call: ${currentToolName}(${JSON.stringify(parsedArgs).slice(0, 300)})`,
        );
        sendEvent("tool_call", {
          tool: currentToolName,
          arguments: parsedArgs,
        });
        currentToolName = "";
        currentToolArgs = "";
        break;
      }

      case "tool_result": {
        const content = Array.isArray(evt.content)
          ? evt.content.map((c: any) => c.text || JSON.stringify(c)).join("")
          : typeof evt.content === "string"
            ? evt.content
            : JSON.stringify(evt.content);
        console.log(`[agent] 📋 Tool result: ${content.slice(0, 200)}`);
        sendEvent("tool_result", {
          tool: evt.toolName || "unknown",
          result: content,
        });
        break;
      }

      case "tool_use":
        console.log(
          `[agent] 🔧 Tool: ${evt.name}(${JSON.stringify(evt.input).slice(0, 300)})`,
        );
        sendEvent("tool_call", { tool: evt.name, arguments: evt.input });
        break;

      default:
        if (!["text_start", "text_end"].includes(evt.type)) {
          console.log(`[agent] 📡 Event: ${evt.type}`);
        }
        break;
    }
  });

  try {
    let prompt = message;
    if (!historyInjected && history && history.length > 0) {
      const historyText = history
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      prompt = `<conversation_history>\nThe following is the previous conversation with the user. Continue naturally from where you left off.\n\n${historyText}\n</conversation_history>\n\nUser's new message: ${message}`;
      historyInjected = true;
      console.log(
        `[agent] 📜 Injected ${history.length} history messages into prompt`,
      );
    } else if (!historyInjected) {
      historyInjected = true;
    }

    const promptImages = await buildPromptImages(images);
    if (promptImages?.length) {
      console.log(
        `[agent] 🖼️ Attaching ${promptImages.length} image(s) to prompt`,
      );
    }

    await session.prompt(
      prompt,
      promptImages ? { images: promptImages } : undefined,
    );
  } catch (promptError) {
    const msg =
      promptError instanceof Error ? promptError.message : String(promptError);
    console.error(`[agent] ❌ Prompt error: ${msg}`);
    sendEvent("error", { error: msg });
    throw promptError instanceof Error ? promptError : new Error(msg);
  } finally {
    turnFinish = getActiveTurnControl()?.finish;
    unsubscribe();
    endActiveTurn();
  }

  console.log(`[agent] → Done (${responseText.length} chars)\n`);

  if (turnFinish) {
    const donePayload = {
      type: "final",
      steps: [],
      answer: turnFinish.answer,
      suggestions: turnFinish.suggestions,
      usage: {
        input_tokens: Math.ceil(message.length / 4),
        output_tokens: Math.ceil(turnFinish.answer.length / 4),
      },
    };
    persistMessages(message, turnFinish.answer, images);
    return donePayload;
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    const stripped = responseText
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();
    const jsonStart = stripped.indexOf("{");
    const jsonEnd = stripped.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      parsed = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1));
    }
  } catch {
    // Not valid JSON
  }

  let result: Record<string, unknown>;
  if (parsed?.type === "greeting") {
    result = {
      type: "greeting",
      answer: `${parsed.greeting || ""}\n\n${parsed.summary || ""}`.trim(),
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      images: parseImagesFromResponse(parsed.images),
    };
  } else if (parsed?.type === "final") {
    result = {
      type: "final",
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      answer: parsed.answer || responseText,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
        : undefined,
      images: parseImagesFromResponse(parsed.images),
    };
  } else if (parsed?.type === "question") {
    result = {
      type: "question",
      question: parsed.question,
      images: parseImagesFromResponse(parsed.images),
    };
  } else {
    result = { type: "final", steps: [], answer: responseText };
  }

  let usage: Record<string, number>;
  try {
    const stats = session.getSessionStats();
    usage = {
      input_tokens: stats.tokens.input,
      output_tokens: stats.tokens.output,
      cache_read_tokens: stats.tokens.cacheRead,
      cache_write_tokens: stats.tokens.cacheWrite,
      total_cost: stats.cost,
    };
  } catch {
    usage = {
      input_tokens: Math.ceil(message.length / 4),
      output_tokens: Math.ceil(responseText.length / 4),
    };
  }

  const answer = String(result.answer || result.question || "");
  persistMessages(message, answer, images);
  return { ...result, usage };
}

/** Pi sessions are single-threaded — serialize turns like Codex. */
let piTurnChain: Promise<unknown> = Promise.resolve();

export function runPiAgentTurnQueued(
  input: PiAgentTurnInput,
): Promise<Record<string, unknown>> {
  const run = piTurnChain.then(() => runPiAgentTurn(input));
  piTurnChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
