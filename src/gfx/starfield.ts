import { COLORS, GROUND_Y, SKY_Y, W } from '../config';
import { rand } from '../core/math';
import type { Gfx } from './gfx';

interface Star {
  x: number;
  y: number;
  phase: number;
}

export class Starfield {
  private readonly stars: Star[];

  constructor(count = 70) {
    this.stars = Array.from({ length: count }, () => ({
      x: rand(0, W),
      y: rand(SKY_Y, GROUND_Y - 8),
      phase: rand(0, Math.PI * 2),
    }));
  }

  draw(g: Gfx, time: number): void {
    for (const s of this.stars) {
      g.rect(s.x, s.y, 0.67, 0.67, COLORS.white, 0.25 + 0.25 * Math.sin(time * 2 + s.phase));
    }
  }
}
