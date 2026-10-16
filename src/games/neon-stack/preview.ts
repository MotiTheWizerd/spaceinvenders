import { bestPlacement, type Placement } from './ai';
import { Board } from './board';
import { COLORS, COLS, HIDDEN, PIECE_COLORS, ROWS } from './config';
import { Bag, CELLS, spawnX, type PieceType, type Rotation } from './pieces';

/** Size of the gallery preview in logical pixels. */
export const PREVIEW_W = 160;
export const PREVIEW_H = 100;

const CELL = 4.4;
const WELL_X = (PREVIEW_W - COLS * CELL) / 2;
const WELL_Y = (PREVIEW_H - ROWS * CELL) / 2;
const SLIDE_STEP = 0.07; // seconds per rotate/slide while lining up
const DROP_STEP = 0.03; // seconds per row once lined up
const CLEAR_TIME = 0.35;
const RESET_HEIGHT = 15; // start over before the demo ever tops out

interface Demo {
  board: Board;
  bag: Bag;
  queue: PieceType[];
  piece: { type: PieceType; rot: Rotation; x: number; y: number } | null;
  target: Placement | null;
  timer: number;
  clearing: { rows: number[]; t: number } | null;
  lines: number;
  callout: { text: string; t: number } | null;
  last: number;
}

const demo: Demo = {
  board: new Board(), bag: new Bag(), queue: [], piece: null, target: null,
  timer: 0, clearing: null, lines: 0, callout: null, last: 0,
};

function spawn(): void {
  while (demo.queue.length < 4) demo.queue.push(demo.bag.next());
  const type = demo.queue.shift()!;
  if (demo.board.stackHeight > RESET_HEIGHT || !demo.board.fits(type, 0, spawnX(type), 0)) {
    demo.board.clear();
    demo.lines = 0;
  }
  demo.piece = { type, rot: 0, x: spawnX(type), y: 0 };
  demo.target = bestPlacement(demo.board, type);
}

/** Advances the self-playing demo: line up with the AI's chosen spot, drop, clear lines. */
function step(dt: number): void {
  const d = demo;
  if (d.callout && (d.callout.t -= dt) <= 0) d.callout = null;
  if (d.clearing) {
    if ((d.clearing.t += dt / CLEAR_TIME) >= 1) {
      d.board.removeRows(d.clearing.rows);
      d.clearing = null;
      spawn();
    }
    return;
  }
  if (!d.piece) spawn();
  const p = d.piece!;
  const t = d.target ?? { rot: p.rot, x: p.x };
  const lined = p.rot === t.rot && p.x === t.x;
  if ((d.timer -= dt) > 0) return;
  d.timer = lined ? DROP_STEP : SLIDE_STEP;

  if (p.rot !== t.rot) p.rot = t.rot;
  else if (p.x !== t.x) p.x += Math.sign(t.x - p.x);
  else if (d.board.fits(p.type, p.rot, p.x, p.y + 1)) p.y++;
  else {
    d.board.place(p.type, p.rot, p.x, p.y);
    d.piece = null;
    const rows = d.board.fullRows();
    if (rows.length) {
      d.clearing = { rows, t: 0 };
      d.lines += rows.length;
      if (rows.length >= 2) d.callout = { text: ['', '', 'DOUBLE', 'TRIPLE', 'QUAD!'][rows.length], t: 1 };
    }
  }
}

function cell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(x - 0.8, y - 0.8, size + 1.6, size + 1.6); // soft glow
  ctx.globalAlpha = 1;
  ctx.fillRect(x + 0.3, y + 0.3, size - 0.6, size - 0.6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(x + 0.3, y + 0.3, size - 0.6, 0.8);
}

/** Card animation: the game playing itself, with the neon well, ghost piece and next queue. */
export function drawPreview(ctx: CanvasRenderingContext2D, time: number): void {
  step(Math.min(0.1, Math.max(0, time - demo.last)));
  demo.last = time;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  const glow = ctx.createRadialGradient(PREVIEW_W / 2, PREVIEW_H / 2, 5, PREVIEW_W / 2, PREVIEW_H / 2, 90);
  glow.addColorStop(0, COLORS.bgGlow);
  glow.addColorStop(1, COLORS.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  // Well and frame.
  const w = COLS * CELL;
  const h = ROWS * CELL;
  ctx.fillStyle = COLORS.well;
  ctx.fillRect(WELL_X, WELL_Y, w, h);
  ctx.save();
  ctx.shadowColor = COLORS.frame;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(WELL_X - 1, WELL_Y - 1, w + 2, h + 2);
  ctx.restore();

  const cx = (x: number) => WELL_X + x * CELL;
  const cy = (y: number) => WELL_Y + (y - HIDDEN) * CELL;
  const fade = demo.clearing ? 1 - demo.clearing.t : 1;

  demo.board.grid.forEach((row, y) => {
    if (y < HIDDEN) return;
    ctx.globalAlpha = demo.clearing?.rows.includes(y) ? fade : 1;
    row.forEach((type, x) => type && cell(ctx, cx(x), cy(y), CELL, PIECE_COLORS[type]));
    ctx.globalAlpha = 1;
  });
  if (demo.clearing) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * fade})`;
    for (const y of demo.clearing.rows) ctx.fillRect(WELL_X, cy(y), w, CELL);
  }

  const p = demo.piece;
  if (p) {
    const ghostY = demo.board.dropY(p.type, p.rot, p.x, p.y);
    ctx.strokeStyle = PIECE_COLORS[p.type];
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;
    for (const c of CELLS[p.type][p.rot]) ctx.strokeRect(cx(p.x + c.x) + 0.6, cy(ghostY + c.y) + 0.6, CELL - 1.2, CELL - 1.2);
    ctx.globalAlpha = 1;
    for (const c of CELLS[p.type][p.rot]) {
      if (p.y + c.y >= HIDDEN) cell(ctx, cx(p.x + c.x), cy(p.y + c.y), CELL, PIECE_COLORS[p.type]);
    }
  }

  // Next queue on the right, line count on the left.
  const side = WELL_X + w + 10;
  demo.queue.slice(0, 3).forEach((type, i) => {
    for (const c of CELLS[type][0]) cell(ctx, side + c.x * 3.2, WELL_Y + 6 + i * 16 + c.y * 3.2, 3.2, PIECE_COLORS[type]);
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.label;
  ctx.font = '700 6px system-ui, sans-serif';
  ctx.fillText('LINES', WELL_X / 2, WELL_Y + 10);
  ctx.fillStyle = PIECE_COLORS.S;
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.fillText(String(demo.lines), WELL_X / 2, WELL_Y + 22);

  if (demo.callout) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, demo.callout.t * 2);
    ctx.shadowColor = PIECE_COLORS.I;
    ctx.shadowBlur = 6;
    ctx.fillStyle = PIECE_COLORS.I;
    ctx.font = '900 10px system-ui, sans-serif';
    ctx.fillText(demo.callout.text, PREVIEW_W / 2, WELL_Y + h * 0.35);
    ctx.restore();
  }
}
