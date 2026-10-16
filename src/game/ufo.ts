import { COLORS, UFO_SPEED, UFO_Y, W } from '../config';
import type { Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';

export const UFO_W = 16;
const UFO_H = 7;

export class Ufo {
  x: number;
  readonly y = UFO_Y;

  constructor(private readonly dir: 1 | -1) {
    this.x = dir > 0 ? -UFO_W : W;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: UFO_W, h: UFO_H };
  }

  get gone(): boolean {
    return this.x > W || this.x < -UFO_W;
  }

  update(dt: number): void {
    this.x += this.dir * UFO_SPEED * dt;
  }

  draw(g: Gfx, tint: string = COLORS.red): void {
    g.sprite('ufo', tint, this.x, this.y);
  }
}
