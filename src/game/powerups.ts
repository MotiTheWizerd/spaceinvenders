import { COLORS, GROUND_Y } from '../config';
import type { Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';
import type { SpriteName } from '../gfx/sprites';

export type PowerUpKind =
  | 'rapid' | 'shield' | 'triple' | 'wide' | 'fireball' | 'laser' | 'homing' | 'drones' | 'freeze' | 'double'
  | 'life' | 'nuke' | 'repair';

export interface PowerUpDef {
  /** Shown when caught. */
  readonly label: string;
  /** Shown in the HUD countdown. */
  readonly short: string;
  readonly color: string;
  /** Seconds the effect lasts once caught; instant gifts (life, nuke, repair) have none. */
  readonly duration?: number;
  /** Power-ups in the same group replace each other instead of stacking. */
  readonly group?: 'pattern';
  /** Relative drop chance (default 1). */
  readonly weight?: number;
  /** Falling icon (default: the gift box). */
  readonly sprite?: SpriteName;
}

/** Add a new gift: extend PowerUpKind, add its entry here, then check for it in Game. */
export const POWER_UPS: Readonly<Record<PowerUpKind, PowerUpDef>> = {
  rapid: { label: 'RAPID FIRE', short: 'RAPID', color: COLORS.cyan, duration: 8 },
  shield: { label: 'SHIELD', short: 'SHIELD', color: COLORS.yellow, duration: 10 },
  triple: { label: 'TRIPLE SHOT', short: 'TRIPLE', color: COLORS.pink, duration: 10, group: 'pattern' },
  wide: { label: 'WIDE SHOT', short: 'WIDE', color: COLORS.green, duration: 10, group: 'pattern' },
  fireball: { label: 'FIREBALL', short: 'FIRE', color: COLORS.red, duration: 7 },
  laser: { label: 'LASER BEAM', short: 'LASER', color: COLORS.purple, duration: 6, weight: 0.8 },
  homing: { label: 'HOMING MISSILES', short: 'HOMING', color: COLORS.orange, duration: 10 },
  drones: { label: 'WINGMEN', short: 'DRONES', color: COLORS.silver, duration: 12 },
  freeze: { label: 'TIME FREEZE', short: 'FREEZE', color: COLORS.blue, duration: 5, weight: 0.8 },
  double: { label: 'DOUBLE POINTS', short: 'X2', color: COLORS.gold, duration: 12 },
  life: { label: 'EXTRA LIFE', short: '1UP', color: COLORS.red, weight: 0.3, sprite: 'giftLife' },
  nuke: { label: 'NUKE!', short: 'NUKE', color: COLORS.orange, weight: 0.5, sprite: 'giftNuke' },
  repair: { label: 'BUNKERS REPAIRED', short: 'REPAIR', color: COLORS.green, weight: 0.7, sprite: 'giftRepair' },
};

const KINDS = Object.keys(POWER_UPS) as PowerUpKind[];

function pickKind(): PowerUpKind {
  const total = KINDS.reduce((sum, k) => sum + (POWER_UPS[k].weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const k of KINDS) if ((roll -= POWER_UPS[k].weight ?? 1) < 0) return k;
  return KINDS[0];
}

const params = new URLSearchParams(location.search);
const forced = params.get('gift');
/** Dev shortcut: ?gift=laser makes every gift a Laser (and drops one every kill). */
const FORCED_KIND = forced && forced in POWER_UPS ? (forced as PowerUpKind) : null;

/** Chance a killed invader drops a gift (only one gift falls at a time). Dev shortcut: ?gifts drops one every kill. */
export const GIFT_DROP_CHANCE = params.has('gifts') || FORCED_KIND ? 1 : 0.1;
const GIFT_SPEED = 40;
const GIFT_SIZE = 8;

/** A falling gift box; the player catches it by touching it. */
export class Gift {
  readonly kind: PowerUpKind = FORCED_KIND ?? pickKind();
  x: number;
  y: number;

  constructor(centerX: number, y: number) {
    this.x = centerX - GIFT_SIZE / 2;
    this.y = y;
  }

  get def(): PowerUpDef {
    return POWER_UPS[this.kind];
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: GIFT_SIZE, h: GIFT_SIZE };
  }

  get landed(): boolean {
    return this.y + GIFT_SIZE >= GROUND_Y;
  }

  update(dt: number): void {
    this.y += GIFT_SPEED * dt;
  }

  draw(g: Gfx, time: number): void {
    const color = Math.floor(time * 8) % 2 ? COLORS.white : this.def.color;
    g.sprite(this.def.sprite ?? 'gift', color, this.x, this.y);
  }
}

/** Timers for the power-ups the player currently has. */
export class ActivePowerUps {
  private readonly timers = new Map<PowerUpKind, number>();

  /** Starts (or restarts) a timed power-up; instant gifts are ignored here. */
  activate(kind: PowerUpKind): void {
    const { group, duration } = POWER_UPS[kind];
    if (!duration) return;
    if (group) {
      for (const other of this.timers.keys()) if (POWER_UPS[other].group === group) this.timers.delete(other);
    }
    this.timers.set(kind, duration);
  }

  has(kind: PowerUpKind): boolean {
    return this.timers.has(kind);
  }

  update(dt: number): void {
    for (const [kind, left] of this.timers) {
      if (left - dt <= 0) this.timers.delete(kind);
      else this.timers.set(kind, left - dt);
    }
  }

  clear(): void {
    this.timers.clear();
  }

  entries(): [PowerUpKind, number][] {
    return [...this.timers];
  }
}
