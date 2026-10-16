import './styles.css';
import { Game } from './Game';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Missing #scene canvas');

const game = new Game(canvas);

// Fixed physics steps (so a fast run on a slow frame can't skip through a thin gate), one render per frame.
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;
const frame = (now: number) => {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  game.render();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
