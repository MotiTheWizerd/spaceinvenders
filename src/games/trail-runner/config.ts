// World units are metres. The hiker stays near z = 0 facing -z; the world scrolls towards +z.

export const TRAIL_W = 5.6;
export const LANE_W = 1.75;
export const LANES = [-LANE_W, 0, LANE_W] as const;

/** Where course rows appear and where everything is recycled behind the camera. */
export const SPAWN_Z = -170;
export const DESPAWN_Z = 12;

// Running
export const START_SPEED = 10;
export const MAX_SPEED = 24;
export const ACCEL = 0.12; // m/s gained per second
export const TITLE_SPEED = 3.5; // the gentle walk behind the title screen
export const LANE_SNAP = 14; // how quickly the hiker slides into a new lane

// Jumping and sliding
export const GRAVITY = 26;
export const JUMP_SPEED = 8.4; // peak ≈ 1.36 m, ≈ 0.65 s in the air
export const FAST_FALL_SPEED = 14;
export const SLIDE_TIME = 0.65;
export const STAND_H = 1.75;
export const SLIDE_H = 0.9;
export const HIKER_HALF_W = 0.32;

export const BEST_KEY = 'trail-runner-best';

export const COLORS = {
  skyTop: '#22264d',
  skyMid: '#5a4d85',
  skyLow: '#b88aa8',
  horizon: '#efc6b6',
  ground: '#f1dcd1',
  tuft: '#d9bfae',
  mountains: ['#a79fc2', '#9890b5', '#b7aecb', '#8f88ab'],
  snow: '#f6f2fb',
  pine: '#5b8c78',
  pineDark: '#476f60',
  trunk: '#7a5236',
  rock: '#9c98aa',
  rockDark: '#7f7b8f',
  log: '#8a5a3b',
  logEnd: '#d9b07c',
  gate: '#c8553d',
  post: '#6e4a33',
  coin: '#f2c94c',
  dust: '#e7cfb3',
  sun: '#fff0dd',
  hemiSky: '#cbbcff',
  hemiGround: '#f2c9b2',
} as const;

type Action = 'left' | 'right' | 'jump' | 'slide' | 'start' | 'pause' | 'mute';

export const KEYS: Readonly<Record<Action, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  slide: ['ArrowDown', 'KeyS'],
  start: ['Enter', 'Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};
