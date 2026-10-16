import {
  COLORS, EXTRA_LIFE_SCORE, GROUND_Y, H, KEYS, PLAYER_SHOT_SPEED, PLAYER_Y, SHIELD_Y, SKY_Y, START_LIVES,
  UFO_DELAY, UFO_FIRST_DELAY, UFO_MIN_INVADERS, UFO_POINTS, W,
} from '../config';
import type { Sound } from '../audio/sound';
import { Input } from '../core/input';
import { clamp, overlap, pick, rand } from '../core/math';
import { loadHiScore, saveHiScore } from '../core/storage';
import type { Gfx } from '../gfx/gfx';
import { Starfield } from '../gfx/starfield';
import { drawBanner, drawFooter, drawHud, drawOverlay, drawPowerUps, drawTitle } from '../ui/screens';
import { difficulty } from './difficulty';
import { Effects } from './effects';
import { Fleet, WAVE_INTROS, type Invader } from './fleet';
import { Player } from './player';
import { ActivePowerUps, GIFT_DROP_CHANCE, Gift } from './powerups';
import {
  ENEMY_SHOT, FIREBALL, PLAYER_SHOT, beamRect, drawBeam, drawEnemyShot, drawPlayerShot, enemyShotRect,
  playerShotRect, type EnemyShot, type Shot,
} from './projectiles';
import { buildShields, eraseShields, hitShields, type Shield } from './shields';
import { Ufo } from './ufo';

type State = 'title' | 'playing' | 'paused' | 'dying' | 'levelclear' | 'gameover';

const DEATH_TIME = 1.6;
const LEVEL_CLEAR_TIME = 1.8;
const MARCH_SOUND_GAP = 0.07; // keeps the march audible instead of a buzz when the fleet is fast
const RAPID_MAX_SHOTS = 3;
const RAPID_COOLDOWN = 0.15;
const TRIPLE_SPREAD = [-60, 0, 60]; // sideways drift (px/s) of each bullet in a triple volley
const WIDE_OFFSETS = [-8, 0, 8]; // Wide Shot: three parallel bullets, this far from the gun (px)
const LASER_TICK = 0.08; // seconds between laser damage ticks (armour takes two)
const DRONE_FIRE_DELAY = 0.45;
const HOMING_GAIN = 6; // sideways speed (px/s) per pixel off target
const HOMING_MAX = 160;
const HOMING_TURN = 900; // how hard a missile can swerve (px/s²)
const NUKE_FLASH = 0.5;
const STRAFE_STOP_Y = SHIELD_Y - 24; // strafers stop shooting below this, so the last shots can be dodged

/** Dev shortcut: open the game with ?wave=3 to start new games on wave 3. */
const START_WAVE = Math.max(1, Math.floor(Number(new URLSearchParams(location.search).get('wave'))) || 1);

export class Game {
  private state: State = 'title';
  private stateTimer = 0;
  private time = 0;

  private score = 0;
  private hi = loadHiScore();
  private hiAtStart = 0;
  private lives = START_LIVES;
  private level = 1;
  private bonusGiven = false;

  private readonly input: Input;
  private readonly player = new Player();
  private readonly fleet = new Fleet();
  private readonly effects = new Effects();
  private readonly stars = new Starfield();
  private shields: Shield[] = [];
  private shots: Shot[] = [];
  private fireCooldown = 0;
  private beamOn = false;
  private laserTimer = 0;
  private droneTimer = 0;
  private flash = 0;
  private enemyShots: EnemyShot[] = [];
  private gift: Gift | null = null;
  private readonly powerUps = new ActivePowerUps();
  private enemyFireTimer = 0;
  private ufo: Ufo | null = null;
  private ufoTimer = 0;
  private marchStep = 0;
  private lastMarch = 0;

  constructor(
    private readonly gfx: Gfx,
    private readonly sound: Sound,
  ) {
    this.input = new Input({
      onPress: code => this.handlePress(code),
      onBlur: () => {
        if (this.state === 'playing') this.pause();
      },
    });
  }

  // ---------- Flow ----------

  private handlePress(code: string): void {
    this.sound.init();
    if (KEYS.start.includes(code)) {
      if (this.state === 'title' || this.state === 'gameover') this.newGame();
      else if (this.state === 'paused') this.resume();
    } else if (KEYS.pause.includes(code)) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    } else if (KEYS.mute.includes(code)) {
      this.sound.toggleMute();
    }
  }

  private get active(): boolean {
    return this.state === 'playing';
  }

  private newGame(): void {
    this.score = 0;
    this.lives = START_LIVES;
    this.bonusGiven = false;
    this.hiAtStart = this.hi;
    this.effects.clear();
    this.powerUps.clear();
    this.newWave(START_WAVE);
  }

  private newWave(level: number): void {
    this.level = level;
    this.fleet.reset(level);
    this.shields = buildShields();
    this.ufoTimer = rand(...UFO_FIRST_DELAY);
    this.resetRound();
    this.state = 'playing';
  }

  private resetRound(): void {
    this.player.reset();
    this.fleet.recallDives();
    this.shots = [];
    this.enemyShots = [];
    this.gift = null;
    this.beamOn = false;
    this.laserTimer = 0;
    this.droneTimer = 0;
    this.enemyFireTimer = 1.2;
    this.removeUfo();
  }

  private pause(): void {
    this.state = 'paused';
    this.sound.ufoStop();
  }

  private resume(): void {
    this.state = 'playing';
    if (this.ufo) this.sound.ufoStart();
  }

  private killPlayer(): void {
    this.state = 'dying';
    this.stateTimer = DEATH_TIME;
    this.lives = Math.max(0, this.lives - 1);
    this.shots = [];
    this.enemyShots = [];
    this.beamOn = false;
    this.powerUps.clear();
    this.removeUfo();
    this.sound.death();
  }

  private gameOver(): void {
    this.state = 'gameover';
    saveHiScore(this.hi);
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score > this.hi) this.hi = this.score;
    if (!this.bonusGiven && this.score >= EXTRA_LIFE_SCORE) {
      this.bonusGiven = true;
      this.lives++;
      this.sound.extraLife();
    }
  }

  private removeUfo(): void {
    this.ufo = null;
    this.sound.ufoStop();
  }

  // ---------- Update ----------

  update(dt: number): void {
    this.time += dt;
    if (this.state === 'paused') return;
    this.effects.update(dt);
    this.flash = Math.max(0, this.flash - dt);

    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        if ((this.stateTimer -= dt) <= 0) {
          if (this.lives <= 0) this.gameOver();
          else {
            this.resetRound();
            this.state = 'playing';
          }
        }
        break;
      case 'levelclear':
        if ((this.stateTimer -= dt) <= 0) this.newWave(this.level + 1);
        break;
    }
  }

  private updatePlaying(dt: number): void {
    const move = Number(this.input.isDown(KEYS.right)) - Number(this.input.isDown(KEYS.left));
    this.player.move(move, dt);
    this.powerUps.update(dt);
    this.updateGuns(dt);

    // Time Freeze stops every enemy in its tracks, bullets included; the player keeps moving.
    const enemyDt = this.powerUps.has('freeze') ? 0 : dt;

    // Each step can end the round (kill, wave clear), so stop as soon as it does.
    const steps = [
      () => this.updateLaser(dt),
      () => this.updatePlayerShots(dt),
      () => this.updateGift(dt),
      () => this.updateEnemyShots(enemyDt),
      () => this.updateFleet(enemyDt),
      () => this.updateDivers(enemyDt),
      () => this.updateEnemyFire(enemyDt),
      () => this.updateUfo(enemyDt),
    ];
    for (const step of steps) {
      step();
      if (!this.active) return;
    }
  }

  /** The player's gun (or laser beam) and the wingmen's auto-fire. */
  private updateGuns(dt: number): void {
    const firing = this.input.isDown(KEYS.fire);
    const homing = this.powerUps.has('homing');
    // While Laser lasts, holding fire swaps the gun for a continuous beam.
    this.beamOn = firing && this.powerUps.has('laser');

    // Normally one volley on screen at a time (arcade rules); Rapid Fire allows a short burst.
    const rapid = this.powerUps.has('rapid');
    const fire = this.powerUps.has('fireball');
    const volley = this.volleyPattern();
    const maxShots = (rapid ? RAPID_MAX_SHOTS : 1) * volley.length;
    const ownShots = this.shots.filter(s => !s.drone).length;
    this.fireCooldown -= dt;
    if (firing && !this.beamOn && ownShots + volley.length <= maxShots && this.fireCooldown <= 0) {
      const y = PLAYER_Y - (fire ? FIREBALL.h : PLAYER_SHOT.h);
      for (const { dx, vx } of volley) {
        this.shots.push({ x: this.player.gunX + dx, y, vx, fire, homing, drone: false });
      }
      this.fireCooldown = rapid ? RAPID_COOLDOWN : 0;
      if (fire) this.sound.fireball();
      else this.sound.shoot();
    }

    if (this.powerUps.has('drones') && (this.droneTimer -= dt) <= 0) {
      this.droneTimer = DRONE_FIRE_DELAY;
      const y = PLAYER_Y - PLAYER_SHOT.h;
      for (const x of this.player.droneXs) this.shots.push({ x, y, vx: 0, fire: false, homing, drone: true });
      this.sound.droneShot();
    }
  }

  /** Laser beam: every tick it burns everything in its column, from the gun to the top of the screen. */
  private updateLaser(dt: number): void {
    this.laserTimer -= dt;
    if (!this.beamOn || this.laserTimer > 0) return;
    this.laserTimer = LASER_TICK;
    this.sound.laser();

    const x = this.player.gunX;
    const beam = beamRect(x);
    for (const inv of this.fleet.alive) {
      if (!overlap(beam, inv.rect)) continue;
      this.hitInvader(inv, x, false);
      if (!this.active) return;
    }
    if (this.ufo && overlap(beam, this.ufo.rect)) this.destroyUfo(this.ufo);
    this.enemyShots = this.enemyShots.filter(e => {
      if (!overlap(beam, enemyShotRect(e))) return true;
      this.effects.sprite('shotBoom', e.x - 3, e.y, COLORS.purple, 0.2);
      return false;
    });
  }

  /** Bullets per volley: one straight shot, a Triple Shot fan, or Wide Shot's three parallel lines. */
  private volleyPattern(): { dx: number; vx: number }[] {
    if (this.powerUps.has('triple')) return TRIPLE_SPREAD.map(vx => ({ dx: 0, vx }));
    if (this.powerUps.has('wide')) return WIDE_OFFSETS.map(dx => ({ dx, vx: 0 }));
    return [{ dx: 0, vx: 0 }];
  }

  private updatePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      if (this.updatePlayerShot(this.shots[i], dt)) this.shots.splice(i, 1);
      if (!this.active) return;
    }
  }

  /** Moves one shot and resolves its hits; returns true if the shot is used up. */
  private updatePlayerShot(s: Shot, dt: number): boolean {
    if (s.homing) this.steer(s, dt);
    s.y -= PLAYER_SHOT_SPEED * dt;
    s.x += s.vx * dt;
    const r = playerShotRect(s);

    if (s.y < SKY_Y) {
      this.effects.sprite('shotBoom', s.x - 4, SKY_Y, COLORS.red, 0.25);
      return true;
    }
    if (s.x < 0 || s.x >= W) return true;

    // A fireball burns straight through everything it touches (and flies over the bunkers);
    // a normal shot stops at the first thing it hits. Drone shots fly over the bunkers too.
    const pierce = s.fire;
    if (!pierce && !s.drone && hitShields(this.shields, r, 2)) return true;

    for (const inv of this.fleet.alive) {
      if (!overlap(r, inv.rect)) continue;
      this.hitInvader(inv, s.x, pierce);
      if (!pierce || !this.active) return true;
    }

    const ufo = this.ufo;
    if (ufo && overlap(r, ufo.rect)) {
      this.destroyUfo(ufo);
      if (!pierce) return true;
    }

    // Shots collide mid-air.
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const e = this.enemyShots[i];
      if (!overlap(r, enemyShotRect(e))) continue;
      this.effects.sprite('shotBoom', e.x - 3, e.y, COLORS.white, 0.2);
      this.enemyShots.splice(i, 1);
      if (!pierce) return true;
    }
    return false;
  }

  /** Homing missiles swerve towards the nearest invader (or UFO) still above them. */
  private steer(s: Shot, dt: number): void {
    const targets = this.fleet.alive.map(i => i.rect);
    if (this.ufo) targets.push(this.ufo.rect);
    let targetX: number | undefined;
    let best = Infinity;
    for (const t of targets) {
      if (t.y > s.y) continue;
      const cx = t.x + t.w / 2;
      const cost = Math.abs(cx - s.x) * 2 + (s.y - t.y);
      if (cost < best) {
        best = cost;
        targetX = cx;
      }
    }
    const want = targetX === undefined ? 0 : clamp((targetX - s.x) * HOMING_GAIN, -HOMING_MAX, HOMING_MAX);
    s.vx += clamp(want - s.vx, -HOMING_TURN * dt, HOMING_TURN * dt);
  }

  /** One hit on an invader (fatal ignores armour); x is where the armour spark shows. */
  private hitInvader(inv: Invader, x: number, fatal: boolean): void {
    inv.hp = fatal ? 0 : inv.hp - 1;
    if (inv.hp > 0) {
      // Armour absorbed the hit.
      this.effects.sprite('shotBoom', x - 4, inv.y, COLORS.white, 0.15);
      this.sound.armorHit();
    } else {
      this.destroyInvader(inv);
    }
  }

  /** Double Points doubles everything scored while it lasts. */
  private get multiplier(): number {
    return this.powerUps.has('double') ? 2 : 1;
  }

  private destroyUfo(ufo: Ufo): void {
    const points = pick(UFO_POINTS) * this.multiplier;
    this.addScore(points);
    this.effects.text(String(points), ufo.x + 8, ufo.y, COLORS.red, 1.2);
    this.ufoTimer = rand(...UFO_DELAY);
    this.removeUfo();
    this.sound.ufoHit();
  }

  /**
   * Kills an invader: score (doubled mid-dive), explosion, maybe a gift, maybe wave clear.
   * silent skips the hit sound (a Nuke kills a dozen at once).
   */
  private destroyInvader(inv: Invader, silent = false): void {
    inv.alive = false;
    const points = inv.type.points * (inv.diving ? 2 : 1) * this.multiplier;
    this.addScore(points);
    this.effects.sprite('boom', inv.x + inv.w / 2 - 6.5, inv.y, inv.type.color, 0.25);
    if (inv.diving || this.multiplier > 1) {
      this.effects.text(String(points), inv.x + inv.w / 2, inv.y - 9, inv.type.color, 0.8);
    }
    if (!silent) this.sound.hit();
    if (!this.gift && Math.random() < GIFT_DROP_CHANCE) this.gift = new Gift(inv.x + inv.w / 2, inv.y);
    if (this.fleet.cleared) {
      this.state = 'levelclear';
      this.stateTimer = LEVEL_CLEAR_TIME;
      this.enemyShots = [];
      this.gift = null;
      this.removeUfo();
    }
  }

  private updateDivers(dt: number): void {
    if (this.fleet.updateStrafe(dt, this.level)) this.sound.strafeAlarm();
    if (this.fleet.updateDives(dt, this.level, this.player.centerX)) this.sound.dive();

    const bubble = this.powerUps.has('shield') ? this.player.shieldRect : null;
    for (const inv of this.fleet.divers) {
      this.strafeFire(inv, dt);
      eraseShields(this.shields, inv.rect);
      if (bubble && overlap(inv.rect, bubble)) {
        this.sound.shieldBlock();
        this.destroyInvader(inv);
        if (!this.active) return;
      } else if (overlap(inv.rect, this.player.rect)) {
        this.killPlayer();
        return;
      }
    }
  }

  /** A strafer rains shots on the way down (ignoring the fleet's shot limit) until it nears the bunkers. */
  private strafeFire(inv: Invader, dt: number): void {
    const d = inv.dive;
    if (!d?.strafe || d.phase !== 'down' || inv.y > STRAFE_STOP_Y) return;
    if ((d.shotTimer -= dt) > 0) return;
    d.shotTimer = difficulty.strafeFireDelay(this.level);
    this.enemyShots.push({ x: Math.round(inv.x + inv.w / 2) - 1, y: inv.y + inv.h, kind: 1 });
    this.sound.strafeShot();
  }

  private updateGift(dt: number): void {
    const gift = this.gift;
    if (!gift) return;
    gift.update(dt);
    if (overlap(gift.rect, this.player.rect)) {
      this.gift = null; // first: a Nuke's kills may drop the next gift
      this.catchGift(gift);
    } else if (gift.landed) {
      this.gift = null;
    }
  }

  private catchGift({ kind, def }: Gift): void {
    // Keep the label on screen when the ship is near an edge.
    const x = clamp(this.player.centerX, 40, W - 40);
    this.effects.text(def.label, x, PLAYER_Y - 12, def.color, 1.2);
    switch (kind) {
      case 'life':
        this.lives++;
        this.sound.extraLife();
        break;
      case 'repair':
        this.shields = buildShields();
        this.sound.powerUp();
        break;
      case 'nuke':
        this.nuke();
        break;
      case 'freeze':
        this.powerUps.activate(kind);
        this.sound.freeze();
        break;
      default:
        this.powerUps.activate(kind);
        this.sound.powerUp();
    }
  }

  /** Nuke: a white flash that wipes out every enemy bullet, every diver and the whole bottom row. */
  private nuke(): void {
    this.flash = NUKE_FLASH;
    this.sound.nuke();
    for (const e of this.enemyShots) this.effects.sprite('shotBoom', e.x - 3, e.y, COLORS.orange, 0.3);
    this.enemyShots = [];
    for (const inv of [...this.fleet.bottomRow(), ...this.fleet.divers]) {
      this.destroyInvader(inv, true);
      if (!this.active) return;
    }
  }

  private updateEnemyShots(dt: number): void {
    const speed = difficulty.enemyShotSpeed(this.level);
    const playerRect = this.player.rect;
    const bubble = this.powerUps.has('shield') ? this.player.shieldRect : null;
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.y += speed * dt;
      const r = enemyShotRect(s);
      if (hitShields(this.shields, r, 3)) {
        this.enemyShots.splice(i, 1);
      } else if (bubble && overlap(r, bubble)) {
        this.effects.sprite('shotBoom', s.x - 3, bubble.y - 4, COLORS.yellow, 0.2);
        this.enemyShots.splice(i, 1);
        this.sound.shieldBlock();
      } else if (overlap(r, playerRect)) {
        this.killPlayer();
        return;
      } else if (s.y + ENEMY_SHOT.h >= GROUND_Y) {
        this.effects.sprite('shotBoom', s.x - 3, GROUND_Y - ENEMY_SHOT.h, COLORS.green, 0.25);
        this.enemyShots.splice(i, 1);
      }
    }
  }

  private updateFleet(dt: number): void {
    if (!this.fleet.update(dt, this.level)) return;

    if (this.time - this.lastMarch >= MARCH_SOUND_GAP) {
      this.sound.march(this.marchStep++);
      this.lastMarch = this.time;
    }

    for (const inv of this.fleet.alive) {
      if (inv.diving) continue; // divers are handled in updateDivers
      eraseShields(this.shields, inv.rect);
      if (inv.y + inv.h >= PLAYER_Y) {
        // Invasion: game over regardless of lives left.
        this.lives = 0;
        this.killPlayer();
        return;
      }
    }
  }

  private updateEnemyFire(dt: number): void {
    if ((this.enemyFireTimer -= dt) > 0) return;
    this.enemyFireTimer = difficulty.enemyFireDelay(this.level);
    if (this.enemyShots.length >= difficulty.maxEnemyShots(this.level)) return;

    const shooter = this.fleet.pickShooter(this.player.centerX);
    if (!shooter) return;
    this.enemyShots.push({
      x: Math.round(shooter.x + shooter.w / 2) - 1,
      y: shooter.y + shooter.h,
      kind: Math.random() < 0.5 ? 0 : 1,
    });
  }

  private updateUfo(dt: number): void {
    if (!this.ufo) {
      if ((this.ufoTimer -= dt) <= 0) {
        this.ufoTimer = rand(...UFO_DELAY);
        if (this.fleet.alive.length >= UFO_MIN_INVADERS) {
          this.ufo = new Ufo(Math.random() < 0.5 ? 1 : -1);
          this.sound.ufoStart();
        }
      }
      return;
    }
    this.ufo.update(dt);
    if (this.ufo.gone) this.removeUfo();
  }

  // ---------- Render ----------

  render(): void {
    const g = this.gfx;
    g.clear(COLORS.bg);
    this.stars.draw(g, this.time);
    drawHud(g, this.score, this.hi, this.level);

    if (this.state === 'title') {
      drawTitle(g, this.time);
      return;
    }
    this.drawWorld();

    switch (this.state) {
      case 'paused':
        drawOverlay(g, this.time, 'PAUSED', 'PRESS P TO RESUME');
        break;
      case 'gameover':
        drawOverlay(g, this.time, 'GAME OVER', 'PRESS ENTER TO PLAY AGAIN', {
          score: this.score,
          newHi: this.score > this.hiAtStart,
        });
        break;
      case 'levelclear':
        drawBanner(g, `WAVE ${this.level + 1}`, WAVE_INTROS[this.level + 1]);
        break;
    }
  }

  private drawWorld(): void {
    const g = this.gfx;
    const ice = this.powerUps.has('freeze') ? COLORS.ice : undefined;
    this.ufo?.draw(g, ice);
    this.fleet.draw(g, ice);
    for (const s of this.shields) s.draw(g);

    if (this.state === 'dying') this.player.drawDeath(g, this.time);
    else if (this.state !== 'gameover') {
      this.player.draw(g);
      if (this.powerUps.has('drones')) this.player.drawDrones(g, this.time);
      if (this.powerUps.has('shield')) this.player.drawShield(g, this.time);
    }

    if (this.beamOn && (this.state === 'playing' || this.state === 'paused')) {
      drawBeam(g, this.player.gunX, this.time);
    }
    for (const s of this.shots) drawPlayerShot(g, s, this.time);
    for (const s of this.enemyShots) drawEnemyShot(g, s, this.time);
    this.gift?.draw(g, this.time);
    this.effects.draw(g);
    if (this.flash > 0) g.rect(0, 0, W, H, COLORS.white, (this.flash / NUKE_FLASH) * 0.7);
    drawFooter(g, this.lives, this.sound.muted);
    drawPowerUps(g, this.time, this.powerUps.entries());
  }
}
