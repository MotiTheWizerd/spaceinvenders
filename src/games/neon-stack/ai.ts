import type { Board } from './board';
import { COLS, TOTAL_ROWS } from './config';
import { spawnX, type PieceType, type Rotation } from './pieces';

export interface Placement {
  readonly rot: Rotation;
  readonly x: number;
}

// Classic weights for a one-piece-lookahead stacker (Yiyuan Lee's tuned values).
const W_HEIGHT = -0.51;
const W_LINES = 0.76;
const W_HOLES = -0.36;
const W_BUMPY = -0.18;

function evaluate(board: Board, lines: number): number {
  const heights: number[] = [];
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let top = TOTAL_ROWS;
    for (let y = 0; y < TOTAL_ROWS; y++) {
      if (board.grid[y][x]) {
        if (top === TOTAL_ROWS) top = y;
      } else if (top < y) {
        holes++;
      }
    }
    heights.push(TOTAL_ROWS - top);
  }
  const total = heights.reduce((a, b) => a + b, 0);
  let bumpy = 0;
  for (let x = 1; x < COLS; x++) bumpy += Math.abs(heights[x] - heights[x - 1]);
  return W_HEIGHT * total + W_LINES * lines + W_HOLES * holes + W_BUMPY * bumpy;
}

/** The best spot for a piece (rotation and column), reachable by rotating at spawn then sliding and dropping. */
export function bestPlacement(board: Board, type: PieceType): Placement | null {
  let best: Placement | null = null;
  let bestScore = -Infinity;
  const rotations: Rotation[] = type === 'O' ? [0] : [0, 1, 2, 3];
  for (const rot of rotations) {
    if (!board.fits(type, rot, spawnX(type), 0)) continue;
    for (let x = -2; x < COLS; x++) {
      if (!board.fits(type, rot, x, 0)) continue;
      const trial = board.clone();
      trial.place(type, rot, x, trial.dropY(type, rot, x, 0));
      const full = trial.fullRows();
      trial.removeRows(full);
      const score = evaluate(trial, full.length);
      if (score > bestScore) {
        bestScore = score;
        best = { rot, x };
      }
    }
  }
  return best;
}
