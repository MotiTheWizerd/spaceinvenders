import type { PieceType } from './pieces';

// Board
export const COLS = 10;
export const ROWS = 20; // visible rows
export const HIDDEN = 2; // spawn rows above the visible board
export const TOTAL_ROWS = ROWS + HIDDEN;

// Layout, in logical pixels (the canvas scales this to fit the window).
export const VIEW_W = 520;
export const VIEW_H = 600;
export const CELL = 26;
export const BOARD_X = 130;
export const BOARD_Y = 40;
export const NEXT_COUNT = 5;

// Handling
export const DAS = 0.16; // hold left/right this long before auto-repeat starts
export const ARR = 0.045; // then move a cell this often
export const SOFT_DROP_INTERVAL = 0.03;
export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15; // moves/rotations on the ground that restart the lock timer
export const CLEAR_TIME = 0.32; // line-clear animation
export const LINES_PER_LEVEL = 10;
export const MAX_LEVEL = 20;

/** Seconds per row of gravity at a level (the classic guideline curve). */
export const gravity = (level: number): number => {
  const l = Math.min(level, MAX_LEVEL) - 1;
  return (0.8 - l * 0.007) ** l;
};

export const HI_KEY = 'neon-stack-hi';

export const COLORS = {
  bg: '#07060f',
  bgGlow: '#1a0f3d',
  grid: 'rgba(130, 110, 255, 0.07)',
  well: 'rgba(8, 6, 22, 0.85)',
  frame: '#ff3df2',
  frameDanger: '#ff3b5c',
  text: '#ece9ff',
  dim: '#7a76a3',
  label: '#9d8cff',
  gold: '#ffe14d',
} as const;

export const PIECE_COLORS: Readonly<Record<PieceType, string>> = {
  I: '#2ee6ff',
  O: '#ffe14d',
  T: '#c04dff',
  S: '#3dff7a',
  Z: '#ff3b5c',
  J: '#3d7bff',
  L: '#ff9a3d',
};

type Action = 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotateCW' | 'rotateCCW' | 'hold' | 'start' | 'pause' | 'mute';

export const KEYS: Readonly<Record<Action, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  softDrop: ['ArrowDown', 'KeyS'],
  hardDrop: ['Space'],
  rotateCW: ['ArrowUp', 'KeyX', 'KeyW'],
  rotateCCW: ['KeyZ', 'ControlLeft', 'ControlRight'],
  hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
  start: ['Enter', 'Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};
