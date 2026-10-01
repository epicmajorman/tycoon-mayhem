// TYCOON MAYHEM boards — three sizes, Ultimate-Monopoly-style concentric rings.
// The active board is a module-level singleton swapped by setActiveBoard() at game
// start; all importers see the new arrays through ES module live bindings.

// ---------- district pool (21) ----------
// par = stock par value; prices = the 4 property prices in build order; sky = skyscraper zoning.
export const DISTRICT_POOL = {
  sunset:    { name: 'Sunset Flats',      color: '#b8a06a', par: 16,  prices: [60, 60, 70, 70],        sky: false, blurb: 'Buses, dust, and the cheapest rent in town. Every empire starts somewhere.' },
  docklands: { name: 'Old Docklands',     color: '#9c6b4a', par: 20,  prices: [80, 90, 100, 110],      sky: false, blurb: 'Salt-rusted cranes and cheap lofts. Where every empire starts.' },
  oldmill:   { name: 'Old Mill Row',      color: '#7a9e7e', par: 24,  prices: [90, 90, 100, 110],      sky: false, blurb: 'Cobblestones, craft ale, and rent controlled since 1987.' },
  neon:      { name: 'Neon Row',          color: '#3fb8e8', par: 28,  prices: [110, 120, 130, 140],    sky: false, blurb: 'Karaoke, ramen, arcade glow. Rent paid in vibes and cash.' },
  maple:     { name: 'Maple Heights',     color: '#e0569a', par: 36,  prices: [150, 160, 170, 180],    sky: false, blurb: 'Quiet cul-de-sacs with loud HOA meetings.' },
  artisan:   { name: 'Artisan Quarter',   color: '#d98f4e', par: 44,  prices: [170, 170, 190, 200],    sky: false, blurb: 'Sourdough, pottery, and a farmers market with a waitlist.' },
  midtown:   { name: 'Midtown',           color: '#f0932b', par: 52,  prices: [190, 210, 230, 250],    sky: false, blurb: 'The traffic king. Everyone passes Midtown eventually.' },
  university:{ name: 'University Hill',   color: '#6a8fd8', par: 56,  prices: [210, 220, 230, 240],    sky: false, blurb: 'Ten thousand tenants who all move in on the same day.' },
  harbor:    { name: 'Harbor Point',      color: '#4ecdc4', par: 64,  prices: [240, 250, 260, 270],    sky: false, blurb: 'Container ships by day, rooftop bars by night.' },
  strip:     { name: 'Casino Strip',      color: '#e84545', par: 52,  prices: [260, 270, 280, 290],    sky: false, blurb: 'Desert excess, neon cowboys, free drinks at a price.' },
  goldcoast: { name: 'Gold Coast',        color: '#eab543', par: 60,  prices: [300, 310, 320, 330],    sky: false, blurb: 'Marina mornings, yacht afternoons, invoice evenings.' },
  silicon:   { name: 'Silicon Gulch',     color: '#26de81', par: 70,  prices: [340, 350, 360, 380],    sky: false, blurb: 'Disrupting disruption. Unicorns graze freely here.' },
  financial: { name: 'Financial Quarter', color: '#8854d0', par: 84,  prices: [420, 450, 480, 510],    sky: false, blurb: 'Suits, skyscraper shadows, and quiet panics at 4 PM.' },
  museum:    { name: 'Museum Mile',       color: '#c084fc', par: 72,  prices: [260, 270, 280, 300],    sky: false, blurb: 'Culture on every corner, gift shops on every floor.' },
  skyline:   { name: 'Skyline Edge',      color: '#f472b6', par: 84,  prices: [300, 310, 330, 350],    sky: false, blurb: 'Cliffside modernism. The view is the amenity.' },
  riverside: { name: 'Riverside Green',   color: '#34d399', par: 60,  prices: [220, 230, 240, 260],    sky: false, blurb: 'Joggers, kayaks, and artisanal everything.' },
  diamond:   { name: 'Diamond Plaza',     color: '#4a69bd', par: 100, prices: [520, 560, 600, 650],    sky: true,  blurb: 'Penthouse country. Skyscraper zoning approved.' },
  aurora:    { name: 'Aurora Heights',    color: '#fb7185', par: 88,  prices: [320, 330, 350, 370],    sky: false, blurb: 'Northern lights, southern exposures, zero vacancies.' },
  crystal:   { name: 'Crystal Bay',       color: '#38bdf8', par: 96,  prices: [360, 380, 400, 420],    sky: false, blurb: 'Water on three sides, money on the fourth.' },
  golden:    { name: 'Golden Mile',       color: '#ffd32a', par: 120, prices: [700, 750, 800, 900],    sky: true,  blurb: 'The most expensive pavement in the world. Own it all.' },
  eclipse:   { name: 'Eclipse Tower',     color: '#fbbf24', par: 120, prices: [560, 600, 640, 700],    sky: true,  blurb: 'It blocks out the sun. The sun sends invoices now.' },
};

const P = (d) => ({ prop: d });
const TR = () => ({ type: 'transit', name: 'TRANSIT', icon: '🚉', blurb: 'Transit Station. Land here to change lanes — ride the line to a linked ring and end your move at the linked station.' });
// gateway tokens: the tile is a normal district property (ownable, rentable, buildable,
// tradeable) AND the front door to one game system — rates depend on who owns the space.
const GST = () => ({ gateway: 'stocks' });
const GDT = () => ({ gateway: 'deals' });
const GLN = () => ({ gateway: 'loans' });
const FORT = () => ({ type: 'fortune', name: 'COMMUNITY CHEST', icon: '🎁', blurb: 'Draw from the Community Chest — cash, deals, and the odd monkey wrench.' });
const FRZ = () => ({ type: 'frenzy', name: 'FRENZY', icon: '⚡', blurb: 'Draw a Frenzy card. Chaos is on the menu.' });
const TAX = () => ({ type: 'tax', name: 'Income Tax', icon: '🏛️', amount: 300, pct: 0.08, blurb: 'The larger of $300 or 8% of your cash goes to the Pool.' });
const TAX2 = () => ({ type: 'tax', name: 'Luxury Tax', icon: '🏛️', amount: 200, blurb: '$200 straight into the Pool. Guilt not included.' });
const DOOD = () => ({ type: 'doodad', name: 'Doodad Alley', icon: '🛍️', blurb: 'Forced impulse buy. Pay it — or the bank loans you into it.' });
const POOL = () => ({ type: 'pool', name: 'POOL PAYOUT', icon: '⛲', blurb: 'Collect 50% of everything in the central Pool. Taxes have to go somewhere.' });
const PYR = () => ({ type: 'pyramid', name: 'PYRAMID PITCH', icon: '🔺', blurb: 'UpStone Ventures is recruiting. Join the ladder — or pitch it to someone else.' });
const GJ = () => ({ type: 'gotojail', name: 'FRAUD SQUAD', icon: '🚨', blurb: 'The investigators were waiting. Go directly to Jail.' });

const C = (type, name, opts = {}) => ({ type, name, corner: true, ...opts });

// ---------- board definitions ----------
export const BOARDS = {
  standard: {
    id: 'standard', name: 'Standard City', tag: '52 tiles · 1 ring · 12 districts of 3',
    desc: 'The classic single-ring board. Compact, cutthroat, fast — every color group is 3 properties on one side of the board.',
    rings: [{ size: 52, half: 17.5, tile: 2.35, corner: 3.4 }],
    salaryMult: 1, targetScale: 1, lapScale: 1, cashMult: 1,
    // explicit side membership: each color group is exactly 3 properties inside ONE side
    // (never spanning a corner). d0..d11 map to the districts array below, in price order.
    // group sizes vary on purpose: 2s, 3s and 4s — cheap pairs to start, fat quartets
    // to fight over. Every group still lives on one side, never spanning a corner.
    sides: [
      ['P:docklands', 'P:docklands', 'P:docklands', 'GS:docklands', 'TAX', 'P:neon', 'P:neon', 'FORT', 'P:oldmill', 'P:oldmill', 'P:oldmill', 'FRZ'],
      ['P:maple', 'P:maple', 'P:maple', 'GL:maple', 'P:midtown', 'P:midtown', 'GD:midtown', 'TAX2', 'P:university', 'P:university', 'GL:university', 'POOL'],
      ['P:harbor', 'P:harbor', 'P:harbor', 'FORT', 'P:strip', 'P:strip', 'GD:strip', 'GJ', 'P:silicon', 'P:silicon', 'P:silicon', 'TAX2'],
      ['P:financial', 'P:financial', 'P:financial', 'GS:financial', 'PYR', 'P:diamond', 'P:diamond', 'P:diamond', 'DOOD', 'P:golden', 'P:golden', 'TAX'],
    ],
    districts: ['docklands', 'neon', 'oldmill', 'maple', 'midtown', 'university', 'harbor', 'strip', 'silicon', 'financial', 'diamond', 'golden'],
    corners: [
      C('start', 'START', { pay: 1, icon: '🚀', blurb: 'Collect salary & expenses. Pass with 4 seals to be promoted.' }),
      C('jail', 'JAIL', { icon: '⛓️', blurb: 'Visiting — or doing time. Bail is $100, or roll doubles within 3 turns.' }),
      C('exchange', 'STOCK EXCHANGE', { icon: '📈', blurb: 'Trade any stock, take bank loans, buy Dreams. The bell never stops.' }),
      C('casino', 'VENTURE CASINO', { icon: '🎲', blurb: 'Bet on High / Low / Seven. The house edge is 17% — the house says thanks.' }),
    ],
    seals: { 0: 'heart', 13: 'diamond', 26: 'club', 39: 'spade' },
    jailTile: 13,
  },
  grand: {
    id: 'grand', name: 'Grand City', tag: '80 tiles · 2 rings · 12 districts',
    desc: 'Two concentric rings linked by transit stations. Inner ring holds the seals — dive in on an even roll.',
    rings: [
      { size: 48, half: 17.5, tile: 2.35, corner: 3.4 },
      { size: 32, half: 11.6, tile: 2.0, corner: 2.7 },
    ],
    salaryMult: 1.25, targetScale: 1.2, lapScale: 0.7, cashMult: 1.15,
    sides: [
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'TAX', 'P', 'P', 'FRZ', 'P'],
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'DOOD', 'GL', 'P', 'TAX2', 'P'],
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'FRZ', 'P', 'GD', 'DOOD', 'P'],
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'TAX', 'GL', 'GD', 'GJ', 'P'],
    ],
    outer: true,
    districts: ['docklands', 'neon', 'midtown', 'strip', 'silicon', 'financial', 'diamond'],
    corners: [
      C('start', 'START', { pay: 1.2, icon: '🚀', blurb: 'Collect salary & expenses (outer-ring rate).' }),
      C('jail', 'JAIL', { icon: '⛓️', blurb: 'Visiting — or doing time. Bail is $100, or roll doubles within 3 turns.' }),
      C('exchange', 'STOCK EXCHANGE', { icon: '📈', blurb: 'Trade any stock, take bank loans, buy Dreams. The bell never stops.' }),
      C('casino', 'VENTURE CASINO', { icon: '🎲', blurb: 'Bet on High / Low / Seven. The house edge is 17% — the house says thanks.' }),
    ],
    innerRings: [
      {
        districts: ['maple', 'harbor', 'golden', 'crystal', 'eclipse'],
        corners: [
          C('start', 'BONUS PAYDAY', { pay: 2, icon: '💰', blurb: 'Inner-ring payday: double salary. Worth the detour.' }),
          C('pool', 'POOL PAYOUT', { icon: '⛲', blurb: 'Collect 50% of everything in the central Pool.' }),
          C('pyramid', 'PYRAMID PITCH', { icon: '🔺', blurb: 'UpStone Ventures is recruiting. Join the ladder — or pitch it to someone else.' }),
          C('fortune', 'FORTUNE', { icon: '🃏', blurb: 'Draw a Fortune card — cash, deals, and the odd monkey wrench.' }),
        ],
        sides: [
          ['P', 'P', 'TR', 'P', 'TAX', 'P', 'P'],
          ['P', 'P', 'TR', 'P', 'DOOD', 'P', 'P'],
          ['P', 'P', 'TR', 'GS', 'FRZ', 'P', 'P'],
          ['P', 'P', 'TR', 'P', 'TAX2', 'P', 'P'],
        ],
        seals: { 0: 'heart', 8: 'diamond', 16: 'club', 24: 'spade' },
      },
    ],
    jailTile: 13,
  },
  ultimate: {
    id: 'ultimate', name: 'Ultimate Metropolis', tag: '132 tiles · 3 rings · 21 districts',
    desc: 'The full Ultimate-Monopoly experience: three concentric rings, 21 districts, transit-station ring switching, inner payday corners. Bring friends.',
    rings: [
      { size: 52, half: 17.5, tile: 2.35, corner: 3.4 },
      { size: 44, half: 12.3, tile: 2.0, corner: 2.8 },
      { size: 36, half: 8.4, tile: 1.7, corner: 2.3 },
    ],
    salaryMult: 1.6, targetScale: 1.4, lapScale: 0.75, cashMult: 1.3,
    sides: [
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'TAX', 'P', 'P', 'P', 'FRZ', 'P'],
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'DOOD', 'P', 'GL', 'P', 'TAX2', 'P'],
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'FRZ', 'P', 'P', 'GD', 'DOOD', 'P'],
      ['P', 'P', 'TR', 'GS', 'FORT', 'P', 'TAX', 'P', 'GL', 'GD', 'GJ', 'P'],
    ],
    districts: ['docklands', 'neon', 'maple', 'midtown', 'strip', 'goldcoast', 'silicon', 'financial'],
    corners: [
      C('start', 'START', { pay: 1.2, icon: '🚀', blurb: 'Collect salary & expenses (outer-ring rate).' }),
      C('jail', 'JAIL', { icon: '⛓️', blurb: 'Visiting — or doing time. Bail is $100, or roll doubles within 3 turns.' }),
      C('exchange', 'STOCK EXCHANGE', { icon: '📈', blurb: 'Trade any stock, take bank loans, buy Dreams. The bell never stops.' }),
      C('casino', 'VENTURE CASINO', { icon: '🎲', blurb: 'Bet on High / Low / Seven. The house edge is 17% — the house says thanks.' }),
    ],
    innerRings: [
      {
        districts: ['artisan', 'university', 'harbor', 'museum', 'skyline', 'diamond', 'golden'],
        corners: [
          C('pool', 'POOL PAYOUT', { icon: '⛲', blurb: 'Collect 50% of everything in the central Pool.' }),
          C('fortune', 'FORTUNE', { icon: '🃏', blurb: 'Draw a Fortune card — cash, deals, and the odd monkey wrench.' }),
          C('pyramid', 'PYRAMID PITCH', { icon: '🔺', blurb: 'UpStone Ventures is recruiting. Join the ladder — or pitch it to someone else.' }),
          C('start', 'BONUS PAYDAY', { pay: 1.5, blurb: 'Middle-ring payday: +50% salary.' }),
        ],
        sides: [
          ['P', 'P', 'TR', 'P', 'TAX', 'P', 'P', 'FRZ', 'P', 'P'],
          ['P', 'P', 'TR', 'GS', 'DOOD', 'P', 'P', 'TAX', 'P', 'P'],
          ['P', 'P', 'TR', 'FRZ', 'P', 'P', 'GD', 'DOOD', 'P', 'P'],
          ['P', 'P', 'TR', 'P', 'FORT', 'P', 'P', 'TAX2', 'GL', 'P'],
        ],
        seals: {}, // seals live on the inner ring for ultimate
      },
      {
        districts: ['sunset', 'oldmill', 'riverside', 'aurora', 'crystal', 'eclipse'],
        corners: [
          C('start', 'PAY DAY', { pay: 2, icon: '💰', blurb: 'Inner-ring payday: double salary. Worth the detour.' }),
          C('casino', 'VENTURE CASINO', { icon: '🎲', blurb: 'Bet on High / Low / Seven. The house edge is 17% — the house says thanks.' }),
          C('fortune', 'FORTUNE', { icon: '🃏', blurb: 'Draw a Fortune card — cash, deals, and the odd monkey wrench.' }),
          C('exchange', 'STOCK EXCHANGE', { icon: '📈', blurb: 'Trade any stock, take bank loans, buy Dreams. The bell never stops.' }),
        ],
        sides: [
          ['P', 'P', 'TR', 'P', 'TAX', 'P', 'P', 'P'],
          ['P', 'P', 'TR', 'P', 'DOOD', 'P', 'P', 'P'],
          ['P', 'P', 'TR', 'P', 'FRZ', 'P', 'P', 'P'],
          ['P', 'P', 'TR', 'P', 'TAX2', 'P', 'P', 'P'],
        ],
        seals: { 0: 'heart', 9: 'diamond', 18: 'club', 27: 'spade' },
      },
    ],
    jailTile: 52 + 11, // middle ring's corner 1
  },
};

// ---------- active board (live-bound singleton) ----------
export let TILES = [];
export let DISTRICTS = [];
export let D = {};
export let BOARD_SIZE = 52;
export let DISTRICT_TILES = {};
export let CORNER_SEALS = {};
export let RING_META = [];          // [{base, size, half, tile, corner}]
export let JAIL_TILE = 13;
export let BOARD_META = BOARDS.standard;

export function setActiveBoard(id) {
  const def = BOARDS[id] || BOARDS.standard;
  BOARD_META = def;
  TILES = buildTiles(def);
  DISTRICTS = def.districts.concat(...(def.innerRings || []).map(r => r.districts)).map(dId => ({ id: dId, ...DISTRICT_POOL[dId] }));
  D = Object.fromEntries(DISTRICTS.map((d, i) => [d.id, i]));
  BOARD_SIZE = TILES.length;
  DISTRICT_TILES = Object.fromEntries(DISTRICTS.map(d => [d.id, districtTiles(d.id)]));
  CORNER_SEALS = collectSeals(def);
  RING_META = ringMetas(def);
  JAIL_TILE = def.jailTile;
  return def;
}

function ringMetas(def) {
  const metas = [];
  let base = 0;
  const all = [def.rings[0], ...(def.innerRings || []).map((r, i) => ({ ...def.rings[i + 1] }))];
  const geoms = def.rings;
  // ring 0 geometry from def.rings[0]; inner rings reuse geometry entries 1..n
  metas.push({ base: 0, size: def.rings[0].size, half: def.rings[0].half, tile: def.rings[0].tile, corner: def.rings[0].corner });
  base = def.rings[0].size;
  (def.innerRings || []).forEach((r, i) => {
    const g = geoms[i + 1];
    metas.push({ base, size: r.corners.length ? (r.sides.length * (g.size / 4)) : g.size, half: g.half, tile: g.tile, corner: g.corner });
    base += g.size;
  });
  return metas;
}

function collectSeals(def) {
  const seals = { ...def.seals };
  let base = def.rings[0].size;
  for (const inner of def.innerRings || []) {
    for (const k in inner.seals) seals[base + Number(k)] = inner.seals[k];
    base += distRingSize(def, inner);
  }
  return seals;
}
function distRingSize(def, inner) { return inner.sides[0].length + 1 ? (inner.sides[0].length + 1) * 4 : 0; }

const TOKENS = { TR, FORT, FRZ, TAX, TAX2, DOOD, POOL, PYR, GJ };

// ---------- gateway system metadata ----------
// Gateway spaces are ordinary district properties that also front one game system.
// Owning the space earns a trade discount (+10% per building level, +10% for the set);
// everyone else pays a 10% commission on top — and the normal landing fee, as always.
export const GATEWAYS = {
  stocks: { id: 'stocks', name: 'STOCK HOUSE', icon: '📈', iconFile: 'gw-stocks', color: '#26de81',
    blurb: 'District stocks trade here. The owner trades at a discount; visitors pay a 10% commission.' },
  deals:  { id: 'deals',  name: 'DEAL BROKERAGE', icon: '🤝', iconFile: 'gw-deals', color: '#b48cff',
    blurb: 'The broker sets up shop here. The owner signs deals cheaper; visitors pay a 10% commission.' },
  loans:  { id: 'loans',  name: 'BANK BRANCH', icon: '🏦', iconFile: 'gw-loans', color: '#f0932b',
    blurb: 'A full-service bank branch. The owner borrows at better rates; visitors pay a 10% premium.' },
};
export function gatewayTiles(kind) {
  const out = [];
  for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].gateway === kind) out.push(i);
  return out;
}

function buildTiles(def) {
  const tiles = [];
  const pushRing = (ringDef, geom, corners, sides, districts) => {
    const base = tiles.length;
    const tps = geom.size / 4;
    const buf = new Array(geom.size);
    for (let c = 0; c < 4; c++) {
      const cd = corners[c];
      buf[c * tps] = { type: cd.type, name: cd.name, pay: cd.pay, icon: cd.icon, blurb: cd.blurb, corner: true };
    }
    const queue = districts.flatMap(id => [id, id, id, id]);
    const names = {};
    let queueUsed = false;
    for (let side = 0; side < 4; side++) {
      const tmpl = sides[side];
      if (tmpl.length !== tps - 1) throw new Error(`Ring side template length ${tmpl.length} != ${tps - 1} on board ${def.id}`);
      for (let s = 0; s < tmpl.length; s++) {
        const k = side * tps + 1 + s;
        const item = tmpl[s];
        if (item === 'P') {
          const dId = queue.shift();
          const dist = DISTRICT_POOL[dId];
          names[dId] = names[dId] || 0;
          const j = names[dId]++;
          buf[k] = { type: 'property', district: dId, name: dist.names[j], price: dist.prices[j] };
        } else if (item === 'P' || item === 'GS' || item === 'GD' || item === 'GL' || item.includes(':')) {
          // 'P' pulls the next district from the queue; 'TOKEN:dN' pins a property (and an
          // optional gateway) to an explicit district — used for corner-safe group layouts
          let kind = item, dId = null;
          if (item.includes(':')) { [kind, dId] = item.split(':'); }
          if (dId == null) {
            dId = queue.shift();
            queueUsed = true;
          } else {
            const qi = queue.indexOf(dId);
            if (qi >= 0) queue.splice(qi, 1);
          }
          const dist = DISTRICT_POOL[dId];
          names[dId] = names[dId] || 0;
          const j = names[dId]++;
          const t = { type: 'property', district: dId, name: dist.names[j], price: dist.prices[j] };
          if (kind === 'GS') t.gateway = 'stocks';
          else if (kind === 'GD') t.gateway = 'deals';
          else if (kind === 'GL') t.gateway = 'loans';
          buf[k] = t;
        } else {
          const t = (typeof item === 'function' ? item : TOKENS[item])();
          buf[k] = t;
        }
      }
    }
    if (queueUsed && queue.length !== 0) throw new Error(`District queue not exhausted on board ${def.id} (left ${queue.length})`);
    for (const t of buf) tiles.push(t);
  };

  pushRing(def.rings[0], def.rings[0], def.corners, def.sides, def.districts);
  (def.innerRings || []).forEach((r, i) => {
    const geom = def.rings[i + 1];
    pushRing(r, geom, r.corners, r.sides, r.districts);
  });
  return tiles;
}

// ---------- ring helpers ----------
export function ringOf(i) {
  for (let r = RING_META.length - 1; r >= 0; r--) if (i >= RING_META[r].base) return r;
  return 0;
}
export function ringBase(r) { return RING_META[r] ? RING_META[r].base : 0; }
export function ringSize(r) { return RING_META[r] ? RING_META[r].size : BOARD_SIZE; }
export function nextInRing(i) {
  const r = ringOf(i), m = RING_META[r];
  return m.base + ((i - m.base + 1) % m.size);
}
export function prevInRing(i) {
  const r = ringOf(i), m = RING_META[r];
  return m.base + ((i - m.base - 1 + m.size) % m.size);
}
export function ringDistance(a, b) {
  if (ringOf(a) !== ringOf(b)) return null;
  const m = RING_META[ringOf(a)];
  return ((b - a) + m.size) % m.size;
}
// Transit stations are linked by INDEX across rings (like Ultimate Monopoly's tunnels):
// the n-th station of a ring connects to the n-th station of each adjacent ring.
function transitsOfRing(r) {
  const m = RING_META[r];
  const out = [];
  for (let i = m.base; i < m.base + m.size; i++) if (TILES[i].type === 'transit') out.push(i);
  return out;
}
export function transitLinks(i) {
  if (RING_META.length < 2 || !TILES[i] || TILES[i].type !== 'transit') return [];
  const r = ringOf(i);
  const j = transitsOfRing(r).indexOf(i);
  const out = [];
  for (const t of [r + 1, r - 1]) {
    if (!RING_META[t]) continue;
    const list = transitsOfRing(t);
    if (list[j] != null) out.push(list[j]);
  }
  return out;
}
export function linkedTransit(i) {
  const links = transitLinks(i);
  return links.length ? links[0] : null;
}

// ---------- classic helpers ----------
export const RENT_MULT = [1, 5, 14, 32, 52, 64, 92];
export const LEVEL_NAMES = ['—', 'House', '2 Houses', '3 Houses', '4 Houses', 'Hotel', 'Skyscraper'];
export const MAX_LEVEL = (district) => (DISTRICTS[D[district]] || {}).sky ? 6 : 5;

export function baseRent(price) { return Math.max(4, Math.round(price * 0.09)); }
export function buildingCost(price) { return Math.round(price * 0.5 / 10) * 10; }
export function districtTiles(di) {
  const out = [];
  for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].type === 'property' && TILES[i].district === di) out.push(i);
  return out;
}

export const SEAL_INFO = {
  heart:   { name: 'Heart Seal',   color: '#ff5e7a' },
  diamond: { name: 'Diamond Seal', color: '#5ec8ff' },
  club:    { name: 'Club Seal',    color: '#59d46b' },
  spade:   { name: 'Spade Seal',   color: '#b48cff' },
};

// Districts need per-tile names — merged into the pool here.
const NAMES = {
  sunset: ['Bus-Stop Bungalow', 'Flat 3B', 'Laundry View', 'The Last Cheap Roof'],
  docklands: ['Anchor Wharf', 'Saltshed Lofts', 'Crane Commons', 'Tidal Yards'],
  oldmill: ['Millwheel Mews', 'Grainstore Flats', 'Cobble & Co.', 'The Old Kiln'],
  neon: ['Pixel Alley', 'Ramen Row', 'Karaoke Krossing', 'Arcade Arcade'],
  maple: ['Dogwood Lane', 'Birch Boulevard', 'Syrup Circle', 'Owl Creek Court'],
  artisan: ['Kiln Yard', 'Sourdough Square', 'Loom Lane', 'Farmers Row'],
  midtown: ['Grand Terminus', 'Clocktower Plaza', 'Union Exchange', 'Meridian Works'],
  university: ['Dean\'s Lawn', 'Library Walk', 'Frat Fold', 'Ivy Terrace'],
  harbor: ['Quay Seven', 'Container Crescent', 'Lighthouse Landing', 'Tidewater Terrace'],
  strip: ['Flamingo Royale', 'Lucky Tiger', 'Velvet Vault', 'Cobalt Palace'],
  goldcoast: ['Marina Vista', 'Regatta Point', 'Sunset Terraces', 'Lighthouse Green'],
  silicon: ['Garage Alpha', 'Pivot Campus', 'Unicorn Commons', 'Blockchain Bowl'],
  financial: ['Bull & Bear Club', 'Meridian Trust Tower', 'Hedge Row Plaza', 'Vault 44'],
  museum: ['Gallery Gate', 'Marble Court', 'Curator\'s Row', 'The Annex'],
  skyline: ['Cliffside One', 'Vertigo Villas', 'Edge House', 'Horror of Heights'],
  riverside: ['Kayak Club', 'Willow Bend', 'Rivergate', 'Greenbank Walk'],
  diamond: ['Aurora Spire', 'Prism Tower I', 'Prism Tower II', 'The Halo'],
  aurora: ['Borealis Block', 'Polar Court', 'Radiance Row', 'Solaria'],
  crystal: ['Bayview One', 'Crystal Cove', 'Pier Nine', 'The Sandbar'],
  golden: ['Gilded Gate', 'Midas Court', 'Aurum Row', 'The Pinnacle'],
  eclipse: ['Umbra Tower', 'Penumbra Plaza', 'Totality Terrace', 'Corona Court'],
};
for (const id in DISTRICT_POOL) DISTRICT_POOL[id].names = NAMES[id];

// ---------- traffic model (ring-aware, used by AI + UI heatmap) ----------
const DICE_DIST = (() => {
  const d = new Array(13).fill(0);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) d[a + b] += 1 / 36;
  return d;
})();
export function tileTraffic() {
  const N = BOARD_SIZE;
  let w = new Array(N).fill(1 / N);
  for (let iter = 0; iter < 8; iter++) {
    const nw = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const wi = w[i];
      if (wi <= 0) continue;
      if (TILES[i].type === 'gotojail') { nw[JAIL_TILE] += wi; continue; }
      for (let s = 2; s <= 12; s++) {
        let cur = i;
        for (let step = 0; step < s; step++) cur = nextInRing(cur);
        // lane changes are a deliberate landing choice now, not a passing bonus —
        // the stationary distribution treats rings as independent loops
        nw[cur] += wi * DICE_DIST[s] * 0.94;
      }
      nw[i] += wi * 0.06;
    }
    for (const k in CORNER_SEALS) nw[k] += 0.006; // corner magnetism
    const sum = nw.reduce((a, b) => a + b, 0);
    w = nw.map(v => v / sum);
  }
  return w;
}
