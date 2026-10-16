import { COLORS, H, SCALE, W } from '../config';
import { sprite, type SpriteName } from './sprites';

/** Thin wrapper over the canvas: everything is drawn in logical (W x H) pixels. */
export class Gfx {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color: string): void {
    this.rect(0, 0, W, H, color);
  }

  /** Shifts everything drawn after this by (x, y) logical pixels — used for screen shake. */
  offset(x: number, y: number): void {
    this.ctx.setTransform(SCALE, 0, 0, SCALE, Math.round(x * SCALE), Math.round(y * SCALE));
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.globalAlpha = 1;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1, lineWidth = 0.67): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }

  image(img: CanvasImageSource, x: number, y: number): void {
    this.ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  sprite(name: SpriteName, color: string, x: number, y: number): void {
    this.image(sprite(name, color), x, y);
  }

  text(str: string, x: number, y: number, color: string = COLORS.white, align: CanvasTextAlign = 'left', size = 8): void {
    this.ctx.font = `bold ${size}px "Courier New", monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = color;
    this.ctx.fillText(str, x, y);
  }
}
