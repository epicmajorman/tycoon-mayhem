// The board: even-spaced concentric rings raised as a ziggurat, sourced-art tile faces,
// owner bands + mortgage stamps, ocean + dusk sky environment with palms and boats.
import * as THREE from 'three';
import { TILES, DISTRICTS, D, DISTRICT_TILES, CORNER_SEALS, RING_META, SEAL_INFO, ringOf } from '../data/board.js?v=8';
import { canvasTex, windowTexture } from './textures.js?v=8';
import { tileFace } from './propertyArt.js?v=8';
import { onIconsReady } from './icons.js?v=8';
import { tween } from './fx.js?v=8';

export const HALF = 17.5; // legacy alias
let RING_Y = [];
const RING_GEO = [];

export function tilePos(i) {
  const r = ringOf(i);
  const G = RING_GEO[r] || { half: 15.73, step: 2.42, y: 0, ts: 2.3 };
  const m = RING_META[r];
  const k = i - m.base;
  const tps = m.size / 4;
  const side = Math.floor(k / tps);
  const q = k % tps;
  // center-line offset: each side spans tps gaps (corner tile -> tps-1 side tiles -> next
  // corner), so corners sit exactly one step apart from their neighbours — one tile per
  // corner, no doubles, no overlaps.
  const h = G.half;
  const d = h - q * G.step;
  if (side === 0) return new THREE.Vector3(d, G.y, h);
  if (side === 1) return new THREE.Vector3(-h, G.y, d);
  if (side === 2) return new THREE.Vector3(-d, G.y, -h);
  return new THREE.Vector3(h, G.y, -d);
}
export const isCornerTile = (i) => {
  const m = RING_META[ringOf(i)];
  return (i - m.base) % (m.size / 4) === 0;
};
export const tileFootprint = (i) => RING_META[ringOf(i)].tile;

export function initRingGeometry() {
  RING_Y = RING_META.map((_, r) => r * 0.26);
  RING_GEO.length = 0;
  // every tile AND corner is the same size on every ring, evenly spaced —
  // a perfectly consistent square grid look on all three boards
  const ts = 2.3, g = 0.12;
  RING_META.forEach((m, r) => {
    const tps = m.size / 4;
    const half = (tps / 2) * (ts + g);
    RING_GEO.push({ base: m.base, ts, g, step: ts + g, half, y: RING_Y[r], tps });
  });
}

const RINGS = () => RING_META.length;
const topRingY = () => RING_Y[RING_Y.length - 1];
export function centerBudget() { return RINGS() > 1 ? (RING_GEO[RING_GEO.length - 1]?.half ?? 10.9) - 1.55 : 15; }
export function centerQuadrant() { return centerBudget() * 0.42; }
export function unitScale() { return centerBudget() / 6; }
export function diceHome() {
  const q = centerQuadrant();
  return new THREE.Vector3(q, topRingY() + 0.9, -q);
}
export function pyramidPos() { const q = centerQuadrant(); return new THREE.Vector3(q, topRingY(), q); }
export function poolPos() { const q = centerQuadrant(); return new THREE.Vector3(-q, topRingY(), q); }
export function jumboPos() { const q = centerQuadrant(); return new THREE.Vector3(-q, topRingY(), -q); }
export function overviewFor() {
  const ext = (RING_GEO[0]?.half ?? 15.73) + 1.2;
  const n = RINGS();
  if (n === 1) return { pos: new THREE.Vector3(0, ext * 1.85, ext * 1.5), target: new THREE.Vector3(0, 0.5, 0) };
  if (n === 2) return { pos: new THREE.Vector3(0, ext * 2.45, ext * 1.95), target: new THREE.Vector3(0, 0.8, 0) };
  return { pos: new THREE.Vector3(0, ext * 3.0, ext * 2.4), target: new THREE.Vector3(0, 1.1, 0) };
}

const SPECIAL_COLORS = {
  start: '#2ee6a8', jail: '#8b93a7', exchange: '#7ee3ff', casino: '#ff5e7a',
  tax: '#c9a227', fortune: '#b48cff', frenzy: '#ff8f3f', doodad: '#ff6b9d',
  pool: '#59d46b', gotojail: '#e04545', pyramid: '#ff9de2', transit: '#5ec8ff',
};

// sourced game-icons artwork per tile type (assets/icons, CC BY 3.0 — see CREDITS.md)
const TYPE_ICONS = {
  start: 'start', jail: 'jail', gotojail: 'gotojail', exchange: 'exchange', casino: 'casino',
  fortune: 'fortune', frenzy: 'frenzy', doodad: 'doodad', pool: 'pool', pyramid: 'pyramid',
  transit: 'transit',
};
export function tileIconFile(t) {
  if (t.type === 'property') return `d_${t.district}`;
  if (t.type === 'tax') return t.name === 'Luxury Tax' ? 'luxury' : 'tax';
  return TYPE_ICONS[t.type] || 'exchange';
}
const SPECIAL_ICONS = {
  start: '🚀', jail: '⛓️', exchange: '📈', casino: '🎲', tax: '🏛️', fortune: '🎁',
  frenzy: '⚡', doodad: '🛍️', pool: '⛲', gotojail: '🚨', pyramid: '🔺', transit: '🚉',
};

export class Board3D {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    initRingGeometry();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.tiles = [];
    this.buildings = [];
    this.owners = [];
    this.highlights = new Map();
    this.sealMeshes = {};
    this.tickerCanvas = document.createElement('canvas');
    this.tickerCanvas.width = 512;
    this.tickerCanvas.height = Math.min(512, 44 + Math.ceil(DISTRICTS.length / (DISTRICTS.length > 12 ? 3 : 2)) * 30 + 44);
    this.tickerTex = new THREE.CanvasTexture(this.tickerCanvas);
    this.pyramidHolo = null;
    this.build();
  }

  build() {
    const extent = RING_GEO[0].half + RING_GEO[0].ts / 2;
    const pad = 2.2; // wide sandy beach margin around the felt, toy-boardgame style
    const outer = extent + pad;
    // island base: rippled sand
    const sandMap = canvasTex(256, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#f4e6bc'); g.addColorStop(1, '#e8d49e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(215,190,140,0.5)' : 'rgba(250,240,214,0.5)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
      }
      ctx.strokeStyle = 'rgba(186, 156, 104, 0.22)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 11; i++) {
        const y = 12 + i * 22 + Math.random() * 8;
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
        ctx.stroke();
      }
    });
    sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping;
    sandMap.repeat.set(6, 6);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(outer * 2, 1.5, outer * 2),
      new THREE.MeshStandardMaterial({ map: sandMap, roughness: 0.92 })
    );
    base.position.y = -0.8;
    this.group.add(base);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(outer * 2 + 0.3, 0.3, outer * 2 + 0.3),
      new THREE.MeshStandardMaterial({ color: '#c8a06a', roughness: 0.75 })
    );
    trim.position.y = -0.22;
    this.group.add(trim);
    // raised ziggurat platforms for inner rings
    for (let r = 1; r < RING_META.length; r++) {
      const w = (RING_GEO[r].half + RING_GEO[r].ts / 2 + 0.35) * 2;
      const stoneMap = canvasTex(256, 256, (ctx) => {
        ctx.fillStyle = '#f0e9d4'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = Math.random() < 0.5 ? 'rgba(190,178,148,0.4)' : 'rgba(255,252,240,0.5)';
          ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
        }
        ctx.strokeStyle = 'rgba(150,136,104,0.3)'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 7; i++) {
          let x = Math.random() * 256, y = Math.random() * 256;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      });
      stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
      stoneMap.repeat.set(3, 3);
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(w, RING_Y[r] + 0.3, w),
        new THREE.MeshStandardMaterial({ map: stoneMap, roughness: 0.88 })
      );
      slab.position.y = RING_Y[r] - (RING_Y[r] + 0.3) / 2 + 0.02;
      this.group.add(slab);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.12, 0.09, w + 0.12),
        new THREE.MeshBasicMaterial({ color: '#c9a24a' })
      );
      edge.position.y = RING_Y[r] + 0.04;
      this.group.add(edge);
    }
    // painted felt: mottled toy-grass cloth
    const feltTex = canvasTex(512, 512, (ctx) => {
      ctx.fillStyle = '#43b45e'; ctx.fillRect(0, 0, 512, 512);
      // organic light/dark patches first
      for (let i = 0; i < 42; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 18 + Math.random() * 52;
        const rg = ctx.createRadialGradient(x, y, 2, x, y, r);
        const dark = Math.random() < 0.5;
        rg.addColorStop(0, dark ? 'rgba(38,132,72,0.30)' : 'rgba(120,214,140,0.22)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      // mow stripes for that tended-lawn read
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i += 2) ctx.fillRect(0, i * 64, 512, 32);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 2600; i++) {
        ctx.globalAlpha = 0.05 + Math.random() * 0.09;
        ctx.fillStyle = Math.random() < 0.5 ? '#2f9a4c' : '#5ecb74';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2.2, 2.2);
      }
      ctx.globalAlpha = 1;
      const v = ctx.createRadialGradient(256, 256, 150, 256, 256, 360);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,60,26,0.28)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, 512, 512);
    });
    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(RING_GEO[0].half * 2 + RING_GEO[0].ts + 0.4, 0.1, RING_GEO[0].half * 2 + RING_GEO[0].ts + 0.4),
      new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.92 })
    );
    felt.position.y = -0.04;
    this.group.add(felt);

    for (let i = 0; i < TILES.length; i++) {
      const t = TILES[i];
      const pos = tilePos(i);
      const size = tileFootprint(i);
      const isProp = t.type === 'property';
      const dist = isProp ? DISTRICTS[D[t.district]] : null;
      const accent = isProp ? dist.color : (SPECIAL_COLORS[t.type] || '#555');
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(size - 0.12, 0.34, size - 0.12),
        new THREE.MeshStandardMaterial({ color: '#efe9d8', roughness: 0.65 })
      );
      slab.position.copy(pos); slab.position.y = pos.y + 0.17;
      this.group.add(slab);
      const faceOpts = {
        accent,
        districtName: dist ? dist.name : '',
        iconFile: tileIconFile(t),
      };
      const topTex = tileFace(t, faceOpts);
      const cardSide = new THREE.MeshStandardMaterial({ color: '#e2dbc6', roughness: 0.65 });
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(size - 0.14, 0.1, size - 0.14),
        [cardSide, cardSide,
         new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.66, metalness: 0.0 }),
         cardSide, cardSide, cardSide]
      );
      top.position.copy(pos); top.position.y = pos.y + 0.39;
      // uniform orientation: on screen, all names read upright from the default camera
      // (a real table's per-side rotation leaves three of four sides illegible)
      top.userData.faceOpts = faceOpts;
      top.userData.faceKey = '';
      this.group.add(top);
      this.tiles.push(top);
      top.userData.baseEmissive = { color: accent, intensity: isProp ? 0.03 : 0.06 };
      const beacon = new THREE.Mesh(
        new THREE.RingGeometry(size * 0.3, size * 0.42, 28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
      );
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.copy(pos); beacon.position.y = pos.y + 0.45;
      beacon.visible = false;
      this.group.add(beacon);
      this.owners.push(beacon);
      const bGroup = new THREE.Group();
      bGroup.position.copy(pos);
      bGroup.userData.scale = 1.0;
      bGroup.userData.targetScale = 1.0;
      this.group.add(bGroup);
      this.buildings.push(bGroup);
      if (CORNER_SEALS[i]) {
        const info = SEAL_INFO[CORNER_SEALS[i]];
        const seal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5),
          new THREE.MeshStandardMaterial({ color: info.color, emissive: info.color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.6 })
        );
        seal.position.copy(pos); seal.position.y = pos.y + 3.1;
        this.group.add(seal);
        this.sealMeshes[CORNER_SEALS[i] + '_' + i] = seal;
      }
    }
    this.buildCenter();
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // if any face rendered before the sourced artwork finished loading, repaint once it lands
    onIconsReady(() => this.redrawFaces());
  }

  // repaint every painted face from current state (used after late icon/font loads)
  redrawFaces() {
    const s = this.state;
    for (let i = 0; i < this.tiles.length; i++) {
      const top = this.tiles[i];
      if (!top) continue;
      const t = TILES[i];
      const pr = s.props[i];
      top.userData.faceKey = '';
      const mat = top.material[2];
      const old = mat.map;
      mat.map = tileFace(t, {
        ...top.userData.faceOpts,
        ownerColor: pr && pr.owner >= 0 ? s.players[pr.owner].color : null,
        mortgaged: !!(pr && pr.mortgaged),
      });
      mat.needsUpdate = true;
      if (old) old.dispose();
    }
  }

  buildCenter() {
    const g = new THREE.Group();
    this.center = g;
    g.position.y = topRingY();
    this.group.add(g);
    const u = unitScale();
    const q = centerQuadrant();
    // Pool fountain
    const pp = poolPos();
    const poolR = 1.55 * Math.max(1, u * 0.9);
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(poolR, poolR + 0.18, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: '#0f2b33', roughness: 0.3, metalness: 0.4, emissive: '#0e4b5a', emissiveIntensity: 0.5 })
    );
    pool.position.set(pp.x, 0.2, pp.z);
    g.add(pool);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(poolR - 0.25, poolR - 0.25, 0.14, 32),
      new THREE.MeshStandardMaterial({ color: '#1fb2c9', roughness: 0.1, metalness: 0.6, emissive: '#0d7f96', emissiveIntensity: 0.7 })
    );
    water.position.set(pp.x, 0.45, pp.z);
    g.add(water);
    this.poolWater = water;
    // Jumbotron billboard
    const jp = jumboPos();
    const jS = Math.max(0.75, u * 0.45);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * jS + 0.05, 0.16 * jS + 0.05, 2.6 * jS, 8),
      new THREE.MeshStandardMaterial({ color: '#181c2c', metalness: 0.6, roughness: 0.4 })
    );
    leg.position.set(jp.x, 1.3 * jS, jp.z);
    g.add(leg);
    const planeW = 5.6 * jS;
    const planeH = planeW * (this.tickerCanvas.height / this.tickerCanvas.width);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      new THREE.MeshBasicMaterial({ map: this.tickerTex })
    );
    screen.position.set(jp.x, 2.9 * jS, jp.z);
    screen.rotation.x = -0.42;
    screen.rotation.y = Math.PI / 4;
    g.add(screen);
    this.updateTicker();
    // Center logo plate
    const logoTex = canvasTex(512, 256, (ctx) => {
      ctx.fillStyle = '#276b44';
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#fdfaf1';
      ctx.textAlign = 'center';
      ctx.font = 'bold 74px Georgia, serif';
      ctx.fillText('TYCOON', 256, 108);
      ctx.font = 'bold 58px Georgia, serif';
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('M A Y H E M', 256, 180);
      ctx.strokeStyle = '#fdfaf1'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 492, 236);
    });
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(centerBudget() * 0.8, centerBudget() * 0.4),
      new THREE.MeshBasicMaterial({ map: logoTex })
    );
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(0, 0.04, 0);
    g.add(logo);

    // Pyramid hologram
    const pyp = pyramidPos();
    const pyr = new THREE.Mesh(
      new THREE.ConeGeometry(1.35 * Math.max(1, u * 0.9), 2.3 * Math.max(1, u * 0.9), 4),
      new THREE.MeshPhysicalMaterial({
        color: '#ff9de2', emissive: '#ff5ec8', emissiveIntensity: 1.2,
        transparent: true, opacity: 0.55, roughness: 0.2, clearcoat: 1,
      })
    );
    pyr.position.set(pyp.x, 1.3 * Math.max(1, u * 0.9), pyp.z);
    pyr.rotation.y = Math.PI / 4;
    g.add(pyr);
    this.pyramidHolo = pyr;
    this.pyrBaseY = pyr.position.y;
  }

  updateTicker() {
    const s = this.state;
    const ctx = this.tickerCanvas.getContext('2d');
    const W = this.tickerCanvas.width, H = this.tickerCanvas.height;
    ctx.fillStyle = '#0a0c16';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1c2236'; ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = '#7ee3ff'; ctx.font = 'bold 26px Arial Black, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`LAP ${s.lap}  ·  TYCOON MAYHEM EXCHANGE`, 16, 31);
    const cols = DISTRICTS.length > 12 ? 3 : 2;
    const colW = (W - 24) / cols;
    ctx.font = 'bold 20px Consolas, monospace';
    DISTRICTS.forEach((d, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 16 + col * colW;
      const yy = 74 + row * 30;
      if (yy > H - 20) return;
      const st = s.stocks[d.id];
      const up = st.price >= st.par;
      ctx.fillStyle = up ? '#59d46b' : '#ff5e5e';
      ctx.fillText(`${d.name.slice(0, 10).padEnd(10)}`, x, yy);
      ctx.fillStyle = '#e8ecff';
      ctx.fillText(`$${String(st.price).padStart(3)}`, x + colW - 62, yy);
      ctx.fillStyle = up ? '#59d46b' : '#ff5e5e';
      ctx.fillText(`${up ? '▲' : '▼'}`, x + colW - 20, yy);
    });
    ctx.fillStyle = '#ffd32a'; ctx.font = 'bold 22px Consolas, monospace';
    const footY = H - 16;
    ctx.fillText(`POOL $${s.pool.toLocaleString()}`, 16, footY);
    if (s.flags.pyramid) {
      ctx.fillStyle = '#ff9de2';
      ctx.fillText(`UPSTONE HYPE ${Math.round(s.pyramid.hype)}%`, 200, footY);
      ctx.fillStyle = '#241a2c'; ctx.fillRect(400, footY - 16, 96, 18);
      ctx.fillStyle = '#ff5ec8'; ctx.fillRect(400, footY - 16, 96 * s.pyramid.hype / 100, 18);
    }
    this.tickerTex.needsUpdate = true;
  }

  sync() {
    const s = this.state;
    for (let i = 0; i < TILES.length; i++) {
      const t = TILES[i];
      if (t.type !== 'property') continue;
      const pr = s.props[i];
      const beacon = this.owners[i];
      if (pr.owner >= 0) {
        beacon.visible = true;
        beacon.material.color.set(s.players[pr.owner].color);
        beacon.material.opacity = pr.mortgaged ? 0.25 : 0.8;
      } else beacon.visible = false;
      this.setLevel(i, pr.level, false);
      // the painted face carries the owner band + mortgage stamp — repaint on change
      const key = `${pr.owner}|${pr.mortgaged ? 1 : 0}`;
      const top = this.tiles[i];
      if (top && top.userData.faceKey !== key) {
        top.userData.faceKey = key;
        const mat = top.material[2];
        const old = mat.map;
        mat.map = tileFace(t, {
          ...top.userData.faceOpts,
          ownerColor: pr.owner >= 0 ? s.players[pr.owner].color : null,
          mortgaged: !!pr.mortgaged,
        });
        mat.needsUpdate = true;
        if (old) old.dispose();
      }
    }
    this.updateTicker();
  }

  setLevel(i, level, animate = true) {
    const bGroup = this.buildings[i];
    if (!bGroup || bGroup.userData.level === level) return;
    bGroup.userData.level = level;
    while (bGroup.children.length) bGroup.remove(bGroup.children[0]);
    const t = TILES[i];
    const dist = DISTRICTS[D[t.district]];
    if (level <= 0) return;
    const sc = bGroup.userData.targetScale;
    if (level < 5) {
      for (let k = 0; k < level; k++) {
        const house = makeHouse(dist.color);
        const ang = -0.9 + k * 0.6;
        house.position.set(Math.sin(ang) * 0.72, 0.42, -Math.cos(ang) * 0.72);
        house.scale.setScalar(sc);
        bGroup.add(house);
        if (animate) pop(house, sc);
      }
    } else if (level === 5) {
      const hotel = makeHotel(dist.color);
      hotel.position.y = 0.5;
      hotel.scale.setScalar(sc);
      bGroup.add(hotel);
      if (animate) pop(hotel, sc);
    } else {
      const sky = makeSkyscraper(dist.color);
      sky.position.y = 1.55 * sc;
      sky.scale.setScalar(sc);
      bGroup.add(sky);
      if (animate) pop(sky, sc);
    }
  }

  highlight(i, color = '#ffffff', strong = true) {
    this.clearHighlight(i);
    const t = this.tiles[i];
    if (!t) return;
    const mat = t.material[2] || t.material;
    mat.emissive = mat.emissive || new THREE.Color();
    mat.emissive.set(color);
    mat.emissiveIntensity = strong ? 0.5 : 0.25;
    this.highlights.set(i, { mat });
  }
  clearHighlight(i) {
    const h = this.highlights.get(i);
    if (h) { h.mat.emissive.set(0x000000); h.mat.emissiveIntensity = 0; this.highlights.delete(i); }
  }
  clearAllHighlights() { for (const i of [...this.highlights.keys()]) this.clearHighlight(i); }

  setRoadblock(tile, ownerColor) {
    this.removeRoadblock(tile);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff7a1a', emissiveIntensity: 0.6, roughness: 0.4 })
    );
    const p = tilePos(tile);
    cone.position.set(p.x, p.y + 0.85, p.z);
    this.group.add(cone);
    this.roadblocks = this.roadblocks || {};
    this.roadblocks[tile] = cone;
  }
  removeRoadblock(tile) {
    if (this.roadblocks && this.roadblocks[tile]) {
      this.group.remove(this.roadblocks[tile]);
      delete this.roadblocks[tile];
    }
  }

  setPyramidHype(hype) {
    if (!this.pyramidHolo) return;
    const k = 0.45 + (hype / 100) * 0.95;
    tween(0.5, (t) => {
      const s = 0.5 + (k - 0.5) * t;
      this.pyramidHolo.scale.set(s, s, s);
      this.pyramidHolo.material.opacity = 0.25 + (hype / 100) * 0.55 * t;
      this.pyramidHolo.material.emissiveIntensity = 0.6 + (hype / 100) * 1.6;
    });
    this.pyramidHolo.visible = this.state.flags.pyramid;
  }

  update(dt, time) {
    for (const k in this.sealMeshes) this.sealMeshes[k].rotation.y += dt * 1.2;
    if (this.poolWater) this.poolWater.material.emissiveIntensity = 0.55 + Math.sin(time * 2.4) * 0.2;
    if (this.pyramidHolo && this.pyramidHolo.visible) {
      this.pyramidHolo.rotation.y += dt * (0.3 + (this.state.pyramid.hype / 100) * 1.4);
      this.pyramidHolo.position.y = this.pyrBaseY + Math.sin(time * 1.4) * 0.2;
    }
  }
}

// ---------- building factories ----------
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return c;
}
function makeHouse(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.5),
    new THREE.MeshStandardMaterial({ color: shade(color, 0.25), roughness: 0.5, emissive: color, emissiveIntensity: 0.12 }));
  body.position.y = 0.23;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 4),
    new THREE.MeshStandardMaterial({ color: shade(color, -0.18), roughness: 0.55 }));
  roof.position.y = 0.64; roof.rotation.y = Math.PI / 4;
  g.add(body, roof);
  return g;
}
function makeHotel(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.9),
    new THREE.MeshStandardMaterial({ color: shade(color, 0.18), roughness: 0.42, metalness: 0.2, emissive: color, emissiveIntensity: 0.16 }));
  body.position.y = 0.52;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: shade(color, -0.25), roughness: 0.5, emissive: color, emissiveIntensity: 0.25 }));
  roof.position.y = 1.1;
  g.add(body, roof);
  return g;
}
function makeSkyscraper(color) {
  const g = new THREE.Group();
  const tex = windowTexture('#ffd98a');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.56, 2.9, 6),
    new THREE.MeshStandardMaterial({ color: shade(color, -0.05), roughness: 0.35, metalness: 0.5, emissiveMap: tex, emissive: '#fff', emissiveIntensity: 0.9 }));
  body.position.y = 1.45;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.65, 6),
    new THREE.MeshStandardMaterial({ color: shade(color, 0.3), emissive: color, emissiveIntensity: 0.9 }));
  tip.position.y = 3.2;
  g.add(body, tip);
  return g;
}
function pop(obj, targetScale) {
  obj.scale.setScalar(0.01);
  tween(0.5, (t) => {
    const overshoot = 1 + Math.sin(t * Math.PI) * 0.22;
    obj.scale.setScalar(Math.max(0.01, t * targetScale * overshoot));
  }, 'out');
}

// ---------- environment: dusk sky, sun, animated ocean, palms, boats ----------
let envUpdate = null;
export function updateEnvironment(t) { if (envUpdate) envUpdate(t); }

export function buildEnvironment(scene) {
  const ext0 = RING_META.length ? RING_META[0].half : 17.5;
  const group = new THREE.Group();
  scene.add(group);
  const skyTex = canvasTex(1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#2e7cd6'); g.addColorStop(0.55, '#6ab8f0'); g.addColorStop(0.8, '#a8ddf8'); g.addColorStop(1, '#ffeccf');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
    // a few faint stars high up keep the top from feeling empty
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.12 + Math.random() * 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.random() * 1024, Math.random() * 120, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    // puffy cumulus clusters, painted
    const cloud = (cx, cy, s) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      const blobs = [[0, 0, 34], [30, 6, 26], [-30, 8, 24], [12, -16, 24], [-14, -12, 20], [46, 12, 16]];
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.92;
      for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); }
      // soft shaded underside
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#7ea8d8';
      for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx, by + br * 0.42, br * 0.8, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.globalAlpha = 1;
    };
    cloud(140, 110, 1.2); cloud(420, 70, 0.9); cloud(700, 130, 1.35); cloud(950, 90, 0.85);
    cloud(260, 180, 0.7); cloud(600, 200, 0.75); cloud(880, 200, 0.6);
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(260, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  group.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
      g.addColorStop(0, '#fff6d8'); g.addColorStop(0.3, 'rgba(255,210,130,0.9)'); g.addColorStop(1, 'rgba(255,180,100,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    }),
    transparent: true, fog: false, depthWrite: false,
  }));
  sun.scale.set(120, 120, 1);
  sun.position.set(-120, 36, -180);
  group.add(sun);
  const oceanGeo = new THREE.PlaneGeometry(560, 560, 48, 48);
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color('#bfe4f2') },
      uFogNear: { value: 55 },
      uFogFar: { value: 150 },
    },
    vertexShader: `
      uniform float uTime;
      varying float vW;
      varying vec2 vWorld;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.06 + uTime * 0.8) * 0.5 + cos(p.y * 0.05 + uTime * 0.6) * 0.5;
        p.z += w;
        vW = w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying float vW;
      varying vec2 vWorld;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      void main() {
        float d = length(vWorld);
        // lagoon: bright shallow turquoise hugging the island, deepening to open sea
        float shallow = 1.0 - smoothstep(20.0, 55.0, d);
        vec3 deep = vec3(0.03, 0.30, 0.55);
        vec3 lagoon = vec3(0.32, 0.83, 0.86);
        vec3 c = mix(deep, lagoon, shallow);
        c = mix(c, vec3(0.5, 0.92, 0.9), shallow * (vW * 0.5 + 0.5) * 0.25); // wave shimmer in the shallows
        c += vec3(1.0, 1.0, 0.9) * max(0.0, vW) * 0.14; // sun glitter
        // manual fog: the sea must haze into the horizon like everything else
        float fogDist = length(vWorld - cameraPosition.xz);
        float f = smoothstep(uFogNear, uFogFar, fogDist);
        c = mix(c, uFogColor, f);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.35;
  group.add(ocean);
  // foam ring where the island meets the water
  const foamTex = canvasTex(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.7 - i * 0.2;
      ctx.lineWidth = 10 - i * 3;
      ctx.setLineDash([26 + i * 12, 18 + i * 10]);
      ctx.strokeRect(40 + i * 14, 40 + i * 14, 432 - i * 28, 432 - i * 28);
    }
  });
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(ext0 + 2.3, ext0 + 3.7, 64),
    new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = -1.22;
  group.add(foam);
  // real foliage: CC0 Quaternius nature models (assets/models) instanced densely on
  // grass islets + shore palms + water rocks. Loads async; ocean stays instant.
  import('./foliage.js?v=8').then(({ buildFoliage }) => {
    // RING_GEO is populated by the time matches rebuild the environment; the fallback
    // covers the very first (menu) build before a board is active
    const islandOuter = (RING_GEO[0] ? RING_GEO[0].half + RING_GEO[0].ts / 2 : 16.9) + 2.2;
    try { buildFoliage(scene, group, islandOuter); } catch (e) { console.warn('foliage failed', e); }
  });
  const boats = [];
  for (let i = 0; i < 3; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.3, 4, 10), new THREE.MeshStandardMaterial({ color: ['#e8e2d0', '#c95e4a', '#4a8ac9'][i], roughness: 0.5 }));
    hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.5); hull.position.y = 0.15;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 4), new THREE.MeshStandardMaterial({ color: '#f4f6ff', roughness: 0.6, side: THREE.DoubleSide }));
    sail.position.y = 0.9; sail.rotation.y = Math.PI / 4;
    boat.add(hull, sail);
    const ang = i * 2.1 + 1;
    boat.position.set(Math.cos(ang) * (ext0 + 8), -1.15, Math.sin(ang) * (ext0 + 8));
    boat.rotation.y = Math.random() * 6;
    group.add(boat);
    boats.push(boat);
  }
  envUpdate = (t) => {
    oceanMat.uniforms.uTime.value = t;
    boats.forEach((b, i) => { b.position.y = -1.15 + Math.sin(t * 1.1 + i * 2) * 0.12; b.rotation.z = Math.sin(t * 0.9 + i) * 0.05; });
    foam.rotation.z = t * 0.02;
    foam.material.opacity = 0.7 + Math.sin(t * 1.3) * 0.15;
  };
  return [group];
}
