import { COLORS, GROUND_Y, H, W } from '../config';
import type { Gfx } from '../gfx/gfx';
import { CRAB, OCTOPUS, SQUID } from '../game/fleet';
import { POWER_UPS, type PowerUpKind } from '../game/powerups';
import { UFO_W } from '../game/ufo';

export const pad = (n: number): string => String(n).padStart(5, '0');
const blink = (time: number): boolean => Math.floor(time * 2) % 2 === 0;

export function drawHud(g: Gfx, score: number, hi: number, level: number): void {
  g.text('SCORE', 8, 3);
  g.text(pad(score), 8, 12, COLORS.green);
  g.text('HI-SCORE', W / 2, 3, COLORS.white, 'center');
  g.text(pad(hi), W / 2, 12, COLORS.yellow, 'center');
  g.text('WAVE', W - 8, 3, COLORS.white, 'right');
  g.text(String(level), W - 8, 12, COLORS.cyan, 'right');
}

export function drawFooter(g: Gfx, lives: number, muted: boolean): void {
  g.rect(0, GROUND_Y, W, 1, COLORS.green);
  g.text(String(lives), 8, 245, COLORS.green);
  for (let i = 0; i < Math.min(lives - 1, 4); i++) g.sprite('player', COLORS.green, 20 + i * 16, 245);
  g.text(muted ? 'SOUND OFF' : 'M: MUTE', W - 8, 246, COLORS.dim, 'right', 7);
}

const POWER_UP_SLOT = 54;

/**
 * Active power-ups with seconds left, in one row under the ship; each blinks when about to expire.
 * Past four at once the slots (and text) shrink to keep them on one line.
 */
export function drawPowerUps(g: Gfx, time: number, active: [PowerUpKind, number][]): void {
  const slot = Math.min(POWER_UP_SLOT, (W - 8) / active.length);
  const size = slot < 44 ? 5 : 7;
  active.forEach(([kind, left], i) => {
    if (left < 2 && !blink(time * 3)) return;
    const { short, color } = POWER_UPS[kind];
    const x = W / 2 + (i - (active.length - 1) / 2) * slot;
    g.text(`${short} ${Math.ceil(left)}`, x, GROUND_Y - 9, color, 'center', size);
  });
}

export function drawTitle(g: Gfx, time: number): void {
  g.text('SPACE', W / 2, 40, COLORS.green, 'center', 22);
  g.text('INVADERS', W / 2, 64, COLORS.green, 'center', 22);
  g.text('*SCORE ADVANCE TABLE*', W / 2, 104, COLORS.white, 'center', 7);

  const f = Math.floor(time * 2) % 2;
  g.sprite('ufo', COLORS.red, 72 - UFO_W / 2, 120);
  g.text('= ? MYSTERY', 88, 120);
  [SQUID, CRAB, OCTOPUS].forEach((type, i) => {
    const y = 136 + i * 16;
    g.sprite(type.frames[f], type.color, 72 - type.w / 2, y);
    g.text(`= ${type.points} POINTS`, 88, y);
  });

  if (blink(time)) g.text('PRESS ENTER TO START', W / 2, 196, COLORS.yellow, 'center');
  g.text('← → / A D  MOVE   SPACE  FIRE', W / 2, 218, COLORS.dim, 'center', 7);
  g.text('P  PAUSE     M  MUTE', W / 2, 228, COLORS.dim, 'center', 7);
}

export interface FinalScore {
  score: number;
  newHi: boolean;
}

export function drawOverlay(g: Gfx, time: number, title: string, sub: string, result?: FinalScore): void {
  g.rect(0, 0, W, H, '#000', 0.6);
  g.text(title, W / 2, 96, COLORS.red, 'center', 18);
  if (result) {
    g.text(`SCORE ${pad(result.score)}`, W / 2, 122, COLORS.white, 'center');
    if (result.newHi) g.text('NEW HI-SCORE!', W / 2, 134, COLORS.yellow, 'center');
  }
  if (blink(time)) g.text(sub, W / 2, 152, COLORS.white, 'center');
}

export function drawBanner(g: Gfx, text: string, sub?: string): void {
  g.text(text, W / 2, 110, COLORS.green, 'center', 16);
  if (sub) g.text(sub, W / 2, 132, COLORS.orange, 'center', 7);
}
