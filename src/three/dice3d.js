// Tumbling dice: two white d6 + speed die, real pip faces, settle on the rolled values.
import * as THREE from 'three';
import { diceFaceTexture, speedFaceTexture } from './textures.js?v=8';
import { tween } from './fx.js?v=8';

function makeDie(faceTexes, size = 1.15) {
  // Box face order: +x, -x, +y, -y, +z, -z
  const mats = [faceTexes[1], faceTexes[6], faceTexes[2], faceTexes[5], faceTexes[3], faceTexes[4]]
    .map(t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.05 }));
  const geo = new THREE.BoxGeometry(size, size, size);
  const m = new THREE.Mesh(geo, mats);
  return m;
}

// quaternion that shows face `n` on top (+y). Material order: +x=1, -x=6, +y=2, -y=5, +z=3, -z=4
function faceQuat(n) {
  const e = new THREE.Euler();
  switch (n) {
    case 1: e.set(0, 0, Math.PI / 2); break;   // +x up
    case 2: e.set(0, 0, 0); break;             // +y up
    case 3: e.set(-Math.PI / 2, 0, 0); break;  // +z up
    case 4: e.set(Math.PI / 2, 0, 0); break;   // -z up
    case 5: e.set(Math.PI, 0, 0); break;       // -y up
    case 6: e.set(0, 0, -Math.PI / 2); break;  // -x up
    default: e.set(0, 0, 0);
  }
  return new THREE.Quaternion().setFromEuler(e);
}

export class Dice3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const t = {}; for (let n = 1; n <= 6; n++) t[n] = diceFaceTexture(n);
    const ts = { 1: speedFaceTexture(1), 2: speedFaceTexture(2), 3: speedFaceTexture(3), 4: speedFaceTexture('BUS'), 5: speedFaceTexture('BUS'), 6: speedFaceTexture('MR') };
    this.d1 = makeDie(t); this.d2 = makeDie(t); this.d3 = makeDie(ts, 1.05);
    this.d3.position.y = 0.4;
    this.group.add(this.d1, this.d2, this.d3);
    this.home = new THREE.Vector3(9.5, 1.4, 13.2);
    this.group.position.copy(this.home);
    this.d1.position.set(-1.0, 0, 0); this.d2.position.set(1.0, 0, 0); this.d3.position.set(0, 0, 1.3);
    this.d3.visible = false;
    this.rolling = false;
    this.faceMap = { 1: 'BUS', 2: 'MR', 3: 1, 4: 2, 5: 3, 6: 'BUS' }; // speed die: map settle face
  }
  setSpeedDieVisible(v) { this.d3.visible = v; }

  // values: [d1, d2, speed?] speed numeric or 'BUS'/'MR'/null. pace > 1 = faster.
  async roll(values, origin = null, pace = 1) {
    this.rolling = true;
    const T = (sec) => sec / pace;
    const dice = [this.d1, this.d2];
    if (this.d3.visible && values[2] != null) dice.push(this.d3);
    const targets = [values[0], values[1]];
    if (this.d3.visible && values[2] != null) {
      targets.push(values[2] === 'BUS' ? 4 : values[2] === 'MR' ? 6 : values[2]);
    }
    if (origin) this.group.position.copy(origin);
    // toss
    const spins = dice.map(() => new THREE.Vector3(Math.random() * 14 + 8, Math.random() * 14 + 8, Math.random() * 14 + 8));
    const lifts = dice.map(() => 2.2 + Math.random() * 1.4);
    await new Promise((resolve) => {
      tween(T(1.15), (t) => {
        for (let i = 0; i < dice.length; i++) {
          dice[i].rotation.set(spins[i].x * t * 4, spins[i].y * t * 4, spins[i].z * t * 4);
          dice[i].position.y = Math.sin(t * Math.PI) * lifts[i];
        }
      }, 'linear', resolve);
    });
    // settle with a satisfying bounce per die, in sequence
    for (let i = 0; i < dice.length; i++) {
      const q = faceQuat(targets[i]);
      const from = dice[i].quaternion.clone();
      await new Promise((resolve) => {
        tween(T(0.42), (t) => {
          dice[i].quaternion.slerpQuaternions(from, q, Math.min(1, t * 1.6));
          dice[i].position.y = Math.abs(Math.sin((1 - t) * Math.PI * 2)) * 0.5 * (1 - t);
        }, 'out', resolve);
      });
      dice[i].rotation.set(0, 0, 0);
      dice[i].quaternion.copy(q);
      dice[i].position.y = 0;
    }
    this.rolling = false;
  }
  restAt(pos) { this.group.position.lerp(pos || this.home, 1); }
}
