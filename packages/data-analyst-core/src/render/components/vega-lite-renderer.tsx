"use client";

import { sanitizeVegaLiteSpec } from "../utils";

type VegaLiteChartProps = {
  spec: Record<string, unknown>;
};

function buildVegaLiteSrcDoc(spec: unknown): string {
  const safeSpecObject = JSON.parse(JSON.stringify(spec ?? {}));
  const safeSpec = JSON.stringify(safeSpecObject).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>html,body,#vis{margin:0;padding:0;width:100%;height:100%;background:transparent;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}*,*::before,*::after{box-sizing:border-box}</style><script src="https://cdn.jsdelivr.net/npm/vega@5"></script><script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script><script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script></head><body><div id="vis"></div><script>(function(){const spec=${safeSpec};vegaEmbed("#vis",spec,{actions:false,mode:"vega-lite",renderer:"svg"}).catch(function(err){document.body.innerHTML='<pre style="padding:8px;color:#b91c1c;font-size:12px;white-space:pre-wrap;">'+String(err&&err.message?err.message:err)+'</pre>';});})();</script></body></html>`;
}

export function VegaLiteRenderer({ props }: { props: VegaLiteChartProps }) {
  console.log("[VegaLiteRenderer] received spec:", JSON.stringify(props.spec).slice(0, 500));
  const sanitized = sanitizeVegaLiteSpec(props.spec);

  if (!sanitized) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Invalid Vega-Lite spec
      </div>
    );
  }

  return (
    <iframe
      title="Vega-Lite chart"
      srcDoc={buildVegaLiteSrcDoc(sanitized)}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-transparent"
    />
  );
}
