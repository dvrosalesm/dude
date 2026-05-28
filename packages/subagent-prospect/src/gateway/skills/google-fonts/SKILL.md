---
name: google-fonts
description: Choose and embed Google Fonts in landing pages. Use when picking typography, deciding on a font for a landing page, pairing display + body fonts, or asked to "make the font nicer", "use a better font", "modernize the typography", "what font should I use". Covers curated pairings by brand vibe (modern SaaS, editorial, friendly, bold, luxury), the exact `<link>` embed pattern, weight selection, performance hygiene (`display=swap`, requesting only weights used), and Latin Extended support for Spanish (LATAM market). Triggers: font, fonts, typography, google fonts, font pairing, font family, headline font, body font, type system, choose a font, pick a font.
---

# Google Fonts for Landing Pages

Pick a typeface that matches the brand vibe, embed it cleanly, and don't overdo it.

## Default rule

**One family, used well, beats two families used poorly.** If you can't articulate why a second font is needed, use a single family with weight contrast (e.g., 700 for headlines, 400 for body).

Most modern SaaS landing pages use exactly one font.

## Curated picks (by vibe)

Each pick is battle-tested, has full Latin Extended (Spanish á/é/í/ó/ú/ñ), and is a variable font so weight contrast is cheap.

| Vibe | Family | Why |
|---|---|---|
| **Modern SaaS / default** | `Inter` | Neutral, geometric, screen-optimized. Safe everywhere. |
| **Warm + friendly** | `Plus Jakarta Sans` | Rounder, more humanist than Inter. Good for B2C, education, wellness. |
| **Bold / startup energy** | `Space Grotesk` | Distinctive without being weird. Pairs with Inter for body. |
| **Editorial / premium** | `Fraunces` (display) + `Inter` (body) | Serif headlines, sans body. Use for higher-end positioning. |
| **Luxury / hospitality** | `Cormorant Garamond` (display) + `Inter` (body) | Elegant serif. Real-estate, food, fashion. |
| **Tech / monospace accent** | `JetBrains Mono` | Only for code/numbers in a section, never body. |
| **LATAM-friendly readable** | `DM Sans` | Slightly more open than Inter, reads well at small sizes in Spanish. |

When in doubt: **Inter**.

## Pairing rules

If you're using two families, follow this:

1. **Display family for `h1`–`h2` only.** Body, `h3+`, buttons, captions all use the body family.
2. **Contrast must be obvious.** A serif + sans pair works. Two sans-serifs only work if their proportions are clearly different (e.g., Space Grotesk + Inter).
3. **Match x-heights.** Mismatched x-heights look amateur. Pairings above are vetted.

## Embed pattern

Always use the `<link>` form (preconnect + stylesheet) inside `<head>`. Request **only** the weights you actually use. `display=swap` is non-negotiable.

### Single family (most cases)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">

<style>
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
</style>
```

### Display + body pair

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">

<style>
  body { font-family: 'Inter', system-ui, sans-serif; }
  h1, h2 { font-family: 'Fraunces', Georgia, serif; }
</style>
```

### Variable font (lighter request, more weight flexibility)

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" rel="stylesheet">
```

The `400..700` range loads one variable file you can use at any weight in between. Prefer this over listing 4 discrete weights.

## Weight choices

A clean system uses **2–3 weights max**:

- `400` — body
- `600` — buttons, mid-emphasis labels
- `700` — headlines

Skip `300` (looks weak on most screens) and `900` (rarely needed). If a design calls for `500`, fine, but don't ship every weight "just in case" — every weight is a separate font file download.

## Performance hygiene

- ✅ `display=swap` always. Without it, browsers hide text until the font loads ("FOIT").
- ✅ Preconnect to both `fonts.googleapis.com` and `fonts.gstatic.com`.
- ✅ Request only weights you use.
- ✅ Always include a system fallback in `font-family` (`system-ui, -apple-system, sans-serif`).
- ❌ Don't load fonts via `@import` in `<style>` — it blocks render longer than `<link>`.
- ❌ Don't request more than 2 families.

## Spanish / LATAM characters

All families above include Latin Extended by default. If you pick a font outside this list, **verify it includes `latin-ext`** in the Google Fonts charset selector — without it, accented Spanish characters fall back to the system font and look mismatched.

## Anti-patterns

- Comic Sans, Papyrus, anything quirky. Even ironically. No.
- More than 2 families on a page.
- Using a display font for body text. Display fonts are tuned for large sizes and look noisy at 16px.
- Loading 6+ weights "to have options."
- Forgetting `display=swap`.

## Quick decision tree

1. Is the brand defined? → Use whatever the brand specifies; don't second-guess it.
2. Is it a SaaS / B2B product? → **Inter**, weights 400/600/700.
3. Is it consumer / lifestyle / education? → **Plus Jakarta Sans** or **DM Sans**.
4. Is it premium / editorial / hospitality? → **Fraunces** (or **Cormorant Garamond**) for headlines, **Inter** for body.
5. Still unsure? → **Inter**. Ship it, iterate later.
