import * as THREE from 'three';
import {
  ACCEL, BEST_KEY, COLORS, FAST_FALL_SPEED, GRAVITY, HIKER_HALF_W, JUMP_SPEED, KEYS, LANES, LANE_SNAP,
  MAX_SPEED, SLIDE_H, SLIDE_TIME, STAND_H, START_SPEED, TITLE_SPEED,
} from './config';
import { Course, type Hitbox } from './course';
import { Dust } from './dust';
import { Hiker, type Pose } from './hiker';
import { Hud } from './hud';
import { Scenery } from './scenery';
import { Sound } from './sound';
import { contactShadowTexture, skyTexture } from './textures';

type State = 'title' | 'running' | 'paused' | 'crashed';

const CAMERA_HEIGHT = 3.1;
const CAMERA_BACK = 6.2;
const LOOK_AHEAD = 8;
const BASE_FOV = 58;
const FAST_FOV = 70; // the view widens as the run speeds up
/** The sun sits high and just behind the hiker, so the shadow falls short, right under the feet. */
const SUN_OFFSET = new THREE.Vector3(2.5, 14, 4);
const GAME_OVER_DELAY = 1.1; // seconds of crash before the result panel
const RESTART_GUARD = 0.4; // and a moment more before a key can restart (so a held key doesn't)
const KNOCKBACK = -3; // the world briefly runs backwards: the hiker bounces off what they hit
const SWIPE = 24; // px of finger travel that counts as a swipe rather than a tap

const SCROLL_KEYS = new Set([...KEYS.left, ...KEYS.right, ...KEYS.jump, ...KEYS.slide]);

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(metres: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(metres)));
  } catch {
    // storage unavailable (private mode, etc.)
  }
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 700);
  private readonly sun = new THREE.DirectionalLight(COLORS.sun, 2.4);
  private readonly hiker = new Hiker();
  private readonly contact: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly scenery: Scenery;
  private readonly course: Course;
  private readonly dust: Dust;
  private readonly sound = new Sound();
  private readonly hud: Hud;

  private state: State = 'title';
  private stateTime = 0;
  private time = 0;
  private speed = TITLE_SPEED;
  /** Total metres the world has scrolled (drives the trail texture), including the title-screen walk. */
  private distance = 0;
  private runDistance = 0;
  private coins = 0;
  private best = loadBest();
  private newBest = false;
  private resultShown = false;

  private lane = 1;
  private x = 0;
  private y = 0;
  private vy = 0;
  private slideLeft = 0;
  private slideOnLanding = false;
  private shake = 0;
  private fov = BASE_FOV;
  private pointer: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(COLORS.horizon, 70, 460);

    // A tight shadow box that travels with the hiker keeps the shadow sharp where it matters.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 1.6), this.sun, this.sun.target);

    // Contact shadow: a soft blob right under the feet, on top of the sun's shadow.
    this.contact = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.contact.position.y = 0.02;
    this.scene.add(this.hiker.root, this.contact);

    this.scenery = new Scenery(this.scene);
    this.course = new Course(this.scene);
    this.dust = new Dust(this.scene);
    this.hud = new Hud({ sound: () => this.toggleSound(), pause: () => this.togglePause() });
    this.hud.stats(0, 0, this.best);
    this.hud.showTitle();

    window.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('blur', () => {
      if (this.state === 'running') this.togglePause();
    });
    window.addEventListener('pointerdown', e => this.onPointerDown(e));
    window.addEventListener('pointerup', e => this.onPointerUp(e));
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Dev shortcut: open the page with ?run to skip the title screen.
    if (new URLSearchParams(location.search).has('run')) this.startRun();
  }

  // ---------- Input ----------

  private onKey(e: KeyboardEvent): void {
    const is = (action: keyof typeof KEYS) => KEYS[action].includes(e.code);
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    this.sound.init();
    if (is('mute')) {
      this.toggleSound();
      return;
    }
    if (e.repeat) return;

    switch (this.state) {
      case 'title':
        if (is('start')) this.startRun();
        break;
      case 'crashed':
        if (is('start') && this.canRestart) this.startRun();
        break;
      case 'paused':
        if (is('pause') || is('start')) this.togglePause();
        break;
      case 'running':
        if (is('pause')) this.togglePause();
        else if (is('left')) this.steer(-1);
        else if (is('right')) this.steer(1);
        else if (is('jump')) this.jump();
        else if (is('slide')) this.slide();
        break;
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if ((e.target as Element).closest('.btn')) return;
    this.sound.init();
    this.pointer = { x: e.clientX, y: e.clientY };
  }

  /** Tap to start / resume / jump; swipe to change lane, jump or slide. */
  private onPointerUp(e: PointerEvent): void {
    const start = this.pointer;
    this.pointer = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) {
      if (this.state === 'title' || (this.state === 'crashed' && this.canRestart)) this.startRun();
      else if (this.state === 'paused') this.togglePause();
      else if (this.state === 'running') this.jump();
    } else if (this.state === 'running') {
      if (Math.abs(dx) > Math.abs(dy)) this.steer(dx > 0 ? 1 : -1);
      else if (dy < 0) this.jump();
      else this.slide();
    }
  }

  private get canRestart(): boolean {
    return this.resultShown && this.stateTime > GAME_OVER_DELAY + RESTART_GUARD;
  }

  private get grounded(): boolean {
    return this.y <= 0 && this.vy <= 0;
  }

  private steer(dir: -1 | 1): void {
    this.lane = THREE.MathUtils.clamp(this.lane + dir, 0, LANES.length - 1);
  }

  private jump(): void {
    if (!this.grounded) return;
    this.vy = JUMP_SPEED;
    this.slideLeft = 0;
    this.sound.jump();
  }

  /** Slide on the ground; in the air, drop fast and slide on landing. */
  private slide(): void {
    if (this.grounded) {
      this.slideLeft = SLIDE_TIME;
      this.sound.slide();
      this.dust.kick(this.x, 0, 4, COLORS.dust);
    } else {
      this.vy = -FAST_FALL_SPEED;
      this.slideOnLanding = true;
    }
  }

  private toggleSound(): void {
    this.sound.init();
    this.sound.toggleMute();
    this.hud.sound(this.sound.muted);
  }

  private togglePause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      this.hud.showPaused();
      this.hud.paused(true);
    } else if (this.state === 'paused') {
      this.state = 'running';
      this.hud.hide();
      this.hud.paused(false);
    }
  }

  // ---------- Flow ----------

  private startRun(): void {
    this.state = 'running';
    this.stateTime = 0;
    this.speed = START_SPEED;
    this.runDistance = 0;
    this.coins = 0;
    this.newBest = false;
    this.resultShown = false;
    this.lane = 1;
    this.y = this.vy = this.slideLeft = 0;
    this.slideOnLanding = false;
    this.course.reset();
    this.dust.clear();
    this.hiker.reset();
    this.hud.hide();
    this.hud.stats(0, 0, this.best);
  }

  private crash(): void {
    this.state = 'crashed';
    this.stateTime = 0;
    this.speed = KNOCKBACK;
    this.slideLeft = 0;
    this.shake = 0.35;
    this.sound.crash();
    this.dust.kick(this.x, -0.2, 12, COLORS.dust);
    if (this.runDistance > this.best) {
      this.best = this.runDistance;
      this.newBest = true;
      saveBest(this.best);
    }
  }

  // ---------- Update ----------

  update(dt: number): void {
    this.time += dt;
    if (this.state === 'paused') return;
    this.stateTime += dt;

    if (this.state === 'running') {
      this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * dt);
    } else if (this.state === 'crashed') {
      this.speed *= Math.exp(-4 * dt);
      if (!this.resultShown && this.stateTime > GAME_OVER_DELAY) {
        this.resultShown = true;
        this.hud.showGameOver({ distance: this.runDistance, coins: this.coins, newBest: this.newBest });
      }
    } else {
      this.speed = TITLE_SPEED;
    }

    const metres = this.speed * dt;
    this.distance += metres;
    if (this.state === 'running') this.runDistance += metres;

    this.updateHiker(dt);
    this.scenery.update(dt, this.speed, this.distance);
    this.course.update(dt, this.state === 'title' ? 0 : this.speed, this.time);
    if (this.state === 'running') this.checkCourse();
    this.dust.update(dt, this.speed);
    this.updateCamera(dt);

    if (this.state === 'running') this.hud.stats(this.runDistance, this.coins, Math.max(this.best, this.runDistance));
  }

  private updateHiker(dt: number): void {
    const targetX = LANES[this.lane];
    this.x += (targetX - this.x) * (1 - Math.exp(-LANE_SNAP * dt));

    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) this.land();
    }
    this.slideLeft = Math.max(0, this.slideLeft - dt);

    const pose: Pose =
      this.state === 'crashed' ? 'crash' : this.y > 0 ? 'air' : this.slideLeft > 0 ? 'slide' : 'run';
    const footstep = this.hiker.animate(dt, this.speed, pose);
    if (footstep) {
      this.dust.kick(this.x, 0, 2, COLORS.dust);
      if (this.state === 'running') this.sound.step();
    }

    const root = this.hiker.root;
    root.position.set(this.x, this.y, 0);
    root.rotation.z = (this.x - targetX) * 0.15; // lean into lane changes

    // The contact shadow stays on the ground, shrinking and fading as the hiker jumps.
    const lift = Math.min(1, this.y / 1.4);
    this.contact.position.x = this.x;
    this.contact.scale.setScalar(1 - lift * 0.45);
    this.contact.material.opacity = 1 - lift * 0.7;

    this.sun.position.set(this.x + SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
    this.sun.target.position.set(this.x, 0, 0);
  }

  private land(): void {
    this.y = 0;
    this.vy = 0;
    if (this.state !== 'running') return;
    this.sound.land();
    this.dust.kick(this.x, 0, 5, COLORS.dust);
    if (this.slideOnLanding) {
      this.slideOnLanding = false;
      this.slideLeft = SLIDE_TIME;
      this.sound.slide();
    }
  }

  private checkCourse(): void {
    const sliding = this.slideLeft > 0 && this.y <= 0;
    const box: Hitbox = {
      x0: this.x - HIKER_HALF_W,
      x1: this.x + HIKER_HALF_W,
      y0: this.y,
      y1: this.y + (sliding ? SLIDE_H : STAND_H),
      z: 0,
      halfZ: 0.25,
    };
    for (const at of this.course.collect(box)) {
      this.coins++;
      this.dust.sparkle(at, COLORS.coin);
      this.sound.coin();
    }
    if (this.course.hit(box)) this.crash();
  }

  private updateCamera(dt: number): void {
    const pace = THREE.MathUtils.clamp((this.speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1);
    this.fov += (THREE.MathUtils.lerp(BASE_FOV, FAST_FOV, pace) - this.fov) * (1 - Math.exp(-3 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    this.shake = Math.max(0, this.shake - dt);
    const jolt = () => (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.x * 0.55 + jolt(), CAMERA_HEIGHT + this.y * 0.35 + jolt(), CAMERA_BACK);
    this.camera.lookAt(this.x * 0.7, 1.3 + this.y * 0.3, -LOOK_AHEAD);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
