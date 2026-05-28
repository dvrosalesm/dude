"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";
import { cn } from "@dude/ui/utils";
import { ShaderCanvas, renderShaderFrame, parseCustomUniforms } from "./shader-canvas";

/** Renders a shader to a static 2D canvas thumbnail. WebGL context is created and destroyed immediately. */
function ShaderThumbnail({ fragment, seed, className, style }: { fragment: string; seed: number; className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef<string | null>(null);
  const key = `${fragment.length}:${seed}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || renderedRef.current === key) return;
    renderedRef.current = key;

    // Render on a temporary offscreen canvas, then copy to 2D
    const offscreen = document.createElement("canvas");
    offscreen.width = 160;
    offscreen.height = 90;
    const ok = renderShaderFrame(offscreen, fragment, seed, 0);
    if (ok) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 160;
        canvas.height = 90;
        ctx.drawImage(offscreen, 0, 0);
      }
    }
    // offscreen canvas and its WebGL context are garbage collected
  }, [fragment, seed, key]);

  return <canvas ref={canvasRef} className={className} style={style} />;
}

export type ShaderPreset = {
  name: string;
  category: string;
  fragment: string;
};

export const SHADER_PRESETS: ShaderPreset[] = [
  {
    name: "Aurora",
    category: "Organic",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.4 + u_seed;
  float wave1 = sin(uv.x * 6.0 + t) * 0.5 + 0.5;
  float wave2 = sin(uv.x * 4.0 - t * 1.3 + uv.y * 3.0) * 0.5 + 0.5;
  float wave3 = sin(uv.y * 5.0 + t * 0.7) * 0.5 + 0.5;
  float mask = smoothstep(0.2, 0.8, uv.y + sin(uv.x * 3.0 + t) * 0.15);
  vec3 c1 = vec3(0.05, 0.0, 0.15);
  vec3 c2 = vec3(0.0, 0.8, 0.6);
  vec3 c3 = vec3(0.4, 0.0, 0.8);
  vec3 c4 = vec3(0.0, 0.4, 0.9);
  vec3 col = mix(c1, mix(c2, mix(c3, c4, wave3), wave2), wave1 * mask);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Sunset",
    category: "Gradient",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.3 + u_seed;
  vec3 top = vec3(0.07, 0.0, 0.2);
  vec3 mid = vec3(0.8, 0.2, 0.4);
  vec3 bot = vec3(1.0, 0.6, 0.1);
  float n = sin(uv.x * 8.0 + t) * 0.02 + sin(uv.x * 3.0 - t * 0.7) * 0.01;
  float y = uv.y + n;
  vec3 col = y < 0.5 ? mix(bot, mid, y * 2.0) : mix(mid, top, (y - 0.5) * 2.0);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Ocean",
    category: "Gradient",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.5 + u_seed;
  float wave = sin(uv.x * 10.0 + t * 2.0) * 0.03 + sin(uv.x * 6.0 - t) * 0.02 + sin(uv.x * 15.0 + t * 3.0) * 0.01;
  float y = uv.y + wave;
  vec3 deep = vec3(0.0, 0.05, 0.2);
  vec3 mid = vec3(0.0, 0.3, 0.6);
  vec3 surf = vec3(0.3, 0.8, 0.9);
  vec3 col = y < 0.5 ? mix(surf, mid, y * 2.0) : mix(mid, deep, (y - 0.5) * 2.0);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Plasma",
    category: "Organic",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.6 + u_seed;
  float v1 = sin(uv.x * 10.0 + t);
  float v2 = sin(uv.y * 10.0 + t * 1.2);
  float v3 = sin((uv.x + uv.y) * 10.0 + t * 0.8);
  float v4 = sin(length(uv - 0.5) * 14.0 - t * 1.5);
  float v = (v1 + v2 + v3 + v4) * 0.25;
  vec3 col = vec3(
    sin(v * 3.14159 + 0.0) * 0.5 + 0.5,
    sin(v * 3.14159 + 2.094) * 0.5 + 0.5,
    sin(v * 3.14159 + 4.189) * 0.5 + 0.5
  );
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Nebula",
    category: "Organic",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.15 + u_seed;
  float n1 = fbm(uv * 3.0 + t * 0.3);
  float n2 = fbm(uv * 5.0 - t * 0.2 + 10.0);
  vec3 c1 = vec3(0.1, 0.0, 0.2);
  vec3 c2 = vec3(0.6, 0.1, 0.5);
  vec3 c3 = vec3(0.1, 0.3, 0.8);
  vec3 col = mix(c1, mix(c2, c3, n2), n1);
  float stars = step(0.98, hash(floor(uv * 200.0)));
  col += stars * 0.8;
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Mesh",
    category: "Geometric",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.2 + u_seed;
  vec2 grid = fract(uv * 12.0 + t * 0.05);
  float d = min(min(grid.x, 1.0 - grid.x), min(grid.y, 1.0 - grid.y));
  float line = smoothstep(0.0, 0.03, d);
  vec3 bg = mix(vec3(0.05, 0.05, 0.15), vec3(0.1, 0.1, 0.3), uv.y);
  vec3 lineCol = vec3(0.2, 0.5, 1.0);
  float pulse = sin(t * 2.0) * 0.3 + 0.7;
  vec3 col = mix(lineCol * pulse * 0.5, bg, line);
  float glow = (1.0 - line) * 0.3 * pulse;
  col += lineCol * glow;
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Liquid",
    category: "Organic",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.3 + u_seed;
  vec2 q = vec2(fbm(uv + t * 0.1), fbm(uv + vec2(1.7, 9.2) + t * 0.15));
  vec2 r = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2) + t * 0.1), fbm(uv + 4.0 * q + vec2(8.3, 2.8) + t * 0.12));
  float f = fbm(uv + 4.0 * r);
  vec3 col = mix(vec3(0.1, 0.3, 0.5), vec3(0.9, 0.6, 0.2), f);
  col = mix(col, vec3(0.0, 0.2, 0.4), dot(q, q));
  col = mix(col, vec3(0.9, 0.4, 0.1), r.x * r.y);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Ripple",
    category: "Geometric",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.8 + u_seed;
  vec2 center = vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);
  float d = length(uv - center);
  float wave = sin(d * 30.0 - t * 4.0) * 0.5 + 0.5;
  wave *= exp(-d * 3.0);
  vec3 col = mix(vec3(0.02, 0.02, 0.08), vec3(0.2, 0.5, 1.0), wave);
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Warm Glow",
    category: "Gradient",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.3 + u_seed;
  vec2 center = vec2(0.5 + sin(t) * 0.08, 0.4 + cos(t * 0.7) * 0.05);
  float d = length(uv - center);
  vec3 inner = vec3(1.0, 0.85, 0.5);
  vec3 mid = vec3(0.95, 0.5, 0.2);
  vec3 outer = vec3(0.15, 0.05, 0.1);
  vec3 col = mix(inner, mid, smoothstep(0.0, 0.4, d));
  col = mix(col, outer, smoothstep(0.3, 0.9, d));
  gl_FragColor = vec4(col, 1.0);
}`,
  },
  {
    name: "Matrix",
    category: "Geometric",
    fragment: `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time + u_seed;
  float cols = 40.0;
  float col_id = floor(uv.x * cols);
  float speed = hash(vec2(col_id, 0.0)) * 0.5 + 0.3;
  float offset = hash(vec2(col_id, 1.0)) * 100.0;
  float char_y = fract(uv.y - t * speed + offset);
  float brightness = pow(char_y, 4.0);
  float flicker = step(0.7, hash(vec2(col_id, floor(t * 10.0 + uv.y * 20.0))));
  brightness *= (0.7 + flicker * 0.3);
  vec3 col = vec3(0.1, 0.9, 0.3) * brightness;
  gl_FragColor = vec4(col, 1.0);
}`,
  },
];

const CUSTOM_TEMPLATE = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

// Available uniforms:
//   u_resolution — canvas size in pixels
//   u_time       — elapsed seconds (animates)
//   u_seed       — random value, changes on Randomize

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time + u_seed;

  vec3 col = 0.5 + 0.5 * cos(t + uv.xyx + vec3(0, 2, 4));

  gl_FragColor = vec4(col, 1.0);
}`;

type TabMode = "presets" | "custom";

type EffectsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetLiveBackground?: (fragmentSrc: string, seed: number, customUniforms?: Record<string, number>, textureDataUrl?: string) => void;
  slideAspect?: number;
};

export function EffectsDialog({
  open,
  onOpenChange,
  onSetLiveBackground,
  slideAspect = 16 / 9,
}: EffectsDialogProps) {
  const [selected, setSelected] = useState(0);
  const [seed, setSeed] = useState(() => Math.random() * 10);
  const [tab, setTab] = useState<TabMode>("presets");
  const [customCode, setCustomCode] = useState(CUSTOM_TEMPLATE);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [textureImage, setTextureImage] = useState<HTMLImageElement | null>(null);
  const [textureName, setTextureName] = useState<string | null>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedCustom, setDebouncedCustom] = useState(CUSTOM_TEMPLATE);
  const [customUniformValues, setCustomUniformValues] = useState<Record<string, number>>({});

  // Cleanup texture object URL on unmount
  useEffect(() => {
    return () => {
      if (textureImage?.src?.startsWith("blob:")) URL.revokeObjectURL(textureImage.src);
    };
  }, [textureImage]);

  const handleTextureUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setTextureImage(img);
      setTextureName(file.name);
    };
    img.src = url;
  }, []);

  const activeFragment = tab === "custom" ? debouncedCustom : SHADER_PRESETS[selected].fragment;
  const detectedUniforms = tab === "custom" ? parseCustomUniforms(debouncedCustom) : [];

  const handleCustomCodeChange = useCallback((value: string) => {
    setCustomCode(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedCustom(value);
    }, 400);
  }, []);

  const handleRandomize = useCallback(() => {
    setSeed(Math.random() * 100);
  }, []);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleApplyLive = useCallback(() => {
    const frag = tab === "custom" ? customCode : SHADER_PRESETS[selected].fragment;
    // Convert texture image to data URL for storage
    let texDataUrl: string | undefined;
    if (textureImage) {
      const c = document.createElement("canvas");
      c.width = textureImage.naturalWidth;
      c.height = textureImage.naturalHeight;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(textureImage, 0, 0);
        texDataUrl = c.toDataURL("image/jpeg", 0.85);
      }
    }
    const uniforms = Object.keys(customUniformValues).length > 0 ? customUniformValues : undefined;
    onSetLiveBackground?.(frag, seed, uniforms, texDataUrl);
    onOpenChange(false);
  }, [tab, customCode, selected, seed, onSetLiveBackground, onOpenChange, textureImage, customUniformValues]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Effects</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setTab("presets")}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                tab === "presets" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              Presets
            </button>
            <button
              type="button"
              onClick={() => setTab("custom")}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                tab === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              Custom
            </button>
          </div>

          {/* Animated preview */}
          <div ref={previewContainerRef} className="rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
            <ShaderCanvas
              fragment={activeFragment}
              seed={seed}
              animate
              width={960}
              height={Math.round(960 / slideAspect)}
              className="w-full"
              style={{ aspectRatio: slideAspect }}
              textureImage={textureImage}
              customUniforms={customUniformValues}
              onError={(hasError) => {
                if (tab === "custom") setCompileError(hasError ? "Shader compilation failed — check your GLSL syntax" : null);
              }}
            />
          </div>

          {tab === "presets" ? (
            <div className="grid grid-cols-5 gap-2">
              {SHADER_PRESETS.map((preset, i) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    "rounded-lg overflow-hidden border-2 transition-all",
                    selected === i ? "border-[#E7C59A] shadow-md" : "border-gray-200 hover:border-gray-300",
                  )}
                >
                  <ShaderThumbnail
                    fragment={preset.fragment}
                    seed={seed}
                    className="w-full"
                    style={{ aspectRatio: "16/9" }}
                  />
                  <div className="px-2 py-1 text-[10px] text-gray-600 font-medium truncate bg-white">
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Fragment shader (GLSL ES 1.0)</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const code = SHADER_PRESETS[selected].fragment;
                      setCustomCode(code);
                      setDebouncedCustom(code);
                      setCompileError(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Copy current preset
                  </button>
                </div>
              </div>
              <textarea
                value={customCode}
                onChange={(e) => handleCustomCodeChange(e.target.value)}
                spellCheck={false}
                className={cn(
                  "w-full h-56 rounded-lg border bg-gray-950 text-green-400 text-xs font-mono px-3 py-2 resize-y focus:outline-none focus:ring-2",
                  compileError
                    ? "border-red-400 focus:ring-red-400/30"
                    : "border-gray-700 focus:ring-[#E7C59A]/30",
                )}
              />
              {compileError && (
                <p className="text-xs text-red-500">{compileError}</p>
              )}
              {/* Texture upload */}
              <div className="flex items-center gap-2">
                <input
                  ref={textureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleTextureUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => textureInputRef.current?.click()}
                >
                  {textureName ? "Change texture" : "Upload texture"}
                </Button>
                {textureName && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {textureImage && (
                      <>
                        {/* Blob/data preview; Next Image is not a good fit here. */}
                        <img src={textureImage.src} alt="" className="h-5 w-5 rounded object-cover border" />
                      </>
                    )}
                    <span className="truncate max-w-[140px]">{textureName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (textureImage?.src?.startsWith("blob:")) URL.revokeObjectURL(textureImage.src);
                        setTextureImage(null);
                        setTextureName(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">
                  Use <code className="bg-gray-100 px-1 rounded">uniform sampler2D u_texture</code> + <code className="bg-gray-100 px-1 rounded">varying vec2 v_uv</code>
                </span>
              </div>
              {/* Custom uniform sliders */}
              {detectedUniforms.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500">Uniforms</p>
                  {detectedUniforms.map((name) => {
                    const val = customUniformValues[name];
                    // Auto-range: try to pick sensible min/max
                    const n = name.toLowerCase();
                    let min = 0, max = 10, step = 0.1;
                    if (n.includes("contrast") || n.includes("gamma")) { min = 0; max = 5; step = 0.05; }
                    else if (n.includes("brightness")) { min = -1; max = 1; step = 0.05; }
                    else if (n.includes("size") || n.includes("dot")) { min = 1; max = 30; step = 0.5; }
                    else if (n.includes("opacity") || n.includes("alpha")) { min = 0; max = 1; step = 0.01; }
                    else if (n.includes("scale")) { min = 0.1; max = 5; step = 0.1; }

                    const defaultVal = val !== undefined ? val :
                      (n.includes("size") || n.includes("dot") ? 8 :
                       n.includes("contrast") ? 1.5 :
                       n.includes("gamma") ? 1 :
                       n.includes("brightness") ? 0 : 1);

                    return (
                      <div key={name} className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 font-mono w-28 truncate shrink-0" title={name}>
                          {name}
                        </label>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={val ?? defaultVal}
                          onChange={(e) => {
                            setCustomUniformValues((prev) => ({
                              ...prev,
                              [name]: parseFloat(e.target.value),
                            }));
                          }}
                          className="flex-1 h-1 accent-[#E7C59A]"
                        />
                        <span className="text-xs text-gray-500 w-10 text-right font-mono">
                          {(val ?? defaultVal).toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleRandomize}>
              Randomize
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {onSetLiveBackground && (
                <Button
                  size="sm"
                  className="bg-[#E7C59A] text-white hover:bg-[#E7C59A]/80"
                  onClick={handleApplyLive}
                  disabled={tab === "custom" && !!compileError}
                >
                  Set as Live Background
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
