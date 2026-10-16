import { COLS, ROWS } from '../config';
import { rand } from '../core/math';

const TOTAL = COLS * ROWS;

/** All per-level tuning lives here. */
export const difficulty = {
  /** Seconds between fleet steps — faster as invaders die and levels rise. */
  marchInterval(alive: number, level: number): number {
    return Math.max(0.025, (0.03 + (0.55 * (alive - 1)) / (TOTAL - 1)) * 0.9 ** (level - 1));
  },

  /** How many rows lower each new wave starts (capped). */
  waveDrop(level: number): number {
    return Math.min(level - 1, 5);
  },

  enemyShotSpeed(level: number): number {
    return 90 + level * 8;
  },

  enemyFireDelay(level: number): number {
    return rand(0.4, 1.2) * Math.max(0.4, 1 - (level - 1) * 0.1);
  },

  maxEnemyShots(level: number): number {
    return Math.min(3, 1 + level);
  },

  /** Chance a shot is aimed at the player rather than from a random column. */
  aimedShotChance: 0.35,

  /** Seconds between dive attempts (divers appear from wave 2). */
  diveDelay(level: number): number {
    return rand(2.5, 5) * Math.max(0.5, 1 - (level - 2) * 0.1);
  },

  /** How many divers may be out of formation at once. */
  maxDivers(level: number): number {
    return Math.min(3, 1 + Math.floor((level - 2) / 2));
  },

  diveSpeed(level: number): number {
    return 70 + level * 5;
  },

  /** Seconds between strafing runs (any alien, from wave 1): it dives at the player, raining shots. */
  strafeDelay(level: number): number {
    return rand(9, 15) * Math.max(0.5, 1 - (level - 1) * 0.08);
  },

  /** Seconds between shots in a strafing run's rain. */
  strafeFireDelay(level: number): number {
    return Math.max(0.08, 0.14 - level * 0.006);
  },
};
