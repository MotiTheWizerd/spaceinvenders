import './styles.css';
import { Game } from './Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing #game canvas');

const game = new Game(canvas);

// Fixed simulation steps for steady gravity and auto-repeat timing; one render per frame.
const STEP = 1 / 120;
let last = performance.now();
let acc = 0;
const frame = (now: number) => {
  acc += Math.min(0.25, Math.max(0, now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  game.render();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
