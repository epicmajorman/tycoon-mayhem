// Renderer: scene, lights, bloom, cinematic camera director, event-driven animation.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/examples/jsm/controls/OrbitControls.js?v=8';
import { EffectComposer } from '../../vendor/three/examples/jsm/postprocessing/EffectComposer.js?v=8';
import { RenderPass } from '../../vendor/three/examples/jsm/postprocessing/RenderPass.js?v=8';
import { UnrealBloomPass } from '../../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js?v=8';
import { OutputPass } from '../../vendor/three/examples/jsm/postprocessing/OutputPass.js?v=8';
import { RoomEnvironment } from '../../vendor/three/examples/jsm/environments/RoomEnvironment.js?v=8';
import { Board3D, tilePos, diceHome, overviewFor, buildEnvironment, updateEnvironment, pyramidPos } from './board3d.js?v=8';
import { RING_META, TILES, DISTRICTS, D } from '../data/board.js?v=8';
const RINGS = () => RING_META.length;
import { Tokens3D } from './tokens3d.js?v=8';
import { Dice3D } from './dice3d.js?v=8';
import { Particles, Floaters, Shockwaves, tweens, updateTweens } from './fx.js?v=8';

const money = (n) => (n >= 0 ? '+$' : '−$') + Math.abs(Math.round(n)).toLocaleString('en-US');

export class Renderer {
  constructor(container) {
    this.container = container;
    this.engine = null;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1c2c54');
    this.scene.fog = new THREE.Fog('#bfe4f2', 55, 150); // horizon haze: hides the world edge, matches the sky

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.camera.position.set(0, 42, 40);

    this.renderer3 = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer3.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer3.shadowMap.enabled = true;
    this.renderer3.shadowMap.type = THREE.PCFSoftShadowMap;
    // environment reflections: makes clearcoat/glossy materials read as real objects
    const pmrem = new THREE.PMREMGenerator(this.renderer3);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.renderer3.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer3.toneMappingExposure = 1.02;
    container.appendChild(this.renderer3.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer3.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 95;
    this.controls.target.set(0, 0, 0);
    this.controls.enablePan = false; // right-drag pan is handled manually for a clean release
    this.userOverrideUntil = 0;
    this.controls.addEventListener('start', () => { this.userOverrideUntil = performance.now() + 12000; });

    // lights
    this.lights = [];
    this.hemi = new THREE.HemisphereLight('#fff2dc', '#8a7a55', 1.0);
    this.dir = new THREE.DirectionalLight('#ffd9a0', 2.4);   // warm dusk key, matches the sun sprite
    this.dir.position.set(-60, 45, -90);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(2048, 2048);
    this.dir.shadow.camera.left = -45; this.dir.shadow.camera.right = 45;
    this.dir.shadow.camera.top = 45; this.dir.shadow.camera.bottom = -45;
    this.dir.shadow.camera.far = 260;
    this.dir.shadow.bias = -0.0004;
    this.lights.push(this.hemi, this.dir);
    const fill = new THREE.DirectionalLight('#ffb87a', 0.5);  // warm bounce, opposite the key
    fill.position.set(70, 24, 60);
    this.lights.push(fill);
    const rim = new THREE.DirectionalLight('#9fc8ff', 0.45);  // cool rim from behind the sun
    rim.position.set(60, 30, -110);
    this.lights.push(rim);
    for (const l of this.lights) this.scene.add(l);

    this.composer = new EffectComposer(this.renderer3);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.07, 0.6, 0.97);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.env = buildEnvironment(this.scene);
    this.particles = new Particles(this.scene);
    this.floaters = new Floaters(this.scene, this.camera);
    this.shocks = new Shockwaves(this.scene);
    this.dice = new Dice3D(this.scene);

    this.pace = 1; // animation speed multiplier (higher = faster)
    this.autoOrbit = false;  // menu: slow cinematic spin around the board
    this._orbit = 0;
    this.cameraGoal = { pos: new THREE.Vector3(0, 42, 40), target: new THREE.Vector3(0, 0, 0), lerp: 0.045 };
    this.shake = 0;
    this.clock = new THREE.Clock();
    this.currentPlayer = 0;
    this.queue = [];
    this.processing = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer3.setAnimationLoop(() => this.frame());
    this.setupPicking();
    this.setupNav();
  }

  // ---- alternative navigation: API used by the nav pad + keyboard ----
  panBy(dx, dy) {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const k = dist * 0.0014;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const move = right.multiplyScalar(-dx * k).add(up.multiplyScalar(dy * k));
    this.camera.position.add(move);
    this.controls.target.add(move);
    this.controls.update();
    this.userOverrideUntil = performance.now() + 15000;
  }
  zoomBy(f) {
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(f);
    const len = offset.length();
    if ((f < 1 && len <= this.controls.minDistance) || (f > 1 && len >= this.controls.maxDistance)) return;
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.userOverrideUntil = performance.now() + 15000;
  }
  resetView() {
    this.userOverrideUntil = 0;
    this.overview();
  }
  setupNav() {
    // on-screen pad: a no-mouse-gesture way to move around
    const pad = document.createElement('div');
    pad.id = 'navpad';
    pad.innerHTML = `
      <div class="np-cluster">
        <button data-nav="up" title="Pan up (W / ↑)">▲</button>
        <div class="np-row">
          <button data-nav="left" title="Pan left (A / ←)">◀</button>
          <button data-nav="in" title="Zoom in (+)">＋</button>
          <button data-nav="right" title="Pan right (D / →)">▶</button>
        </div>
        <button data-nav="down" title="Pan down (S / ↓)">▼</button>
      </div>
      <div class="np-cluster np-side">
        <button data-nav="out" title="Zoom out (−)">－</button>
        <button data-nav="reset" title="Reset view (Home)">⌂</button>
      </div>`;
    document.getElementById('app').appendChild(pad);
    const hold = (btn) => {
      const nav = btn.dataset.nav;
      const act = () => {
        if (nav === 'up') this.panBy(0, 14);
        else if (nav === 'down') this.panBy(0, -14);
        else if (nav === 'left') this.panBy(14, 0);
        else if (nav === 'right') this.panBy(-14, 0);
        else if (nav === 'in') this.zoomBy(0.92);
        else if (nav === 'out') this.zoomBy(1.08);
        else if (nav === 'reset') this.resetView();
      };
      let iv = null;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        act();
        iv = setInterval(act, 40);
      });
      const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    };
    pad.querySelectorAll('button').forEach(hold);

    // keyboard navigation: WASD / arrows pan, +/- zoom, Home resets
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', '+', '=', '-', '_', 'Home'].includes(k)) {
        e.preventDefault();
        this.keys.add(k);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('blur', () => this.keys.clear());
  }
  applyKeyboardNav(dt) {
    if (!this.keys || this.keys.size === 0) return;
    const step = 520 * dt;
    if (this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('W')) this.panBy(0, step);
    if (this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S')) this.panBy(0, -step);
    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) this.panBy(step, 0);
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) this.panBy(-step, 0);
    if (this.keys.has('+') || this.keys.has('=')) this.zoomBy(Math.pow(0.9, dt * 60));
    if (this.keys.has('-') || this.keys.has('_')) this.zoomBy(Math.pow(1.1, dt * 60));
    if (this.keys.has('Home')) this.resetView();
  }

  // click (not drag) on a tile opens its info card — wired by the driver
  onTileClick = null;
  setupPicking() {
    const dom = this.renderer3.domElement;
    let sx = 0, sy = 0, st = 0;
    // right mouse: manual drag & release panning — grab, move, let go. No inertia,
    // no stuck state; the camera stays exactly where you leave it.
    let pan = null;
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        pan = { x: e.clientX, y: e.clientY };
        this.userOverrideUntil = performance.now() + 15000;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      pan.x = e.clientX; pan.y = e.clientY;
      this.userOverrideUntil = performance.now() + 15000;
      const dist = this.camera.position.distanceTo(this.controls.target);
      const k = dist * 0.0014;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      const move = right.multiplyScalar(-dx * k).add(up.multiplyScalar(dy * k));
      this.camera.position.add(move);
      this.controls.target.add(move);
      this.controls.update();
    });
    const endPan = (e) => { if (e.button === 2) pan = null; };
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
    dom.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
    dom.addEventListener('pointerup', (e) => {
      if (!this.board || !this.onTileClick) return;
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 7 || performance.now() - st > 450) return;
      const r = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const hits = ray.intersectObjects(this.board.tiles, false);
      if (hits.length) {
        const idx = this.board.tiles.indexOf(hits[0].object);
        if (idx >= 0) this.onTileClick(idx);
      }
    });
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer3.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setEngine(engine) {
    this.engine = engine;
    this.queue.length = 0;
    // rebuild the world for the new match — with the active board's real size, so the
    // offshore foliage clears the island on every board
    this.scene.clear();
    for (const g of this.env) this.scene.remove(g);
    this.env = buildEnvironment(this.scene);
    for (const e of this.env) this.scene.add(e);
    for (const l of this.lights) this.scene.add(l);
    this.scene.add(this.particles.group);
    this.scene.add(this.dice.group);
    this.board = new Board3D(this.scene, engine.s);
    this.tokens = new Tokens3D(this.scene, engine.s);
    this.dice.group.position.copy(diceHome());
    for (const m of this.tokens.meshes) m.userData.baseY = m.position.y;
    this.board.sync();
    this.bindEngine(engine);
    this.overview();
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    updateTweens(dt);
    this.particles.update(dt);
    this.floaters.update(dt);
    this.shocks.update(dt);
    if (this.board) this.board.update(dt, time);
    updateEnvironment(time);
    if (this.tokens) this.tokens.update(dt, time, this.currentPlayer);
    // camera easing
    const now = performance.now();
    if (this.autoOrbit) {
      this._orbit += dt * 0.07;
      const r = 40;
      this.cameraGoal.pos.set(Math.sin(this._orbit) * r, 30 + Math.sin(this._orbit * 0.6) * 4, Math.cos(this._orbit) * r);
      this.cameraGoal.target.set(0, 0, 0);
    }
    if (now > this.userOverrideUntil) {
      this.camera.position.lerp(this.cameraGoal.pos, this.cameraGoal.lerp);
      this.controls.target.lerp(this.cameraGoal.target, this.cameraGoal.lerp + 0.02);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
    }
    this.controls.update();
    this.applyKeyboardNav(dt);
    this.composer.render();
    this.pumpQueue();
  }

  // ---------- camera director ----------
  overview() {
    const o = overviewFor();
    this.cameraGoal.pos.copy(o.pos);
    this.cameraGoal.target.copy(o.target);
  }
  followPlayer(i) {
    if (this.autoOrbit) return;
    if (!this.tokens) return;
    const p = this.tokens.meshes[i].position.clone();
    const zoom = RINGS() > 1 ? 0.9 : 1;
    // high three-quarter view: steep enough that offshore islands read as scenery
    // beyond the board instead of overlapping it
    this.cameraGoal.pos.set(p.x * 0.5 * zoom, 34, p.z * 0.5 * zoom + 14);
    this.cameraGoal.target.copy(p).setY(0.5);
  }
  focusTile(i, height = 16) {
    const p = tilePos(i).clone();
    this.cameraGoal.pos.copy(p).multiplyScalar(0.68).setY(height);
    this.cameraGoal.target.copy(p).setY(1);
  }
  focusDice() {
    const h = diceHome();
    this.cameraGoal.pos.set(h.x + 2.2, 10, h.z + 8.5);
    this.cameraGoal.target.set(h.x, 0.8, h.z);
  }
  shakeIt(a = 0.8) { this.shake = a; }

  // ---------- event queue ----------
  push(type, data) { this.queue.push({ type, data }); this.pumpQueue(); }
  // run cb once the animation queue has fully drained (used to time UI prompts)
  whenIdle(cb) {
    if (!this.processing && this.queue.length === 0) { cb(); return; }
    (this._idleCbs = this._idleCbs || []).push(cb);
  }
  async pumpQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const { type, data } = this.queue.shift();
      try { await this.playEvent(type, data); } catch (e) { console.error('renderer event', type, e); }
      // let every action breathe so a human can follow what is happening
      await new Promise(r => setTimeout(r, 260 / this.pace));
      if (type === 'tileLand' || type === 'card') await new Promise(r => setTimeout(r, 500 / this.pace));
    }
    this.processing = false;
    if (this._idleCbs && this.queue.length === 0) {
      const cbs = this._idleCbs; this._idleCbs = [];
      for (const cb of cbs) { try { cb(); } catch (e) { console.error('idle cb', e); } }
    }
  }
  async playEvent(type, d) {
    const eng = this.engine, s = eng.s;
    const P = (i) => this.tokens.meshes[i];
    switch (type) {
      case 'rolled': {
        this.userOverrideUntil = 0; // a new roll re-takes the camera from any manual drag
        this.focusDice();
        this.dice.setSpeedDieVisible(s.flags.speedDie && s.players[d.player].laps >= 1);
        sfx('dice');
        await this.dice.roll([d.d1, d.d2, d.speed ?? null], null, this.pace);
        await new Promise(r => setTimeout(r, 420 / this.pace));
        break;
      }
      case 'moveStep': {
        await this.tokens.hopPath(d.player, [d.pos], { teleport: d.teleport, speed: (d.bonus ? 0.16 : 0.24) / this.pace });
        if (!d.teleport) sfx('hop');
        // movement cinematic: drop in low and chase the piece until it lands
        this.moveCine = true;
        const mp = P(d.player)?.position.clone();
        if (mp) {
          const out = new THREE.Vector3(mp.x, 0, mp.z).normalize().multiplyScalar(3.2);
          this.cameraGoal.lerp = 0.1;
          this.cameraGoal.pos.set(mp.x + out.x, 12, mp.z + out.z + 8);
          this.cameraGoal.target.copy(mp).setY(1);
        }
        break;
      }
      case 'tileLand': {
        this.board.highlight(d.tile, s.players[d.player].color);
        this.moveCine = false;
        this.cameraGoal.lerp = 0.045;
        // ease back out once the landing beat has played
        clearTimeout(this._cineTimer);
        this._cineTimer = setTimeout(() => { if (!this.moveCine) this.overview(); }, 1500 / (this.pace || 1));
        this.focusTile(d.tile, 17); // close enough to read, far enough to keep board context
        this.shakeIt(0.12);
        // landing pulse ring in the player's color
        this.shocks.add(tilePos(d.tile).clone().setY(0.6), new THREE.Color(s.players[d.player].color).getHex(), 2.4);
        // name callout as the piece arrives
        const t = TILES[d.tile];
        if (t) {
          const label = t.type === 'property' ? `${t.name} · $${t.price}` : t.name;
          this.floaters.add(label, tilePos(d.tile).clone(), { color: t.type === 'property' ? DISTRICTS[D[t.district]].color : '#7ee3ff', size: 1.2, life: 2.6, rise: 1.2 });
        }
        setTimeout(() => this.board.clearHighlight(d.tile), 2600);
        break;
      }
      case 'cash': {
        const gain = d.delta >= 0;
        const size = Math.min(2.2, 0.9 + Math.log10(1 + Math.abs(d.delta)) * 0.42); // bigger money, bigger moment
        const pos = P(d.player)?.position.clone() || tilePos(0);
        this.floaters.add(money(d.delta), pos.clone(), {
          color: gain ? '#8dffb4' : '#ff8a8a',
          size: 1.05 * size, pop: 0.7, drop: !gain, rise: 1.9, life: gain ? 1.5 : 1.7,
        });
        if (gain) {
          // coin fountain: coins blast up and rain back down on the token
          this.particles.burst(pos.clone().setY(1), {
            count: Math.round(12 + size * 12), color: 0xffd32a, shape: 'coin', spread: 1.2, up: 3.4 + size, life: 1.1, grav: -11,
          });
          sfx('gain', { size });
          this.tokens?.pulse?.(d.player, gain ? 1 : -1);
        } else {
          // bills flutter away + a little hurt-shake on big hits
          this.particles.burst(pos.clone().setY(1.1), {
            count: Math.round(6 + size * 6), color: 0x9fe8a8, color2: 0xd8f3de, spread: 1.6, up: 2.2, life: 1.2, grav: -6,
          });
          sfx('loss', { size });
          if (size > 1.35) this.shakeIt(Math.min(0.5, (size - 1.35) * 0.8));
        }
        break;
      }
      case 'card': {
        sfx('card');
        this.focusTile(s.players[d.player]?.pos ?? 0, 14);
        break;
      }
      case 'fx:buy': {
        sfx('buy');
        this.board.highlight(d.tile, '#7dff9e');
        this.particles.burst(tilePos(d.tile).clone().setY(1), { count: 44, color: 0x7dff9e, color2: 0xffd32a });
        setTimeout(() => this.board.clearHighlight(d.tile), 2200);
        this.board.sync();
        break;
      }
      case 'auction:win': {
        sfx('gavel');
        this.particles.burst(tilePos(d.tile).clone().setY(1), { count: 30, color: 0x7ee3ff, color2: 0xffffff });
        this.board.sync();
        break;
      }
      case 'fx:rent': {
        sfx('rent');
        const from = P(d.from)?.position.clone() || tilePos(0);
        const to = P(d.to)?.position.clone() || from.clone();
        // bills fly from the payer toward the landlord, then the landlord's coin fountain
        this.particles.burst(from.clone().setY(1), { count: 12, color: 0xffd32a, shape: 'coin', spread: 1.3, up: 3.6 });
        this.floaters.add(`−${money(d.amount).slice(1)}`, from.clone(), { color: '#ff8a8a', size: 1.05, pop: 0.6, drop: true, life: 1.5 });
        setTimeout(() => {
          this.particles.burst(to.clone().setY(1), { count: 18, color: 0xffd32a, shape: 'coin', spread: 1.1, up: 4.2, life: 1.1 });
          this.floaters.add(`+${money(d.amount).slice(1)}`, to.clone(), { color: '#8dffb4', size: 1.15, pop: 0.7, life: 1.6 });
        }, 260);
        break;
      }
      case 'fx:build': {
        sfx('build');
        this.board.setLevel(d.tile, d.level, true);
        this.focusTile(d.tile, 10);
        break;
      }
      case 'fx:sell': {
        sfx('demolish');
        this.board.setLevel(d.tile, d.level, true);
        break;
      }
      case 'fx:mortgage': case 'fx:unmortgage': {
        this.board.sync();
        break;
      }
      case 'fx:jail': {
        sfx('jail');
        await this.tokens.sendToJail(d.player);
        this.focusTile(13, 12);
        break;
      }
      case 'fx:seal': {
        sfx('seal');
        this.floaters.add('◈ SEAL', P(d.player)?.position.clone(), { color: '#7ee3ff' });
        break;
      }
      case 'fx:promote': {
        sfx('promote');
        this.tokens.pulse(d.player);
        this.particles.burst(P(d.player).position.clone().setY(1.4), { count: 50, color: 0xb48cff, color2: 0xffd32a });
        break;
      }
      case 'stockPrice': {
        this.board.updateTicker();
        sfx(d.price >= (this.engine.s.stocks[d.dist]?.par ?? 0) ? 'stockUp' : 'stockDown');
        break;
      }
      case 'stock': { this.board.updateTicker(); break; }
      case 'pyramid:state': {
        this.board.setPyramidHype(this.engine.s.pyramid.hype);
        this.board.updateTicker();
        break;
      }
      case 'fx:pyramidYield': {
        this.particles.burst(P(d.player).position.clone().setY(1.4), { count: 26, color: 0xff9de2, color2: 0xff5ec8, shape: 'coin' });
        this.floaters.add(`🔺 +$${d.amount}`, P(d.player).position.clone(), { color: '#ff9de2' });
        break;
      }
      case 'fx:pyramidCollapse': {
        sfx('collapse'); sfx('shock');
        this.shakeIt(1.4);
        const pp = pyramidPos();
        this.shocks.add(new THREE.Vector3(pp.x, 0, pp.z), 0xff5ec8, 26);
        this.particles.burst(new THREE.Vector3(pp.x, 3, pp.z), { count: 90, color: 0xff5ec8, color2: 0x2a2a3a, spread: 7, up: 8, life: 2.2 });
        this.board.setPyramidHype(0);
        break;
      }
      case 'fx:freedom': {
        sfx('freedom');
        this.particles.burst(P(d.player).position.clone().setY(1.6), { count: 80, color: 0xffffff, color2: 0xffd32a, up: 7, life: 2 });
        this.floaters.add('🕊️ FREEDOM!', P(d.player).position.clone(), { color: '#ffffff', size: 1.6 });
        break;
      }
      case 'fx:dream': {
        sfx('win');
        this.particles.burst(P(d.player).position.clone().setY(1.6), { count: 110, color: 0xff5e7a, color2: 0x7ee3ff, up: 9, life: 2.6 });
        break;
      }
      case 'fx:demolish': {
        sfx('demolish');
        this.particles.burst(tilePos(d.tile).clone().setY(1), { count: 36, color: 0x8b93a7, color2: 0x4a4f63, spread: 2.4 });
        this.board.sync();
        break;
      }
      case 'fx:swap': { this.board.sync(); break; }
      case 'fx:equalizer': { this.shakeIt(0.5); sfx('shock'); break; }
      case 'fx:storm': { this.shakeIt(0.4); break; }
      case 'fx:casino': {
        sfx('casino');
        await this.dice.roll([Math.ceil(d.r / 2), Math.floor(d.r / 2) + (d.r % 2 ? 0 : 0)]);
        break;
      }
      case 'fx:spin': {
        await this.spinWheelUI(d);
        break;
      }
      case 'fx:transfer': {
        sfx('teleport');
        this.floaters.add('🚉 RING CHANGE', P(d.player)?.position.clone(), { color: '#5ec8ff' });
        break;
      }
      case 'fx:roadblock': {
        sfx('build');
        this.board.setRoadblock(d.tile, '#ff7a1a');
        break;
      }
      case 'fx:item': { sfx('item'); break; }
      case 'fx:bankrupt': {
        sfx('lose');
        this.tokens.sink(d.player);
        this.shakeIt(0.9);
        // full-screen bankruptcy drama
        const ov = document.createElement('div');
        const name = this.engine?.s.players[d.player]?.name || 'A tycoon';
        ov.style.cssText = 'position:absolute;inset:0;z-index:35;display:flex;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(ellipse at center, rgba(120,0,0,0.55), rgba(20,0,0,0.85));animation:bkIn 0.4s ease;';
        ov.innerHTML = `<div style="font-family:Georgia,serif;font-size:72px;font-weight:900;color:#ffdada;text-shadow:0 6px 40px rgba(255,0,0,0.7);letter-spacing:6px;">BANKRUPT</div>
          <div style="color:#ffb1b1;font-size:22px;margin-top:12px;letter-spacing:2px;">${name}'s empire has fallen</div>`;
        document.getElementById('app').appendChild(ov);
        setTimeout(() => { ov.style.transition = 'opacity 0.8s'; ov.style.opacity = '0'; setTimeout(() => ov.remove(), 850); }, 2600);
        break;
      }
      case 'fx:lap': { break; }
      case 'turnStart': {
        this.currentPlayer = d.player;
        this.moveCine = false;
        clearTimeout(this._cineTimer);
        this.cameraGoal.lerp = 0.045;
        this.followPlayer(d.player);
        break;
      }
      case 'win': {
        sfx('win');
        this.tokens.celebrate(d.player);
        this.focusTile(this.engine.s.players[d.player].pos, 16);
        for (let k = 0; k < 5; k++) {
          setTimeout(() => this.particles.burst(new THREE.Vector3((Math.random() - 0.5) * 26, 1, (Math.random() - 0.5) * 26), { count: 60, color: 0xffd32a, color2: 0xff5e7a, up: 9, life: 2.6 }), k * 400);
        }
        break;
      }
      case 'fx:targetHit': {
        this.floaters.add('🎯 TARGET!', P(d.player)?.position.clone(), { color: '#ffd32a', size: 1.5 });
        sfx('promote');
        break;
      }
      case 'debt': { sfx('debt'); this.shakeIt(0.3); break; }
      default: break;
    }
  }

  // Lucky Spin: animated prize wheel overlay (result pre-picked by the engine)
  async spinWheelUI(d) {
    const pace = this.pace || 1;
    const segs = d.segments;
    const n = segs.length;
    const segAngle = (Math.PI * 2) / n;
    // land on the chosen segment's center (pointer at top = -PI/2)
    const targetAngle = -Math.PI / 2 - (d.index + 0.5) * segAngle;
    const turns = 5;
    const total = targetAngle + turns * Math.PI * 2;
    const dur = 3000 / pace;

    const ov = document.createElement('div');
    ov.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,0.45);z-index:25;';
    const cv = document.createElement('canvas');
    const size = Math.min(380, window.innerHeight * 0.42);
    cv.width = size * 2; cv.height = size * 2;
    cv.style.cssText = `width:${size}px;height:${size}px;filter:drop-shadow(0 18px 50px rgba(0,0,0,0.7));`;
    ov.appendChild(cv);
    document.getElementById('app').appendChild(ov);

    const ctx = cv.getContext('2d');
    const R = size * 2 - 8;
    const cx = size, cy = size;
    const drawWheel = (rot) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      for (let i = 0; i < n; i++) {
        const a0 = i * segAngle - Math.PI / 2 - segAngle / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R / 2, a0, a0 + segAngle);
        ctx.closePath();
        ctx.fillStyle = segs[i].color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(10,12,22,0.9)';
        ctx.lineWidth = 4;
        ctx.stroke();
        // label
        ctx.save();
        ctx.rotate(a0 + segAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0b0d16';
        ctx.font = 'bold 34px "Segoe UI", Arial';
        ctx.fillText(segs[i].short, R / 2 - 26, 12);
        ctx.restore();
      }
      // hub
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#10131f'; ctx.fill();
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 8; ctx.stroke();
      ctx.restore();
      // pointer
      ctx.save();
      ctx.translate(cx, 24);
      ctx.beginPath();
      ctx.moveTo(-22, -14); ctx.lineTo(22, -14); ctx.lineTo(0, 34);
      ctx.closePath();
      ctx.fillStyle = '#ffd76a';
      ctx.fill();
      ctx.strokeStyle = '#0b0d16'; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    };

    // animate with ease-out + tick sfx at segment boundaries
    const start = performance.now();
    let lastTickSeg = -1;
    await new Promise((resolve) => {
      const frame = () => {
        const t = Math.min(1, (performance.now() - start) / dur);
        const k = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const rot = total * k;
        drawWheel(rot);
        const segUnderPointer = Math.abs(Math.round(((-rot - Math.PI / 2) / segAngle - 0.5) % n)) % n;
        if (segUnderPointer !== lastTickSeg) { lastTickSeg = segUnderPointer; try { getSfx()?.play('tick'); } catch { } }
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const won = segs[d.index];
    try { getSfx()?.play(won.id === 'jackpot' ? 'jackpot' : won.id === 'pay200' || won.id === 'jail' ? 'debt' : 'buy'); } catch { }
    // banner with the result
    this.floaters.add(`🎡 ${won.label}`, this.tokens?.meshes[d.player]?.position.clone() || tilePos(0), { color: won.color, size: 1.4, life: 2.2 });
    await new Promise(r => setTimeout(r, 650 / pace));
    ov.style.transition = 'opacity 0.35s';
    ov.style.opacity = '0';
    setTimeout(() => ov.remove(), 400);
  }

  bindEngine(engine) {
    const evts = ['rolled', 'moveStep', 'tileLand', 'cash', 'card', 'fx:buy', 'fx:rent', 'fx:build', 'fx:sell',
      'fx:mortgage', 'fx:unmortgage', 'fx:jail', 'fx:seal', 'fx:promote', 'stockPrice', 'stock', 'pyramid:state',
      'fx:pyramidYield', 'fx:pyramidCollapse', 'fx:freedom', 'fx:dream', 'fx:demolish', 'fx:swap', 'fx:equalizer',
      'fx:storm', 'fx:casino', 'fx:roadblock', 'fx:item', 'fx:bankrupt', 'fx:lap', 'turnStart', 'win', 'fx:targetHit',
      'debt', 'auction:win', 'fx:transfer', 'fx:spin'];
    for (const e of evts) engine.on(e, (d) => this.push(e, d));
  }
}

import { getSfx } from '../audio/sfx.js?v=8';
function sfx(name) { try { getSfx()?.play(name); } catch { } }
