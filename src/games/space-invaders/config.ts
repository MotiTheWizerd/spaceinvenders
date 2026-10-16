// Logical resolution (original arcade) and on-screen scale.
export const W = 224;
export const H = 256;
export const SCALE = 3;

/** Fixed simulation timestep (seconds). */
export const STEP = 1 / 120;

// Layout
export const SKY_Y = 22; // player shots vanish above this line
export const UFO_Y = 28;
export const SHIELD_Y = 192;
export const PLAYER_Y = 216;
export const GROUND_Y = 240;

// Player
export const PLAYER_W = 13;
export const PLAYER_H = 8;
export const PLAYER_SPEED = 90;
export const PLAYER_SHOT_SPEED = 300;
export const START_LIVES = 3;
export const EXTRA_LIFE_SCORE = 1500;

// Fleet
export const COLS = 11;
export const ROWS = 5;

// Shields
export const SHIELD_COUNT = 4;
export const SHIELD_W = 22;
export const SHIELD_H = 16;

// UFO
export const UFO_SPEED = 45;
export const UFO_POINTS = [50, 100, 150, 300] as const;
export const UFO_MIN_INVADERS = 8;
export const UFO_FIRST_DELAY: [number, number] = [15, 25];
export const UFO_DELAY: [number, number] = [18, 28];

export const HI_SCORE_KEY = 'space-invenders-hi';

export const COLORS = {
  bg: '#05060a',
  white: '#f2f2f2',
  green: '#39ff6a',
  red: '#ff3b5c',
  pink: '#ff6bd6',
  cyan: '#4de8ff',
  yellow: '#ffe14d',
  orange: '#ff9a3d',
  silver: '#c0c8d8',
  purple: '#b36bff',
  blue: '#5b8cff',
  ice: '#a8eeff',
  gold: '#ffb000',
  dim: '#5b6475',
} as const;

type Action = 'left' | 'right' | 'fire' | 'start' | 'pause' | 'mute';

export const KEYS: Readonly<Record<Action, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire: ['Space', 'ArrowUp', 'KeyW'],
  start: ['Enter'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};
