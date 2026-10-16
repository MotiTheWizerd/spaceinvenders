import type { Board } from './board';
import { BOARD_X, BOARD_Y, CELL, COLORS, COLS, HIDDEN, PIECE_COLORS, ROWS, VIEW_H, VIEW_W } from './config';
import { CELLS, type PieceType, type Rotation } from './pieces';

const WELL_W = COLS * CELL;
const WELL_H = ROWS * CELL;
const SIDE_W = 110;
const HOLD_X = 10;
const NEXT_X = BOARD_X + WELL_W + 10;
const PANEL_TOP = BOARD_Y;

/** Mixes a #rrggbb colour towards white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (v: number) => Math.round(v + (target - v) * a);
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

export interface Clearing {
  readonly rows: readonly number[];
  /** 0 → 1 over the clear animation. */
  readonly progress: number;
}

/** Draws the whole game in logical pixels; the canvas is scaled to fit the window at full device resolution. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private readonly blocks = new Map<string, { img: HTMLCanvasElement; pad: number }>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Fits the view to the window (keeping its shape) and renders at the screen's real pixel density. */
  resize(): void {
    const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H) * 0.96;
    const cssW = Math.floor(VIEW_W * fit);
    const cssH = Math.floor(VIEW_H * fit);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / VIEW_W;
    this.blocks.clear();
  }

  /** CSS pixels per logical pixel (for touch gestures). */
  get cssScale(): number {
    return this.scale / (window.devicePixelRatio || 1);
  }

  begin(time: number, level: number, shake: number): void {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.background(time, level);
    const jolt = () => (Math.random() - 0.5) * shake;
    ctx.setTransform(this.scale, 0, 0, this.scale, jolt() * this.scale, jolt() * this.scale);
  }

  /** Deep purple glow with a neon grid that scrolls faster as the level rises. */
  private background(time: number, level: number): void {
    const { ctx } = this;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const glow = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.45, 20, VIEW_W / 2, VIEW_H * 0.45, VIEW_H * 0.7);
    glow.addColorStop(0, COLORS.bgGlow);
    glow.addColorStop(1, 'rgba(7, 6, 15, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const gap = 40;
    const scroll = (time * (8 + level * 3)) % gap;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = gap / 2; x < VIEW_W; x += gap) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_H);
    }
    for (let y = scroll - gap; y < VIEW_H; y += gap) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
    }
    ctx.stroke();
  }

  /** The well: frame (pulsing red when the stack is high), grid, locked blocks and any rows being cleared. */
  well(board: Board, clearing: Clearing | null, danger: number, time: number): void {
    const { ctx } = this;
    const pulse = danger > 0 ? 0.5 + 0.5 * Math.sin(time * (6 + danger * 8)) : 0;
    ctx.save();
    ctx.shadowColor = danger > 0 ? COLORS.frameDanger : COLORS.frame;
    ctx.shadowBlur = 16 + pulse * 14 * danger;
    ctx.strokeStyle = danger > 0.3 && pulse > 0.5 ? COLORS.frameDanger : COLORS.frame;
    ctx.lineWidth = 2;
    this.roundRect(BOARD_X - 4, BOARD_Y - 4, WELL_W + 8, WELL_H + 8, 8);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.well;
    ctx.fillRect(BOARD_X, BOARD_Y, WELL_W, WELL_H);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(BOARD_X + x * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + x * CELL, BOARD_Y + WELL_H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(BOARD_X, BOARD_Y + y * CELL);
      ctx.lineTo(BOARD_X + WELL_W, BOARD_Y + y * CELL);
    }
    ctx.stroke();

    for (let y = HIDDEN; y < board.grid.length; y++) {
      const fading = clearing?.rows.includes(y);
      if (fading) ctx.globalAlpha = 1 - clearing!.progress;
      board.grid[y].forEach((type, x) => {
        if (type) this.block(PIECE_COLORS[type], this.cellX(x), this.cellY(y), CELL);
      });
      ctx.globalAlpha = 1;
    }

    // Cleared rows burn out as a white bar that thins away.
    if (clearing) {
      const t = clearing.progress;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * (1 - t)})`;
      for (const y of clearing.rows) {
        const h = CELL * (1 - t * 0.85);
        ctx.fillRect(BOARD_X + (WELL_W * t) / 2, this.cellY(y) + (CELL - h) / 2, WELL_W * (1 - t), h);
      }
      ctx.restore();
    }
  }

  /** A piece in the well; `glow` (0-1) brightens it as its lock timer runs out. */
  piece(type: PieceType, rot: Rotation, x: number, y: number, glow = 0): void {
    const { ctx } = this;
    this.clipWell(() => {
      for (const c of CELLS[type][rot]) this.block(PIECE_COLORS[type], this.cellX(x + c.x), this.cellY(y + c.y), CELL);
      if (glow > 0) {
        ctx.globalAlpha = glow * 0.45;
        ctx.fillStyle = '#ffffff';
        for (const c of CELLS[type][rot]) ctx.fillRect(this.cellX(x + c.x) + 2, this.cellY(y + c.y) + 2, CELL - 4, CELL - 4);
        ctx.globalAlpha = 1;
      }
    });
  }

  /** Where the piece will land: a faint outline. */
  ghost(type: PieceType, rot: Rotation, x: number, y: number): void {
    const { ctx } = this;
    const color = PIECE_COLORS[type];
    this.clipWell(() => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      for (const c of CELLS[type][rot]) {
        const px = this.cellX(x + c.x);
        const py = this.cellY(y + c.y);
        ctx.globalAlpha = 0.12;
        ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        ctx.globalAlpha = 0.55;
        ctx.strokeRect(px + 2.5, py + 2.5, CELL - 5, CELL - 5);
      }
      ctx.globalAlpha = 1;
    });
  }

  hold(type: PieceType | null, used: boolean): void {
    this.panel('HOLD', HOLD_X, PANEL_TOP, SIDE_W, 86);
    if (type) {
      this.ctx.globalAlpha = used ? 0.3 : 1;
      this.miniPiece(type, HOLD_X + SIDE_W / 2, PANEL_TOP + 50, 20);
      this.ctx.globalAlpha = 1;
    }
  }

  next(types: readonly PieceType[]): void {
    this.panel('NEXT', NEXT_X, PANEL_TOP, SIDE_W, 310);
    types.forEach((t, i) => {
      const first = i === 0;
      this.miniPiece(t, NEXT_X + SIDE_W / 2, PANEL_TOP + (first ? 56 : 66 + i * 54), first ? 22 : 16);
    });
  }

  stats(score: number, hi: number, level: number, lines: number): void {
    const rows: [string, string, string][] = [
      ['SCORE', score.toLocaleString(), COLORS.text],
      ['HI-SCORE', hi.toLocaleString(), COLORS.gold],
      ['LEVEL', String(level), PIECE_COLORS.I],
      ['LINES', String(lines), PIECE_COLORS.S],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = PANEL_TOP + 120 + i * 62;
      this.text(label, HOLD_X + 4, y, COLORS.label, 11, 'left', 700);
      this.text(value, HOLD_X + 4, y + 24, color, 22, 'left', 900);
    });
  }

  controlsHint(): void {
    const lines = ['← → MOVE', '↓ SOFT DROP', 'SPACE HARD DROP', '↑ X ROTATE', 'Z ROTATE BACK', 'C HOLD', 'P PAUSE · M MUTE'];
    lines.forEach((l, i) => this.text(l, NEXT_X + 2, PANEL_TOP + 332 + i * 18, COLORS.dim, 10, 'left', 600));
  }

  /** Title, pause and game-over cards over the well. */
  overlay(title: string, lines: readonly [string, string][], prompt: string, time: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5, 3, 15, 0.78)';
    ctx.fillRect(BOARD_X, BOARD_Y, WELL_W, WELL_H);
    const cx = BOARD_X + WELL_W / 2;
    const top = BOARD_Y + WELL_H * 0.3;
    title.split('\n').forEach((t, i) => this.glowText(t, cx, top + i * 46, i % 2 ? PIECE_COLORS.I : COLORS.frame, 40));
    lines.forEach(([text, color], i) => this.text(text, cx, top + 110 + i * 26, color, 15, 'center', 700));
    if (Math.floor(time * 2) % 2 === 0) this.text(prompt, cx, top + 130 + lines.length * 26, COLORS.gold, 13, 'center', 800);
  }

  end(): void {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  // ---------- Helpers ----------

  private cellX(x: number): number {
    return BOARD_X + x * CELL;
  }

  private cellY(y: number): number {
    return BOARD_Y + (y - HIDDEN) * CELL;
  }

  private clipWell(draw: () => void): void {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(BOARD_X, BOARD_Y, WELL_W, WELL_H);
    ctx.clip();
    draw();
    ctx.restore();
  }

  /** A glowing neon tile, pre-rendered once per colour and size at device resolution. */
  private block(color: string, x: number, y: number, size: number): void {
    const key = `${color}|${size}`;
    let sprite = this.blocks.get(key);
    if (!sprite) {
      sprite = this.buildBlock(color, size);
      this.blocks.set(key, sprite);
    }
    const pad = sprite.pad / this.scale;
    this.ctx.drawImage(sprite.img, x - pad, y - pad, size + pad * 2, size + pad * 2);
  }

  private buildBlock(color: string, size: number): { img: HTMLCanvasElement; pad: number } {
    const px = size * this.scale;
    const pad = Math.ceil(px * 0.4);
    const img = document.createElement('canvas');
    img.width = img.height = Math.ceil(px + pad * 2);
    const c = img.getContext('2d')!;
    const inset = px * 0.06;
    const s = px - inset * 2;
    const r = px * 0.16;
    const x = pad + inset;

    const body = c.createLinearGradient(0, x, 0, x + s);
    body.addColorStop(0, shade(color, 0.35));
    body.addColorStop(0.5, color);
    body.addColorStop(1, shade(color, -0.3));
    c.shadowColor = color;
    c.shadowBlur = px * 0.5;
    c.fillStyle = body;
    c.beginPath();
    c.roundRect(x, x, s, s, r);
    c.fill();
    c.shadowBlur = 0;

    // Bright rim and a glint, for the lit-glass look.
    c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    c.lineWidth = Math.max(1, px * 0.06);
    c.beginPath();
    c.roundRect(x + c.lineWidth / 2, x + c.lineWidth / 2, s - c.lineWidth, s - c.lineWidth, r * 0.8);
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.beginPath();
    c.roundRect(x + s * 0.18, x + s * 0.16, s * 0.34, s * 0.14, s * 0.07);
    c.fill();
    return { img, pad };
  }

  /** A piece centred on its blocks (not its rotation box) at (cx, cy). */
  private miniPiece(type: PieceType, cx: number, cy: number, size: number): void {
    const cells = CELLS[type][0];
    const xs = cells.map(c => c.x);
    const ys = cells.map(c => c.y);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * size;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * size;
    const ox = cx - w / 2 - Math.min(...xs) * size;
    const oy = cy - h / 2 - Math.min(...ys) * size;
    for (const c of cells) this.block(PIECE_COLORS[type], ox + c.x * size, oy + c.y * size, size);
  }

  private panel(label: string, x: number, y: number, w: number, h: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(12, 9, 30, 0.75)';
    this.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(157, 140, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    this.text(label, x + w / 2, y + 16, COLORS.label, 11, 'center', 800);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
  }

  private text(str: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign, weight: number): void {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  private glowText(str: string, x: number, y: number, color: string, size: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    this.text(str, x, y, color, size, 'center', 900);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    this.text(str, x, y, '#ffffff', size, 'center', 900);
    ctx.restore();
  }
}
