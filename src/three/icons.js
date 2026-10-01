// Sourced artwork loader — game-icons.net SVGs (CC BY 3.0, see assets/icons/CREDITS.md).
// SVGs load as <img>, ready to draw onto tile-face canvases (rasterized by the browser).
const ICONS = [
  'start', 'jail', 'gotojail', 'exchange', 'casino', 'tax', 'luxury', 'fortune', 'frenzy',
  'doodad', 'pool', 'pyramid', 'transit', 'mortgage',
  'gw-stocks', 'gw-deals', 'gw-loans',
  'd_sunset', 'd_docklands', 'd_oldmill', 'd_neon', 'd_maple', 'd_artisan', 'd_midtown',
  'd_university', 'd_harbor', 'd_strip', 'd_goldcoast', 'd_silicon', 'd_financial',
  'd_museum', 'd_skyline', 'd_riverside', 'd_diamond', 'd_aurora', 'd_crystal', 'd_golden',
  'd_eclipse',
];

const cache = new Map();   // name -> HTMLImageElement | null
let readyPromise = null;
const readyCbs = [];

export function loadIcons() {
  if (readyPromise) return readyPromise;
  const loads = ICONS.map((name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { cache.set(name, img); resolve(); };
    img.onerror = () => { cache.set(name, null); resolve(); };
    img.src = `assets/icons/${name}.svg`;
  }));
  readyPromise = Promise.all(loads).then(() => {
    const missing = ICONS.filter((n) => !cache.get(n));
    if (missing.length) console.warn('icons missing (fallback art used):', missing.join(', '));
    for (const cb of readyCbs) { try { cb(); } catch (e) { console.error(e); } }
    readyCbs.length = 0;
  });
  return readyPromise;
}

// the loaded <img> for a name, or null while/when unavailable
export function iconEl(name) {
  return cache.get(name) || null;
}

// run cb once all icons have settled (used to redraw faces that rendered before art arrived)
export function onIconsReady(cb) {
  if (!readyPromise) loadIcons();
  readyPromise.then(() => cb()).catch(() => {});
}
