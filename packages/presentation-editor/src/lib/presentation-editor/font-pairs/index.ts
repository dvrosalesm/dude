/**
 * Font pair registry — curated Google Fonts pairings that lock the agent's
 * typography decisions. The user picks one in the UI; the key is persisted
 * in workspace config and injected into every generate_slide prompt.
 */

export interface FontPair {
  /** Stable key. */
  key: string;
  /** Display label. */
  label: string;
  /** Short description. */
  description: string;
  /** Display / headline font family, as written in CSS `font-family`. */
  display: string;
  /** Body font family. */
  body: string;
  /** Exact Google Fonts CSS2 URL loading both fonts. */
  googleFontsUrl: string;
}

export const DEFAULT_FONT_PAIR = "system";

export const FONT_PAIRS: FontPair[] = [
  {
    key: "system",
    label: "System",
    description: "Default system sans",
    display: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    googleFontsUrl: "",
  },
  {
    key: "inter-inter",
    label: "Inter Duo",
    description: "Clean, neutral",
    display: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  },
  {
    key: "playfair-inter",
    label: "Playfair + Inter",
    description: "Editorial serif + clean sans",
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700;800;900&display=swap",
  },
  {
    key: "cormorant-inter",
    label: "Cormorant + Inter",
    description: "Elegant serif + modern sans",
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500&display=swap",
  },
  {
    key: "dmsans-dmserif",
    label: "DM Serif + DM Sans",
    description: "Warm, expressive",
    display: "'DM Serif Display', Georgia, serif",
    body: "'DM Sans', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=swap",
  },
  {
    key: "archivo-archivo",
    label: "Archivo Duo",
    description: "Bold, architectural",
    display: "'Archivo Black', Impact, sans-serif",
    body: "'Archivo', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600&display=swap",
  },
  {
    key: "plex-plex",
    label: "IBM Plex",
    description: "Mono + Sans technical",
    display: "'IBM Plex Sans', system-ui, sans-serif",
    body: "'IBM Plex Mono', ui-monospace, monospace",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600;700&display=swap",
  },
  {
    key: "space-space",
    label: "Space Duo",
    description: "Geometric + mono",
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Space Mono', ui-monospace, monospace",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Space+Mono:wght@400;700&display=swap",
  },
  {
    key: "bodoni-inter",
    label: "Bodoni + Inter",
    description: "Fashion editorial",
    display: "'Bodoni Moda', 'Didot', serif",
    body: "'Inter', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@700;800;900&family=Inter:wght@400;500&display=swap",
  },
  {
    key: "unifraktur-garamond",
    label: "UnifrakturCook + EB Garamond",
    description: "Medieval manuscript",
    display: "'UnifrakturCook', 'UnifrakturMaguntia', serif",
    body: "'EB Garamond', Garamond, serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;700&family=UnifrakturCook:wght@700&display=swap",
  },
  {
    key: "orbitron-plex",
    label: "Orbitron + Plex Mono",
    description: "Tech / cyberpunk",
    display: "'Orbitron', 'Rajdhani', sans-serif",
    body: "'IBM Plex Mono', ui-monospace, monospace",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Orbitron:wght@600;700;800&display=swap",
  },
  {
    key: "monoton-inter",
    label: "Monoton + Inter",
    description: "Neon display",
    display: "'Monoton', Impact, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Monoton&display=swap",
  },
  {
    key: "bangers-inter",
    label: "Bangers + Inter",
    description: "Comic / pop art",
    display: "'Bangers', 'Luckiest Guy', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@500;700&display=swap",
  },
  {
    key: "vt323-plex",
    label: "VT323 + Plex Mono",
    description: "Terminal / CRT",
    display: "'VT323', 'IBM Plex Mono', ui-monospace, monospace",
    body: "'IBM Plex Mono', ui-monospace, monospace",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=VT323&display=swap",
  },
];

export function getFontPair(key: string | null | undefined): FontPair {
  const found = FONT_PAIRS.find((p) => p.key === key);
  return found || FONT_PAIRS[0];
}
