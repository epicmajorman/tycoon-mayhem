// Mechanics regression: GO pays exactly once per lap, gateway rates (discount/commission),
// transit lane change lands without re-prompting. Run: node tests/mechanics.mjs
import { newGame } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { gatewayTiles, TILES, BOARD_SIZE, setActiveBoard } from '../src/data/board.js';

// this test file imports board.js without a version tag (a separate module instance from
// the engine's) — activate the board here too so gatewayTiles() sees the tiles
setActiveBoard('standard');

let failures = 0;
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`✅ ${name} ${extra}`);
  else { console.error(`❌ ${name} ${extra}`); failures++; }
};

const mk = (boardId = 'standard', ruleset = 'wealth') => {
  const players = [
    { name: 'Ana', token: 'hat', isAI: true, difficulty: 'ruthless', professionId: 'janitor' },
    { name: 'Bob', token: 'car', isAI: true, difficulty: 'standard', professionId: 'janitor' },
  ];
  const state = newGame({ seed: 424242, players, ruleset, flags: { boardId, stocks: true, cashflow: true, deals: true, pyramid: false, professions: false, winMode: 'target', targetWorth: 1e9, lapCap: 200, auctions: true, startCash: 5000, salary: 500 } });
  return new Engine(state);
};

// ---------- GO pays exactly once per lap ----------
{
  const e = mk('standard');
  const p = e.P(0);
  let salaryEvents = 0, lapEvents = 0;
  e.on('cash', (d) => { if (d.player === 0 && d.reason === 'Salary') salaryEvents++; });
  e.on('fx:lap', (d) => { if (d.player === 0) lapEvents++; });
  // force: move 52 steps from START -> back to START in one roll via forcedTotal
  e.beginTurn();
  e.s.forcedTotal = 12; // not allowed 52; instead walk manually 40 then 12
  e.do('roll');
  // walk to just before START
  while (p.pos !== 51) { p.pos = (p.pos + 1) % BOARD_SIZE; }
  p.pos = 45; // deterministic: 7 steps to START
  e.s.pending = null;
  const before = salaryEvents;
  e.moveBy(p, 7, { total: 7 });
  ok(salaryEvents - before === 1, 'GO: salary paid exactly once when landing on START', `(got ${salaryEvents - before})`);
  ok(lapEvents === 1, 'GO: one lap counted', `(got ${lapEvents})`);
}

// ---------- gateway rates ----------
{
  const e = mk('standard');
  const gw = gatewayTiles('stocks');
  ok(gw.length === 2, 'standard board has 2 stock gateway spaces', `(${gw.length})`);
  ok(gatewayTiles('deals').length === 2, 'standard board has 2 deal gateway spaces');
  ok(gatewayTiles('loans').length === 2, 'standard board has 2 loan gateway spaces');
  // v4 board: 12 districts with varied sizes (2-4), none spanning a board side/corner
  const perDist = {};
  for (const t of TILES) if (t.type === 'property') perDist[t.district] = (perDist[t.district] || 0) + 1;
  const sizes = Object.values(perDist);
  ok(sizes.length === 12 && sizes.every(s => s >= 2 && s <= 4) && new Set(sizes).size >= 3,
    'standard = 12 districts, varied sizes 2-4', JSON.stringify(perDist));
  const spans = new Set();
  for (let i = 0; i < BOARD_SIZE; i++) {
    const t = TILES[i];
    if (t.type !== 'property') continue;
    spans.add(t.district + ':' + Math.floor((i % 52) / 13));
  }
  const byDist = {};
  for (const key of spans) {
    const [d, , side] = key.split(':');
    (byDist[d] = byDist[d] || new Set()).add(side);
  }
  ok(Object.values(byDist).every(s => s.size === 1), 'no district spans a corner/side boundary');
  const tile = gw[0];
  const A = e.P(0), B = e.P(1);
  // unowned: rate 0
  ok(e.gatewayRate(A, tile) === -0.1, 'unowned gateway = visitor markup for buyer', '');
  // A owns it: 10% discount
  e.s.props[tile].owner = 0;
  ok(Math.abs(e.gatewayRate(A, tile) - 0.10) < 1e-9, 'owner gets 10% base discount');
  // level 2 building -> 30%
  e.s.props[tile].level = 2;
  ok(Math.abs(e.gatewayRate(A, tile) - 0.30) < 1e-9, 'discount grows +10% per building level');
  // full set -> +10%
  const dist = TILES[tile].district;
  for (const i of e.constructor ? [] : []) {} // noop
  // find district tiles via TILES scan
  const dtiles = [];
  for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].type === 'property' && TILES[i].district === dist) dtiles.push(i);
  for (const i of dtiles) e.s.props[i].owner = 0;
  ok(Math.abs(e.gatewayRate(A, tile) - 0.40) < 1e-9, 'full set adds +10% (40% total at level 2)');
  e.s.props[tile].level = 0;
  ok(Math.abs(e.gatewayRate(A, tile) - 0.20) < 1e-9, 'full set at level 0 = 20%');
  // buy stock as owner: 10% discount (single tile, no set)
  for (const i of dtiles) if (i !== tile) e.s.props[i].owner = -1;
  e.s.props[tile].level = 0;
  e.s.props[tile].owner = 0;
  const st = e.s.stocks[dist];
  const price = st.price;
  A.cash = 100000;
  e.s.pending = { kind: 'gateway', player: 0, tile, gateway: 'stocks' };
  const beforeCash = A.cash;
  e.do('buyStock', { dist, n: 10, at: tile });
  const ownerSpent = beforeCash - A.cash;
  // give B the tile, A buys: +10% markup, commission to owner
  e.s.props[tile].owner = 1;
  B.cash = 0;
  const price2 = e.s.stocks[dist].price; // bumped by the 10-share order above
  const beforeA2 = A.cash;
  e.s.pending = { kind: 'gateway', player: 0, tile, gateway: 'stocks' };
  e.do('buyStock', { dist, n: 10, at: tile });
  const visitorSpent = beforeA2 - A.cash;
  ok(visitorSpent === Math.round(price2 * 10 * 1.1), 'visitor pays +10% markup', `(spent ${visitorSpent}, expect ${Math.round(price2 * 10 * 1.1)})`);
  ok(B.cash === Math.round(price2 * 10 * 0.1), 'space owner receives the commission', `(got ${B.cash})`);
  ok(ownerSpent === Math.round(price * 10 * 0.9), 'owner pays par price (10% off)', `(spent ${ownerSpent}, expect ${Math.round(price * 10 * 0.9)})`);
}

// ---------- gateway visit: buy keeps visit alive, then continue ends it ----------
{
  const e = mk('standard');
  const gw = gatewayTiles('deals')[0];
  const A = e.P(0);
  e.s.players[0].pos = gw;
  e.s.pending = null;
  e.s.props[gw].owner = -1;
  e.resolveTile(A, gw, {});
  ok(e.s.pending && e.s.pending.kind === 'gateway' && e.s.pending.unowned, 'landing on unowned gateway prompts gateway (with buy)');
  A.cash = 20000;
  const before = A.cash;
  e.choose('buy');
  ok(e.s.props[gw].owner === 0, 'bought the gateway space during first landing');
  ok(e.s.pending && e.s.pending.kind === 'gateway' && !e.s.pending.unowned, 'visit stays open after buying (interact now)');
  e.choose({ type: 'continue' });
  ok(e.s.pending?.kind !== 'gateway', 'continue ends the gateway visit (turn resolved / next turn began)', `pending=${e.s.pending?.kind}`);
}

// ---------- stock settlement: no same-cycle selling, dividends need settled shares ----------
{
  const e = mk('standard');
  const A = e.P(0);
  const gw = gatewayTiles('stocks')[0];
  const dist = TILES[gw].district;
  A.cash = 100000;
  e.s.pending = { kind: 'gateway', player: 0, tile: gw, gateway: 'stocks' };
  e.do('buyStock', { dist, n: 10, at: gw });
  ok(A.stocks[dist] === 10, 'bought 10 shares');
  ok((A.unsettled[dist] || 0) === 10, 'fresh shares are unsettled');
  e.do('sellStock', { dist, n: 10 });
  ok(A.stocks[dist] === 10, 'selling unsettled shares is blocked');
  e.passStart(A, 1);
  ok((A.unsettled[dist] || 0) === 0, 'passing Go settles the holdings');
  const before = A.stocks[dist];
  e.s.pending = { kind: 'exchange', player: 0 };
  e.do('sellStock', { dist, n: 4 });
  ok(A.stocks[dist] === before - 4, 'settled shares sell freely');
  A.stocks[dist] = 12; A.unsettled[dist] = 6;
  ok(e.settledShares(A, dist) === 6, 'settledShares counts only settled stock');
}
// ---------- transit: lane change without re-prompt ----------
{
  setActiveBoard('grand');
  const e = mk('grand');
  const { transitLinks, RING_META, ringOf } = await import('../src/data/board.js');
  const A = e.P(0);
  // find a transit tile with a link
  let tTile = -1;
  for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].type === 'transit' && transitLinks(i).length > 0) { tTile = i; break; }
  ok(tTile >= 0, 'grand board has linked transit stations');
  A.pos = tTile;
  e.s.pending = null;
  e.resolveTile(A, tTile, {});
  ok(e.s.pending && e.s.pending.kind === 'select' && e.s.pending.selectKind === 'transit', 'landing on transit prompts lane choice');
  const link = transitLinks(tTile)[0];
  e.choose({ tile: link });
  ok(A.pos === link, 'player changes lanes to the linked station');
  ok(!e.s.pending || e.s.pending.selectKind !== 'transit', 'arrival does NOT re-prompt the station', `pending=${JSON.stringify(e.s.pending)?.slice(0, 80)}`);
  ok(ringOf(tTile) !== ringOf(link), 'lane change actually switches rings');
}

console.log(failures === 0 ? '\n=== MECHANICS ALL PASS ===' : `\n=== ${failures} FAILURES ===`);
process.exit(failures === 0 ? 0 : 1);
