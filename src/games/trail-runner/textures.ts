import * as THREE from 'three';
import { COLORS, LANES, TRAIL_W } from './config';

const TRAIL_TEX_W = 256;
const TRAIL_TEX_H = 512;
/** Metres of trail covered by one copy of the trail texture (keeps its pixels square). */
export const TRAIL_TILE = (TRAIL_W * TRAIL_TEX_H) / TRAIL_TEX_W;

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Small seeded random generator, so the textures look the same on every visit. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Tileable packed-sand trail: worn edges, darker patches, pebbles, ruts and old footprints.
 * The detail is what makes the ground visibly rush past (a flat colour shows no speed at all).
 */
export function trailTexture(): THREE.CanvasTexture {
  const W = TRAIL_TEX_W;
  const H = TRAIL_TEX_H;
  const [c, ctx] = canvas2d(W, H);
  const rnd = seeded(7);

  // Draws a shape at y, plus wrapped copies so the texture tiles seamlessly top to bottom.
  const wrapped = (y: number, reach: number, draw: (y: number) => void) => {
    draw(y);
    if (y - reach < 0) draw(y + H);
    if (y + reach > H) draw(y - H);
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, rot: number, color: string) =>
    wrapped(y, Math.max(rx, ry), yy => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, yy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    });

  ctx.fillStyle = '#f5e5c0';
  ctx.fillRect(0, 0, W, H);

  // Worn, darker edges where the trail meets the dirt.
  const edge = ctx.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, 'rgba(150, 105, 70, 0.45)');
  edge.addColorStop(0.07, 'rgba(150, 105, 70, 0)');
  edge.addColorStop(0.93, 'rgba(150, 105, 70, 0)');
  edge.addColorStop(1, 'rgba(150, 105, 70, 0.45)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);

  // Soft patches of darker sand, built from overlapping faint blobs so they have no hard outline.
  for (let i = 0; i < 16; i++) {
    const cx = rnd() * W;
    const cy = rnd() * H;
    const size = 8 + rnd() * 14;
    for (let j = 0; j < 6; j++) {
      ellipse(
        cx + (rnd() - 0.5) * size * 2, cy + (rnd() - 0.5) * size * 3,
        size * (0.5 + rnd() * 0.5), size * (0.8 + rnd()), rnd() * 0.6 - 0.3,
        'rgba(185, 140, 95, 0.05)',
      );
    }
  }

  // Ruts across the trail: strong horizontal marks are what the eye tracks at speed.
  for (let i = 0; i < 9; i++) {
    const y = rnd() * H;
    const x = rnd() * W * 0.6;
    const len = 30 + rnd() * W * 0.5;
    const width = 2 + rnd() * 2;
    const bend = (rnd() - 0.5) * 8;
    const tilt = (rnd() - 0.5) * 6;
    wrapped(y, 8, yy => {
      ctx.strokeStyle = 'rgba(140, 95, 60, 0.18)';
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.quadraticCurveTo(x + len / 2, yy + bend, x + len, yy + tilt);
      ctx.stroke();
    });
  }

  // Old footprints up each lane.
  for (const lane of LANES) {
    const cx = W / 2 + (lane / TRAIL_W) * W;
    for (let y = 0; y < H; y += 32) {
      const side = (y / 32) % 2 ? 1 : -1;
      ellipse(cx + side * 7 + (rnd() - 0.5) * 3, y + rnd() * 6, 3.2, 6.5, side * 0.15, 'rgba(125, 85, 55, 0.2)');
    }
  }

  // Pebbles, each with a highlight.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 0.8 + rnd() * 2.2;
    ellipse(x, y, r, r * (0.7 + rnd() * 0.3), 0, rnd() < 0.5 ? 'rgba(120, 105, 110, 0.55)' : 'rgba(150, 110, 75, 0.5)');
    if (r > 1.8) ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.3, 0, 'rgba(255, 255, 255, 0.35)');
  }

  const tex = finish(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Soft dark ellipse laid under the hiker's feet so they always look planted on the trail. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, ctx] = canvas2d(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(40, 25, 40, 0.55)');
  g.addColorStop(0.55, 'rgba(40, 25, 40, 0.3)');
  g.addColorStop(1, 'rgba(40, 25, 40, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish(c);
}

/**
 * Dusk sky: deep indigo overhead fading to a warm haze. The background spans the whole screen, and
 * the horizon sits about 40% down it from this camera, so the haze is reached there and held below,
 * matching the fog the far ground fades into.
 */
export function skyTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(4, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.18, COLORS.skyMid);
  g.addColorStop(0.32, COLORS.skyLow);
  g.addColorStop(0.42, COLORS.horizon);
  g.addColorStop(1, COLORS.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);
  return finish(c);
}
