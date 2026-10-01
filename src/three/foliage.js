// Real foliage — CC0 low-poly nature models (Quaternius via poly.pizza, CC0/CC-BY —
// see assets/models/CREDITS.md) scattered densely on grass islets around the island.
// Each source model is normalized, then instanced, so ~300 plants cost a handful of
// draw calls. Falls back silently to the procedural greenery if models fail to load.
import * as THREE from 'three';
import { canvasTex } from './textures.js?v=8';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';

// file -> [node names to use, target height in world units]
const SOURCES = [
  ['n8.glb',  /^PalmTree/, 3.1],
  ['n9.glb',  /^NormalTree/, 2.9],
  ['n12.glb', /^PineTree/, 3.0],
  ['n11.glb', /^MapleTree/, 2.7],
  ['n6.glb',  /^BirchTree/, 2.8],
  ['n4.glb',  /^Bush/, 0.85],
  ['n10.glb', /^Rock/, 0.75],
  ['n7.glb',  /^Grass/, 0.42],
  ['n5.glb',  /^Flower/, 0.5],
  ['n1.glb',  /^(Plant|Petals)/, 0.55],
];

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; return (s % 100000) / 100000; };
}

// bake a node's meshes into WORLD space (preserving every authored rotation — baking into
// node-local space is what made trees lie down), then normalize: centered on X/Z, grounded
// at Y=0, scaled to targetH.
function extractEntries(root, nameRe, targetH) {
  const entries = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    // model nodes may be Groups (trunk + canopy sub-meshes with suffixed names like
    // BirchTree_3_1) or single meshes — match the top-most named node of either shape
    if (!nameRe.test(node.name) || node.userData._used) return;
    if (node.parent && nameRe.test(node.parent.name)) return;
    const meshes = [];
    node.traverse((m) => { if (m.isMesh) meshes.push(m); });
    if (!meshes.length) return;
    node.userData._used = true;
    const baked = [];
    for (const m of meshes) {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld); // into world space, rotations intact
      baked.push({ geometry: g, material: m.material });
    }
    // combined world-space bbox across all sub-meshes (trunks + canopies normalize together)
    const box = new THREE.Box3();
    for (const b of baked) {
      b.geometry.computeBoundingBox();
      box.union(b.geometry.boundingBox);
    }
    const size = new THREE.Vector3(); box.getSize(size);
    const s = targetH / Math.max(1e-6, size.y);
    const norm = new THREE.Matrix4()
      .makeTranslation(-(box.min.x + size.x / 2), -box.min.y, -(box.min.z + size.z / 2))
      .multiply(new THREE.Matrix4().makeScale(s, s, s));
    for (const b of baked) {
      b.geometry.applyMatrix4(norm);
      b.geometry.computeVertexNormals();
      // these assets ship a metallic finish that reads as dark sludge under our sun —
      // clone to matte so leaves look like leaves
      const mat = b.material.clone();
      mat.metalness = 0;
      mat.roughness = 0.92;
      entries.push({ geometry: b.geometry, material: mat });
    }
  });
  return entries;
}

export function buildFoliage(scene, group, outer) {
  // `outer` is the true island edge (tile extent + beach pad). The island is a SQUARE,
  // so the clear distance at an angle is outer / max(|cos|,|sin|) — this boundary keeps
  // islets from clipping the board corners, which a circular radius would miss.
  const boundary = (ang) => outer / Math.max(0.0001, Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))));
  const ext0 = outer;
  const rnd = seeded(20260928);
  const loader = new GLTFLoader();

  // grass islets the forests live on — every one rises from a sandy skirt so it sits
  // IN the water instead of floating beside the board
  const islets = [];
  const dirtMat = new THREE.MeshStandardMaterial({ color: '#6e5136', roughness: 0.95 });
  const grassMat = new THREE.MeshStandardMaterial({ color: '#3f9a55', roughness: 0.9 });
  const sandTex = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#eee0b2'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(215,190,140,0.5)' : 'rgba(250,240,214,0.5)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
    }
  });
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(2, 2);
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 });
  const nIslets = 9;
  for (let i = 0; i < nIslets; i++) {
    const ang = (i / nIslets) * Math.PI * 2 + rnd() * 0.5;
    const rad = 2.8 + rnd() * 3.8;
    // clearance uses the above-water footprint (rad + beach rim), not the sunken skirt
    const dist = boundary(ang) + 2.5 + rad + rnd() * 8;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    // underwater sandy skirt: wide at the seabed, tapering up through the surface
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(rad + 0.5, rad * 1.9, 1.9, 10), sandMat);
    skirt.position.set(x, -1.15, z);
    group.add(skirt);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad + 0.35, 1.7, 9), dirtMat);
    base.position.set(x, -0.85, z); // bottom sinks 0.4 below the water plane — no gap, no floating
    group.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.94, rad, 0.22, 9), i % 3 === 0 ? sandMat : grassMat);
    top.position.set(x, -0.32, z);
    group.add(top);
    islets.push({ x, z, rad: rad * 0.9, y: -0.2, kind: i % 3 === 0 ? 'sand' : 'grass', dist: Math.hypot(x, z) });
  }
  // dedicated far forest islets — all the tall trees live out here, past the fog line,
  // where their canopies can never parallax over the board
  const treeKeysAll = ['n9', 'n12', 'n11', 'n6'];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.9 + rnd() * 0.9;
    const dist = 46 + rnd() * 9;
    const rad = 4 + rnd() * 3;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(rad + 0.5, rad * 1.9, 1.9, 10), sandMat);
    skirt.position.set(x, -1.15, z);
    group.add(skirt);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad + 0.35, 1.7, 9), dirtMat);
    base.position.set(x, -0.85, z);
    group.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.94, rad, 0.22, 9), grassMat);
    top.position.set(x, -0.32, z);
    group.add(top);
    islets.push({ x, z, rad: rad * 0.9, y: -0.2, kind: 'grass', dist: Math.hypot(x, z) });
  }
  // low sandbars close to the island — they visually bridge the shore to the sea
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.6 + rnd() * 0.7;
    const dist = boundary(ang) + 5 + rnd() * 2.5;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.4 + rnd() * 1.6, 2.6 + rnd() * 1.6, 0.5, 8), sandMat);
    bar.position.set(Math.cos(ang) * dist, -1.2, Math.sin(ang) * dist);
    group.add(bar);
  }

  const placements = new Map(); // source key -> array of {pos, rotY, scale}
  const put = (key, pos, rotY, scale) => {
    if (!placements.has(key)) placements.set(key, []);
    placements.get(key).push({ pos, rotY, scale });
  };
  const onIslet = (isl, key, h, rMin = 0.25, count) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = isl.rad * (rMin + rnd() * 0.7);
      put(key, new THREE.Vector3(isl.x + Math.cos(a) * r, isl.y, isl.z + Math.sin(a) * r), rnd() * Math.PI * 2, 0.8 + rnd() * 0.5);
    }
  };

  // the board's sand margin stays CLEAN — all greenery lives offshore. A few tiny
  // palm islets sit in the water just past the beach instead.
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.45 + rnd() * 0.5;
    const dist = boundary(ang) + 14 + rnd() * 4;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6 + rnd() * 0.9, 2.6 + rnd() * 1.1, 1.6, 8), sandMat);
    pad.position.set(x, -0.95, z);
    group.add(pad);
    for (let k = 0; k < 3; k++) {
      put('n8', new THREE.Vector3(x + (rnd() - 0.5) * 1.6, 0.06, z + (rnd() - 0.5) * 1.6), rnd() * 6.3, 0.75 + rnd() * 0.45);
    }
    if (rnd() < 0.6) put('n4', new THREE.Vector3(x + (rnd() - 0.5) * 1.4, 0.06, z + (rnd() - 0.5) * 1.4), rnd() * 6.3, 0.7);
  }
  // tall forests ONLY on islets far from the board — near-island parallax would put
  // tree canopies over the tiles from gameplay camera angles. Close islets stay low.
  const treeKeys = ['n9', 'n12', 'n11', 'n6'];
  const forestDist = 42;
  for (const isl of islets) {
    const forest = isl.dist > forestDist;
    if (isl.kind === 'sand') {
      if (forest) for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) onIslet(isl, 'n8', 3.1, 0.2, 1);
      onIslet(isl, 'n4', 0.85, 0.2, 2);
      onIslet(isl, 'n10', 0.75, 0.2, 2);
      onIslet(isl, 'n7', 0.42, 0.1, 5);
    } else if (forest) {
      const nTrees = 5 + Math.floor(rnd() * 4);
      for (let i = 0; i < nTrees; i++) onIslet(isl, treeKeys[Math.floor(rnd() * treeKeys.length)], 3, 0.15, 1);
      onIslet(isl, 'n8', 3.1, 0.2, 1 + Math.floor(rnd() * 2));
      onIslet(isl, 'n4', 0.85, 0.15, 2 + Math.floor(rnd() * 3));
      onIslet(isl, 'n10', 0.75, 0.2, 1 + Math.floor(rnd() * 2));
      onIslet(isl, 'n7', 0.42, 0.05, 5 + Math.floor(rnd() * 4));
      onIslet(isl, 'n5', 0.5, 0.1, 4 + Math.floor(rnd() * 5));
      onIslet(isl, 'n1', 0.55, 0.1, 2 + Math.floor(rnd() * 3));
    } else {
      // meadow islet: nothing taller than a bush
      onIslet(isl, 'n4', 0.85, 0.15, 2 + Math.floor(rnd() * 3));
      onIslet(isl, 'n10', 0.75, 0.2, 1 + Math.floor(rnd() * 2));
      onIslet(isl, 'n7', 0.42, 0.05, 4 + Math.floor(rnd() * 4));
      onIslet(isl, 'n5', 0.5, 0.1, 4 + Math.floor(rnd() * 5));
      onIslet(isl, 'n1', 0.55, 0.1, 2 + Math.floor(rnd() * 3));
    }
  }
  // lone rocks half-submerged in the water (surface is y = -1.35)
  for (let i = 0; i < 7; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = ext0 + 6 + rnd() * 12;
    put('n10', new THREE.Vector3(Math.cos(ang) * r, -1.5, Math.sin(ang) * r), rnd() * 6.3, 0.7 + rnd() * 1.4);
  }

  // load every GLB, bake its matching nodes, and instance them into place
  let loaded = 0;
  for (const [file, nameRe, targetH] of SOURCES) {
    loader.load(`assets/models/${file}`, (gltf) => {
      const entries = extractEntries(gltf.scene, nameRe, targetH);
      const spots = placements.get(file.replace('.glb', '')) || [];
      if (!entries.length || !spots.length) return;
      for (const e of entries) {
        const inst = new THREE.InstancedMesh(e.geometry, e.material, spots.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
        spots.forEach((sp, i) => {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.rotY);
          sc.set(sp.scale, sp.scale, sp.scale);
          m.compose(sp.pos, q, sc);
          inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = false;
        inst.receiveShadow = false;
        group.add(inst);
      }
      loaded++;
    }, undefined, () => { /* model unavailable — procedural look already in place */ });
  }
  return () => loaded; // debug handle
}
