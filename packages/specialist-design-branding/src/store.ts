import { create } from "zustand";
import type {
  BrandBookSection,
  BrandLogoConcept,
  BrandPalette,
  BrandTypography,
  DesignCanvasSnapshot,
  DesignReview,
  TokensExport,
} from "@dude/specialist-design-branding/lib/types";

interface DesignBrandingState {
  workspaceId: string | null;
  canvasSnapshot: DesignCanvasSnapshot;
  brandBook: BrandBookSection[];
  palettes: BrandPalette[];
  typography: BrandTypography[];
  logos: BrandLogoConcept[];
  reviews: DesignReview[];
  tokensExports: TokensExport[];
  loading: boolean;
  setWorkspaceData(data: Partial<DesignBrandingState>): void;
  setCanvasSnapshot(snapshot: DesignCanvasSnapshot): void;
  setBrandBook(brandBook: BrandBookSection[]): void;
  setPalettes(palettes: BrandPalette[]): void;
  setTypography(typography: BrandTypography[]): void;
  setLogos(logos: BrandLogoConcept[]): void;
  setReviews(reviews: DesignReview[]): void;
  setTokensExports(exports: TokensExport[]): void;
  reset(): void;
}

const EMPTY_SNAPSHOT: DesignCanvasSnapshot = { nodes: [], edges: [] };

export const useDesignBrandingStore = create<DesignBrandingState>((set) => ({
  workspaceId: null,
  canvasSnapshot: EMPTY_SNAPSHOT,
  brandBook: [],
  palettes: [],
  typography: [],
  logos: [],
  reviews: [],
  tokensExports: [],
  loading: true,

  setWorkspaceData: (data) => set((state) => ({ ...state, ...data })),
  setCanvasSnapshot: (canvasSnapshot) => set({ canvasSnapshot }),
  setBrandBook: (brandBook) => set({ brandBook }),
  setPalettes: (palettes) => set({ palettes }),
  setTypography: (typography) => set({ typography }),
  setLogos: (logos) => set({ logos }),
  setReviews: (reviews) => set({ reviews }),
  setTokensExports: (tokensExports) => set({ tokensExports }),

  reset: () =>
    set({
      workspaceId: null,
      canvasSnapshot: EMPTY_SNAPSHOT,
      brandBook: [],
      palettes: [],
      typography: [],
      logos: [],
      reviews: [],
      tokensExports: [],
      loading: true,
    }),
}));
