// Procedural canvas textures — dice pips, speed-die icons, emissive windows, glow sprites.
import * as THREE from 'three';

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

const PIP_POS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export function diceFaceTexture(n, base = '#f5f2ea', pip = '#22201d') {
  return canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    const g = ctx.createRadialGradient(64, 40, 8, 64, 64, 90);
    g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = pip;
    for (const [px, py] of PIP_POS[n]) {
      ctx.beginPath(); ctx.arc(64 + px * 30, 64 + py * 30, 11, 0, Math.PI * 2); ctx.fill();
    }
  });
}

export function speedFaceTexture(kind) {
  // kind: 1 | 2 | 3 | 'BUS' | 'MR'
  return canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = '#12131b'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#3a4160'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 116, 116);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (typeof kind === 'number') {
      ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 72px Georgia';
      ctx.fillText(String(kind), 64, 68);
    } else if (kind === 'BUS') {
      ctx.fillStyle = '#ffd32a'; ctx.font = 'bold 34px Arial Black, Arial';
      ctx.fillText('BUS', 64, 58);
      ctx.font = '40px serif'; ctx.fillText('🚌', 64, 98);
    } else {
      ctx.fillStyle = '#7ee3ff'; ctx.font = 'bold 20px Arial Black, Arial';
      ctx.fillText('MR.', 64, 40);
      ctx.fillText('TYCOON', 64, 64);
      ctx.font = '40px serif'; ctx.fillText('🎩', 64, 100);
    }
  });
}

export function windowTexture(color = '#ffd98a') {
  return canvasTex(64, 128, (ctx) => {
    ctx.fillStyle = '#0b0d18'; ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = color;
    for (let y = 6; y < 122; y += 10) {
      for (let x = 6; x < 58; x += 12) {
        if (Math.random() < 0.55) {
          ctx.globalAlpha = 0.35 + Math.random() * 0.65;
          ctx.fillRect(x, y, 6, 5);
        }
      }
    }
    ctx.globalAlpha = 1;
  });
}

export function glowSprite(color = '#ffffff') {
  return canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
}

export function textSprite(text, opts = {}) {
  const { size = 44, color = '#fff', stroke = 'rgba(0,0,0,0.8)', font = 'Arial Black, Arial', pad = 18 } = opts;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `bold ${size}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  c.width = Math.max(4, w); c.height = size + pad * 2;
  const ctx2 = c.getContext('2d');
  ctx2.font = `bold ${size}px ${font}`;
  ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
  ctx2.lineWidth = size * 0.16; ctx2.strokeStyle = stroke;
  ctx2.strokeText(text, c.width / 2, c.height / 2);
  ctx2.fillStyle = color;
  ctx2.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: c.width / c.height };
}
