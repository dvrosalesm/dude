import {
  DESIGN_BRANDING_SPECIALIST_ID,
  DESIGN_NODE_TYPES,
  type BrandBookSection,
  type BrandLogoConcept,
  type BrandPalette,
  type BrandPaletteColor,
  type BrandTypography,
  type BrandTypographyFace,
  type DesignBrandingConfig,
  type DesignBrandingConfigSanitized,
  type DesignBrandingWorkspace,
  type DesignCanvasSnapshot,
  type DesignFlowEdge,
  type DesignFlowNode,
  type DesignFlowViewport,
  type DesignReview,
  type DesignReviewScore,
  type TokensExport,
} from "@dude/subagent-design-branding/lib/types";
import {
  MAX_MARKETING_IDENTIFIER_LENGTH,
  normalizeMarketingIdentifier,
} from "@dude/subagent-utils/identifiers";
import { normalizeSafeHttpUrl } from "@dude/subagent-utils/urls";

export const MAX_CONFIG_NODES = 1000;
export const MAX_CONFIG_EDGES = 1000;
export const MAX_CONFIG_BRAND_BOOK_SECTIONS = 40;
export const MAX_CONFIG_PALETTES = 50;
export const MAX_CONFIG_TYPOGRAPHY = 30;
export const MAX_CONFIG_LOGOS = 100;
export const MAX_CONFIG_REVIEWS = 200;
export const MAX_CONFIG_TOKENS_EXPORTS = 30;
export const MAX_CONFIG_PALETTE_COLORS = 20;
export const MAX_CONFIG_IDENTIFIER_LENGTH = MAX_MARKETING_IDENTIFIER_LENGTH;

const DEFAULT_WORKSPACE_IDENTIFIER = "workspace";
const CONFIG_TEXT_CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const CONFIG_MULTILINE_CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CONFIG_NUMERIC_CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HEX_COLOR_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const VALID_NODE_TYPES = new Set<string>(DESIGN_NODE_TYPES);

const VALID_BRAND_BOOK_SECTIONS = new Set<BrandBookSection["section"]>([
  "mission",
  "audience",
  "voice",
  "principles",
  "logoUsage",
  "doDont",
  "custom",
]);

const VALID_REVIEW_CATEGORIES = new Set<DesignReviewScore["category"]>([
  "brandFit",
  "hierarchy",
  "contrast",
  "consistency",
  "craft",
]);

const VALID_TYPO_CATEGORIES = new Set<BrandTypographyFace["category"]>([
  "sans",
  "serif",
  "mono",
  "display",
  "handwritten",
]);

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(CONFIG_NUMERIC_CONTROL_CHARS, "").trim())
        : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asFiniteNumberOrUndefined(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(CONFIG_NUMERIC_CONTROL_CHARS, "").trim())
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(CONFIG_TEXT_CONTROL_CHARS, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeBoundedMultilineText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(CONFIG_MULTILINE_CONTROL_CHARS, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }
  const normalized = value.replace(CONFIG_TEXT_CONTROL_CHARS, "").trim();
  if (!normalized) {
    return new Date().toISOString();
  }
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }
  return new Date(parsed).toISOString();
}

function normalizeIdentifier(value: unknown, fallback: string) {
  const normalizedFallback = normalizeMarketingIdentifier(fallback, {
    maxLength: MAX_CONFIG_IDENTIFIER_LENGTH,
  });
  if (typeof value !== "string") {
    return normalizedFallback;
  }
  const normalized = normalizeMarketingIdentifier(value, {
    maxLength: MAX_CONFIG_IDENTIFIER_LENGTH,
  });
  return normalized || normalizedFallback;
}

function normalizeDefaultIdentifier(value: string, fallback: string) {
  return (
    normalizeMarketingIdentifier(value, {
      maxLength: MAX_CONFIG_IDENTIFIER_LENGTH,
    }) ||
    normalizeMarketingIdentifier(fallback, {
      maxLength: MAX_CONFIG_IDENTIFIER_LENGTH,
    }) ||
    fallback.trim() ||
    DEFAULT_WORKSPACE_IDENTIFIER
  );
}

function normalizeConfigVersion(value: unknown) {
  const parsed = Math.floor(asNumber(value, 1));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10_000);
}

function safeDateValue(value: string) {
  const parsed = Date.parse(
    value.replace(CONFIG_TEXT_CONTROL_CHARS, "").trim(),
  );
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function dedupeByIdLatest<T extends { id: string }>(
  entries: T[],
  getRecency: (entry: T) => number,
) {
  const byId = new Map<string, T>();
  for (const entry of entries) {
    if (!entry.id) continue;
    const existing = byId.get(entry.id);
    if (!existing || getRecency(entry) >= getRecency(existing)) {
      byId.set(entry.id, entry);
    }
  }
  return Array.from(byId.values());
}

function dedupeAndSortByRecencyDesc<T extends { id: string }>(
  entries: T[],
  getRecency: (entry: T) => number,
) {
  return dedupeByIdLatest(entries, getRecency).sort(
    (a, b) => getRecency(b) - getRecency(a),
  );
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return withHash.toLowerCase();
}

function normalizePosition(input: unknown): { x: number; y: number } {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const raw = input as Record<string, unknown>;
    const x = asNumber(raw.x, 0);
    const y = asNumber(raw.y, 0);
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    };
  }
  return { x: 0, y: 0 };
}

function normalizeViewport(input: unknown): DesignFlowViewport | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const x = asFiniteNumberOrUndefined(raw.x);
  const y = asFiniteNumberOrUndefined(raw.y);
  const zoom = asFiniteNumberOrUndefined(raw.zoom);
  if (x === undefined || y === undefined || zoom === undefined) return undefined;
  return {
    x,
    y,
    zoom: Math.max(0.1, Math.min(4, zoom)),
  };
}

function normalizeFlowNode(input: unknown): DesignFlowNode | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const id = normalizeIdentifier(raw.id, "");
  if (!id) return null;
  const type = typeof raw.type === "string" ? raw.type.trim().slice(0, 80) : "stickyNote";
  const finalType = VALID_NODE_TYPES.has(type) ? type : type || "stickyNote";
  const data =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};
  const node: DesignFlowNode = {
    id,
    type: finalType,
    position: normalizePosition(raw.position),
    data,
  };
  const width = asFiniteNumberOrUndefined(raw.width);
  if (width !== undefined) node.width = Math.max(20, Math.min(4000, width));
  const height = asFiniteNumberOrUndefined(raw.height);
  if (height !== undefined) node.height = Math.max(20, Math.min(4000, height));
  const zIndex = asFiniteNumberOrUndefined(raw.zIndex);
  if (zIndex !== undefined) node.zIndex = Math.floor(zIndex);
  if (typeof raw.parentId === "string") {
    const parent = normalizeIdentifier(raw.parentId, "");
    if (parent) node.parentId = parent;
  }
  if (raw.extent === "parent") node.extent = "parent";
  return node;
}

function normalizeFlowEdge(input: unknown): DesignFlowEdge | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const id = normalizeIdentifier(raw.id, "");
  const source = normalizeIdentifier(raw.source, "");
  const target = normalizeIdentifier(raw.target, "");
  if (!id || !source || !target) return null;
  const edge: DesignFlowEdge = { id, source, target };
  if (typeof raw.sourceHandle === "string") {
    edge.sourceHandle = raw.sourceHandle.slice(0, 80);
  }
  if (typeof raw.targetHandle === "string") {
    edge.targetHandle = raw.targetHandle.slice(0, 80);
  }
  if (typeof raw.type === "string") {
    edge.type = raw.type.slice(0, 80);
  }
  if (typeof raw.label === "string") {
    edge.label = normalizeText(raw.label, 200);
  }
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    edge.data = raw.data as Record<string, unknown>;
  }
  return edge;
}

function normalizeCanvasSnapshot(input: unknown): DesignCanvasSnapshot {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { nodes: [], edges: [] };
  }
  const raw = input as Record<string, unknown>;
  const nodes = asArray<unknown>(raw.nodes)
    .map(normalizeFlowNode)
    .filter((node): node is DesignFlowNode => Boolean(node))
    .slice(0, MAX_CONFIG_NODES);
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const edges = asArray<unknown>(raw.edges)
    .map(normalizeFlowEdge)
    .filter((edge): edge is DesignFlowEdge => Boolean(edge))
    .filter((edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target))
    .slice(0, MAX_CONFIG_EDGES);
  const viewport = normalizeViewport(raw.viewport);
  return viewport ? { nodes, edges, viewport } : { nodes, edges };
}

function normalizePaletteColor(input: unknown): BrandPaletteColor | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const hex = normalizeHexColor(raw.hex);
  if (!hex) return null;
  return {
    hex,
    name: normalizeText(raw.name, 80) || undefined,
    role: normalizeText(raw.role, 80) || undefined,
  };
}

function normalizePalette(input: unknown): BrandPalette | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const name = normalizeText(raw.name, 120);
  if (!name) return null;
  const colors = asArray<unknown>(raw.colors)
    .map(normalizePaletteColor)
    .filter((color): color is BrandPaletteColor => Boolean(color))
    .slice(0, MAX_CONFIG_PALETTE_COLORS);
  if (!colors.length) return null;
  return {
    id: normalizeIdentifier(raw.id, crypto.randomUUID()),
    name,
    colors,
    createdAt: normalizeIsoDate(raw.createdAt),
  };
}

function normalizeTypographyFace(input: unknown): BrandTypographyFace | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const family = normalizeText(raw.family, 120);
  if (!family) return null;
  const face: BrandTypographyFace = { family };
  if (typeof raw.weight === "number" || typeof raw.weight === "string") {
    face.weight = typeof raw.weight === "number" ? raw.weight : normalizeText(raw.weight, 40);
  }
  if (
    typeof raw.category === "string" &&
    VALID_TYPO_CATEGORIES.has(raw.category as BrandTypographyFace["category"])
  ) {
    face.category = raw.category as BrandTypographyFace["category"];
  }
  return face;
}

function normalizeTypography(input: unknown): BrandTypography | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const name = normalizeText(raw.name, 120);
  const display = normalizeTypographyFace(raw.display);
  const body = normalizeTypographyFace(raw.body);
  if (!name || !display || !body) return null;
  return {
    id: normalizeIdentifier(raw.id, crypto.randomUUID()),
    name,
    display,
    body,
    sampleText: normalizeBoundedMultilineText(raw.sampleText, 1000) || undefined,
    createdAt: normalizeIsoDate(raw.createdAt),
  };
}

function normalizeLogoConcept(input: unknown): BrandLogoConcept | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const name = normalizeText(raw.name, 200);
  const imageUrl = normalizeSafeHttpUrl(raw.imageUrl);
  if (!name || !imageUrl) return null;
  return {
    id: normalizeIdentifier(raw.id, crypto.randomUUID()),
    name,
    brief: normalizeBoundedMultilineText(raw.brief, 4000),
    imageUrl,
    rationale: normalizeBoundedMultilineText(raw.rationale, 4000) || undefined,
    createdAt: normalizeIsoDate(raw.createdAt),
  };
}

function normalizeBrandBookSection(input: unknown): BrandBookSection | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const title = normalizeText(raw.title, 200);
  if (!title) return null;
  const section =
    typeof raw.section === "string" &&
    VALID_BRAND_BOOK_SECTIONS.has(raw.section as BrandBookSection["section"])
      ? (raw.section as BrandBookSection["section"])
      : "custom";
  return {
    id: normalizeIdentifier(raw.id, crypto.randomUUID()),
    section,
    title,
    body: normalizeBoundedMultilineText(raw.body, 20000),
    updatedAt: normalizeIsoDate(raw.updatedAt),
  };
}

function normalizeReviewScore(input: unknown): DesignReviewScore | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const category =
    typeof raw.category === "string" &&
    VALID_REVIEW_CATEGORIES.has(raw.category as DesignReviewScore["category"])
      ? (raw.category as DesignReviewScore["category"])
      : null;
  if (!category) return null;
  const score = Math.max(0, Math.min(10, asNumber(raw.score, 5)));
  return {
    category,
    score,
    notes: normalizeBoundedMultilineText(raw.notes, 4000),
  };
}

function normalizeReview(input: unknown): DesignReview | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const targetUrl = normalizeSafeHttpUrl(raw.targetUrl);
  if (!targetUrl) return null;
  const scores = asArray<unknown>(raw.scores)
    .map(normalizeReviewScore)
    .filter((entry): entry is DesignReviewScore => Boolean(entry))
    .slice(0, 20);
  return {
    id: normalizeIdentifier(raw.id, crypto.randomUUID()),
    targetUrl,
    scores,
    summary: normalizeBoundedMultilineText(raw.summary, 6000),
    createdAt: normalizeIsoDate(raw.createdAt),
  };
}

function normalizeTokensExport(input: unknown): TokensExport | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const css = normalizeBoundedMultilineText(raw.css, 30000);
  const tailwind = normalizeBoundedMultilineText(raw.tailwind, 30000);
  const json = normalizeBoundedMultilineText(raw.json, 30000);
  if (!css && !tailwind && !json) return null;
  return {
    id: normalizeIdentifier(raw.id, crypto.randomUUID()),
    paletteId:
      typeof raw.paletteId === "string"
        ? normalizeIdentifier(raw.paletteId, "") || undefined
        : undefined,
    typographyId:
      typeof raw.typographyId === "string"
        ? normalizeIdentifier(raw.typographyId, "") || undefined
        : undefined,
    css,
    tailwind,
    json,
    generatedAt: normalizeIsoDate(raw.generatedAt),
  };
}

export function buildDefaultDesignBrandingConfig({
  workspaceId,
}: {
  workspaceId: string;
}): DesignBrandingConfig {
  const normalizedWorkspaceId = normalizeDefaultIdentifier(
    workspaceId,
    DEFAULT_WORKSPACE_IDENTIFIER,
  );
  const now = new Date().toISOString();
  return {
    subagent: DESIGN_BRANDING_SPECIALIST_ID,
    version: 1,
    workspaceId: normalizedWorkspaceId,
    canvasSnapshot: { nodes: [], edges: [] },
    brandBook: [],
    palettes: [],
    typography: [],
    logos: [],
    reviews: [],
    tokensExports: [],
    outputLanguage: undefined,
    updatedAt: now,
  };
}

export function normalizeDesignBrandingConfig(
  value: unknown,
  defaults: { workspaceId: string },
): DesignBrandingConfig {
  const normalizedDefaults = {
    workspaceId: normalizeDefaultIdentifier(
      defaults.workspaceId,
      DEFAULT_WORKSPACE_IDENTIFIER,
    ),
  };
  const base = buildDefaultDesignBrandingConfig(normalizedDefaults);
  if (!value || typeof value !== "object") {
    return base;
  }

  const raw = value as Record<string, unknown>;
  return {
    subagent: DESIGN_BRANDING_SPECIALIST_ID,
    version: normalizeConfigVersion(raw.version),
    workspaceId: normalizeIdentifier(
      raw.workspaceId,
      normalizedDefaults.workspaceId,
    ),
    canvasSnapshot: normalizeCanvasSnapshot(raw.canvasSnapshot),
    brandBook: dedupeAndSortByRecencyDesc(
      asArray(raw.brandBook)
        .map(normalizeBrandBookSection)
        .filter((item): item is BrandBookSection => Boolean(item)),
      (entry) => safeDateValue(entry.updatedAt),
    ).slice(0, MAX_CONFIG_BRAND_BOOK_SECTIONS),
    palettes: dedupeAndSortByRecencyDesc(
      asArray(raw.palettes)
        .map(normalizePalette)
        .filter((item): item is BrandPalette => Boolean(item)),
      (entry) => safeDateValue(entry.createdAt),
    ).slice(0, MAX_CONFIG_PALETTES),
    typography: dedupeAndSortByRecencyDesc(
      asArray(raw.typography)
        .map(normalizeTypography)
        .filter((item): item is BrandTypography => Boolean(item)),
      (entry) => safeDateValue(entry.createdAt),
    ).slice(0, MAX_CONFIG_TYPOGRAPHY),
    logos: dedupeAndSortByRecencyDesc(
      asArray(raw.logos)
        .map(normalizeLogoConcept)
        .filter((item): item is BrandLogoConcept => Boolean(item)),
      (entry) => safeDateValue(entry.createdAt),
    ).slice(0, MAX_CONFIG_LOGOS),
    reviews: dedupeAndSortByRecencyDesc(
      asArray(raw.reviews)
        .map(normalizeReview)
        .filter((item): item is DesignReview => Boolean(item)),
      (entry) => safeDateValue(entry.createdAt),
    ).slice(0, MAX_CONFIG_REVIEWS),
    tokensExports: dedupeAndSortByRecencyDesc(
      asArray(raw.tokensExports)
        .map(normalizeTokensExport)
        .filter((item): item is TokensExport => Boolean(item)),
      (entry) => safeDateValue(entry.generatedAt),
    ).slice(0, MAX_CONFIG_TOKENS_EXPORTS),
    outputLanguage: normalizeText(raw.outputLanguage, 50) || undefined,
    updatedAt: normalizeIsoDate(raw.updatedAt),
  };
}

export function withConfigUpdatedAt(
  config: DesignBrandingConfig,
): DesignBrandingConfig {
  return normalizeDesignBrandingConfig(
    {
      ...config,
      updatedAt: new Date().toISOString(),
    },
    {
      workspaceId: config.workspaceId,
    },
  );
}

export function sanitizeDesignBrandingConfig(
  config: DesignBrandingConfig,
): DesignBrandingConfigSanitized {
  return { ...config };
}

export function getWorkspaceConfig(
  workspace: DesignBrandingWorkspace | Record<string, unknown>,
): DesignBrandingConfig {
  const workspaceId = asString(workspace?.id);
  return normalizeDesignBrandingConfig(workspace?.configurations, {
    workspaceId,
  });
}
