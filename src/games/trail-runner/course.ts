import * as THREE from 'three';
import { COLORS, DESPAWN_Z, GRAVITY, JUMP_SPEED, LANES, MAX_SPEED, SPAWN_Z, START_SPEED, TRAIL_W } from './config';

/** A box in world space (x/y extents, plus half its depth around z). */
export interface Hitbox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z: number;
  halfZ: number;
}

type Kind = 'boulder' | 'log' | 'gate';

interface Obstacle {
  readonly kind: Kind;
  readonly obj: THREE.Object3D;
  /** Collision extents relative to obj's position. */
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly halfZ: number;
}

interface Coin {
  readonly obj: THREE.Mesh;
}

const COIN_GAP = 2.2; // metres between coins in a line
const COIN_Y = 0.75;
const COIN_REACH = 0.55; // how close (x and z) the hiker must get to grab a coin
const FIRST_ROW = 45; // metres of free running before the first obstacle

const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...extra });
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Obstacles and coins: spawned in rows far up the trail, scrolled towards the hiker, recycled behind. */
export class Course {
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private untilNextRow = FIRST_ROW;
  private readonly group = new THREE.Group();

  private readonly boulderGeo = new THREE.IcosahedronGeometry(0.8, 0);
  private readonly logGeo = new THREE.CylinderGeometry(0.28, 0.3, TRAIL_W + 0.6, 9).rotateZ(Math.PI / 2);
  private readonly logEndGeo = new THREE.CircleGeometry(0.27, 9);
  private readonly postGeo = new THREE.BoxGeometry(0.2, 1.9, 0.2);
  private readonly beamGeo = new THREE.BoxGeometry(TRAIL_W + 0.5, 0.36, 0.3);
  private readonly coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 14).rotateX(Math.PI / 2);
  private readonly rockMat = flat(COLORS.rock);
  private readonly logMat = flat(COLORS.log);
  private readonly logEndMat = flat(COLORS.logEnd);
  private readonly gateMat = flat(COLORS.gate);
  private readonly postMat = flat(COLORS.post);
  private readonly coinMat = flat(COLORS.coin, { metalness: 0.5, roughness: 0.35, emissive: '#6b4a00', emissiveIntensity: 0.35 });

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  reset(): void {
    this.group.clear();
    this.obstacles = [];
    this.coins = [];
    this.untilNextRow = FIRST_ROW;
  }

  update(dt: number, speed: number, time: number): void {
    const dz = speed * dt;
    for (const o of this.obstacles) o.obj.position.z += dz;
    for (const c of this.coins) {
      c.obj.position.z += dz;
      c.obj.rotation.y = time * 3 + c.obj.position.z * 0.15;
    }
    this.obstacles = this.obstacles.filter(o => this.keep(o.obj));
    this.coins = this.coins.filter(c => this.keep(c.obj));

    if ((this.untilNextRow -= dz) <= 0) {
      this.spawnRow(speed);
      // Rows come closer together as the run speeds up.
      const t = (speed - START_SPEED) / (MAX_SPEED - START_SPEED);
      this.untilNextRow = THREE.MathUtils.lerp(32, 22, t) + Math.random() * 8;
    }
  }

  /** The obstacle the hiker ran into, if any. */
  hit(h: Hitbox): Kind | null {
    for (const o of this.obstacles) {
      const p = o.obj.position;
      if (
        Math.abs(p.z - h.z) < o.halfZ + h.halfZ &&
        p.x + o.x0 < h.x1 && p.x + o.x1 > h.x0 &&
        p.y + o.y0 < h.y1 && p.y + o.y1 > h.y0
      ) {
        return o.kind;
      }
    }
    return null;
  }

  /** Removes the coins the hiker touches and returns their positions (for sparkles). */
  collect(h: Hitbox): THREE.Vector3[] {
    const taken: THREE.Vector3[] = [];
    const cx = (h.x0 + h.x1) / 2;
    this.coins = this.coins.filter(c => {
      const p = c.obj.position;
      const touching =
        Math.abs(p.z - h.z) < COIN_REACH && Math.abs(p.x - cx) < COIN_REACH + (h.x1 - h.x0) / 2 &&
        p.y > h.y0 - 0.3 && p.y < h.y1 + 0.3;
      if (!touching) return true;
      taken.push(p.clone());
      this.group.remove(c.obj);
      return false;
    });
    return taken;
  }

  private keep(obj: THREE.Object3D): boolean {
    if (obj.position.z < DESPAWN_Z) return true;
    this.group.remove(obj);
    return false;
  }

  /** One row of the course. Every pattern leaves a way through: a free lane, a jump, or a slide. */
  private spawnRow(speed: number): void {
    const z = SPAWN_Z;
    const lanes = [0, 1, 2];
    const pattern = pick(['boulder', 'boulder', 'twoBoulders', 'log', 'gate', 'coins'] as const);

    switch (pattern) {
      case 'boulder': {
        const lane = pick(lanes);
        this.boulder(lane, z);
        if (Math.random() < 0.7) this.coinLine(pick(lanes.filter(l => l !== lane)), z - 4, 5);
        break;
      }
      case 'twoBoulders': {
        const free = pick(lanes);
        for (const l of lanes) if (l !== free) this.boulder(l, z);
        this.coinLine(free, z - 2, 6);
        break;
      }
      case 'log':
        this.log(z);
        this.coinArc(pick(lanes), z, speed);
        break;
      case 'gate':
        this.gate(z);
        this.coinLine(pick(lanes), z + COIN_GAP * 2, 5, 0.45); // low coins, grabbed mid-slide
        break;
      case 'coins': {
        // A lane-switching zigzag: a breather that still keeps the player moving.
        const a = pick(lanes);
        const b = pick(lanes.filter(l => l !== a));
        this.coinLine(a, z, 4);
        this.coinLine(b, z - COIN_GAP * 5, 4);
        break;
      }
    }
  }

  private add(kind: Kind, obj: THREE.Object3D, box: Omit<Obstacle, 'kind' | 'obj'>): void {
    obj.traverse(o => (o.castShadow = true));
    this.group.add(obj);
    this.obstacles.push({ kind, obj, ...box });
  }

  private boulder(lane: number, z: number): void {
    const rock = new THREE.Mesh(this.boulderGeo, this.rockMat);
    rock.scale.set(1, 0.85, 0.95);
    rock.rotation.set(Math.random(), Math.random() * Math.PI, 0);
    rock.position.set(LANES[lane], 0.62, z);
    rock.receiveShadow = true;
    this.add('boulder', rock, { x0: -0.72, x1: 0.72, y0: -0.62, y1: 0.7, halfZ: 0.65 });
  }

  /** A fallen log across the whole trail: jump it. */
  private log(z: number): void {
    const log = new THREE.Group();
    log.add(new THREE.Mesh(this.logGeo, this.logMat));
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(this.logEndGeo, this.logEndMat);
      end.rotation.y = (s * Math.PI) / 2;
      end.position.x = s * ((TRAIL_W + 0.6) / 2 + 0.001);
      log.add(end);
    }
    log.position.set(0, 0.28, z);
    this.add('log', log, { x0: -TRAIL_W / 2, x1: TRAIL_W / 2, y0: -0.28, y1: 0.3, halfZ: 0.28 });
  }

  /** A low beam on two posts across the trail: slide under it. */
  private gate(z: number): void {
    const gate = new THREE.Group();
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(this.postGeo, this.postMat);
      post.position.set(s * (TRAIL_W / 2 + 0.15), 0.95, 0);
      gate.add(post);
    }
    const beam = new THREE.Mesh(this.beamGeo, this.gateMat);
    beam.position.y = 1.35;
    gate.add(beam);
    gate.position.z = z;
    this.add('gate', gate, { x0: -TRAIL_W / 2, x1: TRAIL_W / 2, y0: 1.15, y1: 1.55, halfZ: 0.15 });
  }

  private coin(x: number, y: number, z: number): void {
    const coin = new THREE.Mesh(this.coinGeo, this.coinMat);
    coin.position.set(x, y, z);
    coin.castShadow = true;
    this.group.add(coin);
    this.coins.push({ obj: coin });
  }

  private coinLine(lane: number, z: number, count: number, y = COIN_Y): void {
    for (let i = 0; i < count; i++) this.coin(LANES[lane], y, z - i * COIN_GAP);
  }

  /** Coins along the path of a jump timed over the log at the current speed. */
  private coinArc(lane: number, z: number, speed: number): void {
    const airTime = (2 * JUMP_SPEED) / GRAVITY;
    const span = airTime * speed;
    for (let i = 0; i <= 4; i++) {
      const t = (i / 4) * airTime;
      this.coin(LANES[lane], COIN_Y + JUMP_SPEED * t - (GRAVITY * t * t) / 2, z + span / 2 - (i / 4) * span);
    }
  }
}
