import './styles.css';
import { STEP } from './config';
import { startLoop } from './core/loop';
import { Gfx } from './gfx/gfx';
import { Sound } from './audio/sound';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing #game canvas');

const game = new Game(new Gfx(canvas), new Sound());
startLoop(STEP, dt => game.update(dt), () => game.render());
