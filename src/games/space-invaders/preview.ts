import { COLORS } from './config';
import { sprite, type SpriteName } from './gfx/sprites';

/** Size of the gallery preview in logical pixels. */
export const PREVIEW_W = 160;
export const PREVIEW_H = 100;

const FLEET: readonly { frames: readonly [SpriteName, SpriteName]; w: number; color: string }[] = [
  { frames: ['squidA', 'squidB'], w: 8, color: COLORS.pink },
  { frames: ['crabA', 'crabB'], w: 11, color: COLORS.cyan },
  { frames: ['octoA', 'octoB'], w: 12, color: COLORS.yellow },
];
const COLS = 6;
const CELL = 16;
const GROUND = PREVIEW_H - 6;
const SHIP_Y = GROUND - 10;
const SHOT_EVERY = 0.9;
const SHOT_TIME = 0.55;

const shipX = (t: number): number => PREVIEW_W / 2 + Math.sin(t * 1.3) * 55;

/** Attract mode for the gallery card: the fleet marches, the ship weaves and fires, a UFO drifts by. */
export function drawPreview(ctx: CanvasRenderingContext2D, time: number): void {
  const draw = (name: SpriteName, color: string, x: number, y: number) =>
    ctx.drawImage(sprite(name, color), Math.round(x), Math.round(y));

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  // Drifting stars.
  ctx.fillStyle = COLORS.white;
  for (let i = 0; i < 28; i++) {
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 2 + i);
    ctx.fillRect((i * 53) % PREVIEW_W, (i * 37 + time * (4 + (i % 3) * 4)) % PREVIEW_H, 1, 1);
  }
  ctx.globalAlpha = 1;

  // UFO crossing every 8 seconds.
  const ufoT = time % 8;
  if (ufoT < 4) draw('ufo', COLORS.red, -16 + (ufoT / 4) * (PREVIEW_W + 16), 4);

  // Fleet marching side to side.
  const frame = Math.floor(time * 2) % 2;
  const sweep = PREVIEW_W - COLS * CELL - 16;
  const march = Math.round((1 - Math.abs(((time * 0.12) % 2) - 1)) * sweep);
  FLEET.forEach((type, row) => {
    for (let col = 0; col < COLS; col++) {
      draw(type.frames[frame], type.color, 8 + march + col * CELL + (12 - type.w) / 2, 18 + row * 13);
    }
  });

  // The ship's shot, fired from wherever the ship was at the time.
  const sinceShot = time % SHOT_EVERY;
  if (sinceShot < SHOT_TIME) {
    const x = Math.round(shipX(time - sinceShot));
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x, SHIP_Y - 4 - (sinceShot / SHOT_TIME) * (SHIP_Y - 10), 1, 4);
  }

  draw('player', COLORS.green, shipX(time) - 6, SHIP_Y);
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, GROUND, PREVIEW_W, 1);
}
