import { COLORS, COLS, H, PLAYER_Y, W } from '../config';
import { clamp, pick, type Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';
import type { SpriteName } from '../gfx/sprites';
import { difficulty } from './difficulty';

export interface InvaderType {
  readonly frames: readonly [SpriteName, SpriteName];
  /** Frames shown once an armoured invader has taken a hit. */
  readonly damagedFrames?: readonly [SpriteName, SpriteName];
  readonly w: number;
  readonly points: number;
  readonly color: string;
  readonly hp: number;
  /** Breaks formation to swoop at the player. */
  readonly dives?: boolean;
}

export const SQUID: InvaderType = { frames: ['squidA', 'squidB'], w: 8, points: 30, color: COLORS.pink, hp: 1 };
export const CRAB: InvaderType = { frames: ['crabA', 'crabB'], w: 11, points: 20, color: COLORS.cyan, hp: 1 };
export const OCTOPUS: InvaderType = { frames: ['octoA', 'octoB'], w: 12, points: 10, color: COLORS.yellow, hp: 1 };
export const DIVER: InvaderType = {
  frames: ['diverA', 'diverB'], w: 9, points: 40, color: COLORS.orange, hp: 1, dives: true,
};
export const ARMORED: InvaderType = {
  frames: ['armorA', 'armorB'], damagedFrames: ['armorCrackA', 'armorCrackB'],
  w: 11, points: 50, color: COLORS.silver, hp: 2,
};

/** Formation for a wave, top row first. New enemy types join as the waves go on. */
function rowTypes(level: number): InvaderType[] {
  if (level < 2) return [SQUID, CRAB, CRAB, OCTOPUS, OCTOPUS];
  if (level < 3) return [DIVER, ARMORED, CRAB, OCTOPUS, OCTOPUS];
  return [DIVER, ARMORED, ARMORED, OCTOPUS, OCTOPUS];
}

/** Banner subtitle on the wave where something new first appears. */
export const WAVE_INTROS: Readonly<Record<number, string>> = {
  2: 'NEW: DIVERS & ARMOURED ALIENS',
};

const INVADER_H = 8;
const CELL = 16; // grid spacing
const CELL_W = 12; // widest sprite; narrower ones are centred in it
const LEFT = 26;
const TOP = 56;
const DROP = 8;
const MARGIN = 8;

// Dive path
const DIVE_HOMING = 55; // max sideways speed towards the player (px/s)
const DIVE_WEAVE = 35; // side-to-side wiggle (px/s)
const DIVE_COMMIT_Y = PLAYER_Y - 30; // stops steering below this line so it can be dodged
const STRAFE_WARN = 0.8; // a strafer shakes in its slot this long before diving

export interface Dive {
  /** warn: a strafer shaking in its slot before it launches. */
  phase: 'warn' | 'down' | 'back';
  t: number;
  /** Strafing run: rains shots on the way down. */
  strafe: boolean;
  /** Seconds until the strafer's next shot. */
  shotTimer: number;
}

export class Invader {
  alive = true;
  hp: number;
  dive: Dive | null = null;
  readonly h = INVADER_H;
  /** Current position on screen; equals the formation slot unless diving. */
  x: number;
  y: number;

  constructor(
    readonly type: InvaderType,
    readonly col: number,
    public homeX: number,
    public homeY: number,
  ) {
    this.x = homeX;
    this.y = homeY;
    this.hp = type.hp;
  }

  get w(): number {
    return this.type.w;
  }

  get diving(): boolean {
    return this.dive !== null;
  }

  get damaged(): boolean {
    return this.hp < this.type.hp;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

export class Fleet {
  invaders: Invader[] = [];
  private dir = 1;
  private stepTimer = 0;
  private diveTimer = 0;
  private strafeTimer = 0;
  private frame: 0 | 1 = 0;

  reset(level: number): void {
    const top = TOP + difficulty.waveDrop(level) * DROP;
    this.invaders = rowTypes(level).flatMap((type, row) =>
      Array.from({ length: COLS }, (_, col) =>
        new Invader(type, col, LEFT + col * CELL + Math.floor((CELL_W - type.w) / 2), top + row * CELL),
      ),
    );
    this.dir = 1;
    this.stepTimer = 0.5;
    this.diveTimer = 1 + difficulty.diveDelay(level);
    this.strafeTimer = 4 + difficulty.strafeDelay(level);
    this.frame = 0;
  }

  get alive(): Invader[] {
    return this.invaders.filter(i => i.alive);
  }

  get divers(): Invader[] {
    return this.invaders.filter(i => i.alive && i.diving);
  }

  get cleared(): boolean {
    return !this.invaders.some(i => i.alive);
  }

  /** Advances the march; returns true on frames where the fleet took a step. */
  update(dt: number, level: number): boolean {
    if ((this.stepTimer -= dt) > 0) return false;
    const alive = this.alive;
    this.stepTimer = difficulty.marchInterval(alive.length, level);

    // Divers keep their slot in the formation while away, so measure the slots.
    let minX = Infinity;
    let maxX = -Infinity;
    for (const i of alive) {
      minX = Math.min(minX, i.homeX);
      maxX = Math.max(maxX, i.homeX + i.w);
    }

    const dx = alive.length === 1 ? 3 : 2;
    const atEdge = this.dir > 0 ? maxX + dx > W - MARGIN : minX - dx < MARGIN;
    if (atEdge) this.dir *= -1;
    for (const i of alive) {
      if (atEdge) i.homeY += DROP;
      else i.homeX += dx * this.dir;
      if (!i.diving) {
        i.x = i.homeX;
        i.y = i.homeY;
      }
    }
    this.frame = this.frame ? 0 : 1;
    return true;
  }

  /** Launches and flies divers; returns the invader that just started a dive, if any. */
  updateDives(dt: number, level: number, targetX: number): Invader | undefined {
    let launched: Invader | undefined;
    if ((this.diveTimer -= dt) <= 0) {
      this.diveTimer = difficulty.diveDelay(level);
      const divers = this.invaders.filter(i => i.alive && i.type.dives);
      const ready = divers.filter(i => !i.diving);
      if (ready.length && divers.length - ready.length < difficulty.maxDivers(level)) {
        launched = pick(ready);
        launched.dive = { phase: 'down', t: 0, strafe: false, shotTimer: 0 };
      }
    }

    const speed = difficulty.diveSpeed(level);
    for (const i of this.invaders) {
      const d = i.dive;
      if (!i.alive || !d) continue;
      d.t += dt;

      if (d.phase === 'warn') {
        // Shake in the slot, then go.
        i.x = i.homeX + (Math.floor(d.t * 30) % 2 ? 1 : -1);
        i.y = i.homeY;
        if (d.t >= STRAFE_WARN) {
          d.phase = 'down';
          d.t = 0;
          launched = i;
        }
      } else if (d.phase === 'down') {
        // Swoop down, weaving and homing on the player until it commits.
        const homing = i.y < DIVE_COMMIT_Y ? clamp((targetX - (i.x + i.w / 2)) / 12, -1, 1) * DIVE_HOMING : 0;
        i.x = clamp(i.x + (homing + Math.cos(d.t * 5) * DIVE_WEAVE) * dt, 0, W - i.w);
        i.y += speed * dt;
        if (i.y > H) {
          // Off the bottom: re-enter from the top and fly back to its slot.
          d.phase = 'back';
          i.x = i.homeX;
          i.y = -i.h;
        }
      } else {
        const dx = i.homeX - i.x;
        const dy = i.homeY - i.y;
        const dist = Math.hypot(dx, dy);
        const step = speed * dt;
        if (dist <= step) this.dock(i);
        else {
          i.x += (dx / dist) * step;
          i.y += (dy / dist) * step;
        }
      }
    }
    return launched;
  }

  /** Every so often picks a random alien (one at a time) for a strafing run; returns it as it starts shaking. */
  updateStrafe(dt: number, level: number): Invader | undefined {
    if ((this.strafeTimer -= dt) > 0) return undefined;
    this.strafeTimer = difficulty.strafeDelay(level);
    if (this.invaders.some(i => i.alive && i.dive?.strafe)) return undefined;
    const ready = this.invaders.filter(i => i.alive && !i.diving);
    if (ready.length < 2) return undefined; // the last alien stays in formation
    const strafer = pick(ready);
    strafer.dive = { phase: 'warn', t: 0, strafe: true, shotTimer: 0 };
    return strafer;
  }

  /** Sends every diver straight back to its slot (used when the player respawns). */
  recallDives(): void {
    for (const i of this.invaders) if (i.diving) this.dock(i);
  }

  /** The lowest invader still in formation in each column. */
  bottomRow(): Invader[] {
    const bottoms = new Map<number, Invader>();
    for (const i of this.invaders) {
      const current = bottoms.get(i.col);
      if (i.alive && !i.diving && (!current || i.y > current.y)) bottoms.set(i.col, i);
    }
    return [...bottoms.values()];
  }

  /** Only the bottom invader of each column may fire; sometimes it's the one above the player. */
  pickShooter(targetX: number): Invader | undefined {
    const shooters = this.bottomRow();
    if (!shooters.length) return undefined;

    if (Math.random() < difficulty.aimedShotChance) {
      const dist = (i: Invader) => Math.abs(i.x + i.w / 2 - targetX);
      return shooters.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    }
    return pick(shooters);
  }

  /** tint overrides every invader's colour (Time Freeze turns them to ice). */
  draw(g: Gfx, tint?: string): void {
    for (const i of this.invaders) {
      if (!i.alive) continue;
      const damaged = i.damaged && i.type.damagedFrames;
      const frames = damaged || i.type.frames;
      // Strafers flash red and white; a "!" warns while one shakes in its slot.
      const strafer = i.dive?.strafe ? (Math.floor(i.dive.t * 12) % 2 ? COLORS.white : COLORS.red) : undefined;
      g.sprite(frames[this.frame], tint ?? strafer ?? (damaged ? COLORS.red : i.type.color), i.x, i.y);
      if (i.dive?.phase === 'warn') g.text('!', i.homeX + i.w / 2, i.y - 9, COLORS.red, 'center');
    }
  }

  private dock(i: Invader): void {
    i.x = i.homeX;
    i.y = i.homeY;
    i.dive = null;
  }
}
