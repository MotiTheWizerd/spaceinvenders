import { bestPlacement, type Placement } from './ai';
import { Board } from './board';
import {
  ARR, BOARD_X, BOARD_Y, CELL, CLEAR_TIME, COLORS, COLS, DAS, HIDDEN, HI_KEY, KEYS, LINES_PER_LEVEL, LOCK_DELAY,
  MAX_LEVEL, MAX_LOCK_RESETS, NEXT_COUNT, PIECE_COLORS, ROWS, SOFT_DROP_INTERVAL, VIEW_H, VIEW_W, gravity,
} from './config';
import { Effects } from './effects';
import { Bag, CELLS, kicks, spawnX, type PieceType, type Rotation } from './pieces';
import { Renderer } from './render';
import { Sound } from './sound';

type State = 'title' | 'playing' | 'paused' | 'gameover';
type Spin = 'none' | 'mini' | 'full';

interface Active {
  type: PieceType;
  rot: Rotation;
  x: number;
  y: number;
}

// Points per clear, multiplied by the level (index = lines cleared).
const LINE_POINTS = [0, 100, 300, 500, 800];
const T_SPIN_POINTS = [400, 800, 1200, 1600];
const T_SPIN_MINI_POINTS = [100, 200, 400];
const ALL_CLEAR_POINTS = [0, 800, 1200, 1800, 2000];
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD!'];

const WELL_CX = BOARD_X + (COLS * CELL) / 2;
const CALLOUT_Y = BOARD_Y + ROWS * CELL * 0.32;
const RESTART_GUARD = 0.8; // seconds after game over before a key restarts
const DANGER_ROWS = 14; // the frame starts pulsing red once the stack is taller than this
const GAME_KEYS = new Set(Object.values(KEYS).flat());
/** Dev shortcut: open the page with ?autoplay to let the demo AI play the real game. */
const AUTOPLAY = new URLSearchParams(location.search).has('autoplay');
const AUTOPLAY_STEP = 0.1;

function loadHi(): number {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHi(score: number): void {
  try {
    localStorage.setItem(HI_KEY, String(score));
  } catch {
    // storage unavailable (private mode, etc.)
  }
}

export class Game {
  private readonly renderer: Renderer;
  private readonly effects = new Effects();
  private readonly sound = new Sound();

  private state: State = 'title';
  private stateTime = 0;
  private time = 0;

  private board = new Board();
  private bag = new Bag();
  private queue: PieceType[] = [];
  private active: Active | null = null;
  private held: PieceType | null = null;
  private holdUsed = false;

  private score = 0;
  private hi = loadHi();
  private hiAtStart = 0;
  private lines = 0;
  private level = 1;
  private combo = -1;
  private backToBack = false;

  private fallTimer = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;
  /** T-spins only count when the piece's last successful action was a rotation. */
  private lastAction: 'move' | 'rotate' = 'move';
  private lastKick = 0;
  private clearing: { rows: number[]; t: number } | null = null;

  // Held keys, for auto-repeat.
  private dir: -1 | 0 | 1 = 0;
  private leftHeld = false;
  private rightHeld = false;
  private dasTimer = 0;
  private arrTimer = 0;
  private softHeld = false;
  private pointer: { x: number; y: number; anchorX: number; anchorY: number; time: number; moved: boolean } | null = null;
  private auto: { piece: Active; target: Placement | null; timer: number; tries: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => this.onKeyUp(e));
    window.addEventListener('blur', () => {
      this.releaseKeys();
      if (this.state === 'playing') this.togglePause();
    });
    canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    canvas.addEventListener('pointerup', e => this.onPointerUp(e));
    if (AUTOPLAY) this.newGame();
  }

  // ---------- Input ----------

  private onKeyDown(e: KeyboardEvent): void {
    const is = (action: keyof typeof KEYS) => KEYS[action].includes(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.sound.init();
    if (is('mute')) {
      if (!e.repeat) this.sound.toggleMute();
      return;
    }
    if (this.state === 'title' || this.state === 'gameover') {
      if (is('start') && !e.repeat && (this.state === 'title' || this.stateTime > RESTART_GUARD)) this.newGame();
      return;
    }
    if (is('pause')) {
      if (!e.repeat) this.togglePause();
      return;
    }
    if (this.state === 'paused') {
      if (is('start') && !e.repeat) this.togglePause();
      return;
    }

    // Left/right auto-repeat is handled in update, so the OS key repeat is ignored.
    if (is('left')) {
      this.leftHeld = true;
      if (!e.repeat) this.press(-1);
    } else if (is('right')) {
      this.rightHeld = true;
      if (!e.repeat) this.press(1);
    }
    if (e.repeat) return;
    if (is('softDrop')) this.softHeld = true;
    else if (is('hardDrop')) this.hardDrop();
    else if (is('rotateCW')) this.rotate(1);
    else if (is('rotateCCW')) this.rotate(-1);
    else if (is('hold')) this.hold();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (KEYS.left.includes(e.code)) {
      this.leftHeld = false;
      if (this.dir === -1) this.release(this.rightHeld ? 1 : 0);
    } else if (KEYS.right.includes(e.code)) {
      this.rightHeld = false;
      if (this.dir === 1) this.release(this.leftHeld ? -1 : 0);
    } else if (KEYS.softDrop.includes(e.code)) {
      this.softHeld = false;
    }
  }

  private press(dir: -1 | 1): void {
    this.dir = dir;
    this.dasTimer = this.arrTimer = 0;
    this.move(dir);
  }

  /** On releasing one direction, a still-held opposite direction takes over. */
  private release(dir: -1 | 0 | 1): void {
    this.dir = dir;
    this.dasTimer = this.arrTimer = 0;
  }

  private releaseKeys(): void {
    this.leftHeld = this.rightHeld = this.softHeld = false;
    this.dir = 0;
  }

  /** Touch: drag sideways to move, drag down to soft drop, flick down to hard drop, flick up to hold, tap to rotate. */
  private onPointerDown(e: PointerEvent): void {
    this.sound.init();
    (e.target as Element).setPointerCapture(e.pointerId);
    this.pointer = { x: e.clientX, y: e.clientY, anchorX: e.clientX, anchorY: e.clientY, time: this.time, moved: false };
  }

  private onPointerMove(e: PointerEvent): void {
    const p = this.pointer;
    if (!p || this.state !== 'playing') return;
    const step = CELL * this.renderer.cssScale;
    while (e.clientX - p.anchorX >= step) {
      this.move(1);
      p.anchorX += step;
      p.moved = true;
    }
    while (p.anchorX - e.clientX >= step) {
      this.move(-1);
      p.anchorX -= step;
      p.moved = true;
    }
    while (e.clientY - p.anchorY >= step) {
      this.softStep();
      p.anchorY += step;
      p.moved = true;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const p = this.pointer;
    this.pointer = null;
    if (!p) return;
    const dy = e.clientY - p.y;
    const quick = this.time - p.time < 0.3;
    const still = !p.moved && Math.abs(e.clientX - p.x) < 12 && Math.abs(dy) < 12;

    if (this.state === 'title' || (this.state === 'gameover' && this.stateTime > RESTART_GUARD)) {
      if (still) this.newGame();
    } else if (this.state === 'paused') {
      if (still) this.togglePause();
    } else if (this.state === 'playing') {
      if (still && quick) this.rotate(1);
      else if (quick && dy > 70) this.hardDrop();
      else if (quick && dy < -50) this.hold();
    }
  }

  private togglePause(): void {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    this.releaseKeys();
  }

  // ---------- Flow ----------

  private newGame(): void {
    this.board.clear();
    this.bag = new Bag();
    this.queue = [];
    this.held = null;
    this.holdUsed = false;
    this.score = this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.backToBack = false;
    this.clearing = null;
    this.hiAtStart = this.hi;
    this.effects.clear();
    this.releaseKeys();
    this.state = 'playing';
    this.stateTime = 0;
    this.spawn();
  }

  private gameOver(): void {
    this.state = 'gameover';
    this.stateTime = 0;
    this.active = null;
    if (this.score > this.hi) {
      this.hi = this.score;
      saveHi(this.hi);
    }
    this.effects.kick(10);
    this.sound.gameOver();
  }

  private fillQueue(): void {
    while (this.queue.length < NEXT_COUNT) this.queue.push(this.bag.next());
  }

  /** Brings in the next piece (or a specific one, from hold); a blocked spawn tops out the game. */
  private spawn(type?: PieceType): void {
    this.fillQueue();
    const next = type ?? this.queue.shift()!;
    this.fillQueue();
    const piece: Active = { type: next, rot: 0, x: spawnX(next), y: 0 };
    if (!this.board.fits(next, 0, piece.x, piece.y)) {
      this.gameOver();
      return;
    }
    // Drop straight into view if there's room.
    if (this.board.fits(next, 0, piece.x, piece.y + 1)) piece.y++;
    this.active = piece;
    this.fallTimer = this.lockTimer = this.lockResets = 0;
    this.lowestY = piece.y;
    this.lastAction = 'move';
  }

  // ---------- Piece actions ----------

  private fits(p: Active, dx = 0, dy = 0, rot: Rotation = p.rot): boolean {
    return this.board.fits(p.type, rot, p.x + dx, p.y + dy);
  }

  private get grounded(): boolean {
    return !!this.active && !this.fits(this.active, 0, 1);
  }

  private move(dx: -1 | 1): boolean {
    const p = this.active;
    if (!p || this.clearing || !this.fits(p, dx)) return false;
    p.x += dx;
    this.lastAction = 'move';
    this.afterShift();
    this.sound.move();
    return true;
  }

  private rotate(dir: 1 | -1): void {
    const p = this.active;
    if (!p || this.clearing) return;
    const to = ((p.rot + dir + 4) % 4) as Rotation;
    const tests = kicks(p.type, p.rot, to);
    for (let i = 0; i < tests.length; i++) {
      const [kx, ky] = tests[i];
      if (!this.fits(p, kx, ky, to)) continue;
      p.x += kx;
      p.y += ky;
      p.rot = to;
      this.lastAction = 'rotate';
      this.lastKick = i;
      this.afterShift();
      this.sound.rotate();
      return;
    }
  }

  /** Moving or rotating on the ground restarts the lock timer — a limited number of times per piece. */
  private afterShift(): void {
    if (this.lockResets >= MAX_LOCK_RESETS) return;
    if (this.grounded) this.lockResets++;
    this.lockTimer = 0;
  }

  /** One row of soft drop (1 point). */
  private softStep(): boolean {
    const p = this.active;
    if (!p || this.clearing || !this.fits(p, 0, 1)) return false;
    p.y++;
    this.score++;
    this.lastAction = 'move';
    this.reachedRow(p.y);
    return true;
  }

  /** Reaching a new lowest row earns the piece a fresh set of lock resets. */
  private reachedRow(y: number): void {
    if (y > this.lowestY) {
      this.lowestY = y;
      this.lockResets = 0;
    }
  }

  private hardDrop(): void {
    const p = this.active;
    if (!p || this.clearing) return;
    const from = p.y;
    p.y = this.board.dropY(p.type, p.rot, p.x, p.y);
    const rows = p.y - from;
    this.score += rows * 2;
    if (rows > 0) this.lastAction = 'move';

    // A streak behind each column of the piece, a thump, and sparks where it lands.
    const color = PIECE_COLORS[p.type];
    const columns = new Map<number, { top: number; bottom: number }>();
    for (const c of CELLS[p.type][p.rot]) {
      const col = columns.get(c.x);
      columns.set(c.x, { top: Math.min(col?.top ?? c.y, c.y), bottom: Math.max(col?.bottom ?? c.y, c.y) });
    }
    for (const [cx, { top, bottom }] of columns) {
      const x = BOARD_X + (p.x + cx) * CELL;
      const y0 = Math.max(BOARD_Y, BOARD_Y + (from + top - HIDDEN) * CELL);
      const y1 = BOARD_Y + (p.y + top - HIDDEN) * CELL;
      if (y1 > y0) this.effects.trail(x + 3, y0, y1, CELL - 6, color);
      this.effects.burst(x + CELL / 2, BOARD_Y + (p.y + bottom + 1 - HIDDEN) * CELL, color, 3, 140);
    }
    this.effects.kick(Math.min(6, 1.5 + rows * 0.25));
    this.sound.hardDrop();
    this.lock(true);
  }

  private hold(): void {
    const p = this.active;
    if (!p || this.clearing || this.holdUsed) return;
    const swapped = this.held;
    this.held = p.type;
    this.spawn(swapped ?? undefined);
    this.holdUsed = true;
    this.sound.hold();
  }

  /** 3-corner rule: a T that last rotated into a spot with 3 of its 4 corners filled. */
  private detectSpin(p: Active): Spin {
    if (p.type !== 'T' || this.lastAction !== 'rotate') return 'none';
    const corner = (dx: number, dy: number) => this.board.filled(p.x + dx, p.y + dy);
    const corners = [corner(0, 0), corner(2, 0), corner(2, 2), corner(0, 2)]; // clockwise from top-left
    if (corners.filter(Boolean).length < 3) return 'none';
    // The two corners either side of the T's point (rotation 0 points up, then clockwise).
    const front = [corners[p.rot], corners[(p.rot + 1) % 4]].filter(Boolean).length;
    return front === 2 || this.lastKick === 4 ? 'full' : 'mini';
  }

  private lock(hard = false): void {
    const p = this.active!;
    const spin = this.detectSpin(p);
    this.board.place(p.type, p.rot, p.x, p.y);
    this.active = null;

    // Locking entirely above the visible well tops out the game.
    if (CELLS[p.type][p.rot].every(c => p.y + c.y < HIDDEN)) {
      this.gameOver();
      return;
    }
    this.holdUsed = false;
    if (!hard) this.sound.softLock();

    const rows = this.board.fullRows();
    this.award(rows.length, spin);
    if (!rows.length) {
      this.spawn();
      return;
    }
    this.clearing = { rows, t: 0 };
    for (const y of rows) {
      this.board.grid[y].forEach((type, x) => {
        if (type) this.effects.burst(BOARD_X + (x + 0.5) * CELL, BOARD_Y + (y - HIDDEN + 0.5) * CELL, PIECE_COLORS[type], 3, 260);
      });
    }
  }

  /** Scores a lock: line clears, T-spins, back-to-back, combos and all-clears — with callouts and sound. */
  private award(lines: number, spin: Spin): void {
    const difficult = lines === 4 || (spin !== 'none' && lines > 0);
    const base = spin === 'full' ? T_SPIN_POINTS[lines] : spin === 'mini' ? T_SPIN_MINI_POINTS[lines] : LINE_POINTS[lines];
    let points = base * this.level;
    const b2b = difficult && this.backToBack;
    if (b2b) points *= 1.5;
    if (lines > 0) this.backToBack = difficult;
    this.combo = lines > 0 ? this.combo + 1 : -1;
    if (this.combo > 0) points += 50 * this.combo * this.level;
    // Every row is either about to be cleared or already empty.
    const allClear = lines > 0 && this.board.grid.every(row => row.every(c => c) || row.every(c => !c));
    if (allClear) points += ALL_CLEAR_POINTS[lines] * this.level;
    points = Math.round(points);
    this.score += points;

    const levelBefore = this.level;
    this.lines += lines;
    this.level = Math.min(MAX_LEVEL, 1 + Math.floor(this.lines / LINES_PER_LEVEL));

    // Callouts.
    if (spin !== 'none') {
      const name = `T-SPIN${spin === 'mini' ? ' MINI' : ''}${lines ? ` ${CLEAR_NAMES[lines]}` : ''}`;
      this.effects.popup(name, WELL_CX, CALLOUT_Y, PIECE_COLORS.T, 24);
      this.effects.kick(5);
      this.sound.tSpin();
    } else if (lines >= 2) {
      this.effects.popup(CLEAR_NAMES[lines], WELL_CX, CALLOUT_Y, lines === 4 ? PIECE_COLORS.I : COLORS.text, lines === 4 ? 34 : 24);
    }
    if (b2b) this.effects.popup('BACK-TO-BACK', WELL_CX, CALLOUT_Y, COLORS.gold, 16);
    if (this.combo > 0) this.effects.popup(`COMBO ×${this.combo}`, WELL_CX, CALLOUT_Y, PIECE_COLORS.L, 18);
    if (allClear) {
      this.effects.popup('ALL CLEAR!', WELL_CX, CALLOUT_Y, COLORS.gold, 32, 1.8);
      this.effects.flash = 1;
      this.sound.allClear();
    }
    if (points > 0 && lines > 0) this.effects.popup(`+${points.toLocaleString()}`, WELL_CX, CALLOUT_Y, COLORS.dim, 14, 0.9);

    if (lines > 0) {
      this.sound.clear(lines, this.combo);
      this.effects.kick(lines * 1.5);
    }
    if (lines === 4) {
      this.effects.flash = Math.max(this.effects.flash, 0.6);
      this.effects.kick(8);
      this.sound.quad();
    }
    if (this.level > levelBefore) {
      this.effects.popup(`LEVEL ${this.level}`, WELL_CX, BOARD_Y + ROWS * CELL * 0.6, PIECE_COLORS.I, 26, 1.6);
      this.sound.levelUp();
    }
  }

  // ---------- Update ----------

  update(dt: number): void {
    this.time += dt;
    if (this.state === 'paused') return;
    this.stateTime += dt;
    this.effects.update(dt);
    if (AUTOPLAY && this.state === 'gameover' && this.stateTime > 3) this.newGame();
    if (this.state !== 'playing') return;

    if (this.clearing) {
      if ((this.clearing.t += dt / CLEAR_TIME) >= 1) {
        this.board.removeRows(this.clearing.rows);
        this.clearing = null;
        this.spawn();
      }
    }
    this.autoRepeat(dt);
    if (AUTOPLAY) this.autoplay(dt);
    if (!this.active || this.clearing) return;

    const p = this.active;
    const interval = this.softHeld ? Math.min(gravity(this.level), SOFT_DROP_INTERVAL) : gravity(this.level);
    this.fallTimer += dt;
    while (this.fallTimer >= interval) {
      this.fallTimer -= interval;
      if (!this.fits(p, 0, 1)) break;
      p.y++;
      if (this.softHeld) this.score++;
      this.lastAction = 'move';
      this.reachedRow(p.y);
    }

    if (this.grounded) {
      this.fallTimer = 0;
      if ((this.lockTimer += dt) >= LOCK_DELAY) this.lock();
    } else {
      this.lockTimer = 0;
    }
  }

  /** The demo AI drives the same actions a player would: rotate, slide, then hard drop. */
  private autoplay(dt: number): void {
    const p = this.active;
    if (!p || this.clearing) return;
    if (this.auto?.piece !== p) this.auto = { piece: p, target: bestPlacement(this.board, p.type), timer: AUTOPLAY_STEP, tries: 0 };
    const a = this.auto;
    if ((a.timer -= dt) > 0) return;
    a.timer = AUTOPLAY_STEP;
    const t = a.target;
    // Give up and drop if the planned spot can't be reached (a kick shoved the piece, or it's walled in).
    if (!t || ++a.tries > 12) this.hardDrop();
    else if (p.rot !== t.rot) this.rotate(1);
    else if (p.x !== t.x) this.move(t.x > p.x ? 1 : -1);
    else this.hardDrop();
  }

  /** Delayed auto-shift: a held direction waits DAS, then repeats every ARR (charging even between pieces). */
  private autoRepeat(dt: number): void {
    if (this.dir === 0) return;
    this.dasTimer += dt;
    if (this.dasTimer < DAS) return;
    this.arrTimer += dt;
    while (this.arrTimer >= ARR) {
      this.arrTimer -= ARR;
      if (!this.move(this.dir)) break;
    }
  }

  // ---------- Render ----------

  render(): void {
    const r = this.renderer;
    const ctx = r.ctx;
    r.begin(this.time, this.level, this.effects.shake);

    const danger = Math.min(1, Math.max(0, (this.board.stackHeight - DANGER_ROWS) / (ROWS - DANGER_ROWS)));
    const clearing = this.clearing ? { rows: this.clearing.rows, progress: Math.min(1, this.clearing.t) } : null;
    r.well(this.board, clearing, this.state === 'playing' ? danger : 0, this.time);
    this.effects.drawTrails(ctx);

    const p = this.active;
    if (p && this.state !== 'gameover') {
      r.ghost(p.type, p.rot, p.x, this.board.dropY(p.type, p.rot, p.x, p.y));
      r.piece(p.type, p.rot, p.x, p.y, this.grounded ? this.lockTimer / LOCK_DELAY : 0);
    }

    r.hold(this.held, this.holdUsed);
    r.next(this.queue.slice(0, NEXT_COUNT));
    r.stats(this.score, Math.max(this.hi, this.score), this.level, this.lines);
    r.controlsHint();
    this.effects.draw(ctx);

    if (this.effects.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.effects.flash * 0.3})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    switch (this.state) {
      case 'title':
        r.overlay('NEON\nSTACK', [
          ['Stack the falling blocks.', COLORS.text],
          ['Clear lines, chain combos,', COLORS.dim],
          ['land T-spins.', COLORS.dim],
        ], 'PRESS ENTER OR TAP TO PLAY', this.time);
        break;
      case 'paused':
        r.overlay('PAUSED', [], 'PRESS P OR TAP TO RESUME', this.time);
        break;
      case 'gameover': {
        const lines: [string, string][] = [
          [`SCORE ${this.score.toLocaleString()}`, COLORS.text],
          [`LEVEL ${this.level} · ${this.lines} LINES`, COLORS.dim],
        ];
        if (this.score > this.hiAtStart) lines.push(['NEW HI-SCORE!', COLORS.gold]);
        r.overlay('GAME\nOVER', lines, 'PRESS ENTER TO PLAY AGAIN', this.time);
        break;
      }
    }
    r.end();
  }
}
