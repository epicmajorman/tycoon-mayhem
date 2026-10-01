// 8 character pieces — glossy toy-like 3D models built from primitives,
// with clearcoat materials, gold bases, and silhouettes readable across the board.
import * as THREE from 'three';
import { tilePos } from './board3d.js?v=8';
import { tween } from './fx.js?v=8';

function toy(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.22, metalness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.12,
    envMapIntensity: 1.1,
    ...opts,
  });
}
function goldMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf5c542, roughness: 0.18, metalness: 1.0, envMapIntensity: 1.5,
    clearcoat: 0.6, clearcoatRoughness: 0.2,
  });
}
function darkMat() {
  return new THREE.MeshPhysicalMaterial({ color: 0x14151f, roughness: 0.3, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
}
function whiteMat() { return new THREE.MeshPhysicalMaterial({ color: 0xf4f6ff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }); }

function eye(x, y, z) {
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), whiteMat());
  white.scale.set(1, 1.15, 0.55);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), darkMat());
  pupil.position.set(0, 0, 0.045);
  const g2 = new THREE.Group();
  g2.add(white, pupil);
  g2.position.set(x, y, z);
  g2.lookAt(0, y, 2);
  return g2;
}

export function buildToken(kind, color) {
  const g = new THREE.Group();
  const m = toy(color);
  const dark = toy(new THREE.Color(color).multiplyScalar(0.45).getHex());
  const acc = toy(0xff5e7a);

  switch (kind) {
    case 'hat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.09, 28), m);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.62, 28), m);
      tube.position.y = 0.33;
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m);
      top.position.y = 0.63; top.scale.y = 0.55;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.395, 0.14, 28), acc);
      band.position.y = 0.12;
      g.add(brim, tube, top, band);
      break;
    }
    case 'car': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.66, 6, 14), m);
      body.rotation.z = Math.PI / 2; body.position.y = 0.26; body.scale.set(1, 1, 0.85);
      const cab = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 14), new THREE.MeshPhysicalMaterial({
        color: 0x9fd8ff, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6,
      }));
      cab.rotation.z = Math.PI / 2; cab.position.set(-0.04, 0.45, 0); cab.scale.set(1, 1, 0.75);
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.5), dark);
      spoiler.position.set(-0.42, 0.42, 0);
      g.add(body, cab, spoiler);
      for (const [x, z] of [[0.32, 0.24], [0.32, -0.24], [-0.32, 0.24], [-0.32, -0.24]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), dark);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.14, z);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 12), goldMat());
        hub.rotation.x = Math.PI / 2; hub.position.copy(wheel.position);
        g.add(wheel, hub);
      }
      break;
    }
    case 'dog': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), m);
      body.rotation.z = Math.PI / 2; body.position.y = 0.34;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), m);
      head.position.set(0.36, 0.52, 0);
      const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.12, 4, 10), toy(0xf7e7d3));
      snout.rotation.z = Math.PI / 2; snout.position.set(0.54, 0.47, 0);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkMat());
      nose.position.set(0.62, 0.48, 0);
      for (const z of [0.1, -0.1]) {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), dark);
        ear.position.set(0.28, 0.62, z); ear.rotation.x = z > 0 ? 0.3 : -0.3;
        g.add(ear);
      }
      for (const [x, z] of [[0.16, 0.11], [0.16, -0.11], [-0.16, 0.11], [-0.16, -0.11]]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), m);
        leg.position.set(x, 0.14, z);
        g.add(leg);
      }
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), dark);
      tail.position.set(-0.34, 0.48, 0); tail.rotation.z = -0.8;
      g.add(body, head, snout, nose, tail);
      g.add(eye(0.4, 0.56, 0.085), eye(0.4, 0.56, -0.085));
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16), acc);
      collar.rotation.y = Math.PI / 2; collar.position.set(0.24, 0.42, 0);
      g.add(collar);
      break;
    }
    case 'cat': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.3, 6, 14), m);
      body.position.y = 0.32; body.scale.set(1, 1, 0.9);
      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), toy(0xf7e7d3));
      chest.position.set(0, 0.26, 0.08);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), m);
      head.position.set(0, 0.62, 0.02);
      for (const z of [0.09, -0.09]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), m);
        ear.position.set(0, 0.78, z);
        g.add(ear);
      }
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4, 4, 10), dark);
      tail.position.set(-0.05, 0.4, -0.22); tail.rotation.x = 0.9;
      g.add(body, chest, head, tail);
      g.add(eye(0.08, 0.64, 0.15), eye(-0.08, 0.64, 0.15));
      for (const [x, z] of [[0.1, 0.1], [0.1, -0.1], [-0.1, 0.1], [-0.1, -0.1]]) {
        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), toy(0xf7e7d3));
        paw.position.set(x, 0.06, z);
        g.add(paw);
      }
      break;
    }
    case 'ship': {
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.7, 6, 14), m);
      hull.rotation.z = Math.PI / 2; hull.position.y = 0.2; hull.scale.set(1, 1, 0.7);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.32), dark);
      deck.position.y = 0.36;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), toy(0xf7e7d3));
      cabin.position.set(-0.08, 0.48, 0);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 8), goldMat());
      mast.position.set(0.18, 0.7, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      flag.position.set(0.3, 0.9, 0);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.26, 4), m);
      bow.rotation.z = -Math.PI / 2; bow.position.set(0.56, 0.2, 0);
      g.add(hull, bow, deck, cabin, mast, flag);
      break;
    }
    case 'boot': {
      const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), m);
      shaft.position.set(-0.07, 0.46, 0);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 6, 14), m);
      foot.rotation.z = Math.PI / 2; foot.position.set(0.12, 0.18, 0);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.42), dark);
      sole.position.set(0.1, 0.06, 0);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.3), goldMat());
      buckle.position.set(-0.16, 0.5, 0);
      g.add(shaft, foot, sole, buckle);
      break;
    }
    case 'rocket': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.44, 6, 16), whiteMat());
      body.position.y = 0.5;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.196, 0.196, 0.12, 16), acc);
      stripe.position.y = 0.62;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.34, 16), acc);
      nose.position.y = 1.0;
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, clearcoat: 1 }));
      glass.position.set(0, 0.62, 0.175);
      g.add(body, stripe, nose, glass);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.24), acc);
        const ang = (i * Math.PI * 2) / 3;
        fin.position.set(Math.cos(ang) * 0.22, 0.2, Math.sin(ang) * 0.22);
        fin.rotation.y = -ang;
        g.add(fin);
      }
      break;
    }
    case 'crown':
    default: {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.24, 16), m);
      base.position.y = 0.16;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.07, 16), goldMat());
      band.position.y = 0.26;
      g.add(base, band);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), m);
        spike.position.set(Math.cos(a) * 0.32, 0.48, Math.sin(a) * 0.32);
        g.add(spike);
      }
      for (const [x, z, c] of [[0, 0.34, 0x7ee3ff], [0.26, -0.18, 0xff5e7a], [-0.26, -0.18, 0x26de81]]) {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), toy(c, { emissive: c, emissiveIntensity: 0.5 }));
        gem.position.set(x, 0.3, z);
        g.add(gem);
      }
      break;
    }
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.1, 24), goldMat());
  base.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 10, 28), toy(color, { emissive: color, emissiveIntensity: 0.35 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  g.add(base, ring);
  return g;
}

// height of the tile slab + face card above the platform surface
const TOKEN_LIFT = 0.46;

export function seatOffset(idx, tileRadius = 1.0) {
  const ang = (idx / 8) * Math.PI * 2 + 0.4;
  const r = tileRadius * 0.34;
  return new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
}

// slot for `idx` on `tile`, spread by how many pieces stand there: 1 = centred,
// 2 = two sides, 3+ = a ring. Keeps pieces from ever overlapping.
function spreadSlot(count, k) {
  if (count <= 1) return new THREE.Vector3(0, 0, 0);
  if (count === 2) {
    const off = 0.52;
    return new THREE.Vector3(k === 0 ? -off : off, 0, 0);
  }
  const ang = (k / count) * Math.PI * 2 + 0.6;
  const r = count <= 4 ? 0.56 : 0.72;
  return new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
}

export class Tokens3D {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.meshes = [];
    for (const p of state.players) {
      const mesh = buildToken(p.token, p.color);
      mesh.position.copy(tilePos(p.pos));
      mesh.scale.setScalar(1.12);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.queues = state.players.map(() => Promise.resolve());
    this.syncPositions();
  }
  // how many pieces stand on `tile`, and this player's rank among them
  occupancy(tile, idx) {
    let count = 0, k = 0;
    for (const p of this.state.players) {
      if (p.bankrupt) continue;
      if (p.pos === tile) {
        if (p.id === idx) k = count;
        count++;
      }
    }
    return { count, k };
  }
  tileSlot(tile, idx) {
    const { count, k } = this.occupancy(tile, idx);
    return spreadSlot(count, k);
  }
  // full world position for a piece on a tile: platform + lift + spread slot
  slotPos(tile, idx) {
    return tilePos(tile).add(this.tileSlot(tile, idx)).add(new THREE.Vector3(0, TOKEN_LIFT, 0));
  }
  // face outward from the board centre (models are authored facing +X)
  faceOutward(mesh, tile) {
    const p = tilePos(tile);
    mesh.rotation.y = Math.atan2(-p.z, p.x) || 0;
  }
  syncPositions() {
    for (let i = 0; i < this.meshes.length; i++) {
      const tile = this.state.players[i].pos;
      this.meshes[i].position.copy(this.slotPos(tile, i));
      this.faceOutward(this.meshes[i], tile);
    }
  }
  async hopPath(playerIdx, tiles, opts = {}) {
    const mesh = this.meshes[playerIdx];
    mesh.userData.hopping = true;
    const task = (async () => {
      let prev = mesh.position.clone();
      for (const t of tiles) {
        const target = this.slotPos(t, playerIdx);
        // face the direction of travel while hopping
        const dir = target.clone().sub(prev);
        if (dir.x || dir.z) mesh.rotation.y = Math.atan2(-dir.z, dir.x) || mesh.rotation.y;
        await this.hopTo(mesh, target, opts.speed || 0.24, opts.teleport);
        mesh.userData.tile = t;
        prev = mesh.position.clone();
      }
      // settle facing outward at the destination
      this.faceOutward(mesh, tiles[tiles.length - 1]);
      mesh.userData.hopping = false;
    })();
    this.queues[playerIdx] = task;
    return task;
  }
  hopTo(mesh, target, dur = 0.24, teleport = false) {
    return new Promise((resolve) => {
      const from = mesh.position.clone();
      if (teleport) {
        mesh.position.copy(target);
        tween(0.3, (t) => { mesh.scale.setScalar(1.12 * (1 - Math.sin(t * Math.PI) * 0.5)); });
        resolve();
        return;
      }
      tween(dur, (t) => {
        mesh.position.lerpVectors(from, target, t);
        mesh.position.y = from.y + (target.y - from.y) * t + Math.sin(t * Math.PI) * 0.65;
        const squash = 1 - Math.sin(t * Math.PI) * 0.14;
        mesh.scale.set(1.12 * squash, 1.12 * (2 - squash), 1.12 * squash);
      }, 'linear', () => { mesh.scale.setScalar(1.12); resolve(); });
    });
  }
  sendToJail(playerIdx) {
    const mesh = this.meshes[playerIdx];
    return this.hopTo(mesh, this.slotPos(13, playerIdx), 0.3, true);
  }
  sink(playerIdx) {
    const mesh = this.meshes[playerIdx];
    tween(1.6, (t) => {
      mesh.position.y = -t * 2.2;
      mesh.rotation.z = t * 2.4;
      mesh.visible = t < 1;
    }, 'smooth', () => { mesh.visible = false; });
  }
  celebrate(playerIdx) {
    const mesh = this.meshes[playerIdx];
    tween(2.5, (t) => {
      mesh.position.y = Math.abs(Math.sin(t * Math.PI * 6)) * 1.2;
      mesh.rotation.y = t * Math.PI * 8;
    });
  }
  pulse(playerIdx) {
    const mesh = this.meshes[playerIdx];
    tween(0.5, (t) => { mesh.scale.setScalar(1.12 * (1 + Math.sin(t * Math.PI) * 0.28)); });
  }
  update(dt, time, currentIdx) {
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i];
      if (!m.visible) continue;
      if (i === currentIdx && !m.userData.hopping) {
        m.position.y = m.userData.baseY ?? m.position.y;
        m.userData.baseY = m.position.y;
        m.position.y += Math.sin(time * 3 + i) * 0.07;
      }
    }
  }
}
