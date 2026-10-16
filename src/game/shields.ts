import { COLORS, SHIELD_COUNT, SHIELD_H, SHIELD_W, SHIELD_Y, W } from '../config';
import { overlap, type Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';

/** Destructible bunker with per-pixel damage, cached to an offscreen canvas. */
export class Shield {
  private readonly px = new Uint8Array(SHIELD_W * SHIELD_H);
  private readonly canvas = document.createElement('canvas');
  private dirty = true;

  constructor(
    readonly x: number,
    readonly y = SHIELD_Y,
  ) {
    this.canvas.width = SHIELD_W;
    this.canvas.height = SHIELD_H;
    for (let py = 0; py < SHIELD_H; py++) {
      for (let px = 0; px < SHIELD_W; px++) {
        const corner = py < 4 && (px < 4 - py || px > SHIELD_W - 5 + py);
        const arch = (py >= 11 && px >= 7 && px <= 14) || (py >= 13 && px >= 6 && px <= 15);
        this.px[py * SHIELD_W + px] = corner || arch ? 0 : 1;
      }
    }
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: SHIELD_W, h: SHIELD_H };
  }

  /** If r touches a solid pixel, blasts a crater there and returns true. */
  hit(r: Rect, radius: number): boolean {
    if (!overlap(r, this.rect)) return false;
    const { x0, x1, y0, y1 } = this.localBounds(r);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        if (this.px[py * SHIELD_W + px]) {
          this.erode(px, py, radius);
          return true;
        }
      }
    }
    return false;
  }

  /** Clears every pixel under r (invaders marching through). */
  erase(r: Rect): void {
    if (!overlap(r, this.rect)) return;
    const { x0, x1, y0, y1 } = this.localBounds(r);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) this.px[py * SHIELD_W + px] = 0;
    }
    this.dirty = true;
  }

  draw(g: Gfx): void {
    if (this.dirty) this.redraw();
    g.image(this.canvas, this.x, this.y);
  }

  private localBounds(r: Rect) {
    return {
      x0: Math.max(0, Math.floor(r.x - this.x)),
      x1: Math.min(SHIELD_W, Math.ceil(r.x + r.w - this.x)),
      y0: Math.max(0, Math.floor(r.y - this.y)),
      y1: Math.min(SHIELD_H, Math.ceil(r.y + r.h - this.y)),
    };
  }

  private erode(cx: number, cy: number, r: number): void {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= SHIELD_W || y >= SHIELD_H) continue;
        const center = dx === 0 && dy === 0;
        if (center || (dx * dx + dy * dy <= r * r + 1 && Math.random() < 0.8)) this.px[y * SHIELD_W + x] = 0;
      }
    }
    this.dirty = true;
  }

  private redraw(): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SHIELD_W, SHIELD_H);
    ctx.fillStyle = COLORS.green;
    for (let py = 0; py < SHIELD_H; py++) {
      for (let px = 0; px < SHIELD_W; px++) {
        if (this.px[py * SHIELD_W + px]) ctx.fillRect(px, py, 1, 1);
      }
    }
    this.dirty = false;
  }
}

export function buildShields(): Shield[] {
  const gap = (W - SHIELD_COUNT * SHIELD_W) / (SHIELD_COUNT + 1);
  return Array.from({ length: SHIELD_COUNT }, (_, i) => new Shield(Math.round(gap + i * (SHIELD_W + gap))));
}

export const hitShields = (shields: Shield[], r: Rect, radius: number): boolean =>
  shields.some(s => s.hit(r, radius));

export const eraseShields = (shields: Shield[], r: Rect): void => shields.forEach(s => s.erase(r));
