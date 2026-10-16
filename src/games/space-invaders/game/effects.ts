import type { Gfx } from '../gfx/gfx';
import type { SpriteName } from '../gfx/sprites';

interface Effect {
  x: number;
  y: number;
  color: string;
  life: number;
  sprite?: SpriteName;
  text?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

const GRAVITY = 90;

/** Short-lived explosions, flying debris and floating score text. */
export class Effects {
  private list: Effect[] = [];
  private particles: Particle[] = [];

  sprite(sprite: SpriteName, x: number, y: number, color: string, life: number): void {
    this.list.push({ sprite, x, y, color, life });
  }

  text(text: string, x: number, y: number, color: string, life: number): void {
    this.list.push({ text, x, y, color, life });
  }

  /** count pixels of debris flying out from (x, y) at up to speed px/s. */
  burst(x: number, y: number, color: string, count: number, speed = 60): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y, color,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.3,
        life: 0.3 + Math.random() * 0.5,
      });
    }
  }

  update(dt: number): void {
    this.list = this.list.filter(e => (e.life -= dt) > 0);
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += GRAVITY * dt;
      return (p.life -= dt) > 0;
    });
  }

  clear(): void {
    this.list = [];
    this.particles = [];
  }

  draw(g: Gfx): void {
    for (const p of this.particles) g.rect(Math.round(p.x), Math.round(p.y), 1, 1, p.color, Math.min(1, p.life * 3));
    for (const e of this.list) {
      if (e.text) g.text(e.text, e.x, e.y, e.color, 'center');
      else if (e.sprite) g.sprite(e.sprite, e.color, e.x, e.y);
    }
  }
}
