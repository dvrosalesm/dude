export const DESIGN_BRANDING_SPECIALIST_ID = "design-branding";

export const DESIGN_NODE_TYPES = [
  "stickyNote",
  "textBlock",
  "shape",
  "frame",
  "image",
  "palette",
  "typography",
  "logoConcept",
  "brandBookSection",
  "designReview",
  "tokensExport",
  "htmlMockup",
] as const;

export type DesignNodeType = (typeof DESIGN_NODE_TYPES)[number];

export interface DesignFlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface DesignFlowNode {
  id: string;
  type: DesignNodeType | string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: Record<string, unknown>;
  zIndex?: number;
  parentId?: string;
  extent?: "parent" | [[number, number], [number, number]];
}

export interface DesignFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface DesignCanvasSnapshot {
  nodes: DesignFlowNode[];
  edges: DesignFlowEdge[];
  viewport?: DesignFlowViewport;
}

export interface BrandPaletteColor {
  hex: string;
  name?: string;
  role?: string;
}

export interface BrandPalette {
  id: string;
  name: string;
  colors: BrandPaletteColor[];
  createdAt: string;
}

export interface BrandTypographyFace {
  family: string;
  weight?: string | number;
  category?: "sans" | "serif" | "mono" | "display" | "handwritten";
}

export interface BrandTypography {
  id: string;
  name: string;
  display: BrandTypographyFace;
  body: BrandTypographyFace;
  sampleText?: string;
  createdAt: string;
}

export interface BrandLogoConcept {
  id: string;
  name: string;
  brief: string;
  imageUrl: string;
  rationale?: string;
  createdAt: string;
}

export interface BrandBookSection {
  id: string;
  section:
    | "mission"
    | "audience"
    | "voice"
    | "principles"
    | "logoUsage"
    | "doDont"
    | "custom";
  title: string;
  body: string;
  updatedAt: string;
}

export interface DesignReviewScore {
  category:
    | "brandFit"
    | "hierarchy"
    | "contrast"
    | "consistency"
    | "craft";
  score: number;
  notes: string;
}

export interface DesignReview {
  id: string;
  targetUrl: string;
  scores: DesignReviewScore[];
  summary: string;
  createdAt: string;
}

export interface TokensExport {
  id: string;
  paletteId?: string;
  typographyId?: string;
  css: string;
  tailwind: string;
  json: string;
  generatedAt: string;
}

export interface DesignBrandingConfig {
  specialist: typeof DESIGN_BRANDING_SPECIALIST_ID;
  version: number;
  workspaceId: string;
  canvasSnapshot: DesignCanvasSnapshot;
  brandBook: BrandBookSection[];
  palettes: BrandPalette[];
  typography: BrandTypography[];
  logos: BrandLogoConcept[];
  reviews: DesignReview[];
  tokensExports: TokensExport[];
  outputLanguage?: string;
  updatedAt: string;
}

export interface DesignBrandingWorkspace {
  id: string;
  name: string;
  date?: string;
  storage?: string;
  configurations?: DesignBrandingConfig;
}

export type DesignBrandingConfigSanitized = DesignBrandingConfig;
