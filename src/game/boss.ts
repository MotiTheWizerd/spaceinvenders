import type { Sound } from '../audio/sound';
import { COLORS, GROUND_Y, PLAYER_Y, W } from '../config';
import { clamp, pick, type Rect } from '../core/math';
import type { Gfx } from '../gfx/gfx';
import { difficulty } from './difficulty';

export const BOSS_W = 36;
export const BOSS_H = 15;
const BOSS_Y = 40;
const MARGIN = 8;
const ENTER_SPEED = 30;
const CRUISE_SPEED = 45;
const WANDER = 0.6; // how fast it sweeps side to side
const CANNON_DX = 11; // the two side cannons, either side of centre
const SPREAD_VX = 45; // sideways speed step between bullets in a fan
const AIM_MAX_VX = 80;
const CHARGE_TIME = 1;
const BEAM_TIME = 1.6;
const BEAM_W = 7;
const BEAM_TRACK = 28; // how fast the beam follows the player (px/s)
const DEATH_TIME = 1.8;
const HIT_FLASH = 0.06;
/** A gift drops each time the mothership loses this share of its hit points. */
const GIFT_EVERY = 0.2;

type Attack = 'spread' | 'barrage' | 'beam';
const ATTACKS: readonly Attack[] = ['spread', 'barrage', 'beam'];
type Phase = 'enter' | 'idle' | 'spread' | 'barrage' | 'charge' | 'beam' | 'dying';

/** What the mothership needs from the game while it fights. */
export interface BossHost {
  targetX(): number;
  fire(x: number, y: number, vx: number): void;
}

/**
 * The mothership: flies in, sweeps side to side and cycles through attacks —
 * fans of bullets, an aimed barrage from its side cannons, and a charged beam that tracks the player.
 * Below half health it turns red and attacks faster.
 */
export class Boss {
  x = (W - BOSS_W) / 2;
  y = -BOSS_H;
  hp: number;
  readonly maxHp: number;
  private phase: Phase = 'enter';
  /** Seconds left in the current phase. */
  private timer = 0;
  private shotTimer = 0;
  /** Volleys left (spread) or shots fired (barrage). */
  private count = 0;
  private last: Attack = 'beam';
  private clock = 0;
  private flash = 0;
  private giftsDropped = 0;

  constructor(
    private readonly level: number,
    private readonly sound: Sound,
  ) {
    this.hp = this.maxHp = difficulty.bossHp(level);
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: BOSS_W, h: BOSS_H };
  }

  get centerX(): number {
    return this.x + BOSS_W / 2;
  }

  get bottom(): number {
    return this.y + BOSS_H;
  }

  get enraged(): boolean {
    return this.hp <= this.maxHp / 2;
  }

  get dying(): boolean {
    return this.phase === 'dying';
  }

  /** Death throes are over: remove it. */
  get dead(): boolean {
    return this.dying && this.timer <= 0;
  }

  /** Shots pass through while it flies in and while it explodes. */
  get vulnerable(): boolean {
    return this.phase !== 'enter' && !this.dying;
  }

  get beamRect(): Rect | null {
    if (this.phase !== 'beam') return null;
    return { x: this.centerX - BEAM_W / 2, y: this.bottom, w: BEAM_W, h: GROUND_Y - this.bottom };
  }

  /** Takes damage; returns true when the hit knocks loose a gift. Check `dying` afterwards. */
  damage(amount: number): boolean {
    if (!this.vulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.flash = HIT_FLASH;
    if (this.hp <= 0) {
      this.phase = 'dying';
      this.timer = DEATH_TIME;
      return false;
    }
    const due = Math.floor((1 - this.hp / this.maxHp) / GIFT_EVERY);
    if (due <= this.giftsDropped) return false;
    this.giftsDropped = due;
    return true;
  }

  /** After the player loses a life: stop attacking for a moment. */
  calm(): void {
    if (this.phase === 'enter' || this.dying) return;
    this.phase = 'idle';
    this.timer = 2;
  }

  update(dt: number, host: BossHost): void {
    this.flash = Math.max(0, this.flash - dt);
    this.timer -= dt;
    this.clock += dt;

    switch (this.phase) {
      case 'enter':
        this.y += ENTER_SPEED * dt;
        if (this.y >= BOSS_Y) {
          this.y = BOSS_Y;
          this.idle();
        }
        return;
      case 'dying':
        return;
      case 'idle':
        this.cruise(dt);
        if (this.timer <= 0) this.startAttack();
        return;
      case 'spread':
        this.cruise(dt);
        if ((this.shotTimer -= dt) > 0) return;
        this.shotTimer = this.enraged ? 0.35 : 0.5;
        this.fan(host);
        if (--this.count <= 0) this.idle();
        return;
      case 'barrage':
        this.cruise(dt);
        if ((this.shotTimer -= dt) <= 0) {
          this.shotTimer = this.enraged ? 0.07 : 0.1;
          this.aimedShot(host);
        }
        if (this.timer <= 0) this.idle();
        return;
      case 'charge':
        if (this.timer <= 0) {
          this.phase = 'beam';
          this.timer = BEAM_TIME;
          this.sound.bossBeam(BEAM_TIME);
        }
        return;
      case 'beam': {
        const speed = BEAM_TRACK * (this.enraged ? 1.6 : 1);
        const dir = clamp(host.targetX() - this.centerX, -1, 1);
        this.x = clamp(this.x + dir * speed * dt, MARGIN, W - MARGIN - BOSS_W);
        if (this.timer <= 0) this.idle();
        return;
      }
    }
  }

  private idle(): void {
    this.phase = 'idle';
    this.timer = this.enraged ? 0.7 : 1.3;
  }

  private startAttack(): void {
    const attack = pick(ATTACKS.filter(a => a !== this.last));
    this.last = attack;
    this.shotTimer = 0;
    this.count = 0;
    if (attack === 'spread') {
      this.phase = 'spread';
      this.count = this.enraged ? 4 : 3;
    } else if (attack === 'barrage') {
      this.phase = 'barrage';
      this.timer = this.enraged ? 2 : 1.5;
    } else {
      this.phase = 'charge';
      this.timer = CHARGE_TIME;
      this.sound.bossCharge();
    }
  }

  /** Sweeps side to side (and bobs) between and during attacks. */
  private cruise(dt: number): void {
    const range = (W - BOSS_W) / 2 - MARGIN;
    const speed = this.enraged ? 1.5 : 1;
    const want = (W - BOSS_W) / 2 + Math.sin(this.clock * WANDER * speed) * range;
    this.x += clamp(want - this.x, -CRUISE_SPEED * speed * dt, CRUISE_SPEED * speed * dt);
    this.y = BOSS_Y + Math.round(Math.sin(this.clock * 2) * 2);
  }

  /** A fan of bullets from the centre gun. */
  private fan(host: BossHost): void {
    const n = this.enraged ? 7 : 5;
    for (let i = 0; i < n; i++) host.fire(this.centerX, this.bottom, (i - (n - 1) / 2) * SPREAD_VX);
    this.sound.bossShot();
  }

  /** One shot aimed at the player, alternating between the side cannons. */
  private aimedShot(host: BossHost): void {
    const gunX = this.centerX + (this.count++ % 2 ? CANNON_DX : -CANNON_DX);
    const vy = difficulty.enemyShotSpeed(this.level);
    const vx = clamp(((host.targetX() - gunX) * vy) / (PLAYER_Y - this.bottom), -AIM_MAX_VX, AIM_MAX_VX);
    host.fire(gunX, this.bottom, vx);
    this.sound.strafeShot();
  }

  draw(g: Gfx, time: number, tint?: string): void {
    const x = Math.round(this.centerX);

    // Charging: a flickering aim line and a growing glow at the gun.
    if (this.phase === 'charge') {
      if (Math.floor(time * 16) % 2) g.rect(x, this.bottom, 1, GROUND_Y - this.bottom, COLORS.red, 0.5);
      const r = Math.ceil((1 - this.timer / CHARGE_TIME) * 4);
      g.rect(x - r, this.bottom - 1, r * 2 + 1, r + 1, COLORS.white, 0.8);
    }

    const beam = this.beamRect;
    if (beam) {
      const f = Math.floor(time * 30) % 2;
      g.rect(beam.x - 2, beam.y, beam.w + 4, beam.h, COLORS.red, 0.25 + 0.1 * f);
      g.rect(beam.x, beam.y, beam.w, beam.h, COLORS.orange, 0.85);
      g.rect(x - 1 - f, beam.y, 3 + f * 2, beam.h, COLORS.yellow);
      g.rect(x, beam.y, 1, beam.h, COLORS.white);
      g.rect(beam.x - 3, GROUND_Y - 3, beam.w + 6, 3, COLORS.white, 0.6 + 0.3 * f); // impact
    }

    const color = this.flash > 0 ? COLORS.white : (tint ?? (this.enraged ? COLORS.red : COLORS.pink));
    const jitter = this.dying ? Math.round((Math.random() - 0.5) * 4) : 0;
    g.sprite(Math.floor(time * 6) % 2 ? 'bossA' : 'bossB', color, this.x + jitter, this.y);
  }
}
