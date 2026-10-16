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

/** Short-lived explosions and floating score text. */
export class Effects {
  private list: Effect[] = [];

  sprite(sprite: SpriteName, x: number, y: number, color: string, life: number): void {
    this.list.push({ sprite, x, y, color, life });
  }

  text(text: string, x: number, y: number, color: string, life: number): void {
    this.list.push({ text, x, y, color, life });
  }

  update(dt: number): void {
    this.list = this.list.filter(e => (e.life -= dt) > 0);
  }

  clear(): void {
    this.list = [];
  }

  draw(g: Gfx): void {
    for (const e of this.list) {
      if (e.text) g.text(e.text, e.x, e.y, e.color, 'center');
      else if (e.sprite) g.sprite(e.sprite, e.color, e.x, e.y);
    }
  }
}
