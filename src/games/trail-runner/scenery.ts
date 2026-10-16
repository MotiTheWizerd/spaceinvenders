import * as THREE from 'three';
import { COLORS, DESPAWN_Z, TRAIL_W } from './config';
import { TRAIL_TILE, trailTexture } from './textures';

const TRAIL_LEN = 260; // from just behind the camera to deep into the fog
const STRIP_PERIOD = 20; // edge stones and tufts repeat every this many metres
const STRIP_COPIES = 10;
const PROP_SPAN = 190; // trees and rocks recycle over this stretch
const MOUNTAIN_SPAN = 420;
const MOUNTAIN_PARALLAX = 0.12; // far-off mountains drift slowly

const flat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const side = () => (Math.random() < 0.5 ? -1 : 1);

interface Prop {
  readonly obj: THREE.Object3D;
  readonly parallax: number;
  readonly span: number;
  /** Re-rolls its spot each time it wraps around. */
  readonly place: (obj: THREE.Object3D) => void;
}

/** Everything around the trail: ground, the trail itself, roadside detail, trees, rocks and mountains. */
export class Scenery {
  private readonly trailTex = trailTexture();
  private readonly strips = new THREE.Group();
  private readonly props: Prop[] = [];

  constructor(scene: THREE.Scene) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), flat(COLORS.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -500;
    ground.receiveShadow = true;

    this.trailTex.repeat.set(1, TRAIL_LEN / TRAIL_TILE);
    this.trailTex.anisotropy = 8;
    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(TRAIL_W, TRAIL_LEN),
      new THREE.MeshStandardMaterial({ map: this.trailTex, roughness: 1 }),
    );
    trail.rotation.x = -Math.PI / 2;
    trail.position.set(0, 0.01, DESPAWN_Z - TRAIL_LEN / 2);
    trail.receiveShadow = true;

    scene.add(ground, trail, this.strips);
    this.buildStrips();
    this.buildTrees(scene);
    this.buildRocks(scene);
    this.buildMountains(scene);
  }

  /** Scrolls the world by the hiker's progress. */
  update(dt: number, speed: number, distance: number): void {
    // Texture and roadside strips are periodic, so they just slide by the distance (no recycling needed).
    this.trailTex.offset.y = distance / TRAIL_TILE;
    this.strips.position.z = distance % STRIP_PERIOD;

    for (const p of this.props) {
      p.obj.position.z += speed * p.parallax * dt;
      if (p.obj.position.z > DESPAWN_Z + 20) {
        p.obj.position.z -= p.span;
        p.place(p.obj);
      }
    }
  }

  /** Stones lining both trail edges and grass tufts on the dirt: close, fast-moving detail sells speed. */
  private buildStrips(): void {
    const stoneGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const tuftGeo = new THREE.ConeGeometry(0.2, 0.26, 5);
    const perPeriod = { stones: 26, tufts: 22 };
    const stones = new THREE.InstancedMesh(stoneGeo, flat(COLORS.rock), perPeriod.stones * STRIP_COPIES);
    const tufts = new THREE.InstancedMesh(tuftGeo, flat(COLORS.tuft), perPeriod.tufts * STRIP_COPIES);
    stones.receiveShadow = tufts.receiveShadow = true;
    stones.castShadow = true;

    // One period of layout, repeated down the trail.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const stoneSpots = Array.from({ length: perPeriod.stones }, (_, i) => ({
      x: (i % 2 ? 1 : -1) * (TRAIL_W / 2 + rand(0.05, 0.35)),
      z: -(i / perPeriod.stones) * STRIP_PERIOD + rand(-0.3, 0.3),
      s: new THREE.Vector3(rand(0.6, 1.4), rand(0.35, 0.7), rand(0.6, 1.3)),
      r: rand(0, Math.PI),
    }));
    const tuftSpots = Array.from({ length: perPeriod.tufts }, () => ({
      x: side() * rand(TRAIL_W / 2 + 0.8, 16),
      z: -rand(0, STRIP_PERIOD),
      s: rand(0.7, 1.5),
    }));

    for (let copy = 0; copy < STRIP_COPIES; copy++) {
      const dz = DESPAWN_Z - copy * STRIP_PERIOD;
      stoneSpots.forEach((p, i) => {
        q.setFromEuler(e.set(0, p.r, 0));
        m.compose(new THREE.Vector3(p.x, p.s.y * 0.12, p.z + dz), q, p.s);
        stones.setMatrixAt(copy * perPeriod.stones + i, m);
      });
      tuftSpots.forEach((p, i) => {
        m.compose(new THREE.Vector3(p.x, 0.11 * p.s, p.z + dz), q.identity(), new THREE.Vector3(p.s, p.s, p.s));
        tufts.setMatrixAt(copy * perPeriod.tufts + i, m);
      });
    }
    this.strips.add(stones, tufts);
  }

  private buildTrees(scene: THREE.Scene): void {
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6);
    const tiers = [
      new THREE.ConeGeometry(1.15, 1.6, 7),
      new THREE.ConeGeometry(0.9, 1.4, 7),
      new THREE.ConeGeometry(0.6, 1.2, 7),
    ];
    const trunkMat = flat(COLORS.trunk);
    const needleMats = [flat(COLORS.pine), flat(COLORS.pineDark)];

    const place = (tree: THREE.Object3D) => {
      tree.position.x = side() * rand(TRAIL_W / 2 + 1.6, 34);
      tree.scale.setScalar(rand(0.8, 1.7));
      tree.rotation.y = rand(0, Math.PI);
    };
    for (let i = 0; i < 46; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.4;
      tree.add(trunk);
      tiers.forEach((geo, t) => {
        const tier = new THREE.Mesh(geo, needleMats[t % 2]);
        tier.position.y = 1.3 + t * 0.85;
        tree.add(tier);
      });
      tree.traverse(o => (o.castShadow = true));
      place(tree);
      tree.position.z = DESPAWN_Z - rand(0, PROP_SPAN);
      scene.add(tree);
      this.props.push({ obj: tree, parallax: 1, span: PROP_SPAN, place });
    }
  }

  /** Boulders resting on the ground (sunk slightly so none of them float). */
  private buildRocks(scene: THREE.Scene): void {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mats = [flat(COLORS.rock), flat(COLORS.rockDark)];
    const place = (rock: THREE.Object3D) => {
      rock.position.x = side() * rand(TRAIL_W / 2 + 1.8, 30);
      rock.scale.set(rand(0.4, 1.4), rand(0.3, 0.8), rand(0.4, 1.3));
      rock.position.y = rock.scale.y * 0.55;
      rock.rotation.set(0, rand(0, Math.PI), rand(-0.2, 0.2));
    };
    for (let i = 0; i < 34; i++) {
      const rock = new THREE.Mesh(geo, mats[i % 2]);
      rock.castShadow = rock.receiveShadow = true;
      place(rock);
      rock.position.z = DESPAWN_Z - rand(0, PROP_SPAN);
      scene.add(rock);
      this.props.push({ obj: rock, parallax: 1, span: PROP_SPAN, place });
    }
  }

  /** Low-poly peaks with snow caps that share the mountain's facets. */
  private buildMountains(scene: THREE.Scene): void {
    const snow = flat(COLORS.snow);
    // Keep the whole base clear of the trail, however big the peak rolls.
    const place = (mountain: THREE.Object3D) => {
      const scale = rand(0.7, 1.4);
      mountain.scale.setScalar(scale);
      mountain.position.x = side() * ((mountain.userData.radius as number) * scale + rand(14, 110));
    };
    for (let i = 0; i < 28; i++) {
      const segments = 5 + (i % 3);
      const radius = rand(16, 30);
      const height = rand(22, 46);
      const capShare = rand(0.22, 0.32);
      const mountain = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), flat(COLORS.mountains[i % 4]));
      body.position.y = height / 2;
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(radius * capShare * 1.02, height * capShare, segments),
        snow,
      );
      cap.position.y = height - (height * capShare) / 2 + 0.05;
      mountain.add(body, cap);
      mountain.userData.radius = radius;
      mountain.rotation.y = rand(0, Math.PI);
      place(mountain);
      mountain.position.z = DESPAWN_Z - 60 - rand(0, MOUNTAIN_SPAN);
      scene.add(mountain);
      this.props.push({ obj: mountain, parallax: MOUNTAIN_PARALLAX, span: MOUNTAIN_SPAN, place });
    }
  }
}
