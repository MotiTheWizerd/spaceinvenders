import * as THREE from 'three';

const POOL = 60;

interface Puff {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  vx: number;
  vy: number;
  /** Fraction of the world's speed it keeps up with: dust lingers, so it streams away behind the runner. */
  drag: number;
  life: number;
  maxLife: number;
  grow: number;
}

/** Pooled little puffs: dust kicked up by each footstep and landing, gold sparkles for coins. */
export class Dust {
  private readonly puffs: Puff[] = [];

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(0.12, 0);
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      mesh.visible = false;
      scene.add(mesh);
      this.puffs.push({ mesh, vx: 0, vy: 0, drag: 1, life: 0, maxLife: 1, grow: 1 });
    }
  }

  /** Dust from a foot hitting the trail. */
  kick(x: number, z: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      this.spawn(x + (Math.random() - 0.5) * 0.3, 0.08, z + 0.15, color, {
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.4 + Math.random() * 0.6,
        drag: 0.75,
        life: 0.45 + Math.random() * 0.25,
        grow: 2.6,
      });
    }
  }

  /** A burst of sparkles where a coin was grabbed. */
  sparkle(at: THREE.Vector3, color: string): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.spawn(at.x, at.y, at.z, color, {
        vx: Math.cos(a) * 1.8,
        vy: Math.sin(a) * 1.8 + 0.8,
        drag: 0.95,
        life: 0.3,
        grow: -1.5,
      });
    }
  }

  update(dt: number, speed: number): void {
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      if ((p.life -= dt) <= 0) {
        p.mesh.visible = false;
        continue;
      }
      const m = p.mesh;
      m.position.x += p.vx * dt;
      m.position.y += p.vy * dt;
      m.position.z += speed * p.drag * dt;
      m.scale.setScalar(Math.max(0.05, m.scale.x + p.grow * dt));
      m.material.opacity = 0.7 * (p.life / p.maxLife);
    }
  }

  clear(): void {
    for (const p of this.puffs) p.mesh.visible = false;
  }

  private spawn(
    x: number, y: number, z: number, color: string,
    o: { vx: number; vy: number; drag: number; life: number; grow: number },
  ): void {
    const p = this.puffs.find(q => !q.mesh.visible) ?? this.puffs[0];
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(1);
    p.mesh.material.color.set(color);
    p.vx = o.vx;
    p.vy = o.vy;
    p.drag = o.drag;
    p.life = p.maxLife = o.life;
    p.grow = o.grow;
  }
}
