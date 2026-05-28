"use client";

import { useEffect, useRef, useState } from "react";

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type ShaderProgram = {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  texture: WebGLTexture | null;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    seed: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
  };
  customUniformLocs: Map<string, WebGLUniformLocation>;
};

const BUILTIN_UNIFORMS = new Set(["u_resolution", "u_time", "u_seed", "u_texture"]);

/** Parse custom `uniform float` declarations from shader source. */
export function parseCustomUniforms(src: string): string[] {
  const re = /uniform\s+float\s+(\w+)/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (!BUILTIN_UNIFORMS.has(m[1])) names.push(m[1]);
  }
  return names;
}

/** Sensible defaults for common uniform names. */
function defaultForUniform(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("size") || n.includes("dot")) return 8.0;
  if (n.includes("contrast")) return 1.5;
  if (n.includes("brightness")) return 0.0;
  if (n.includes("gamma")) return 1.0;
  if (n.includes("scale")) return 1.0;
  if (n.includes("speed")) return 1.0;
  if (n.includes("intensity") || n.includes("strength") || n.includes("amount")) return 1.0;
  if (n.includes("radius")) return 0.5;
  if (n.includes("opacity") || n.includes("alpha")) return 1.0;
  return 1.0;
}

function createProgram(
  gl: WebGLRenderingContext,
  fragmentSrc: string,
  textureImage?: HTMLImageElement | null,
): ShaderProgram | null {
  const vs = compileShader(gl, VERTEX_SHADER, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fragmentSrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Set up texture if provided and the shader uses u_texture
  let texture: WebGLTexture | null = null;
  const texLoc = gl.getUniformLocation(program, "u_texture");
  if (texLoc && textureImage) {
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
    gl.uniform1i(texLoc, 0);
  }

  // Collect custom uniform locations
  const customUniformLocs = new Map<string, WebGLUniformLocation>();
  const customNames = parseCustomUniforms(fragmentSrc);
  for (const name of customNames) {
    const loc = gl.getUniformLocation(program, name);
    if (loc) customUniformLocs.set(name, loc);
  }

  return {
    program,
    buffer,
    texture,
    uniforms: {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      seed: gl.getUniformLocation(program, "u_seed"),
      texture: texLoc,
    },
    customUniformLocs,
  };
}

/**
 * Render a single frame of a shader. Used for static captures.
 */
export function renderShaderFrame(
  canvas: HTMLCanvasElement,
  fragmentSrc: string,
  seed: number,
  time = 0,
  textureImage?: HTMLImageElement | null,
  customUniforms?: Record<string, number>,
): boolean {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) return false;
  const prog = createProgram(gl, fragmentSrc, textureImage);
  if (!prog) return false;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(prog.uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(prog.uniforms.time, time);
  gl.uniform1f(prog.uniforms.seed, seed);

  // Set custom uniforms
  for (const [name, loc] of prog.customUniformLocs) {
    gl.uniform1f(loc, customUniforms?.[name] ?? defaultForUniform(name));
  }

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  if (prog.texture) gl.deleteTexture(prog.texture);
  gl.deleteProgram(prog.program);
  gl.deleteBuffer(prog.buffer);
  return true;
}

type ShaderCanvasProps = {
  fragment: string;
  seed?: number;
  animate?: boolean;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  onError?: (hasError: boolean) => void;
  /** Image element to bind as u_texture sampler2D */
  textureImage?: HTMLImageElement | null;
  /** Values for custom uniform floats (e.g. u_dotSize, u_contrast) */
  customUniforms?: Record<string, number>;
  /** Callback to expose the internal canvas element */
  canvasRefCallback?: (canvas: HTMLCanvasElement | null) => void;
  /** Data URL for texture — will be loaded as an HTMLImageElement automatically */
  textureUrl?: string;
};

/**
 * A WebGL canvas that renders a fragment shader, optionally animating with u_time.
 */
export function ShaderCanvas({
  fragment,
  seed = 0,
  animate = true,
  width = 960,
  height = 540,
  className,
  style,
  onError,
  textureImage,
  customUniforms,
  canvasRefCallback,
  textureUrl,
}: ShaderCanvasProps) {
  // Load texture from data URL if provided
  const [loadedTexture, setLoadedTexture] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!textureUrl) {
      setLoadedTexture(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLoadedTexture(img);
    img.src = textureUrl;
    return () => { img.onload = null; };
  }, [textureUrl]);

  const effectiveTexture = textureImage || loadedTexture;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    gl: WebGLRenderingContext;
    prog: ShaderProgram;
    animId: number;
    startTime: number;
  } | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const customUniformsRef = useRef(customUniforms);
  customUniformsRef.current = customUniforms;

  // Rebuild program when fragment or seed changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cleanup previous
    if (stateRef.current) {
      cancelAnimationFrame(stateRef.current.animId);
      const { gl, prog } = stateRef.current;
      if (prog.texture) gl.deleteTexture(prog.texture);
      gl.deleteProgram(prog.program);
      gl.deleteBuffer(prog.buffer);
      stateRef.current = null;
    }

    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) { onErrorRef.current?.(true); return; }

    const prog = createProgram(gl, fragment, effectiveTexture);
    if (!prog) {
      onErrorRef.current?.(true);
      // Clear to dark on error
      gl.clearColor(0.05, 0.05, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    onErrorRef.current?.(false);
    const startTime = performance.now();

    function frame() {
      if (!stateRef.current) return;
      const elapsed = (performance.now() - startTime) / 1000;
      gl.viewport(0, 0, canvas!.width, canvas!.height);
      gl.useProgram(prog.program);
      gl.uniform2f(prog.uniforms.resolution, canvas!.width, canvas!.height);
      gl.uniform1f(prog.uniforms.time, elapsed);
      gl.uniform1f(prog.uniforms.seed, seed);

      // Set custom uniforms each frame (values may change via ref)
      const cu = customUniformsRef.current;
      for (const [name, loc] of prog.customUniformLocs) {
        gl.uniform1f(loc, cu?.[name] ?? defaultForUniform(name));
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (animate) {
        stateRef.current.animId = requestAnimationFrame(frame);
      } else {
        // Static mode: clean up GL resources to free the context
        if (prog.texture) gl.deleteTexture(prog.texture);
        gl.deleteProgram(prog.program);
        gl.deleteBuffer(prog.buffer);
        stateRef.current = null;
      }
    }

    const animId = requestAnimationFrame(frame);
    stateRef.current = { gl, prog, animId, startTime };

    return () => {
      if (stateRef.current) {
        cancelAnimationFrame(stateRef.current.animId);
        const { gl: g, prog: p } = stateRef.current;
        if (p.texture) g.deleteTexture(p.texture);
        g.deleteProgram(p.program);
        g.deleteBuffer(p.buffer);
        stateRef.current = null;
      }
    };
  }, [fragment, seed, width, height, animate, effectiveTexture]);

  return <canvas ref={(el) => {
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
    canvasRefCallback?.(el);
  }} className={className} style={style} />;
}
