import { COLORS } from './config';

/** Size of the gallery preview in logical pixels. */
export const PREVIEW_W = 160;
export const PREVIEW_H = 100;

const HORIZON = 40;
const CX = PREVIEW_W / 2;
const DEPTH = PREVIEW_H - HORIZON;

/** Screen y and trail half-width at depth d (0 = horizon, 1 = bottom edge). */
const project = (d: number) => ({ y: HORIZON + DEPTH * d * d, half: 2 + 56 * d * d });

const PEAKS: readonly [x: number, h: number, w: number, color: string][] = [
  [8, 30, 26, COLORS.mountains[1]],
  [40, 22, 22, COLORS.mountains[2]],
  [66, 34, 28, COLORS.mountains[0]],
  [104, 26, 24, COLORS.mountains[3]],
  [140, 32, 28, COLORS.mountains[1]],
];

/** Card animation: the hiker runs down the trail at dusk as coins and pines rush past. */
export function drawPreview(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(0.5, COLORS.skyMid);
  sky.addColorStop(1, COLORS.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PREVIEW_W, HORIZON);

  for (const [x, h, w, color] of PEAKS) {
    const drift = (x - time * 0.6) % (PREVIEW_W + 40);
    const px = drift < -20 ? drift + PREVIEW_W + 40 : drift;
    tri(ctx, px, HORIZON - h, w, h, color);
    tri(ctx, px, HORIZON - h, w * 0.3, h * 0.3, COLORS.snow);
  }

  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, HORIZON, PREVIEW_W, DEPTH);

  // The trail, with ruts rushing towards the viewer.
  const bottom = project(1);
  ctx.fillStyle = '#f5e5c0';
  ctx.beginPath();
  ctx.moveTo(CX - 2, HORIZON);
  ctx.lineTo(CX + 2, HORIZON);
  ctx.lineTo(CX + bottom.half, PREVIEW_H);
  ctx.lineTo(CX - bottom.half, PREVIEW_H);
  ctx.fill();

  const scroll = (time * 0.9) % 1;
  ctx.fillStyle = 'rgba(150, 105, 70, 0.3)';
  for (let i = 0; i < 6; i++) {
    const { y, half } = project((i + scroll) / 6);
    ctx.fillRect(CX - half * 0.8, y, half * 1.6, Math.max(0.5, (y - HORIZON) / 25));
  }

  // Pines beside the trail and coins down the middle lane, nearest drawn last.
  for (let i = 0; i < 4; i++) {
    const d = (i + scroll) / 4;
    const { y, half } = project(d);
    const size = 3 + 22 * d * d;
    for (const s of [-1, 1]) {
      const x = CX + s * (half + 4 + size * 0.6);
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(x - size * 0.06, y - size * 0.25, size * 0.12, size * 0.25);
      tri(ctx, x, y - size * 1.4, size * 0.9, size * 1.2, i % 2 ? COLORS.pine : COLORS.pineDark);
    }
    if (d > 0.15 && d < 0.8) {
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      const r = 0.6 + 3 * d;
      ctx.ellipse(CX, y - 6 * d * d - r, r * Math.abs(Math.cos(time * 4 + i)) + 0.3, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHiker(ctx, time);
}

function tri(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + w / 2, top + h);
  ctx.lineTo(x - w / 2, top + h);
  ctx.fill();
}

/** The blocky hiker from behind, mid-stride. */
function drawHiker(ctx: CanvasRenderingContext2D, time: number): void {
  const stride = Math.sin(time * 9);
  const bob = Math.abs(stride) * 1.2;
  const x = CX;
  const feet = PREVIEW_H - 4;

  ctx.fillStyle = 'rgba(40, 25, 40, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, feet, 9, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const top = feet - 30 - bob;
  ctx.fillStyle = '#5d6f99';
  ctx.fillRect(x - 5, top + 17, 4, 11 + stride * 2);
  ctx.fillRect(x + 1, top + 17, 4, 11 - stride * 2);
  ctx.fillStyle = '#e07a5f';
  ctx.fillRect(x - 8, top + 7, 16, 11);
  ctx.fillRect(x - 10, top + 8 + stride, 3, 9);
  ctx.fillRect(x + 7, top + 8 - stride, 3, 9);
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x - 6, top + 7, 12, 10);
  ctx.fillStyle = '#c9b48a';
  ctx.fillRect(x - 7, top + 5, 14, 3);
  ctx.fillStyle = '#e8b894';
  ctx.fillRect(x - 4, top, 8, 6);
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(x - 8, top - 1, 16, 2);
  ctx.fillRect(x - 4, top - 4, 8, 3);
}
