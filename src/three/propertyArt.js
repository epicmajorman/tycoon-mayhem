// Tile faces — 512px canvas art for every space: sourced game-icons artwork
// (CC BY 3.0) tinted per district, big readable names, district band + owner band,
// price, gateway chips and mortgage stamps. One consistent style for all 132 tiles.
import * as THREE from 'three';
import { canvasTex } from './textures.js?v=8';
import { iconEl } from './icons.js?v=8';
import { GATEWAYS } from '../data/board.js?v=8';

// district art palettes — used to tint the sourced icons and paint the sky backdrop
const P = {
  sunset:    '#c96f4a', docklands: '#9c6b4a', oldmill:   '#7a9e7e', neon:      '#3fb8e8',
  maple:     '#e0569a', artisan:   '#d98f4e', midtown:   '#f0932b', university:'#6a8fd8',
  harbor:    '#4ecdc4', strip:     '#e84545', goldcoast: '#eab543', silicon:   '#26de81',
  financial: '#8854d0', museum:    '#c084fc', skyline:   '#f472b6', riverside: '#34d399',
  diamond:   '#4a69bd', aurora:    '#fb7185', crystal:   '#38bdf8', golden:    '#ffd32a',
  eclipse:   '#fbbf24', special:   '#7ee3ff',
};

function liven(hex, lift = 0.16, warm = 0.04) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL((hsl.h + warm) % 1, Math.min(1, hsl.s * 1.05), Math.min(0.85, hsl.l + lift));
  return '#' + c.getHexString();
}
function mixHex(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return '#' + ca.getHexString();
}
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0.06, Math.min(0.95, hsl.l + amt)));
  return '#' + c.getHexString();
}

// draw a game-icons SVG tinted to `color`. The source art is a white icon on an opaque
// black square, so luminance becomes the alpha channel and the tint becomes the color.
const scratch = document.createElement('canvas');
scratch.width = 256; scratch.height = 256;
const sctx = scratch.getContext('2d', { willReadFrequently: true });
function tintedIcon(name, color) {
  const img = iconEl(name);
  if (!img) return null;
  const key = name + '|' + color;
  sctx.clearRect(0, 0, 256, 256);
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(img, 0, 0, 256, 256);
  const data = sctx.getImageData(0, 0, 256, 256);
  const px = data.data;
  const tc = new THREE.Color(color);
  const r = Math.round(tc.r * 255), g = Math.round(tc.g * 255), b = Math.round(tc.b * 255);
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
    px[i + 3] = Math.round(lum * 255);
  }
  sctx.putImageData(data, 0, 0);
  return scratch;
}
function drawIcon(ctx, name, cx, cy, size, color, alpha = 1, shadow = true) {
  const tinted = tintedIcon(name, color);
  if (!tinted) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) { ctx.shadowColor = 'rgba(10,14,30,0.45)'; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.03; }
  ctx.drawImage(tinted, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
  return true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const NAME_FONT = (px) => `800 ${px}px "Baloo 2", "Segoe UI", Arial, sans-serif`;

function wrapName(ctx, name, maxW, font) {
  ctx.font = font;
  if (ctx.measureText(name).width <= maxW) return [name];
  const words = name.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// cream card base shared by every face
function cardBase(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#fefcf5'); g.addColorStop(1, '#eee8d6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(40,44,70,0.16)'; ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 506, 506);
}

// ---------- property faces ----------
function propertyFace(ctx, t, opts) {
  const accent = opts.accent;
  cardBase(ctx);
  // district band — the color group, with the district name inside it
  const band = shade(accent, -0.2);
  ctx.fillStyle = band; ctx.fillRect(10, 10, 492, 84);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(10, 10, 492, 14);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = NAME_FONT(40);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText((opts.districtName || '').toUpperCase(), 256, 56);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // owner band — sits alongside the district band once someone owns the space
  if (opts.ownerColor) {
    ctx.fillStyle = opts.ownerColor; ctx.fillRect(10, 100, 492, 26);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(10, 120, 492, 6);
  } else {
    ctx.fillStyle = 'rgba(40,44,70,0.12)'; ctx.fillRect(10, 100, 492, 26);
    ctx.font = '700 17px "Baloo 2", "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(40,44,70,0.5)';
    ctx.fillText('FOR SALE', 256, 114);
  }
  // property name — the star of the face, dark ink with a light halo for contrast
  const nameFont = NAME_FONT(57);
  const lines = wrapName(ctx, t.name, 474, nameFont);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,252,242,0.9)';
  ctx.lineWidth = 5;
  ctx.fillStyle = '#0e1122';
  const nY = lines.length > 1 ? 160 : 164;
  lines.forEach((ln, i) => {
    ctx.strokeText(ln, 256, nY + i * 54);
    ctx.fillText(ln, 256, nY + i * 54);
  });
  ctx.restore();
  // art panel: district-tinted sky + the sourced landmark icon
  const ax = 26, ay = lines.length > 1 ? 216 : 208, aw = 460, ah = 216;
  const sky = ctx.createLinearGradient(0, ay, 0, ay + ah);
  sky.addColorStop(0, liven(P[t.district] || accent, 0.28, 0.05));
  sky.addColorStop(0.62, liven(mixHex(P[t.district] || accent, '#ffd9a0', 0.35), 0.1));
  sky.addColorStop(1, mixHex(shade(P[t.district] || accent, -0.18), '#20304d', 0.4));
  roundRect(ctx, ax, ay, aw, ah, 18);
  ctx.save(); ctx.clip();
  ctx.fillStyle = sky; ctx.fillRect(ax, ay, aw, ah);
  // sun glow
  const sg = ctx.createRadialGradient(ax + aw * 0.72, ay + ah * 0.3, 8, ax + aw * 0.72, ay + ah * 0.3, ah * 0.62);
  sg.addColorStop(0, 'rgba(255,244,214,0.85)'); sg.addColorStop(1, 'rgba(255,210,130,0)');
  ctx.fillStyle = sg; ctx.fillRect(ax, ay, aw, ah);
  // the sourced landmark artwork, printed subtly into the card — clearly art from above,
  // not an object standing on the board
  const sil = mixHex('#2a3352', P[t.district] || accent, 0.34);
  drawIcon(ctx, opts.iconFile, ax + aw / 2, ay + ah / 2 + ah * 0.03, Math.min(aw, ah) * 0.68, sil, 0.8);
  ctx.restore();
  // gateway chip — this space fronts a game system
  if (t.gateway) {
    const gw = GATEWAYS[t.gateway];
    ctx.font = '800 22px "Baloo 2", "Segoe UI", Arial';
    const label = gw.name;
    const w = ctx.measureText(label).width + 66;
    const cx = 512 - 26 - w, cy = ay + 14;
    roundRect(ctx, cx, cy, w, 40, 20);
    ctx.fillStyle = 'rgba(12,16,30,0.82)'; ctx.fill();
    ctx.strokeStyle = gw.color; ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = gw.color;
    ctx.fillText(label, cx + 56, cy + 21);
    drawIcon(ctx, gw.iconFile, cx + 28, cy + 20, 30, gw.color, 1, false);
    ctx.textAlign = 'center';
  }
  // price
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,252,242,0.9)';
  ctx.lineWidth = 6;
  ctx.font = NAME_FONT(63);
  ctx.fillStyle = '#c9154a';
  ctx.strokeText('$' + (t.price || 0), 256, 468);
  ctx.fillText('$' + (t.price || 0), 256, 468);
  ctx.restore();
  // mortgage stamp overrides the paint job
  if (opts.mortgaged) mortgageStamp(ctx);
}

// ---------- special faces (corners & action tiles) ----------
function specialFace(ctx, t, opts) {
  const accent = opts.accent;
  cardBase(ctx);
  // full-bleed tinted field
  const g = ctx.createRadialGradient(256, 300, 60, 256, 256, 380);
  g.addColorStop(0, liven(accent, 0.16, 0.02));
  g.addColorStop(1, shade(mixHex(accent, '#1a2038', 0.45), -0.12));
  roundRect(ctx, 14, 14, 484, 484, 22);
  ctx.save(); ctx.clip();
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  // rays backdrop
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.translate(256, 300);
    ctx.rotate((i / 12) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-36, -420); ctx.lineTo(36, -420);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // the sourced icon, big
  drawIcon(ctx, opts.iconFile, 256, 268, 218, '#ffffff', 0.98);
  ctx.restore();
  // gold rosette badge — the universal "special space" mark
  ctx.save();
  ctx.translate(66, 64);
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7);
  ctx.fillStyle = '#e3ab45'; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#8f6216'; ctx.stroke();
  ctx.fillStyle = '#33210a';
  ctx.font = '800 36px "Baloo 2", "Segoe UI", Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, 2);
  ctx.restore();
  // name plate
  const lines = wrapName(ctx, t.name || '', 460, NAME_FONT(50));
  const h = lines.length * 54 + 26;
  roundRect(ctx, 40, 440 - h, 432, h, 18);
  ctx.fillStyle = 'rgba(10,13,26,0.78)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  lines.forEach((ln, i) => ctx.fillText(ln, 256, 440 - h + 26 + i * 54));
  if (t.price) {
    ctx.font = NAME_FONT(44);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText('$' + t.price, 256, 470);
  }
  if (opts.mortgaged) mortgageStamp(ctx);
}

function mortgageStamp(ctx) {
  // grey veil + hazard stripes + banner
  ctx.fillStyle = 'rgba(38,42,58,0.55)'; ctx.fillRect(0, 0, 512, 512);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#000'; ctx.lineWidth = 16;
  for (let x = -512; x < 1024; x += 56) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 512, 512); ctx.stroke();
  }
  ctx.restore();
  drawIcon(ctx, 'mortgage', 256, 180, 170, '#ffb1b1', 0.9);
  ctx.save();
  ctx.translate(256, 330); ctx.rotate(-0.12);
  roundRect(ctx, -218, -40, 436, 80, 14);
  ctx.fillStyle = '#8f2020'; ctx.fill();
  ctx.strokeStyle = '#ffb1b1'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = NAME_FONT(46);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('MORTGAGED', 0, 2);
  ctx.restore();
}

// one entry point: the face texture for any tile
// opts: { accent, ownerColor?, mortgaged?, districtName?, iconFile? }
export function tileFace(t, opts = {}) {
  return canvasTex(512, 512, (ctx) => {
    if (t.type === 'property') propertyFace(ctx, t, opts);
    else specialFace(ctx, t, opts);
  });
}

// backwards-compatible alias used elsewhere
export function deedFace(t, color, flip) {
  return tileFace(t, { accent: color, districtName: t.district ? (t.districtName || '') : '' });
}
