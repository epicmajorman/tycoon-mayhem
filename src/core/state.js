// Game state factory + net worth / passive income accounting.
import { RNG } from './rng.js?v=8';
import { BOARD_SIZE, TILES, DISTRICTS, D, DISTRICT_TILES, buildingCost, baseRent, CORNER_SEALS, setActiveBoard, BOARD_META } from '../data/board.js?v=8';
import { PROFESSIONS } from '../data/professions.js?v=8';
import { PYRAMID_TIERS } from '../data/cards.js?v=8';

export const PLAYER_COLORS = ['#ff5e7a', '#3fb8e8', '#26de81', '#f0932b', '#b48cff', '#ffd32a', '#45d9d5', '#f472b6'];

export function newGame(opts) {
  // opts: { seed, players: [{name, token, isAI, difficulty, professionId?}], ruleset, flags }
  const flags = opts.flags;
  const meta = setActiveBoard(flags.boardId || 'standard');
  const rng = new RNG(opts.seed);
  const players = opts.players.map((p, i) => {
    const prof = PROFESSIONS.find(x => x.id === p.professionId) || PROFESSIONS[i % PROFESSIONS.length];
    return {
      id: i, name: p.name, token: p.token, color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      isAI: !!p.isAI, difficulty: p.difficulty || 'standard',
      professionId: flags.professions ? prof.id : null,
      professionName: flags.professions ? prof.name : 'Tycoon',
      cash: Math.round((flags.startCash + (flags.professions ? prof.savings : 0)) * (meta.cashMult || 1)),
      pos: 0, laps: 0, level: 1,
      seals: { heart: false, diamond: false, club: false, spade: false },
      gojf: 0, items: [], statuses: {},
      stocks: Object.fromEntries(DISTRICTS.map(d => [d.id, 0])),
      unsettled: Object.fromEntries(DISTRICTS.map(d => [d.id, 0])), // shares bought since last Go — can't sell, no dividends
      assets: [], dreams: [], lastDividends: 0,
      loans: 0, loanRate: 1, pyramid: null, pyramidOrder: -1,
      inJail: false, jailTurns: 0, bankrupt: false, freedom: false,
      skipTurns: 0,
      stats: { rentIn: 0, rentOut: 0, laps: 0, buys: 0, builds: 0, trades: 0, bestCombo: 0 },
    };
  });

  const state = {
    seed: opts.seed, rulesetId: opts.ruleset, flags,
    players, turn: 0, lap: 1, tick: 0,
    props: Object.fromEntries(TILES.map((t, i) => [i, t.type === 'property'
      ? { owner: -1, level: 0, mortgaged: false } : null])),
    stocks: Object.fromEntries(DISTRICTS.map(d => [d.id, { price: d.par, par: d.par, divPool: 0 }])),
    pyramid: { open: true, hype: 20, pot: 8000, cycle: 1, closedFor: 0, members: [] },
    buildings: flags.finiteBuildings
      ? { houses: 4 * DISTRICTS.length, hotels: DISTRICTS.length, sky: Math.max(4, Math.round(DISTRICTS.length / 2)) }
      : { houses: 40, hotels: 12, sky: 4 },
    pool: 0, roadblocks: {}, // tileIdx -> ownerIdx
    dice: [1, 1], speedFace: null, doubles: 0, rollsThisTurn: 0,
    phase: 'roll', pending: null, auction: null, tradeOffer: null, tradeInbox: [], rentStorm: 0,
    winner: null, gameOver: false, turnCount: 0,
    inflationIdx: 1,
    boardId: meta.id,
    effTarget: Math.round(flags.targetWorth * (meta.targetScale || 1)),
    effLapCap: Math.max(8, Math.round(flags.lapCap * (meta.lapScale || 1))),
  };
  return state;
}

export const propValueOf = (state, p) => {
  let v = 0;
  for (const t of DISTRICT_TILES_ALL()) {
    const pr = state.props[t];
    if (pr && pr.owner === p.id) v += TILES[t].price + buildingLevelsCost(t, pr.level);
  }
  return v;
};
function* DISTRICT_TILES_ALL() { for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].type === 'property') yield i; }

export function buildingLevelsCost(tileIdx, level) {
  const price = TILES[tileIdx].price;
  let c = 0;
  for (let l = 1; l <= level; l++) c += buildingCost(price) * (l === 6 ? 2 : 1);
  return c;
}

export function stockValueOf(state, p) {
  let v = 0;
  for (const d of DISTRICTS) v += p.stocks[d.id] * state.stocks[d.id].price;
  return v;
}
export function pyramidValueOf(p) { return p.pyramid ? Math.round(PYRAMID_TIERS.find(t => t.id === p.pyramid.tier).cost * 0.4) : 0; }
export function assetsValueOf(p) { return p.assets.reduce((a, x) => a + x.val, 0) + p.dreams.reduce((a, x) => a + x.cost, 0); }
export function loanDebtOf(p) { return p.loans * 500; }

export function netWorth(state, p) {
  return p.cash + propValueOf(state, p) + stockValueOf(state, p) + pyramidValueOf(p)
    + assetsValueOf(p) - loanDebtOf(p);
}
export function passiveIncome(state, p) {
  const cf = p.assets.reduce((a, x) => a + x.cf, 0);
  let roll = 0;
  if (state.flags.cashflow) {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pr = state.props[i];
      if (pr && pr.owner === p.id && !pr.mortgaged) roll += Math.round(baseRent(TILES[i].price) * (1 + pr.level) * 0.55);
    }
  }
  return cf + roll + p.lastDividends;
}
export function expensesOf(state, p) {
  if (!state.flags.cashflow) return 0;
  const prof = PROFESSIONS.find(x => x.id === p.professionId);
  const base = prof ? prof.expense : Math.round((state.flags.salary || 500) * 0.6);
  return base + Math.round(p.loans * 50 * (p.loanRate ?? 1));
}
export function salaryOf(state, p) {
  const prof = PROFESSIONS.find(x => x.id === p.professionId);
  const base = prof ? prof.base : (state.flags.salary || 500);
  let s = base + 200 * (p.level - 1) + Math.floor(propValueOf(state, p) / 12);
  if (p.freedom) s = Math.round(s * 1.5);
  return s;
}
export const sealsCount = (p) => Object.values(p.seals).filter(Boolean).length;
export const alivePlayers = (state) => state.players.filter(p => !p.bankrupt);
export const currentLeader = (state) => alivePlayers(state).reduce((a, b) => netWorth(state, a) >= netWorth(state, b) ? a : b);
export const nextAlive = (state, from) => {
  for (let k = 1; k <= state.players.length; k++) {
    const i = (from + k) % state.players.length;
    if (!state.players[i].bankrupt) return i;
  }
  return from;
};
