import './gallery.css';
import { GAMES, type GameEntry } from './games';

const PREVIEW_SCALE = 3;

interface LivePreview {
  ctx: CanvasRenderingContext2D;
  draw: (ctx: CanvasRenderingContext2D, time: number) => void;
}

const grid = document.querySelector<HTMLElement>('#games');
if (!grid) throw new Error('Missing #games');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function loadHiScore(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function gameCard(game: GameEntry, previews: LivePreview[]): HTMLElement {
  const card = el('a', 'card');
  card.href = game.href;
  card.style.setProperty('--accent', game.accent);

  const screen = el('div', 'screen');
  const canvas = el('canvas', 'preview');
  canvas.width = game.preview.width * PREVIEW_SCALE;
  canvas.height = game.preview.height * PREVIEW_SCALE;
  canvas.style.aspectRatio = `${game.preview.width} / ${game.preview.height}`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(PREVIEW_SCALE, 0, 0, PREVIEW_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    previews.push({ ctx, draw: game.preview.draw });
  }
  screen.append(canvas);

  const body = el('div', 'body');
  body.append(el('h2', 'title', game.title), el('p', 'tagline', game.tagline));

  const controls = el('ul', 'controls');
  for (const c of game.controls) controls.append(el('li', '', c));
  body.append(controls);

  const footer = el('div', 'card-footer');
  const hi = game.hiScoreKey ? loadHiScore(game.hiScoreKey) : 0;
  footer.append(
    el('span', 'hi', game.hiScoreKey ? `HI-SCORE ${String(hi).padStart(5, '0')}` : ''),
    el('span', 'play', '▶ PLAY'),
  );
  body.append(footer);

  card.append(screen, body);
  return card;
}

function comingSoonCard(): HTMLElement {
  const card = el('div', 'card soon');
  card.setAttribute('aria-disabled', 'true');
  const screen = el('div', 'screen');
  screen.append(el('span', 'mystery', '?'));
  const body = el('div', 'body');
  body.append(
    el('h2', 'title', 'Coming Soon'),
    el('p', 'tagline', 'The next cabinet is being wired up. Check back soon.'),
    el('div', 'card-footer', 'INSERT COIN'),
  );
  card.append(screen, body);
  return card;
}

const previews: LivePreview[] = [];
grid.append(...GAMES.map(g => gameCard(g, previews)), comingSoonCard());

// One animation loop drives every preview; with reduced motion they show a single still frame.
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const start = performance.now();
const frame = (now: number) => {
  const time = (now - start) / 1000;
  for (const p of previews) p.draw(p.ctx, still ? 2 : time);
  if (!still) requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
