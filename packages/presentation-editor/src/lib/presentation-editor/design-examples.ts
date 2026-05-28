/**
 * Curated HTML slide examples that define the design quality bar.
 * The agent learns taste from these — they replace verbose design rules.
 *
 * Each example is a complete, self-contained HTML slide that demonstrates
 * good typography, spacing, hierarchy, and color usage. The agent should
 * pattern-match from these, not copy them literally.
 */

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const EXAMPLE_TITLE_LIGHT = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root{--bg:#faf8f5;--accent:#d4552a;--text:#1a1a1a;--muted:#6b6560}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;display:flex;align-items:center;padding:8cqmin 10cqmin}
.content{max-width:60%}
.bar{width:6cqmin;height:.5cqmin;background:var(--accent);border-radius:4px;margin-bottom:4cqmin}
.tag{font-size:1.8cqmin;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);margin-bottom:2.5cqmin}
h1{font-size:clamp(32px,6cqmin,68px);font-weight:800;line-height:1.08;
  letter-spacing:-.03em;margin-bottom:3cqmin}
p{font-size:clamp(14px,2.4cqmin,22px);color:var(--muted);line-height:1.55;max-width:36ch}
</style></head><body>
<div class="content">
<div class="bar"></div>
<div class="tag">2026 Strategy</div>
<h1>The future belongs to those who build it</h1>
<p>A roadmap for scaling operations, expanding markets, and delivering measurable impact.</p>
</div>
<script type="application/json" id="slide-controls">[
{"type":"text","id":"headline","label":"Headline","selector":"h1","value":"The future belongs to those who build it"},
{"type":"text","id":"subtitle","label":"Subtitle","selector":"p","value":"A roadmap for scaling..."},
{"type":"color","id":"accent","label":"Accent","variable":"--accent","value":"#d4552a"},
{"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#faf8f5"}
]</script>
</body></html>`;

const EXAMPLE_STAT_DARK = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root{--bg:#0a0a0a;--accent:#22c55e;--text:#fafafa;--muted:#737373}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:8cqmin 10cqmin}
.number{font-size:clamp(72px,18cqmin,200px);font-weight:800;line-height:.9;
  letter-spacing:-.05em;color:var(--accent)}
h2{font-size:clamp(18px,3.2cqmin,32px);font-weight:600;margin-top:3cqmin;line-height:1.3}
p{font-size:clamp(13px,2.2cqmin,18px);color:var(--muted);margin-top:1.5cqmin;
  max-width:36ch;line-height:1.5}
</style></head><body>
<div class="number">73%</div>
<h2>Reduction in response time</h2>
<p>After deploying automated routing, average wait dropped from 12 minutes to under 3.</p>
<script type="application/json" id="slide-controls">[
{"type":"text","id":"stat","label":"Statistic","selector":".number","value":"73%"},
{"type":"text","id":"headline","label":"Headline","selector":"h2","value":"Reduction in response time"},
{"type":"color","id":"accent","label":"Stat Color","variable":"--accent","value":"#22c55e"},
{"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#0a0a0a"}
]</script>
</body></html>`;

const EXAMPLE_BENTO = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root{--bg:#111;--accent:#a78bfa;--text:#fafafa;--muted:#737373;--cell:#1a1a1a}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;padding:6cqmin;display:flex;flex-direction:column;gap:4cqmin}
h1{font-size:clamp(20px,3.5cqmin,36px);font-weight:700}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2cqmin;flex:1}
.cell{background:var(--cell);border-radius:1.5cqmin;padding:3.5cqmin 3cqmin;
  display:flex;flex-direction:column;justify-content:flex-end}
.cell.wide{grid-column:span 2}
.val{font-size:clamp(32px,7cqmin,80px);font-weight:800;line-height:1;color:var(--accent)}
.cell.wide .val{font-size:clamp(40px,10cqmin,100px)}
.lab{font-size:clamp(11px,1.8cqmin,15px);color:var(--muted);text-transform:uppercase;
  letter-spacing:.08em;margin-top:1.5cqmin}
</style></head><body>
<h1>Q1 Performance</h1>
<div class="grid">
<div class="cell wide"><div class="val">$2.4M</div><div class="lab">Revenue</div></div>
<div class="cell"><div class="val">89%</div><div class="lab">Retention</div></div>
<div class="cell"><div class="val">142</div><div class="lab">New accounts</div></div>
<div class="cell"><div class="val">4.8</div><div class="lab">NPS score</div></div>
<div class="cell"><div class="val">23d</div><div class="lab">Avg close time</div></div>
</div>
<script type="application/json" id="slide-controls">[
{"type":"text","id":"title","label":"Title","selector":"h1","value":"Q1 Performance"},
{"type":"color","id":"accent","label":"Accent","variable":"--accent","value":"#a78bfa"},
{"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#111111"},
{"type":"color","id":"cell","label":"Card","variable":"--cell","value":"#1a1a1a"}
]</script>
</body></html>`;

const EXAMPLE_QUOTE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root{--bg:#faf8f5;--text:#1a1a1a;--muted:#999}
*{margin:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--text);
  min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:10cqmin 12cqmin}
.mark{font-size:clamp(48px,10cqmin,120px);color:var(--muted);opacity:.25;line-height:1;
  margin-bottom:2cqmin}
blockquote{font-size:clamp(24px,4.5cqmin,48px);line-height:1.35;font-weight:400;
  font-style:italic;max-width:22ch}
cite{display:block;margin-top:4cqmin;font-size:clamp(12px,2cqmin,18px);font-style:normal;
  font-family:system-ui,sans-serif;color:var(--muted);letter-spacing:.04em}
</style></head><body>
<div class="mark">&ldquo;</div>
<blockquote>The best way to predict the future is to invent it.</blockquote>
<cite>Alan Kay</cite>
<script type="application/json" id="slide-controls">[
{"type":"text","id":"quote","label":"Quote","selector":"blockquote","value":"The best way to predict the future is to invent it."},
{"type":"text","id":"cite","label":"Attribution","selector":"cite","value":"Alan Kay"},
{"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#faf8f5"}
]</script>
</body></html>`;

const EXAMPLE_SPLIT = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root{--bg:#fff;--accent:#2563eb;--text:#0f172a;--muted:#64748b;--panel:#eff6ff}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;display:grid;grid-template-columns:1.15fr .85fr}
.left{padding:7cqmin 6cqmin;display:flex;flex-direction:column;justify-content:center}
.kicker{font-size:1.8cqmin;font-weight:700;text-transform:uppercase;letter-spacing:.12em;
  color:var(--accent);margin-bottom:2.5cqmin}
h1{font-size:clamp(24px,4cqmin,42px);font-weight:800;line-height:1.15;
  letter-spacing:-.02em;margin-bottom:3cqmin}
ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:2cqmin}
li{font-size:clamp(13px,2.2cqmin,18px);color:var(--muted);line-height:1.5;
  padding-left:3cqmin;position:relative}
li::before{content:'';position:absolute;left:0;top:.6em;width:1.2cqmin;height:1.2cqmin;
  border-radius:50%;background:var(--accent)}
.right{background:var(--panel);display:flex;align-items:center;justify-content:center;
  overflow:hidden}
.visual{width:55%;aspect-ratio:1;border-radius:3cqmin;
  background:linear-gradient(135deg,var(--accent),#7c3aed);opacity:.85}
</style></head><body>
<div class="left">
<div class="kicker">Our Approach</div>
<h1>Three principles that guide every decision</h1>
<ul>
<li>Ship fast, measure everything, iterate weekly</li>
<li>Default to transparency — dashboards over status meetings</li>
<li>Hire generalists who own problems end-to-end</li>
</ul>
</div>
<div class="right"><div class="visual"></div></div>
<script type="application/json" id="slide-controls">[
{"type":"text","id":"headline","label":"Headline","selector":"h1","value":"Three principles that guide every decision"},
{"type":"color","id":"accent","label":"Accent","variable":"--accent","value":"#2563eb"},
{"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#ffffff"},
{"type":"color","id":"panel","label":"Panel","variable":"--panel","value":"#eff6ff"}
]</script>
</body></html>`;

const EXAMPLE_CAROUSEL = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
:root{--bg:#0f172a;--accent:#f59e0b;--text:#f8fafc;--muted:#94a3b8}
*{margin:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;display:flex;flex-direction:column;justify-content:center;
  padding:12vh 10vw;gap:5vh}
.num{font-size:clamp(24px,4vmin,36px);font-weight:700;color:var(--accent);letter-spacing:.1em}
h1{font-size:clamp(48px,9vmin,84px);font-weight:800;line-height:1.08;letter-spacing:-.02em}
p{font-size:clamp(28px,4.5vmin,44px);color:var(--muted);line-height:1.35}
</style></head><body>
<div class="num">03</div>
<h1>Stop selling features</h1>
<p>Sell the outcome your customer actually wants.</p>
<script type="application/json" id="slide-controls">[
{"type":"text","id":"headline","label":"Headline","selector":"h1","value":"Stop selling features"},
{"type":"text","id":"body","label":"Body","selector":"p","value":"Sell the outcome your customer actually wants."},
{"type":"color","id":"accent","label":"Accent","variable":"--accent","value":"#f59e0b"},
{"type":"color","id":"bg","label":"Background","variable":"--bg","value":"#0f172a"}
]</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildDesignExamplesSection(): string {
  return [
    "## DESIGN REFERENCE — YOUR QUALITY BAR",
    "",
    "Study these examples. They define the standard. Don't copy them literally —",
    "absorb the taste: typography scale, spacing, restraint, hierarchy, color",
    "relationships. Then apply that sensibility to whatever the user needs.",
    "",
    "### Title slide — warm, light",
    "```html",
    EXAMPLE_TITLE_LIGHT,
    "```",
    "",
    "### Impact stat — dark, dramatic",
    "```html",
    EXAMPLE_STAT_DARK,
    "```",
    "",
    "### Metrics grid — bento layout",
    "```html",
    EXAMPLE_BENTO,
    "```",
    "",
    "### Quote — typographic, generous whitespace",
    "```html",
    EXAMPLE_QUOTE,
    "```",
    "",
    "### Content — asymmetric split",
    "```html",
    EXAMPLE_SPLIT,
    "```",
    "",
    "### Carousel slide (portrait) — bold, phone-optimized",
    "```html",
    EXAMPLE_CAROUSEL,
    "```",
  ].join("\n");
}
