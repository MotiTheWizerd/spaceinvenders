interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Trail {
  x: number;
  y0: number;
  y1: number;
  w: number;
  color: string;
  life: number;
}

const GRAVITY = 900;
const TRAIL_LIFE = 0.18;

/** Juice: particles, floating callouts, hard-drop trails, screen shake and flashes (all in logical px). */
export class Effects {
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private trails: Trail[] = [];
  shake = 0;
  flash = 0;

  burst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x, y, color, life, maxLife: life,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.4,
        size: 2 + Math.random() * 3,
      });
    }
  }

  popup(text: string, x: number, y: number, color: string, size = 22, life = 1.2): void {
    // Stack under any callout still showing, so a big clear can announce several things at once.
    const below = this.popups.filter(p => p.life > p.maxLife - 0.3).length;
    this.popups.push({ text, x, y: y + below * (size + 6), size, color, life, maxLife: life });
  }

  trail(x: number, y0: number, y1: number, w: number, color: string): void {
    this.trails.push({ x, y0, y1, w, color, life: TRAIL_LIFE });
  }

  kick(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += GRAVITY * dt;
      return (p.life -= dt) > 0;
    });
    this.popups = this.popups.filter(p => {
      p.y -= 28 * dt;
      return (p.life -= dt) > 0;
    });
    this.trails = this.trails.filter(t => (t.life -= dt) > 0);
  }

  clear(): void {
    this.particles = [];
    this.popups = [];
    this.trails = [];
    this.shake = this.flash = 0;
  }

  /** Trails go under the pieces. */
  drawTrails(ctx: CanvasRenderingContext2D): void {
    for (const t of this.trails) {
      const g = ctx.createLinearGradient(0, t.y0, 0, t.y1);
      g.addColorStop(0, 'rgba(0, 0, 0, 0)');
      g.addColorStop(1, t.color);
      ctx.globalAlpha = (t.life / TRAIL_LIFE) * 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(t.x, t.y0, t.w, t.y1 - t.y0);
    }
    ctx.globalAlpha = 1;
  }

  /** Particles and callouts go over everything. */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const age = 1 - p.life / p.maxLife;
      const pop = age < 0.12 ? 0.6 + (age / 0.12) * 0.5 : 1.1 - Math.min(0.1, (age - 0.12) * 0.5);
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.font = `900 ${Math.round(p.size * pop)}px system-ui, "Segoe UI", sans-serif`;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha *= 0.55;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
