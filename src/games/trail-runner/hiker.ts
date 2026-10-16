import * as THREE from 'three';

const SKIN = '#e8b894';
const SHIRT = '#e07a5f';
const JEANS = '#5d6f99';
const BOOTS = '#3b2f2a';
const PACK = '#8a6a4a';
const BEDROLL = '#c9b48a';
const HAT = '#8b5e3c';
const HAT_BAND = '#4a3426';

const HIP_Y = 0.8;
const SHOULDER_Y = 0.58; // above the hips
const BASE_CADENCE = 2.2; // steps per second when barely moving
const CADENCE_PER_MS = 0.085; // extra steps per second for each m/s of speed

export type Pose = 'run' | 'air' | 'slide' | 'crash';

function part(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Blocky hiker in a cowboy hat, seen from behind. Origin is between the feet. */
export class Hiker {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group(); // pivots at the hips
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private phase = 0;
  // Smoothed pose values, eased towards each pose's targets.
  private lean = 0;
  private drop = 0;
  private tumble = 0;

  constructor() {
    this.legL = this.leg(-0.15);
    this.legR = this.leg(0.15);
    this.armL = this.arm(-0.4);
    this.armR = this.arm(0.4);

    this.body.position.y = HIP_Y;
    this.body.add(
      part(box(0.6, 0.62, 0.32), SHIRT, 0, 0.31),
      part(box(0.5, 0.56, 0.26), PACK, 0, 0.33, 0.28),
      part(new THREE.CylinderGeometry(0.11, 0.11, 0.58, 8).rotateZ(Math.PI / 2), BEDROLL, 0, 0.66, 0.28),
      part(box(0.34, 0.34, 0.34), SKIN, 0, 0.82),
      part(new THREE.CylinderGeometry(0.37, 0.37, 0.04, 14), HAT, 0, 1.0),
      part(new THREE.CylinderGeometry(0.19, 0.22, 0.2, 10), HAT, 0, 1.11),
      part(new THREE.CylinderGeometry(0.225, 0.225, 0.05, 10), HAT_BAND, 0, 1.05),
      this.armL,
      this.armR,
    );
    this.root.add(this.body, this.legL, this.legR);
  }

  private leg(x: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(x, HIP_Y, 0);
    pivot.add(part(box(0.22, 0.72, 0.24), JEANS, 0, -0.36), part(box(0.24, 0.14, 0.32), BOOTS, 0, -0.73, -0.04));
    return pivot;
  }

  private arm(x: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(x, SHOULDER_Y, 0);
    pivot.add(part(box(0.16, 0.5, 0.18), SHIRT, 0, -0.25), part(box(0.14, 0.12, 0.14), SKIN, 0, -0.56));
    return pivot;
  }

  /**
   * Advances the animation at the given running speed (m/s).
   * Returns true on the frame a foot strikes the ground (for dust and footstep timing).
   */
  animate(dt: number, speed: number, pose: Pose): boolean {
    const before = Math.sin(this.phase);
    // Steps per second rise with speed, but far slower than speed itself (strides lengthen instead).
    if (pose === 'run') this.phase += dt * Math.PI * (BASE_CADENCE + speed * CADENCE_PER_MS);
    const swing = Math.sin(this.phase);
    const ease = 1 - Math.exp(-14 * dt);
    const to = (from: number, target: number) => from + (target - from) * ease;

    let legL = swing * 0.8;
    let legR = -swing * 0.8;
    let armL = -swing * 0.6;
    let armR = swing * 0.6;
    let lean = -0.12; // runners lean into the run
    let drop = 0;
    let tumble = 0;
    let bob = Math.abs(swing) * 0.06;

    if (pose === 'air') {
      legL = -0.7;
      legR = 0.35;
      armL = armR = -2.3; // arms thrown up
      lean = -0.05;
      bob = 0;
    } else if (pose === 'slide') {
      legL = legR = 1.35; // feet forward
      armL = armR = 0.9;
      lean = 1.05; // lie back
      drop = -0.55;
      bob = 0;
    } else if (pose === 'crash') {
      legL = 0.4;
      legR = -0.2;
      armL = armR = -2.6;
      tumble = -1.45; // face-plant
      drop = -0.35;
      bob = 0;
    }

    this.legL.rotation.x = to(this.legL.rotation.x, legL);
    this.legR.rotation.x = to(this.legR.rotation.x, legR);
    this.armL.rotation.x = to(this.armL.rotation.x, armL);
    this.armR.rotation.x = to(this.armR.rotation.x, armR);
    this.lean = to(this.lean, lean);
    this.drop = to(this.drop, drop);
    this.tumble = to(this.tumble, tumble);
    this.body.rotation.x = this.lean;
    this.body.position.y = HIP_Y + bob;
    this.root.rotation.x = this.tumble;
    this.legL.position.y = this.legR.position.y = HIP_Y;
    this.root.children.forEach(c => (c.position.y += this.drop));

    return pose === 'run' && Math.sign(before) !== Math.sign(swing);
  }

  /** Snaps back to a standing run pose (new run). */
  reset(): void {
    this.lean = this.drop = this.tumble = 0;
    this.root.rotation.set(0, 0, 0);
  }
}
