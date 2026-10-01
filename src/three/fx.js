// VFX: particle bursts, floating text, shockwaves, camera shake, tween helper.
import * as THREE from 'three';
import { textSprite } from './textures.js?v=8';

export const tweens = [];
export function tween(dur, fn, ease = 'smooth', onDone) {
  tweens.push({ t: 0, dur, fn, ease, onDone });
}
export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    let k = Math.min(1, tw.t / tw.dur);
    if (tw.ease === 'smooth') k = k * k * (3 - 2 * k);
    else if (tw.ease === 'out') k = 1 - Math.pow(1 - k, 3);
    else if (tw.ease === 'bounce') k = 1 - Math.pow(1 - k, 2);
    tw.fn(k);
    if (tw.t >= tw.dur) { tweens.splice(i, 1); tw.onDone && tw.onDone(); }
  }
}
export const wait = (ms) => new Promise(r => setTimeout(r, ms));

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }
  burst(pos, opts = {}) {
    const { count = 40, color = 0xffd32a, color2 = 0xff5e7a, spread = 2.2, up = 5, size = 0.16, grav = -9, life = 1.4, shape = 'plane' } = opts;
    for (let i = 0; i < count; i++) {
      let mesh;
      if (shape === 'coin') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(size, size, size * 0.25, 10),
          new THREE.MeshStandardMaterial({ color: 0xffd32a, metalness: 0.7, roughness: 0.3, emissive: 0x664400, emissiveIntensity: 0.4 }));
      } else {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2.6),
          new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? color : color2, side: THREE.DoubleSide }));
      }
      mesh.position.copy(pos);
      mesh.position.x += (Math.random() - 0.5) * 0.6;
      mesh.position.z += (Math.random() - 0.5) * 0.6;
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.group.add(mesh);
      this.items.push({
        mesh,
        v: new THREE.Vector3((Math.random() - 0.5) * spread, up * (0.5 + Math.random() * 0.8), (Math.random() - 0.5) * spread),
        rv: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3),
        life: life * (0.7 + Math.random() * 0.6), age: 0, grav,
      });
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      p.v.y += p.grav * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += p.rv.x * dt; p.mesh.rotation.y += p.rv.y * dt; p.mesh.rotation.z += p.rv.z * dt;
      if (p.mesh.position.y < 0.1 && p.v.y < 0) { p.v.y *= -0.3; p.v.x *= 0.7; p.v.z *= 0.7; }
      const k = 1 - p.age / p.life;
      if (k <= 0) { this.group.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); this.items.splice(i, 1); continue; }
      p.mesh.material.transparent = true;
      p.mesh.material.opacity = Math.min(1, k * 2);
    }
  }
}

export class Floaters {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera; this.items = [];
  }
  add(text, pos, opts = {}) {
    const { color = '#ffd32a', size = 0.9, rise = 2.2, life = 1.6, drop = false, pop = 0 } = opts;
    const { tex, aspect } = textSprite(text, { color, size: 46 });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(size * aspect, size, 1);
    sp.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
    this.scene.add(sp);
    this.items.push({ sp, age: 0, life, rise: drop ? -rise * 0.35 : rise, pop, baseScale: sp.scale.clone() });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.age += dt;
      f.sp.position.y += f.rise * dt;
      // springy pop-in: overshoot then settle over ~0.28s
      if (f.pop > 0) {
        const k = Math.min(1, f.age / 0.28);
        const spring = 1 + Math.sin(k * Math.PI) * f.pop;
        f.sp.scale.set(f.baseScale.x * spring, f.baseScale.y * spring, 1);
      }
      const k = 1 - f.age / f.life;
      f.sp.material.opacity = Math.min(1, k * 2.5);
      if (k <= 0) { this.scene.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); this.items.splice(i, 1); }
    }
  }
}

export class Shockwaves {
  constructor(scene) { this.scene = scene; this.items = []; }
  add(pos, color = 0xff4444, maxR = 18) {
    const geo = new THREE.RingGeometry(0.5, 0.9, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos); m.position.y = 0.3;
    this.scene.add(m);
    this.items.push({ m, age: 0, life: 1.1, maxR });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const s = this.items[i];
      s.age += dt;
      const k = s.age / s.life;
      const r = 0.5 + k * s.maxR;
      s.m.scale.set(r, r, r);
      s.m.material.opacity = (1 - k) * 0.8;
      if (k >= 1) { this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); this.items.splice(i, 1); }
    }
  }
}
