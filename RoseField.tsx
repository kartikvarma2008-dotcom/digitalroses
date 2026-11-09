"use client";

import { useEffect, useRef } from "react";

type Bloom = {
  x: number;
  y: number;
  r: number;
  rot: number;
  brightness: number;
  seed: number;
};

type Petal = {
  ox: number;
  oy: number;
  rx: number;
  ry: number;
  cos: number;
  sin: number;
  ring: number;
};

type Glyph = {
  x: number;
  y: number;
  ch: string;
  c: string;
  a: number;
  fs: number;
};

type Painter = {
  x: number;
  y: number;
  idx: number;
  to: number;
  trail: { x: number; y: number }[];
  accent: string;
  wx: number;
  wy: number;
  gx: number;
  gy: number;
};

type ScriptInfo = {
  family: string;
  font: string;
  size: number;
  lineHeight: number;
  blockCenter: number;
  bottom: number;
  lines: string[];
  baselines: number[];
  widths: number[];
  cx: number;
};

type MessageChar = { ch: string; x: number; y: number };

type Note = {
  lines: string[];
  x: number;
  y: number;
  size: number;
  lineHeight: number;
  font: string;
  width: number;
  height: number;
  total: number;
  cursor: number;
  start: number;
  chars: number;
};

const RAMP = ["·", ".", ":", ";", "=", "+", "*", "o", "x", "#", "%", "@"];
const RIM = ["{", "}", "(", ")", "/", "\\", "<", ">", "+", "*"];

const RING_BASE = [0.4, 0.54, 0.68];

const PALETTE: string[] = Array.from({ length: 18 }, (_, i) => {
  const v = i / 17;
  return `hsl(349 ${70 + v * 20}% ${22 + v * 56}%)`;
});

const ACCENTS = [
  "#ff5c7a",
  "#ff8fa3",
  "#e0143c",
  "#ffb3c1",
  "#ff2d55",
  "#d9556f",
  "#ff9aab",
  "#f7c9d3",
  "#c9163c",
  "#ff7d97",
];

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';

const MESSAGE = "roses for you, my love";

const NOTES_TEXT: string[][] = [
  ["my dearest"],
  ["sweetie"],
  ["i love you so much"],
  ["my sunshine"],
  ["forever yours"],
  ["my whole heart"],
  ["you, always"],
  ["stay with me"],
  ["you are my calm"],
  ["my heart is yours"],
  ["the stars are jealous"],
  ["holding you forever"],
  ["my favourite person"],
  ["you, in every lifetime"],
  ["softest place to land"],
  ["my only one"],
  ["yours, completely"],
  ["you feel like home"],
  ["my quiet joy"],
  ["endlessly yours"],
  ["the best part of my day"],
  ["all my tomorrows"],
  ["the reason i smile"],
  ["my little universe"],
  ["gentle with my heart"],
  ["every quiet morning"],
  ["love you more"],
  ["my dream come true"],
  ["you, my favourite thought"],
  ["achingly lovely"],
  ["my heart's home"],
  ["you light the dark"],
  ["tender, always"],
  ["my sunday morning"],
  ["you are the poem"],
  ["i keep choosing you"],
  ["quietly yours"],
  ["the softest thunder"],
  ["my forever beginning"],
  ["warm hands, cold nights"],
  ["you, and only you"],
  ["sweetest ache"],
  ["you are the quiet", "my heart was", "looking for"],
  ["of all the gardens", "in the world", "you are the rose"],
  ["i would choose you", "in every life,", "every single time"],
  ["stay a little longer,", "my love"],
];

const PAINT_MS = 7200;
const UNITE_MS = 1100;
const MESSAGE_HOLD = 900;
const NOTE_GAP = 380;
const NOTE_TYPE_MS = 50;

function glyphFont(size: number) {
  return `600 ${size.toFixed(1)}px ${MONO}`;
}

function mulberry32(a: number) {
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

/* Petal geometry in units of the bloom radius: three rings of ellipses. */
const PETALS: Petal[] = (() => {
  const rings = [
    { n: 7, d: 0.442, rx: 0.512, ry: 0.547, offset: 0, ring: 0 },
    { n: 5, d: 0.256, rx: 0.36, ry: 0.395, offset: 0.62, ring: 1 },
    { n: 5, d: 0.14, rx: 0.244, ry: 0.267, offset: 1.42, ring: 2 },
  ];
  const petals: Petal[] = [];
  for (const band of rings) {
    for (let i = 0; i < band.n; i += 1) {
      const angle = band.offset + (i / band.n) * Math.PI * 2;
      const rot = angle - Math.PI / 2;
      petals.push({
        ox: Math.cos(angle) * band.d,
        oy: Math.sin(angle) * band.d,
        rx: band.rx,
        ry: band.ry,
        cos: Math.cos(rot),
        sin: Math.sin(rot),
        ring: band.ring,
      });
    }
  }
  return petals;
})();

function buildBlooms(width: number, height: number): Bloom[] {
  const min = Math.min(width, height);
  const cell = min * 0.32;
  const cols = Math.max(3, Math.round(width / cell) + 1);
  const rows = Math.max(3, Math.round(height / cell) + 1);
  const radius = Math.min(cell * 0.52, min * 0.3);
  const blooms: Bloom[] = [];
  let seed = 7;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      seed += 131;
      const rng = mulberry32(seed);
      const x = (col / (cols - 1)) * width + (rng() - 0.5) * cell * 0.3;
      const y = (row / (rows - 1)) * height + (rng() - 0.5) * cell * 0.3;
      blooms.push({
        x,
        y,
        r: radius * (0.88 + rng() * 0.22),
        rot: rng() * Math.PI * 2,
        brightness: 0.86 + rng() * 0.24,
        seed: seed * 17 + 3,
      });
    }
  }

  blooms.sort((a, b) => b.r - a.r);
  return blooms;
}

/* Soft shadow so overlapping blooms keep their own silhouette. */
function drawShadow(ctx: CanvasRenderingContext2D, bloom: Bloom) {
  ctx.save();
  ctx.translate(bloom.x + bloom.r * 0.05, bloom.y + bloom.r * 0.09);
  const shadow = ctx.createRadialGradient(0, 0, bloom.r * 0.25, 0, 0, bloom.r * 1.06);
  shadow.addColorStop(0, "rgba(3, 1, 2, 0.5)");
  shadow.addColorStop(0.72, "rgba(3, 1, 2, 0.3)");
  shadow.addColorStop(1, "rgba(3, 1, 2, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, bloom.r * 1.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* A ragged, jittered sample of the bloom: petal edges are noisy on purpose. */
function buildGlyphs(bloom: Bloom): Glyph[] {
  const random = mulberry32(bloom.seed);
  const step = Math.max(5.4, bloom.r * 0.044);
  const fontSize = Math.max(5, step * 0.95);
  const cos = Math.cos(bloom.rot);
  const sin = Math.sin(bloom.rot);
  const span = Math.ceil(bloom.r / step) + 2;
  const glyphs: Glyph[] = [];

  for (let iy = -span; iy <= span; iy += 1) {
    for (let ix = -span; ix <= span; ix += 1) {
      const x = (ix * step + (random() - 0.5) * step * 1.05) / bloom.r;
      const y = (iy * step + (random() - 0.5) * step * 1.05) / bloom.r;

      /* a little noise so the silhouette frays instead of ruling clean */
      const nx = x + (random() - 0.5) * 0.05;
      const ny = y + (random() - 0.5) * 0.05;
      const dist = Math.sqrt(x * x + y * y);

      let ring = -1;
      let edge = 1;

      for (const petal of PETALS) {
        const dx = nx - petal.ox;
        const dy = ny - petal.oy;
        const u = dx * petal.cos + dy * petal.sin;
        const v = -dx * petal.sin + dy * petal.cos;
        const q = (u * u) / (petal.rx * petal.rx) + (v * v) / (petal.ry * petal.ry);
        if (q <= 1 && petal.ring > ring) {
          ring = petal.ring;
          edge = Math.sqrt(q);
        }
      }

      /* a few glyphs fly loose, like sparks off the pen */
      const stray = random() < 0.01 ? bloom.r * 0.14 : 0;
      const sx =
        bloom.x + (x * cos - y * sin) * bloom.r + (random() - 0.5) * (1.8 + stray);
      const sy =
        bloom.y + (x * sin + y * cos) * bloom.r + (random() - 0.5) * (1.8 + stray);

      if (ring < 0) {
        /* loose code dust just outside the petals */
        if (dist < 1.3 && random() < 0.07) {
          glyphs.push({
            x: sx,
            y: sy,
            ch: random() < 0.5 ? "." : "·",
            c: "#7d0d21",
            a: 0.14 + random() * 0.28,
            fs: fontSize,
          });
        }
        continue;
      }

      if (random() < 0.04 + random() * 0.12) continue;

      let value = RING_BASE[ring] + (edge - 0.45) * 0.34;
      value += (dist - 0.55) * 0.2;
      value -= (x + y) * 0.11;
      if (edge > 0.82) value += (edge - 0.82) * 2.3;
      if (dist < 0.17) value = 0.2 + dist * 3.3;
      value = value * bloom.brightness + (random() - 0.5) * 0.14;
      if (value <= 0.05) continue;

      const rim = edge > 0.9 || (dist < 0.17 && random() < 0.3);
      const ch = rim
        ? RIM[Math.min(RIM.length - 1, Math.floor(random() * RIM.length))]
        : RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(value * RAMP.length)))];

      glyphs.push({
        x: sx,
        y: sy,
        ch,
        c: PALETTE[Math.min(PALETTE.length - 1, Math.max(0, Math.round(value * 17)))],
        a: Math.min(1, (0.55 + Math.min(1, value) * 0.45) * (0.78 + random() * 0.32)),
        fs: fontSize,
      });
    }
  }

  /* centre spiral, drawn brighter so the rose reads at a glance */
  const turns = 3.1;
  const spiralSteps = 64;
  for (let i = 0; i < spiralSteps; i += 1) {
    const t = i / spiralSteps;
    const angle = t * turns * Math.PI * 2 + bloom.rot;
    const radius = (0.025 + 0.145 * t) * bloom.r;
    glyphs.push({
      x: bloom.x + Math.cos(angle) * radius,
      y: bloom.y + Math.sin(angle) * radius,
      ch: t > 0.5 ? "}" : ";",
      c: t > 0.55 ? "#ff8fa3" : "#d9224a",
      a: 0.35 + t * 0.6,
      fs: fontSize,
    });
  }

  return glyphs;
}

function drawArm(ctx: CanvasRenderingContext2D, painter: Painter) {
  const { x, y, accent } = painter;

  if (painter.trail.length > 1) {
    ctx.beginPath();
    painter.trail.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(x, y);

  /* pen tip */
  ctx.shadowColor = accent;
  ctx.shadowBlur = 13;
  ctx.beginPath();
  ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 244, 247, 0.95)";
  ctx.fill();

  /* pointer */
  ctx.scale(0.92, 0.92);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4.6, 12.6);
  ctx.lineTo(7.6, 18.8);
  ctx.lineTo(10.4, 17.4);
  ctx.lineTo(7.5, 11.5);
  ctx.lineTo(12.8, 11.1);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 247, 249, 0.94)";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = "round";
  ctx.shadowBlur = 9;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function makeScript(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  host: HTMLElement | null,
): ScriptInfo {
  const raw = host ? getComputedStyle(host).getPropertyValue("--script").trim() : "";
  const family = raw || '"Segoe Script", cursive';
  const size = Math.min(76, Math.max(26, Math.round(width * 0.062)));
  const font = `400 ${size}px ${family}`;

  ctx.font = font;
  const maxWidth = width * 0.86;
  const lines = ctx.measureText(MESSAGE).width > maxWidth ? ["roses for you,", "my love"] : [MESSAGE];
  const lineHeight = size * 1.16;
  const blockCenter = height * 0.54;
  const first = blockCenter - ((lines.length - 1) * lineHeight) / 2;
  const baselines = lines.map((_, i) => first + i * lineHeight);
  const widths = lines.map((line) => ctx.measureText(line).width);

  return {
    family,
    font,
    size,
    lineHeight,
    blockCenter,
    bottom: baselines[baselines.length - 1] + size * 0.6,
    lines,
    baselines,
    widths,
    cx: width / 2,
  };
}

function buildMessage(ctx: CanvasRenderingContext2D, info: ScriptInfo): MessageChar[] {
  ctx.font = info.font;
  const chars: MessageChar[] = [];
  info.lines.forEach((line, li) => {
    const left = info.cx - info.widths[li] / 2;
    for (let i = 0; i < line.length; i += 1) {
      chars.push({
        ch: line[i],
        x: left + ctx.measureText(line.slice(0, i)).width,
        y: info.baselines[li],
      });
    }
  });
  return chars;
}

function drawMessageChars(
  ctx: CanvasRenderingContext2D,
  info: ScriptInfo,
  chars: MessageChar[],
  revealed: boolean[],
) {
  const ink = ctx.createLinearGradient(
    0,
    info.baselines[0] - info.size,
    0,
    info.baselines[info.baselines.length - 1] + info.size * 0.2,
  );
  ink.addColorStop(0, "#fff5f7");
  ink.addColorStop(0.5, "#ffdbe3");
  ink.addColorStop(1, "#ff9db4");

  ctx.save();
  ctx.font = info.font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.shadowColor = "rgba(255, 46, 88, 0.85)";
  ctx.shadowBlur = 26;

  for (let i = 0; i < chars.length; i += 1) {
    if (!revealed[i]) continue;
    ctx.fillText(chars[i].ch, chars[i].x, chars[i].y);
  }
  ctx.restore();
}

function drawNote(ctx: CanvasRenderingContext2D, note: Note, alpha: number) {
  if (note.chars <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = note.font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffd7e1";
  ctx.shadowColor = "rgba(255, 46, 88, 0.75)";
  ctx.shadowBlur = 18;

  let left = note.chars;
  for (let i = 0; i < note.lines.length; i += 1) {
    if (left <= 0) break;
    const line = note.lines[i];
    const prefix = line.slice(0, Math.min(line.length, left));
    ctx.fillText(prefix, note.x, note.y + i * note.lineHeight);
    left -= line.length;
  }
  ctx.restore();
}

function notePen(ctx: CanvasRenderingContext2D, note: Note) {
  ctx.font = note.font;
  let left = note.chars;
  for (let i = 0; i < note.lines.length; i += 1) {
    const line = note.lines[i];
    if (left <= line.length || i === note.lines.length - 1) {
      const prefix = line.slice(0, Math.max(0, Math.min(line.length, left)));
      return {
        x: note.x + ctx.measureText(prefix).width,
        y: note.y + i * note.lineHeight - note.size * 0.22,
      };
    }
    left -= line.length;
  }
  return { x: note.x, y: note.y };
}

export function RoseField() {
  const roseRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const rose = roseRef.current;
    const overlay = cursorRef.current;
    if (!rose || !overlay) return;
    const ctx = rose.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!ctx || !octx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let raf = 0;
    let resizeTimer = 0;

    const start = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      for (const layer of [rose, overlay]) {
        layer.width = Math.round(width * dpr);
        layer.height = Math.round(height * dpr);
        layer.style.width = `${width}px`;
        layer.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = "#060305";
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.72,
      );
      glow.addColorStop(0, "rgba(128, 6, 26, 0.34)");
      glow.addColorStop(0.5, "rgba(64, 3, 13, 0.18)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const blooms = buildBlooms(width, height);
      for (const bloom of blooms) drawShadow(ctx, bloom);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const glyphs: Glyph[] = [];
      for (const bloom of blooms) {
        for (const glyph of buildGlyphs(bloom)) glyphs.push(glyph);
      }
      /* chaos: the whole field is laid down in a scattered order */
      shuffle(glyphs, mulberry32(90210));

      let script = makeScript(ctx, width, height, rose.parentElement);

      document.fonts
        .load(script.font)
        .then(() => {
          if (!cancelled) script = makeScript(ctx, width, height, rose.parentElement);
        })
        .catch(() => {});

      if (reduced) {
        let pen = 0;
        for (const glyph of glyphs) {
          if (glyph.fs !== pen) {
            ctx.font = glyphFont(glyph.fs);
            pen = glyph.fs;
          }
          ctx.globalAlpha = glyph.a;
          ctx.fillStyle = glyph.c;
          ctx.fillText(glyph.ch, glyph.x, glyph.y);
        }
        ctx.globalAlpha = 1;
        const chars = buildMessage(octx, script);
        drawMessageChars(octx, script, chars, chars.map(() => true));
        return;
      }

      const count = width < 620 ? 6 : width < 1100 ? 8 : 10;
      const chunk = Math.ceil(glyphs.length / count);
      const rate = glyphs.length / PAINT_MS;
      const painters: Painter[] = [];

      for (let i = 0; i < count; i += 1) {
        const from = i * chunk;
        const to = Math.min(glyphs.length, from + chunk);
        if (from >= glyphs.length) break;
        const first = glyphs[from];
        painters.push({
          x: first.x,
          y: first.y,
          idx: from,
          to,
          trail: [],
          accent: ACCENTS[i % ACCENTS.length],
          wx: first.x,
          wy: first.y,
          gx: width / 2,
          gy: height / 2,
        });
      }

      let phase: "paint" | "unite" | "message" | "notes" | "linger" = "paint";
      let uniteAt = 0;
      let messageDoneAt = 0;
      let notesAt = 0;
      let lastNoteDoneAt = 0;
      let pen = 0;
      let last = performance.now();

      let messageChars: MessageChar[] = [];
      let revealed: boolean[] = [];
      let revealedCount = 0;
      let cursorNext = painters.map((_, i) => i);
      let lastReveal = painters.map(() => 0);

      let notes: Note[] = [];

      const placeNotes = () => {
        notes = [];
        const baseSize = Math.max(17, Math.min(30, Math.round(width * 0.023)));
        const msgWidth = Math.max(...script.widths);
        const msgRect = {
          left: script.cx - msgWidth / 2 - 30,
          right: script.cx + msgWidth / 2 + 30,
          top: script.blockCenter - script.size * 0.9,
          bottom: script.bottom + 26,
        };

        /* a jittered lattice of slots so the notes spread over the whole screen */
        const cols = Math.min(8, Math.max(3, Math.round(width / 140)));
        const rows = Math.min(10, Math.max(4, Math.round(height / 110)));
        const cellW = (width - 36) / cols;
        const cellH = (height - 96) / rows;
        const slots: { x: number; y: number }[] = [];
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            slots.push({
              x: 18 + cellW * (c + 0.5) + (Math.random() - 0.5) * cellW * 0.4,
              y: 52 + cellH * (r + 0.5) + (Math.random() - 0.5) * cellH * 0.35,
            });
          }
        }
        shuffle(slots, Math.random);

        NOTES_TEXT.forEach((lines, index) => {
          const verse = lines.length > 1;
          const size = verse
            ? Math.round(Math.min(46, Math.max(21, baseSize * 1.7)))
            : Math.round(Math.min(36, Math.max(15, baseSize * (0.82 + Math.random() * 0.36))));
          const font = `400 ${size}px ${script.family}`;
          const lineHeight = size * (verse ? 1.06 : 1.16);
          octx.font = font;
          const blockWidth = Math.max(...lines.map((line) => octx.measureText(line).width));
          const blockHeight = (lines.length - 1) * lineHeight + size * 0.94;

          const fits = (x: number, y: number) => {
            const hitsMessage =
              x < msgRect.right &&
              x + blockWidth > msgRect.left &&
              y - size < msgRect.bottom &&
              y + blockHeight > msgRect.top;
            if (hitsMessage) return false;
            return !notes.some(
              (note) =>
                x < note.x + note.width + 20 &&
                x + blockWidth + 20 > note.x &&
                y - size < note.y + note.height &&
                y + blockHeight + 14 > note.y - note.size,
            );
          };

          const slotFor = (x: number, y: number) => {
            const bx = Math.min(Math.max(14, x - blockWidth / 2), Math.max(14, width - blockWidth - 14));
            const by = Math.min(Math.max(size + 18, y - blockHeight / 2 + size), Math.max(size + 18, height - 22));
            return { bx, by };
          };

          let { bx, by } = slotFor(slots[index % slots.length].x, slots[index % slots.length].y);
          let best = Number.POSITIVE_INFINITY;

          for (const slot of slots) {
            const spot = slotFor(slot.x, slot.y);
            if (fits(spot.bx, spot.by)) {
              bx = spot.bx;
              by = spot.by;
              break;
            }
            let overlap = 0;
            for (const note of notes) {
              const ox = Math.min(spot.bx + blockWidth, note.x + note.width) - Math.max(spot.bx, note.x);
              const oy = Math.min(spot.by + blockHeight, note.y + note.height) - Math.max(spot.by - size, note.y - note.size);
              if (ox > 0 && oy > 0) overlap += ox * oy;
            }
            if (overlap < best) {
              best = overlap;
              bx = spot.bx;
              by = spot.by;
            }
          }

          notes.push({
            lines,
            x: bx,
            y: by,
            size,
            lineHeight,
            font,
            width: blockWidth,
            height: blockHeight,
            total: lines.reduce((sum, line) => sum + line.length, 0),
            cursor: index % painters.length,
            start: 0,
            chars: 0,
          });
        });
      };

      const frame = (now: number) => {
        if (cancelled) return;
        const dt = Math.min(64, now - last);
        last = now;

        if (phase === "paint") {
          const perPainter = Math.max(1, Math.round((rate * dt) / painters.length));
          for (const painter of painters) {
            if (painter.idx >= painter.to) continue;
            const batch = Math.min(perPainter, painter.to - painter.idx);
            for (let k = 0; k < batch; k += 1) {
              const glyph = glyphs[painter.idx];
              painter.idx += 1;
              if (glyph.fs !== pen) {
                ctx.font = glyphFont(glyph.fs);
                pen = glyph.fs;
              }
              ctx.globalAlpha = glyph.a;
              ctx.fillStyle = glyph.c;
              ctx.fillText(glyph.ch, glyph.x, glyph.y);
              painter.x = glyph.x;
              painter.y = glyph.y;
            }
            ctx.globalAlpha = 1;
            painter.wx = painter.x;
            painter.wy = painter.y;
          }

          if (painters.every((painter) => painter.idx >= painter.to)) {
            phase = "unite";
            uniteAt = now;
            script = makeScript(ctx, width, height, rose.parentElement);
            const meetX = width / 2;
            const meetY = Math.min(height - 40, script.bottom + 34);
            painters.forEach((painter, i) => {
              const angle = (i / painters.length) * Math.PI * 2;
              const radius = 14 + (i % 3) * 7;
              painter.gx = meetX + Math.cos(angle) * radius * 1.7;
              painter.gy = meetY + Math.sin(angle) * radius;
            });
          }
        } else if (phase === "unite") {
          const ease = 1 - Math.exp(-dt / 260);
          let close = true;
          for (const painter of painters) {
            painter.x += (painter.gx - painter.x) * ease;
            painter.y += (painter.gy - painter.y) * ease;
            if (Math.hypot(painter.gx - painter.x, painter.gy - painter.y) > 4) close = false;
          }
          if (close || now - uniteAt > UNITE_MS) {
            phase = "message";
            messageChars = buildMessage(octx, script);
            revealed = messageChars.map(() => false);
            revealedCount = 0;
            cursorNext = painters.map((_, i) => i);
            lastReveal = painters.map(() => now - 200);
          }
        } else if (phase === "message") {
          const ease = 1 - Math.exp(-dt / 120);
          for (let c = 0; c < painters.length; c += 1) {
            const painter = painters[c];
            const index = cursorNext[c];
            if (index >= messageChars.length) {
              const anchorX = script.cx + (c - painters.length / 2) * 9;
              const anchorY = script.bottom + 30;
              painter.x += (anchorX - painter.x) * ease;
              painter.y += (anchorY - painter.y) * ease;
              continue;
            }
            const char = messageChars[index];
            const tx = char.x + 2;
            const ty = char.y - script.size * 0.25;
            painter.x += (tx - painter.x) * ease;
            painter.y += (ty - painter.y) * ease;
            if (Math.hypot(tx - painter.x, ty - painter.y) < 11 && now - lastReveal[c] > 55) {
              revealed[index] = true;
              revealedCount += 1;
              lastReveal[c] = now;
              cursorNext[c] += painters.length;
            }
          }
          if (revealedCount >= messageChars.length) {
            if (!messageDoneAt) messageDoneAt = now;
            if (now - messageDoneAt > MESSAGE_HOLD) {
              phase = "notes";
              notesAt = now;
              placeNotes();
            }
          }
        } else if (phase === "notes") {
          let allDone = true;
          notes.forEach((note, i) => {
            note.start = notesAt + i * NOTE_GAP;
            const elapsed = now - note.start;
            note.chars = Math.max(0, Math.min(note.total, Math.floor(elapsed / NOTE_TYPE_MS)));
            if (note.chars < note.total) allDone = false;
          });

          /* one scribe per note; the rest of the fleet keeps darting around */
          const active = notes.filter(
            (note) => now >= note.start - 650 && note.chars < note.total,
          );
          const scribes = new Map<number, Note>();
          for (const note of active) {
            if (!scribes.has(note.cursor)) scribes.set(note.cursor, note);
          }

          painters.forEach((painter, i) => {
            const note = scribes.get(i);
            if (note) {
              const penPoint = notePen(octx, note);
              const ease = 1 - Math.exp(-dt / 170);
              painter.x += (penPoint.x - painter.x) * ease;
              painter.y += (penPoint.y - painter.y) * ease;
              return;
            }
            const dx = painter.wx - painter.x;
            const dy = painter.wy - painter.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 30) {
              painter.wx = Math.random() * width;
              painter.wy = Math.random() * height;
            } else {
              const move = Math.min(distance, dt * 0.22);
              painter.x += (dx / distance) * move;
              painter.y += (dy / distance) * move;
            }
          });

          if (allDone) {
            if (!lastNoteDoneAt) lastNoteDoneAt = now;
            if (now - lastNoteDoneAt > 1400) phase = "linger";
          } else {
            lastNoteDoneAt = 0;
          }
        } else {
          for (const painter of painters) {
            const dx = painter.wx - painter.x;
            const dy = painter.wy - painter.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 10) {
              painter.wx = width * (0.06 + Math.random() * 0.88);
              painter.wy = height * (0.06 + Math.random() * 0.88);
            } else {
              const move = Math.min(distance, dt * 0.014);
              painter.x += (dx / distance) * move;
              painter.y += (dy / distance) * move;
            }
          }
        }

        for (const painter of painters) {
          painter.trail.push({ x: painter.x, y: painter.y });
          if (painter.trail.length > 16) painter.trail.shift();
        }

        octx.clearRect(0, 0, width, height);

        if (revealedCount > 0) {
          drawMessageChars(octx, script, messageChars, revealed);
        }
        for (const note of notes) {
          drawNote(octx, note, Math.min(1, Math.max(0, (now - note.start) / 300)));
        }
        for (const painter of painters) drawArm(octx, painter);

        raf = window.requestAnimationFrame(frame);
      };

      raf = window.requestAnimationFrame(frame);
    };

    start();

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        window.cancelAnimationFrame(raf);
        start();
      }, 200);
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <canvas ref={roseRef} className="rose-canvas" aria-hidden="true" />
      <canvas ref={cursorRef} className="cursor-canvas" aria-hidden="true" />
    </>
  );
}
