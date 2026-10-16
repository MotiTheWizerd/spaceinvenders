import { HI_SCORE_KEY } from '../games/space-invaders/config';
import { PREVIEW_H, PREVIEW_W, drawPreview } from '../games/space-invaders/preview';

/** An animated thumbnail, drawn in logical pixels and scaled up on the card. */
export interface Preview {
  readonly width: number;
  readonly height: number;
  draw(ctx: CanvasRenderingContext2D, time: number): void;
}

export interface GameEntry {
  readonly title: string;
  readonly tagline: string;
  /** Page of the game, relative to the gallery (keep the trailing slash). */
  readonly href: string;
  /** Neon colour of the card. */
  readonly accent: string;
  readonly controls: readonly string[];
  /** localStorage key of the game's saved hi-score, shown on its card. */
  readonly hiScoreKey?: string;
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
    hiScoreKey: HI_SCORE_KEY,
    preview: { width: PREVIEW_W, height: PREVIEW_H, draw: drawPreview },
  },
];
