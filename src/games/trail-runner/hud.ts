function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export interface RunResult {
  distance: number;
  coins: number;
  newBest: boolean;
}

/** The HTML layer over the 3D view: stats, buttons, and the title / pause / game-over panel. */
export class Hud {
  private readonly distance = $('distance');
  private readonly coins = $('coins');
  private readonly best = $('best');
  private readonly soundBtn = $<HTMLButtonElement>('sound');
  private readonly pauseBtn = $<HTMLButtonElement>('pause');
  private readonly overlay = $('overlay');
  private readonly title = $('overlay-title');
  private readonly text = $('overlay-text');
  private readonly result = $('overlay-result');
  private readonly prompt = $('overlay-prompt');

  constructor(actions: { sound: () => void; pause: () => void }) {
    // Buttons keep keyboard focus otherwise, and Space would "click" them again.
    this.soundBtn.addEventListener('click', () => {
      actions.sound();
      this.soundBtn.blur();
    });
    this.pauseBtn.addEventListener('click', () => {
      actions.pause();
      this.pauseBtn.blur();
    });
  }

  stats(distance: number, coins: number, best: number): void {
    this.distance.textContent = `${Math.floor(distance)} m`;
    this.coins.textContent = String(coins);
    this.best.textContent = `${Math.floor(best)} m`;
  }

  sound(muted: boolean): void {
    this.soundBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  }

  paused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
  }

  showTitle(): void {
    this.show(
      'TRAIL RUNNER',
      'Run the mountain trail. Dodge boulders, jump fallen logs, slide under gates — and grab every coin.',
      '',
      'PRESS SPACE OR TAP TO RUN',
    );
  }

  showPaused(): void {
    this.show('PAUSED', 'Catch your breath.', '', 'PRESS P OR TAP TO RESUME');
  }

  showGameOver(r: RunResult): void {
    this.show(
      'WIPED OUT!',
      r.newBest ? 'New personal best on the trail!' : 'The mountain wins this time.',
      `${Math.floor(r.distance)} m · ${r.coins} coins`,
      'PRESS SPACE OR TAP TO RUN AGAIN',
    );
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }

  private show(title: string, text: string, result: string, prompt: string): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.result.textContent = result;
    this.prompt.textContent = prompt;
    this.overlay.classList.remove('hidden');
  }
}
