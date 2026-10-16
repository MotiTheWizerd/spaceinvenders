import { COLORS, PLAYER_Y, SKY_Y } from '../config';
import type { Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';

export interface Shot {
  x: number;
  y: number;
  /** Sideways drift (px/s) — non-zero for Triple Shot's side bullets. */
  vx: number;
  /** Fireball power-up: bigger, and pierces everything it touches. */
  fire: boolean;
  /** Homing power-up: steers towards the nearest target above it. */
  homing: boolean;
  /** Fired by a wingman drone: flies over the bunkers and doesn't count against the player's shot limit. */
  drone: boolean;
}

export interface EnemyShot {
  x: number;
  y: number;
  /** Sideways drift (px/s) — the mothership fires angled shots. */
  vx: number;
  /** 0 = zigzag, 1 = plunger (visual only). */
  kind: 0 | 1;
}

export const PLAYER_SHOT = { w: 1, h: 4 } as const;
export const FIREBALL = { w: 5, h: 7 } as const;
export const ENEMY_SHOT = { w: 3, h: 7 } as const;

/** x is the shot's centre column, so normal shots and fireballs line up with the gun. */
export const playerShotRect = (s: Shot): Rect =>
  s.fire
    ? { x: s.x - Math.floor(FIREBALL.w / 2), y: s.y, ...FIREBALL }
    : { x: s.x, y: s.y, ...PLAYER_SHOT };
export const enemyShotRect = (s: EnemyShot): Rect => ({ x: s.x, y: s.y, ...ENEMY_SHOT });

/** Laser power-up: a beam from the gun at x straight up to the top of the playfield. */
export const beamRect = (x: number): Rect => ({ x: x - 1, y: SKY_Y, w: 3, h: PLAYER_Y - SKY_Y });

export function drawBeam(g: Gfx, x: number, time: number): void {
  const { y, h } = beamRect(x);
  const f = Math.floor(time * 30) % 2;
  g.rect(x - 2, y, 5, h, COLORS.purple, 0.2 + 0.15 * f);
  g.rect(x - 1, y, 3, h, COLORS.purple, 0.85);
  g.rect(x, y, 1, h, COLORS.white);
  g.rect(x - 2 + f, PLAYER_Y - 3, 4, 3, COLORS.white, 0.8); // muzzle flare
}

export function drawPlayerShot(g: Gfx, s: Shot, time: number): void {
  const x = Math.round(s.x);
  const y = Math.round(s.y);
  if (!s.fire) {
    if (s.homing) {
      // Missile: orange body with a flickering exhaust.
      g.rect(x, y, PLAYER_SHOT.w, PLAYER_SHOT.h, COLORS.orange);
      g.rect(x, y, 1, 1, COLORS.white);
      g.rect(x, y + PLAYER_SHOT.h + (Math.floor(time * 30) % 2), 1, 1, COLORS.yellow, 0.7);
    } else {
      g.rect(x, y, PLAYER_SHOT.w, PLAYER_SHOT.h, s.drone ? COLORS.silver : COLORS.white);
    }
    return;
  }
  // Flickering fireball: orange body, yellow heart, white-hot core, red tail.
  const f = Math.floor(time * 20) % 2;
  g.rect(x - 1, y + 5, 3, 2, COLORS.red, 0.8);
  g.rect(x - 1 + f * 2, y + 7, 1, 2, COLORS.red, 0.6);
  g.rect(x - 1, y, 3, 5, COLORS.orange);
  g.rect(x - 2, y + 1, 5, 3, COLORS.orange);
  g.rect(x - 1, y + 1, 3, 3, COLORS.yellow);
  g.rect(x, y + 2 - f, 1, 1, COLORS.white);
}

const ZIGZAG = [0, 1, 2, 1];
const PLUNGER = [1, 3, 5, 3];

export function drawEnemyShot(g: Gfx, s: EnemyShot, time: number): void {
  const f = Math.floor(time * 12) % 4;
  const x = Math.round(s.x);
  const y = Math.round(s.y);
  if (s.kind === 0) {
    for (let r = 0; r < ENEMY_SHOT.h; r++) g.rect(x + ZIGZAG[(r + f) % 4], y + r, 1, 1, COLORS.white);
  } else {
    g.rect(x + 1, y, 1, ENEMY_SHOT.h, COLORS.white);
    g.rect(x, y + PLUNGER[f], ENEMY_SHOT.w, 1, COLORS.white);
  }
}
