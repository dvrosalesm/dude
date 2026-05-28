/**
 * Premium HTML slide templates — tokenized layouts for agents to instantiate
 * instead of inventing CSS from scratch every time.
 *
 * Each template returns a complete HTML document string. Agents should fill
 * placeholders and keep CSS variables for sidebar controls.
 */

export type TemplateId =
  | "hero-left-copy-right-visual"
  | "full-bleed-quote"
  | "stats-bento"
  | "timeline-editorial"
  | "team-feature-premium"
  | "closing-cta";

export const TEMPLATE_CATALOG: Record<
  TemplateId,
  { name: string; when: string; tokens: string[] }
> = {
  "hero-left-copy-right-visual": {
    name: "Hero — copy left, visual right",
    when: "Opening beats, product moments, one big claim + one strong image",
    tokens: ["--bg", "--accent", "--text", "--muted"],
  },
  "full-bleed-quote": {
    name: "Full-bleed quote",
    when: "Testimonials, mission lines, emotional beats",
    tokens: ["--bg", "--accent", "--text"],
  },
  "stats-bento": {
    name: "Stats bento",
    when: "3–6 KPIs, metrics grid (landscape decks only — not portrait carousels)",
    tokens: ["--bg", "--accent", "--surface", "--text"],
  },
  "timeline-editorial": {
    name: "Timeline editorial",
    when: "Roadmaps, history, sequential story (use vertical stack for 9:16)",
    tokens: ["--bg", "--accent", "--text", "--muted"],
  },
  "team-feature-premium": {
    name: "Team / roster premium",
    when: "People slides — prefer real photos in <img>; avoid tiny initials-only cards",
    tokens: ["--bg", "--accent", "--text", "--muted"],
  },
  "closing-cta": {
    name: "Closing / CTA",
    when: "Final slide: summary, next step, contact",
    tokens: ["--bg", "--accent", "--text"],
  },
};

/** Minimal slide-controls JSON block (agent should extend with real selectors). */
const CONTROLS_STUB = `[
  {"type":"color","id":"accent","label":"Accent","variable":"--accent","value":"#c9a227"},
  {"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#0b1426"},
  {"type":"text","id":"headline","label":"Headline","selector":"h1","value":""}
]`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTemplateHeroLeftCopyRightVisual(opts: {
  headline: string;
  subline: string;
  imageAlt?: string;
  /** Optional data URL or https image */
  imageSrc?: string;
}): string {
  const img = opts.imageSrc
    ? `<img class="hero-img" src="${escapeHtml(opts.imageSrc)}" alt="${escapeHtml(opts.imageAlt || "")}" />`
    : `<div class="hero-placeholder" aria-hidden="true"></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
:root{--bg:#0b1426;--accent:#c9a227;--text:#f8fafc;--muted:#94a3b8;--panel:rgba(15,23,42,.55)}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:grid;grid-template-columns:1.05fr 0.95fr;gap:0;overflow:hidden}
.left{display:flex;flex-direction:column;justify-content:center;padding:6cqmin 6cqmin 6cqmin 8cqmin}
.kicker{font-size:2.8cqmin;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:2cqmin}
h1{font-size:clamp(40px,5.5cqmin,56px);font-weight:800;line-height:1.12;letter-spacing:-.02em}
p.sub{margin-top:2.5cqmin;font-size:clamp(22px,2.8cqmin,28px);color:var(--muted);line-height:1.45;max-width:42ch}
.right{position:relative;min-height:100vh;background:linear-gradient(135deg,rgba(15,23,42,.4),transparent)}
.hero-img{width:100%;height:100%;object-fit:cover;display:block}
.hero-placeholder{width:100%;height:100%;background:radial-gradient(circle at 30% 40%,rgba(201,162,39,.25),transparent 55%),linear-gradient(160deg,#0f172a,#020617)}
@media (max-aspect-ratio:1/1){body{grid-template-columns:1fr;grid-template-rows:auto 1fr}.right{min-height:45vh}}
</style></head><body>
<div class="left"><div class="kicker">Focus</div><h1>${escapeHtml(opts.headline)}</h1><p class="sub">${escapeHtml(opts.subline)}</p></div>
<div class="right">${img}</div>
<script type="application/json" id="slide-controls">${CONTROLS_STUB}</script>
</body></html>`;
}

export function renderTemplateTeamFeaturePremium(opts: {
  title: string;
  subtitle: string;
  members: Array<{ name: string; role: string; detail?: string; imageSrc?: string }>;
}): string {
  const cards = opts.members
    .map(
      (m) => `
    <article class="card">
      <div class="photo">${m.imageSrc ? `<img src="${escapeHtml(m.imageSrc)}" alt="" />` : `<div class="ph"></div>`}</div>
      <div class="meta">
        <div class="name">${escapeHtml(m.name)}</div>
        <div class="role">${escapeHtml(m.role)}</div>
        ${m.detail ? `<div class="detail">${escapeHtml(m.detail)}</div>` : ""}
      </div>
    </article>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
:root{--bg:#0b1426;--accent:#c9a227;--text:#f8fafc;--muted:#94a3b8;--card:#111827}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:5cqmin 6cqmin;display:flex;flex-direction:column;gap:4cqmin}
header .k{font-size:2.6cqmin;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
header h1{font-size:clamp(34px,4.5cqmin,44px);font-weight:800;margin-top:1.5cqmin;line-height:1.15}
header p{color:var(--muted);font-size:2.6cqmin;margin-top:1cqmin;max-width:52ch;line-height:1.4}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:3cqmin;flex:1;min-height:0}
.card{background:var(--card);border-radius:2cqmin;padding:3cqmin;display:grid;grid-template-columns:22cqmin 1fr;gap:3cqmin;align-items:center;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.photo{width:22cqmin;height:22cqmin;border-radius:1.5cqmin;overflow:hidden;border:2px solid rgba(201,162,39,.35)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.ph{width:100%;height:100%;background:linear-gradient(145deg,#1e293b,#0f172a)}
.name{font-weight:700;font-size:3cqmin}
.role{font-size:2.2cqmin;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;margin-top:.6cqmin}
.detail{font-size:2.2cqmin;color:var(--muted);margin-top:1cqmin}
@media (max-aspect-ratio:1/1){.grid{grid-template-columns:1fr}}
</style></head><body>
<header><div class="k">Team</div><h1>${escapeHtml(opts.title)}</h1><p>${escapeHtml(opts.subtitle)}</p></header>
<div class="grid">${cards}</div>
<script type="application/json" id="slide-controls">${CONTROLS_STUB}</script>
</body></html>`;
}

export function renderTemplateStatsBento(opts: {
  title: string;
  stats: Array<{ label: string; value: string; hint?: string }>;
}): string {
  const cells = opts.stats
    .map(
      (s) => `
    <div class="cell">
      <div class="val">${escapeHtml(s.value)}</div>
      <div class="lab">${escapeHtml(s.label)}</div>
      ${s.hint ? `<div class="hint">${escapeHtml(s.hint)}</div>` : ""}
    </div>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
:root{--bg:#0f172a;--accent:#38bdf8;--text:#f8fafc;--muted:#94a3b8;--cell:rgba(30,41,59,.9)}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:5cqmin 6cqmin}
h1{font-size:clamp(32px,4cqmin,40px);font-weight:800;margin-bottom:4cqmin}
.bento{display:grid;grid-template-columns:repeat(3,1fr);gap:2.5cqmin}
.cell{background:var(--cell);border-radius:2cqmin;padding:3.5cqmin 3cqmin;display:flex;flex-direction:column;gap:1cqmin}
.val{font-size:clamp(44px,6cqmin,72px);font-weight:800;color:var(--accent);line-height:1}
.lab{font-size:2.4cqmin;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.hint{font-size:2.2cqmin;color:var(--muted);line-height:1.35}
@media (max-width:600px){.bento{grid-template-columns:1fr}}
</style></head><body>
<h1>${escapeHtml(opts.title)}</h1>
<div class="bento">${cells}</div>
<script type="application/json" id="slide-controls">${CONTROLS_STUB}</script>
</body></html>`;
}

export function renderTemplateFullBleedQuote(opts: { quote: string; attribution: string }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
:root{--bg:#020617;--accent:#fbbf24;--text:#f8fafc;--muted:#64748b}
*{margin:0;box-sizing:border-box}
body{font-family:Georgia,serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:8cqmin 10cqmin}
blockquote{font-size:clamp(32px,4.2cqmin,42px);line-height:1.35;font-weight:600;max-width:28ch}
cite{margin-top:4cqmin;font-size:2.6cqmin;font-style:normal;color:var(--muted);font-family:system-ui,sans-serif}
.accent{width:8cqmin;height:.5cqmin;background:var(--accent);margin-bottom:4cqmin;border-radius:2px}
</style></head><body>
<div class="accent"></div>
<blockquote>${escapeHtml(opts.quote)}</blockquote>
<cite>${escapeHtml(opts.attribution)}</cite>
<script type="application/json" id="slide-controls">${CONTROLS_STUB}</script>
</body></html>`;
}

export function renderTemplateTimelineEditorial(opts: { title: string; steps: Array<{ t: string; d: string }> }): string {
  const rows = opts.steps
    .map(
      (s) => `
    <div class="row">
      <div class="dot"></div>
      <div><div class="t">${escapeHtml(s.t)}</div><div class="d">${escapeHtml(s.d)}</div></div>
    </div>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
:root{--bg:#0b1426;--accent:#38bdf8;--text:#f8fafc;--muted:#94a3b8}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:6cqmin 8cqmin}
h1{font-size:clamp(30px,4cqmin,38px);font-weight:800;margin-bottom:5cqmin}
.stack{display:flex;flex-direction:column;gap:3.5cqmin}
.row{display:grid;grid-template-columns:3cqmin 1fr;gap:3cqmin;align-items:start}
.dot{width:2.4cqmin;height:2.4cqmin;border-radius:50%;background:var(--accent);margin-top:.8cqmin;box-shadow:0 0 0 4px rgba(56,189,248,.2)}
.t{font-weight:700;font-size:3cqmin}
.d{color:var(--muted);font-size:2.6cqmin;margin-top:.8cqmin;line-height:1.45;max-width:50ch}
</style></head><body>
<h1>${escapeHtml(opts.title)}</h1>
<div class="stack">${rows}</div>
<script type="application/json" id="slide-controls">${CONTROLS_STUB}</script>
</body></html>`;
}

export function renderTemplateClosingCta(opts: { headline: string; line: string; cta: string }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
:root{--bg:#0f172a;--accent:#c9a227;--text:#f8fafc;--muted:#94a3b8}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:8cqmin}
h1{font-size:clamp(36px,5cqmin,52px);font-weight:800;max-width:18ch;line-height:1.12}
p{margin-top:3cqmin;font-size:2.8cqmin;color:var(--muted);max-width:36ch;line-height:1.45}
.cta{margin-top:5cqmin;display:inline-block;padding:2.2cqmin 5cqmin;border-radius:999px;background:var(--accent);color:#0f172a;font-weight:800;font-size:2.6cqmin}
</style></head><body>
<h1>${escapeHtml(opts.headline)}</h1>
<p>${escapeHtml(opts.line)}</p>
<div class="cta">${escapeHtml(opts.cta)}</div>
<script type="application/json" id="slide-controls">${CONTROLS_STUB}</script>
</body></html>`;
}

/** Prompt appendix: list templates for document-editor-config */
export function buildTemplatePromptSection(): string {
  const lines: string[] = [
    "",
    "## PREMIUM HTML TEMPLATES (use these instead of improvising weak layouts)",
    "Prefer instantiating or adapting these template families so slides stay cohesive:",
  ];
  for (const [id, meta] of Object.entries(TEMPLATE_CATALOG)) {
    lines.push(`- **${id}**: ${meta.name} — ${meta.when} (CSS vars: ${meta.tokens.join(", ")})`);
  }
  lines.push(
    "When building HTML slides, start from the closest template conceptually: hero split, quote, bento stats, timeline, team roster with real imagery, or closing CTA.",
    "For team slides: use real <img> portraits from web_search when possible; avoid four tiny initials-only circles with huge empty space below.",
    "",
  );
  return lines.join("\n");
}
