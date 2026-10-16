import { COLORS, PLAYER_H, PLAYER_SPEED, PLAYER_W, PLAYER_Y, W } from '../config';
import { clamp, type Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';

const MARGIN = 8;
const SHIELD_PAD_X = 4;
const SHIELD_PAD_Y = 3;
const DRONE_OFFSET = 17; // wingmen fly this far either side of the ship's centre
const DRONE_W = 5;

export class Player {
  x = 0;

  reset(): void {
    this.x = Math.floor((W - PLAYER_W) / 2);
  }

  /** dir: -1 left, 0 still, 1 right. */
  move(dir: number, dt: number): void {
    this.x = clamp(this.x + dir * PLAYER_SPEED * dt, MARGIN, W - MARGIN - PLAYER_W);
  }

  get rect(): Rect {
    return { x: Math.round(this.x), y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
  }

  get gunX(): number {
    return Math.round(this.x) + Math.floor(PLAYER_W / 2);
  }

  get centerX(): number {
    return this.x + PLAYER_W / 2;
  }

  /** Hit area of the Shield power-up bubble — a bit larger than the ship. */
  get shieldRect(): Rect {
    const { x, y, w, h } = this.rect;
    return { x: x - SHIELD_PAD_X, y: y - SHIELD_PAD_Y, w: w + SHIELD_PAD_X * 2, h: h + SHIELD_PAD_Y * 2 };
  }

  /** Gun x of each wingman drone, kept on screen. */
  get droneXs(): number[] {
    return [-1, 1].map(side => Math.round(clamp(this.centerX + side * DRONE_OFFSET, 3, W - 3)));
  }

  draw(g: Gfx): void {
    g.sprite('player', COLORS.green, this.x, PLAYER_Y);
  }

  drawDrones(g: Gfx, time: number): void {
    this.droneXs.forEach((x, i) => {
      const bob = Math.round(Math.sin(time * 6 + i * Math.PI) * 1.5);
      g.sprite('drone', COLORS.silver, x - Math.floor(DRONE_W / 2), PLAYER_Y + 2 + bob);
    });
  }

  drawShield(g: Gfx, time: number): void {
    const r = this.shieldRect;
    const shimmer = 0.6 + 0.3 * Math.sin(time * 10);
    g.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, COLORS.yellow, shimmer);
  }

  drawDeath(g: Gfx, time: number): void {
    g.sprite(Math.floor(time * 10) % 2 ? 'deathA' : 'deathB', COLORS.green, this.x, PLAYER_Y);
  }
}
