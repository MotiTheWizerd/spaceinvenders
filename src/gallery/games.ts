import { HI_SCORE_KEY } from '../games/space-invaders/config';
import * as invaders from '../games/space-invaders/preview';
import { BEST_KEY } from '../games/trail-runner/config';
import * as runner from '../games/trail-runner/preview';

/** An animated thumbnail, drawn in logical pixels and scaled up on the card. */
export interface Preview {
  readonly width: number;
  readonly height: number;
  draw(ctx: CanvasRenderingContext2D, time: number): void;
}

/** The player's best result, read from the game's own localStorage entry. */
export interface Best {
  readonly key: string;
  readonly label: string;
  readonly format: (value: number) => string;
}

export interface GameEntry {
  readonly title: string;
  readonly tagline: string;
  /** Page of the game, relative to the gallery (keep the trailing slash). */
  readonly href: string;
  /** Neon colour of the card. */
  readonly accent: string;
  readonly controls: readonly string[];
  readonly best?: Best;
  readonly preview: Preview;
}

/**
 * Every cabinet in the arcade. To add a game: build it under src/games/<name>/ with its page at
 * games/<name>/index.html, list that page in vite.config.ts, then add its entry here.
 */
export const GAMES: readonly GameEntry[] = [
  {
    title: 'Space Invaders',
    tagline: 'Hold the line against the alien fleet — divers, strafers, 13 power-ups and a Mothership every 4th wave.',
    href: 'games/space-invaders/',
    accent: '#39ff6a',
    controls: ['← → MOVE', 'SPACE FIRE', 'P PAUSE'],
    best: { key: HI_SCORE_KEY, label: 'HI-SCORE', format: n => String(n).padStart(5, '0') },
    preview: { width: invaders.PREVIEW_W, height: invaders.PREVIEW_H, draw: invaders.drawPreview },
  },
  {
    title: 'Trail Runner',
    tagline: 'Sprint a low-poly mountain trail at dusk — dodge boulders, leap logs, slide under gates, grab the gold.',
    href: 'games/trail-runner/',
    accent: '#ff9a3d',
    controls: ['← → LANE', '↑ JUMP', '↓ SLIDE'],
    best: { key: BEST_KEY, label: 'BEST', format: n => `${n} m` },
    preview: { width: runner.PREVIEW_W, height: runner.PREVIEW_H, draw: runner.drawPreview },
  },
];
