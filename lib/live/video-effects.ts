"use client";

/**
 * The studio's camera effects: face smoothing, colour filters, on-screen
 * effects (hearts, petals…), frames and a banner line — drawn into the
 * picture itself, so every viewer sees them with no work on their side.
 *
 *   camera ─▶ <video> ─▶ WebGL (crop to 9:16, smoothing, colour grade)
 *                       ─▶ 2D canvas (effects, frame, banner) ─▶ captureStream
 *
 * The output is always portrait 720×1280, the shape every player shows; a
 * landscape webcam is cropped to its middle the way the player would crop it
 * anyway, so nothing drawn near an edge is cut off for viewers.
 *
 * Frames are timed by a worker, not requestAnimationFrame, so the stream
 * keeps moving while the host has another tab in front.
 */

export const LIVE_FILTERS = ["natural", "bright", "warm", "cool", "vivid", "pink", "silk", "vintage", "mono"] as const;
export type LiveFilter = (typeof LIVE_FILTERS)[number];

export const LIVE_EFFECTS = ["none", "hearts", "sparkle", "petals", "confetti", "snow", "coins"] as const;
export type LiveEffect = (typeof LIVE_EFFECTS)[number];

export const LIVE_FRAMES = ["none", "silk", "sale", "neon"] as const;
export type LiveFrame = (typeof LIVE_FRAMES)[number];

export interface LiveEffectSettings {
  /** Skin smoothing, 0–100. */
  smooth: number;
  /** Brighter, more even skin, 0–100. */
  brighten: number;
  filter: LiveFilter;
  effect: LiveEffect;
  frame: LiveFrame;
  /** A short line shown near the top of the picture; empty for none. */
  banner: string;
  /** Flip left–right (viewers see it flipped too). */
  mirror: boolean;
}

export const DEFAULT_LIVE_EFFECTS: LiveEffectSettings = {
  smooth: 45,
  brighten: 30,
  filter: "natural",
  effect: "none",
  frame: "none",
  banner: "",
  mirror: false,
};

export const LIVE_BANNER_MAX = 40;

/** For the chips: a swatch per filter and an emoji per effect. */
export const LIVE_FILTER_SWATCH: Record<LiveFilter, string> = {
  natural: "linear-gradient(135deg,#f5d0b5,#d9a07a)",
  bright: "linear-gradient(135deg,#fff7ed,#fde2c8)",
  warm: "linear-gradient(135deg,#fcd34d,#f97316)",
  cool: "linear-gradient(135deg,#bae6fd,#6366f1)",
  vivid: "linear-gradient(135deg,#f43f5e,#22c55e,#3b82f6)",
  pink: "linear-gradient(135deg,#fbcfe8,#f472b6)",
  silk: "linear-gradient(135deg,#8a2c1d,#d9a441)",
  vintage: "linear-gradient(135deg,#d6c3a1,#8b6b4a)",
  mono: "linear-gradient(135deg,#f4f4f5,#27272a)",
};

export const LIVE_EFFECT_ICON: Record<LiveEffect, string> = {
  none: "🚫",
  hearts: "💖",
  sparkle: "✨",
  petals: "🌸",
  confetti: "🎉",
  snow: "❄️",
  coins: "🪙",
};

export const LIVE_FRAME_ICON: Record<LiveFrame, string> = {
  none: "🚫",
  silk: "🧵",
  sale: "🏷️",
  neon: "💡",
};

const OUT_W = 720;
const OUT_H = 1280;
// Phones are taller than 9:16, so players crop about 9% off each side; keep
// anything that must be read inside this margin.
const SAFE_X = 70;
const FPS = 30;

/* ------------------------------------------------------------------ */
/* Colour grades                                                       */
/* ------------------------------------------------------------------ */

interface Grade {
  saturation: number;
  contrast: number;
  brightness: number;
  sepia: number;
  tint: [number, number, number];
  vignette: number;
  fade: number;
}

const GRADE_BASE: Grade = { saturation: 1, contrast: 1, brightness: 0, sepia: 0, tint: [1, 1, 1], vignette: 0, fade: 0 };

const GRADES: Record<LiveFilter, Partial<Grade>> = {
  natural: {},
  bright: { saturation: 1.05, contrast: 0.95, brightness: 0.06, tint: [1, 1, 1.02] },
  warm: { saturation: 1.08, contrast: 1.04, brightness: 0.02, tint: [1.08, 1.0, 0.9] },
  cool: { contrast: 1.03, tint: [0.93, 1.0, 1.08] },
  vivid: { saturation: 1.35, contrast: 1.12 },
  pink: { saturation: 1.05, brightness: 0.03, tint: [1.07, 0.97, 1.03] },
  // Phrae Wa silk: rich red-brown and gold.
  silk: { saturation: 1.12, contrast: 1.08, tint: [1.1, 0.96, 0.88], vignette: 0.35 },
  vintage: { saturation: 0.85, contrast: 0.95, sepia: 0.35, fade: 0.06, vignette: 0.4 },
  mono: { saturation: 0, contrast: 1.15 },
};

/* ------------------------------------------------------------------ */
/* WebGL                                                               */
/* ------------------------------------------------------------------ */

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform vec2 u_cropScale;
uniform vec2 u_cropOffset;
uniform float u_mirror;
uniform float u_smooth;
uniform float u_radius;
uniform float u_brighten;
uniform vec4 u_grade;
uniform vec3 u_tint;
uniform float u_vignette;
uniform float u_fade;

float skin(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  float cb = -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5;
  float cr = 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5;
  float m = smoothstep(0.27, 0.32, cb) * (1.0 - smoothstep(0.49, 0.54, cb))
          * smoothstep(0.50, 0.54, cr) * (1.0 - smoothstep(0.68, 0.72, cr));
  return m * smoothstep(0.10, 0.22, y);
}

void main() {
  vec2 uv = v_uv;
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  uv = uv * u_cropScale + u_cropOffset;
  vec3 c = texture2D(u_tex, uv).rgb;
  vec3 col = c;

  if (u_smooth > 0.0) {
    // Edge-preserving blur: neighbours that look alike are averaged, edges
    // (eyes, lips, hair) are left alone. Applied mostly where there is skin.
    vec3 sum = c;
    float wsum = 1.0;
    for (int r = 1; r <= 3; r++) {
      float rad = float(r) * u_radius;
      for (int k = 0; k < 8; k++) {
        float a = float(k) * 0.785398 + float(r) * 0.4;
        vec2 off = vec2(cos(a), sin(a)) * rad * u_texel;
        vec3 s = texture2D(u_tex, uv + off).rgb;
        vec3 d = s - c;
        float w = exp(-dot(d, d) * 55.0);
        sum += s * w;
        wsum += w;
      }
    }
    vec3 blurred = sum / wsum;
    float m = skin(c);
    col = mix(c, blurred, clamp(u_smooth * (0.25 + 0.75 * m), 0.0, 0.92));
  }

  if (u_brighten > 0.0) {
    vec3 lifted = 1.0 - (1.0 - col) * (1.0 - col);
    float m = 0.4 + 0.6 * skin(c);
    col = mix(col, lifted, u_brighten * 0.32 * m);
    // A touch of rosy warmth on skin.
    col += vec3(0.018, 0.004, 0.0) * u_brighten * m;
  }

  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, u_grade.x);
  col = (col - 0.5) * u_grade.y + 0.5;
  col += u_grade.z;
  vec3 sep = vec3(
    dot(col, vec3(0.393, 0.769, 0.189)),
    dot(col, vec3(0.349, 0.686, 0.168)),
    dot(col, vec3(0.272, 0.534, 0.131)));
  col = mix(col, sep, u_grade.w);
  col *= u_tint;
  col = mix(vec3(u_fade), vec3(1.0), clamp(col, 0.0, 1.0));
  float d = distance(v_uv, vec2(0.5));
  col *= 1.0 - u_vignette * smoothstep(0.35, 0.85, d);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

type Uniforms = Record<
  | "texel"
  | "cropScale"
  | "cropOffset"
  | "mirror"
  | "smooth"
  | "radius"
  | "brighten"
  | "grade"
  | "tint"
  | "vignette"
  | "fade",
  WebGLUniformLocation | null
>;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || "shader");
  }
  return shader;
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

interface Particle {
  kind: "sprite" | "rect" | "dot";
  sprite?: HTMLCanvasElement;
  color?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  age: number;
  life: number;
  sway: number;
  phase: number;
  twinkle: boolean;
}

const EFFECT_SPEC: Record<
  Exclude<LiveEffect, "none">,
  { emoji?: string[]; perSecond: number; mode: "rise" | "fall" | "twinkle" | "confetti" | "snow" }
> = {
  hearts: { emoji: ["💖", "💗", "💕", "❤️"], perSecond: 5, mode: "rise" },
  sparkle: { emoji: ["✨", "⭐", "🌟"], perSecond: 7, mode: "twinkle" },
  petals: { emoji: ["🌸", "🌺", "🌷"], perSecond: 4, mode: "fall" },
  confetti: { perSecond: 28, mode: "confetti" },
  snow: { perSecond: 30, mode: "snow" },
  coins: { emoji: ["🪙", "💰", "🧧"], perSecond: 4, mode: "fall" },
};

const CONFETTI_COLORS = ["#8a2c1d", "#c0662b", "#d9a441", "#f43f5e", "#fbbf24", "#22c55e", "#3b82f6", "#ffffff"];

const spriteCache = new Map<string, HTMLCanvasElement>();
function emojiSprite(emoji: string) {
  let sprite = spriteCache.get(emoji);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = 96;
    const ctx = sprite.getContext("2d");
    if (ctx) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(emoji, 48, 54);
    }
    spriteCache.set(emoji, sprite);
  }
  return sprite;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/* ------------------------------------------------------------------ */
/* The processor                                                       */
/* ------------------------------------------------------------------ */

export function liveEffectsSupported() {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  if (typeof canvas.captureStream !== "function") return false;
  try {
    return Boolean(canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export class LiveVideoProcessor {
  private video: HTMLVideoElement;
  private glCanvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private uniforms: Uniforms;
  private texture: WebGLTexture | null;
  private out: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ticker: Worker | null = null;
  private tickerUrl: string | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private settings: LiveEffectSettings = { ...DEFAULT_LIVE_EFFECTS };
  private particles: Particle[] = [];
  private spawnDebt = 0;
  private last = 0;
  private fontFamily = "sans-serif";
  readonly track: MediaStreamTrack;

  constructor() {
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    // In the document (out of sight) so the browser keeps decoding it.
    Object.assign(this.video.style, {
      position: "fixed",
      width: "2px",
      height: "2px",
      opacity: "0",
      pointerEvents: "none",
      left: "-10px",
      top: "0",
    });
    document.body.appendChild(this.video);

    this.glCanvas = document.createElement("canvas");
    this.glCanvas.width = OUT_W;
    this.glCanvas.height = OUT_H;
    const gl = this.glCanvas.getContext("webgl", { preserveDrawingBuffer: true, alpha: false, antialias: false });
    if (!gl) throw new Error("webgl");
    this.gl = gl;

    const program = gl.createProgram();
    if (!program) throw new Error("webgl");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("webgl");
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);

    const u = (name: string) => gl.getUniformLocation(program, `u_${name}`);
    this.uniforms = {
      texel: u("texel"),
      cropScale: u("cropScale"),
      cropOffset: u("cropOffset"),
      mirror: u("mirror"),
      smooth: u("smooth"),
      radius: u("radius"),
      brighten: u("brighten"),
      grade: u("grade"),
      tint: u("tint"),
      vignette: u("vignette"),
      fade: u("fade"),
    };
    gl.viewport(0, 0, OUT_W, OUT_H);

    this.out = document.createElement("canvas");
    this.out.width = OUT_W;
    this.out.height = OUT_H;
    const ctx = this.out.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, OUT_W, OUT_H);

    this.fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";
    const [track] = this.out.captureStream(FPS).getVideoTracks();
    this.track = track;
    this.startTicker();
  }

  /** The camera to draw from; the output track stays the same. */
  setSource(stream: MediaStream | null) {
    const video = stream?.getVideoTracks()[0];
    this.video.srcObject = video ? new MediaStream([video]) : null;
    if (video) void this.video.play().catch(() => {});
  }

  setSettings(settings: LiveEffectSettings) {
    if (settings.effect !== this.settings.effect) this.particles = [];
    this.settings = { ...settings, banner: settings.banner.slice(0, LIVE_BANNER_MAX) };
  }

  destroy() {
    this.ticker?.terminate();
    if (this.tickerUrl) URL.revokeObjectURL(this.tickerUrl);
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.track.stop();
    this.video.srcObject = null;
    this.video.remove();
    const lose = this.gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
  }

  private startTicker() {
    try {
      const source = `let t=setInterval(()=>postMessage(0),${Math.round(1000 / FPS)});onmessage=()=>clearInterval(t);`;
      this.tickerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      this.ticker = new Worker(this.tickerUrl);
      this.ticker.onmessage = () => this.frame();
    } catch {
      this.fallbackTimer = setInterval(() => this.frame(), Math.round(1000 / FPS));
    }
  }

  private frame() {
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / FPS;
    this.last = now;
    const video = this.video;
    const ready = video.readyState >= 2 && video.videoWidth > 0;
    if (ready) this.drawCamera(video);
    const ctx = this.ctx;
    if (ready) ctx.drawImage(this.glCanvas, 0, 0);
    this.drawParticles(dt);
    this.drawFrame(now / 1000);
    this.drawBanner(now / 1000);
  }

  private drawCamera(video: HTMLVideoElement) {
    const gl = this.gl;
    const s = this.settings;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Cover-crop the camera into 9:16.
    const target = OUT_W / OUT_H;
    const source = vw / vh;
    const scale: [number, number] = source > target ? [target / source, 1] : [1, source / target];
    const offset: [number, number] = [(1 - scale[0]) / 2, (1 - scale[1]) / 2];
    const grade = { ...GRADE_BASE, ...GRADES[s.filter] };

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    const u = this.uniforms;
    gl.uniform2f(u.texel, 1 / vw, 1 / vh);
    gl.uniform2f(u.cropScale, scale[0], scale[1]);
    gl.uniform2f(u.cropOffset, offset[0], offset[1]);
    gl.uniform1f(u.mirror, s.mirror ? 1 : 0);
    const smooth = Math.max(0, Math.min(100, s.smooth)) / 100;
    gl.uniform1f(u.smooth, smooth);
    // Blur radius in camera pixels, relative to a 720p face.
    gl.uniform1f(u.radius, (Math.min(vw, vh) / 720) * (1.6 + smooth * 2.2));
    gl.uniform1f(u.brighten, Math.max(0, Math.min(100, s.brighten)) / 100);
    gl.uniform4f(u.grade, grade.saturation, grade.contrast, grade.brightness, grade.sepia);
    gl.uniform3f(u.tint, grade.tint[0], grade.tint[1], grade.tint[2]);
    gl.uniform1f(u.vignette, grade.vignette);
    gl.uniform1f(u.fade, grade.fade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private spawn(effect: Exclude<LiveEffect, "none">): Particle {
    const spec = EFFECT_SPEC[effect];
    const base = {
      rot: 0,
      vr: 0,
      age: 0,
      sway: 0,
      phase: Math.random() * Math.PI * 2,
      twinkle: false,
      vx: 0,
    };
    switch (spec.mode) {
      case "rise":
        return {
          ...base,
          kind: "sprite",
          sprite: emojiSprite(pick(spec.emoji!)),
          x: rand(OUT_W * 0.55, OUT_W * 0.95),
          y: OUT_H + 40,
          vy: -rand(170, 260),
          size: rand(44, 78),
          sway: rand(20, 45),
          life: rand(3.5, 5),
        };
      case "twinkle":
        return {
          ...base,
          kind: "sprite",
          sprite: emojiSprite(pick(spec.emoji!)),
          x: rand(30, OUT_W - 30),
          y: rand(60, OUT_H * 0.75),
          vy: 0,
          size: rand(26, 54),
          life: rand(1.2, 2.2),
          twinkle: true,
          vr: rand(-0.6, 0.6),
        };
      case "fall":
        return {
          ...base,
          kind: "sprite",
          sprite: emojiSprite(pick(spec.emoji!)),
          x: rand(0, OUT_W),
          y: -50,
          vy: rand(110, 190),
          size: rand(36, 62),
          sway: rand(25, 60),
          rot: rand(0, Math.PI * 2),
          vr: rand(-1.2, 1.2),
          life: 14,
        };
      case "confetti":
        return {
          ...base,
          kind: "rect",
          color: pick(CONFETTI_COLORS),
          x: rand(0, OUT_W),
          y: -20,
          vy: rand(180, 300),
          size: rand(10, 18),
          sway: rand(15, 40),
          rot: rand(0, Math.PI * 2),
          vr: rand(-6, 6),
          life: 10,
        };
      case "snow":
        return {
          ...base,
          kind: "dot",
          color: "rgba(255,255,255,0.9)",
          x: rand(0, OUT_W),
          y: -10,
          vy: rand(60, 140),
          size: rand(3, 8),
          sway: rand(10, 30),
          life: 25,
        };
    }
  }

  private drawParticles(dt: number) {
    const effect = this.settings.effect;
    if (effect !== "none") {
      this.spawnDebt += EFFECT_SPEC[effect].perSecond * dt;
      while (this.spawnDebt >= 1 && this.particles.length < 160) {
        this.particles.push(this.spawn(effect));
        this.spawnDebt -= 1;
      }
    }
    if (!this.particles.length) return;
    const ctx = this.ctx;
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const x = p.x + Math.sin(p.phase + p.age * 2.2) * p.sway;
      if (p.age > p.life || p.y < -120 || p.y > OUT_H + 120) continue;
      alive.push(p);
      let alpha = 1;
      if (p.twinkle) alpha = Math.sin((p.age / p.life) * Math.PI);
      else if (p.vy < 0) alpha = Math.min(1, (p.life - p.age) / 1.2, p.age * 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === "sprite" && p.sprite) {
        const s = p.twinkle ? p.size * (0.6 + 0.4 * alpha) : p.size;
        ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
      } else if (p.kind === "rect") {
        ctx.fillStyle = p.color!;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.fillStyle = p.color!;
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    this.particles = alive;
  }

  private drawFrame(t: number) {
    const frame = this.settings.frame;
    if (frame === "none") return;
    const ctx = this.ctx;
    ctx.save();
    if (frame === "silk") {
      // Phrae Wa silk bands top and bottom: deep red-brown with gold diamonds.
      const band = 64;
      for (const y of [0, OUT_H - band]) {
        const g = ctx.createLinearGradient(0, y, 0, y + band);
        g.addColorStop(0, "#5a1a10");
        g.addColorStop(0.5, "#8a2c1d");
        g.addColorStop(1, "#5a1a10");
        ctx.fillStyle = g;
        ctx.fillRect(0, y, OUT_W, band);
        ctx.strokeStyle = "#d9a441";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, y + 6);
        ctx.lineTo(OUT_W, y + 6);
        ctx.moveTo(0, y + band - 6);
        ctx.lineTo(OUT_W, y + band - 6);
        ctx.stroke();
        const step = 48;
        const mid = y + band / 2;
        for (let x = step / 2; x < OUT_W; x += step) {
          ctx.fillStyle = "#d9a441";
          ctx.beginPath();
          ctx.moveTo(x, mid - 16);
          ctx.lineTo(x + 16, mid);
          ctx.lineTo(x, mid + 16);
          ctx.lineTo(x - 16, mid);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#8a2c1d";
          ctx.beginPath();
          ctx.moveTo(x, mid - 8);
          ctx.lineTo(x + 8, mid);
          ctx.lineTo(x, mid + 8);
          ctx.lineTo(x - 8, mid);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#f3d58a";
          ctx.fillRect(x + step / 2 - 3, mid - 3, 6, 6);
        }
      }
      ctx.strokeStyle = "rgba(217,164,65,0.85)";
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 70, OUT_W - 20, OUT_H - 140);
    } else if (frame === "neon") {
      const hue = (t * 60) % 360;
      ctx.lineWidth = 10;
      ctx.shadowBlur = 30;
      ctx.shadowColor = `hsl(${hue},95%,60%)`;
      ctx.strokeStyle = `hsl(${hue},95%,65%)`;
      roundRect(ctx, 18, 18, OUT_W - 36, OUT_H - 36, 36);
      ctx.stroke();
    } else if (frame === "sale") {
      // A starburst badge in the top corner, gently pulsing.
      const pulse = 1 + Math.sin(t * 4) * 0.05;
      const cx = OUT_W - SAFE_X - 105;
      const cy = OUT_H * 0.36;
      ctx.translate(cx, cy);
      ctx.rotate(-0.18);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      const spikes = 16;
      for (let i = 0; i <= spikes * 2; i++) {
        const r = i % 2 === 0 ? 92 : 74;
        const a = (i / (spikes * 2)) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 92);
      g.addColorStop(0, "#ef4444");
      g.addColorStop(1, "#b91c1c");
      ctx.fillStyle = g;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#fde68a";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 46px ${this.fontFamily}`;
      ctx.fillText("SALE", 0, -6);
      ctx.font = `800 22px ${this.fontFamily}`;
      ctx.fillStyle = "#fde68a";
      ctx.fillText("LIVE", 0, 32);
    }
    ctx.restore();
  }

  private drawBanner(t: number) {
    const text = this.settings.banner.trim();
    if (!text) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `800 40px ${this.fontFamily}`;
    const width = Math.min(OUT_W - SAFE_X * 2, ctx.measureText(text).width + 64);
    const height = 76;
    const x = (OUT_W - width) / 2;
    // Below the player's title and its "tap to unmute" button.
    const y = OUT_H * 0.24;
    const g = ctx.createLinearGradient(x, 0, x + width, 0);
    g.addColorStop(0, "#8a2c1d");
    g.addColorStop(1, "#c0662b");
    ctx.shadowBlur = 16;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.fillStyle = g;
    roundRect(ctx, x, y, width, height, 38);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#d9a441";
    ctx.stroke();
    // A glint sweeping across every few seconds.
    const sweep = ((t % 3) / 3) * (width + 200) - 100;
    ctx.save();
    roundRect(ctx, x, y, width, height, 38);
    ctx.clip();
    const shine = ctx.createLinearGradient(x + sweep - 60, 0, x + sweep + 60, 0);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.28)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, OUT_W / 2, y + height / 2 + 2, width - 40);
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Remembered settings                                                 */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "ohk-live-effects";

export function loadLiveEffectSettings(): LiveEffectSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LIVE_EFFECTS };
    const saved = JSON.parse(raw) as Partial<LiveEffectSettings>;
    return {
      smooth: typeof saved.smooth === "number" ? Math.max(0, Math.min(100, saved.smooth)) : DEFAULT_LIVE_EFFECTS.smooth,
      brighten:
        typeof saved.brighten === "number" ? Math.max(0, Math.min(100, saved.brighten)) : DEFAULT_LIVE_EFFECTS.brighten,
      filter: LIVE_FILTERS.includes(saved.filter as LiveFilter) ? (saved.filter as LiveFilter) : "natural",
      effect: LIVE_EFFECTS.includes(saved.effect as LiveEffect) ? (saved.effect as LiveEffect) : "none",
      frame: LIVE_FRAMES.includes(saved.frame as LiveFrame) ? (saved.frame as LiveFrame) : "none",
      banner: typeof saved.banner === "string" ? saved.banner.slice(0, LIVE_BANNER_MAX) : "",
      mirror: saved.mirror === true,
    };
  } catch {
    return { ...DEFAULT_LIVE_EFFECTS };
  }
}

export function saveLiveEffectSettings(settings: LiveEffectSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage blocked; the settings last for this visit.
  }
}
