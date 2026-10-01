// AI brain — one policy, four difficulty tunings. Reads public state + engine helpers,
// answers prompts through the same engine.do()/choose() API humans use. Never touches dice.
import { TILES, DISTRICTS, D, DISTRICT_TILES, MAX_LEVEL, baseRent, buildingCost, CORNER_SEALS, BOARD_SIZE, nextInRing, ringOf, ringDistance } from '../data/board.js?v=8';
import { PYRAMID_TIERS, DREAMS } from '../data/cards.js?v=8';
import { netWorth, passiveIncome, expensesOf, alivePlayers, currentLeader, buildingLevelsCost } from '../core/state.js?v=8';

export const DIFFICULTY = {
  newbie:   { label: 'Newbie',   bidFactor: 0.55, reserve: 0.55, tradeNeed: 1.55, buildCash: 1.6, stockPlay: 0.0, pyrJoin: 0,   pyrExit: 0,   recruit: false, chaosIQ: 0.2, tradeFreq: 0.05, errRate: 0.35 },
  standard: { label: 'Standard', bidFactor: 0.80, reserve: 0.35, tradeNeed: 1.25, buildCash: 1.35, stockPlay: 0.5, pyrJoin: 45,  pyrExit: 92,  recruit: false, chaosIQ: 0.5, tradeFreq: 0.15, errRate: 0.15 },
  sharp:    { label: 'Sharp',    bidFactor: 0.97, reserve: 0.25, tradeNeed: 1.12, buildCash: 1.2,  stockPlay: 1.0, pyrJoin: 55,  pyrExit: 80,  recruit: true,  chaosIQ: 0.8, tradeFreq: 0.3,  errRate: 0.05 },
  ruthless: { label: 'Ruthless', bidFactor: 1.14, reserve: 0.15, tradeNeed: 1.05, buildCash: 1.1,  stockPlay: 1.0, pyrJoin: 65,  pyrExit: 88,  recruit: true,  chaosIQ: 1.0, tradeFreq: 0.4,  errRate: 0.0 },
};

export class Brain {
  constructor(engine, seat) {
    this.e = engine; this.seat = seat;
  }
  get p() { return this.e.P(this.seat); }
  get d() { return DIFFICULTY[this.p.difficulty] || DIFFICULTY.standard; }
  get s() { return this.e.s; }
  err() { return this.e.rng.next() < this.d.errRate; }
  reserveCash() {
    // Cash-proportional reserve keeps aggression constant as the empire grows.
    const nw = netWorth(this.e.s, this.p);
    let r = Math.min(Math.round(nw * this.d.reserve), Math.round(this.p.cash * 0.45));
    // Escaped the Rat Race in a freedom game: save for the Dream instead of re-investing.
    if (this.s.flags.winMode === 'freedom' && this.p.freedom && this.p.dreams.length === 0) {
      r = Math.max(r, Math.min(DREAMS[0].cost, this.p.cash));
    }
    return r;
  }

  // ---- valuation ----
  tileValue(tile) {
    const t = TILES[tile];
    if (t.type !== 'property') return 0;
    const traffic = this.e.traffic[tile];
    const dist = DISTRICTS[D[t.district]];
    const owned = DISTRICT_TILES[t.district].filter(i => this.s.props[i].owner === this.seat).length;
    const size = DISTRICT_TILES[t.district].length;
    const setPull = 1 + (owned / size) * 0.9;              // completing sets is worth more
    const someoneClose = DISTRICT_TILES[t.district].some(i => {
      const o = this.s.props[i].owner; return o >= 0 && o !== this.seat;
    }) ? 0.85 : 1.0;                                        // contested sets worth less
    const trafficN = traffic / (1 / BOARD_SIZE);
    return Math.round(t.price * (0.7 + 0.6 * trafficN) * setPull * someoneClose);
  }
  districtROI(distId) {
    const tiles = DISTRICT_TILES[distId];
    const mine = tiles.filter(i => this.s.props[i].owner === this.seat);
    if (mine.length === 0) return -1;
    const traffic = tiles.reduce((a, i) => a + this.e.traffic[i], 0) / tiles.length / (1 / BOARD_SIZE);
    const complete = mine.length === tiles.length;
    const rent = baseRent(TILES[mine[0]].price) * (complete ? 2 : 1);
    const cost = buildingCost(TILES[mine[0]].price);
    return (rent * traffic * 3) / cost * (complete ? 1 : 0.3);
  }

  // ---- main entry: respond to current prompt for this seat ----
  respond() {
    // incoming trade offers are answered first — negotiation never waits
    const inbox = (this.s.tradeInbox || []).map((o, i) => ({ ...o, i })).filter(o => o.to === this.seat);
    if (inbox.length > 0 && !this.s.auction) {
      const offerEntry = inbox[0];
      const offer = offerEntry.offer;
      const gain = this.offerValue(offer.get), loss = this.offerValue(offer.give);
      const completesTheirs = (offer.get.props || []).some(t => {
        const tiles = DISTRICT_TILES[TILES[t].district];
        return tiles.every(i2 => i2 === t || this.s.props[i2].owner === offer.from);
      });
      let need = this.d.tradeNeed;
      if (completesTheirs) need += 0.8;
      const accept = gain >= loss * need && !this.err();
      this.e.respondInboxTrade(this.seat, accept);
      return true;
    }
    const pend = this.s.pending;
    if (!pend || pend.player !== this.seat) return false;
    const p = this.p, e = this.e, rng = e.rng;
    switch (pend.kind) {
      case 'roll': return this.actPreRoll();
      case 'buy': {
        const v = this.tileValue(pend.tile);
        const dreamFloor = (this.s.flags.winMode === 'freedom' && p.freedom && p.dreams.length === 0)
          ? DREAMS[0].cost : 0;
        const afford = p.cash - pend.price > dreamFloor + this.reserveCash() * 0.25;
        if (!this.err() && afford && pend.price <= v * 1.6) e.choose('buy');
        else e.choose('decline');
        return true;
      }
      case 'auction': return this.actAuction();
      case 'jail': {
        const lap = this.s.lap;
        if (p.gojf > 0) return e.choose('card');
        if (lap <= 3 || netWorth(this.s, p) < 4000) {
          if (p.cash >= 300) return e.choose('pay');
        }
        return e.choose('roll');
      }
      case 'deal': return this.actDeal();
      case 'casino': {
        if (this.d.chaosIQ > 0.4 && p.cash > 800 && rng.chance(0.5 * this.d.chaosIQ)) {
          const bet = rng.pick(['high', 'low', 'seven']);
          return e.choose({ bet, stake: 100 });
        }
        return e.choose('leave');
      }
      case 'pitch': return this.actPitch();
      case 'recruit': {
        const joinCost = pend.halfCost;
        if (p.cash > joinCost * 3 && this.d.chaosIQ >= 0.5) return e.choose('join');
        if (p.cash >= pend.fee) return e.choose('decline');
        return e.choose('join');
      }
      case 'exchange': return this.actExchange();
      case 'gateway': return this.actGateway();
      case 'select': return this.actSelect();
      case 'debt': return this.actDebt();
      case 'trade': return this.actTradeResponse();
      case 'skip': return e.choose({});
      case 'end': return e.choose({});
      default: return e.choose({});
    }
  }

  actPreRoll() {
    const e = this.e, p = this.p, rng = e.rng, flags = this.s.flags;
    this.holdCash = 0; // cash held back this turn to afford a market deal

    // Dreams are bought at the STOCK EXCHANGE (see actExchange) — the one place
    // the bank will sell you a yacht.
    // 1) Deal market moved to the Stock Exchange (board place). Pre-roll keeps:
    //    builds, items, property buys, unmortgage — the landlording half of the game.
    const savingDream = this.s.flags.winMode === 'freedom' && p.freedom && p.dreams.length === 0;
    if (false) {
      const wantBig = this.s.lap >= 4 || passiveIncome(this.s, p) > expensesOf(this.s, p) * 0.5;
      const d = wantBig ? this.s.market?.big : this.s.market?.small;
      const alt = wantBig ? this.s.market?.small : this.s.market?.big;
      const premium = (x) => x ? Math.round(x.cost * 1.1) : Infinity;
      const worth = (x) => x ? (x.cf || 0) * 16 + (x.shares ? x.shares * 12 : 0) + (x.flip ? (x.flip[0] + x.flip[1]) / 2 : x.val || 0) : 0;
      let pick = null;
      if (d && worth(d) > premium(d) * 0.7 && p.cash > premium(d) + this.reserveCash() * 0.5) pick = tierName(d, wantBig);
      else if (alt && worth(alt) > premium(alt) * 0.7 && p.cash > premium(alt) + this.reserveCash() * 0.5) pick = wantBig ? 'small' : 'big';
      if (pick) { e.do('buyDeal', { tier: pick }); }
      else {
        // saving goal: hold most of the cash if a good deal is close to affordable
        const target = (d && worth(d) > premium(d) * 0.7) ? premium(d) : (alt && worth(alt) > premium(alt) * 0.7) ? premium(alt) : 0;
        if (target !== Infinity && target > p.cash && target - p.cash < expensesOf(this.s, p) * 2) this.holdCash = target;
      }
    }

    // 2) Build — best ROI district, respect reserve (+ held cash)
    if (flags.evenBuild !== undefined) {
      const candidates = [];
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = this.s.props[i];
        if (!pr || pr.owner !== this.seat || pr.mortgaged) continue;
        const dist = TILES[i].district;
        const tiles = DISTRICT_TILES[dist];
        if (!tiles.every(x => this.s.props[x].owner === this.seat)) continue;
        const maxL = MAX_LEVEL(dist);
        if (pr.level >= maxL) continue;
        const cost = e.price(buildingCost(TILES[i].price) * (pr.level + 1 === 6 ? 2 : 1));
        candidates.push({ tile: i, cost, roi: this.districtROI(dist) });
      }
      candidates.sort((a, b) => b.roi - a.roi);
      for (const c of candidates) {
        if (p.cash > c.cost + this.reserveCash() + this.holdCash * 0.7) { e.do('build', { tile: c.tile }); break; }
      }
    }

    // 3) Stocks + deals + loans + trades now happen at the STOCK EXCHANGE tile.
    // 5) Pyramid happens at the PYRAMID PITCH tile.

    // 6) Loans when squeezed (but solvent)
    if (flags.cashflow && p.cash < this.reserveCash() * 0.3 && p.loans < 6 && passiveIncome(this.s, p) > expensesOf(this.s, p) * 0.6) {
      e.do('loan', { units: 2 });
    }

    // 5) Unmortgage cheap lifts when rich
    if (p.cash > this.reserveCash() * 2) {
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = this.s.props[i];
        if (pr && pr.owner === this.seat && pr.mortgaged && p.cash > Math.round(e.price(TILES[i].price) / 2 * 1.1) + this.reserveCash()) {
          e.do('unmortgage', { tile: i }); break;
        }
      }
    }

    // 7) Items
    if (flags.items) this.actItems();

    // 8) Trades are proposed from the Stock Exchange corner now.

    // 9) Jail-free item usage is automatic via jail prompt.
    // Roll!
    return e.do('roll');
  }

  // A gateway space visit: unowned ones are bought like any property (first), then the
  // space's own system is used at the visit's rates. One visit, two opportunities.
  actGateway() {
    const e = this.e, p = this.p, pend = this.s.pending;
    const tile = pend.tile;
    if (pend.unowned) {
      const v = this.tileValue(tile);
      const dreamFloor = (this.s.flags.winMode === 'freedom' && p.freedom && p.dreams.length === 0)
        ? DREAMS[0].cost : 0;
      const afford = p.cash - pend.price > dreamFloor + this.reserveCash() * 0.25;
      if (!this.err() && afford && pend.price <= v * 1.6) return e.choose('buy');
      return e.choose('pass');
    }
    if (pend.gateway === 'stocks' && this.s.flags.stocks && this.d.stockPlay > 0) this.actStocks(tile);
    if (pend.gateway === 'deals' && this.s.flags.deals && !p.dealsThisLap) {
      const wantBig = this.s.lap >= 4 || passiveIncome(this.s, p) > expensesOf(this.s, p) * 0.5;
      const d = wantBig ? this.s.market?.big : this.s.market?.small;
      const alt = wantBig ? this.s.market?.small : this.s.market?.big;
      const rate = e.gatewayRate(p, tile);
      const premium = (x) => x ? Math.round(x.cost * 1.1 * (1 - rate)) : Infinity;
      const worth = (x) => x ? (x.cf || 0) * 16 + (x.shares ? x.shares * 12 : 0) + (x.flip ? (x.flip[0] + x.flip[1]) / 2 : x.val || 0) : 0;
      if (d && worth(d) > premium(d) * 0.7 && p.cash > premium(d) + this.reserveCash() * 0.5) e.do('buyDeal', { tier: wantBig ? 'big' : 'small', at: tile });
      else if (alt && worth(alt) > premium(alt) * 0.7 && p.cash > premium(alt) + this.reserveCash() * 0.5) e.do('buyDeal', { tier: wantBig ? 'small' : 'big', at: tile });
    }
    if (pend.gateway === 'loans' && this.s.flags.cashflow) {
      if (p.cash < this.reserveCash() * 0.3 && p.loans < 6 && passiveIncome(this.s, p) > expensesOf(this.s, p) * 0.6) {
        e.do('loan', { units: 2, at: tile });
      } else if (p.loans > 0 && p.cash > this.reserveCash() * 2.2) {
        e.do('repay', { units: clampInt(p.loans, 1, Math.floor(p.cash / 550)), at: tile });
      }
    }
    return e.choose({ type: 'continue' });
  }

  // The Stock Exchange visit: dreams, stocks, deal market, loans, trades — then the bell.
  actExchange() {
    const e = this.e, p = this.p;
    const savingDream = this.s.flags.winMode === 'freedom' && p.freedom && p.dreams.length === 0;
    // Dreams FIRST — the Freedom win condition beats further investing
    if (p.freedom && this.s.flags.cashflow) {
      for (const d of DREAMS) {
        if (!p.dreams.some(x => x.id === d.id) && p.cash >= d.cost) { e.do('dream', { id: d.id }); break; }
      }
    }
    // deals first (the cashflow engine) — one per lap, broker premium included
    if (this.s.flags.deals && !savingDream) {
      const wantBig = this.s.lap >= 4 || passiveIncome(this.s, p) > expensesOf(this.s, p) * 0.5;
      const d = wantBig ? this.s.market?.big : this.s.market?.small;
      const alt = wantBig ? this.s.market?.small : this.s.market?.big;
      const premium = (x) => x ? Math.round(x.cost * 1.1) : Infinity;
      const worth = (x) => x ? (x.cf || 0) * 16 + (x.shares ? x.shares * 12 : 0) + (x.flip ? (x.flip[0] + x.flip[1]) / 2 : x.val || 0) : 0;
      if (d && worth(d) > premium(d) * 0.7 && p.cash > premium(d) + this.reserveCash() * 0.5) e.do('buyDeal', { tier: wantBig ? 'big' : 'small' });
      else if (alt && worth(alt) > premium(alt) * 0.7 && p.cash > premium(alt) + this.reserveCash() * 0.5) e.do('buyDeal', { tier: wantBig ? 'small' : 'big' });
    }
    // stocks
    if (this.s.flags.stocks && this.d.stockPlay > 0) this.actStocks();
    // loans when squeezed
    if (this.s.flags.cashflow && p.cash < this.reserveCash() * 0.3 && p.loans < 6 && passiveIncome(this.s, p) > expensesOf(this.s, p) * 0.6) {
      e.do('loan', { units: 2 });
    }
    // trades (occasionally, from sharp+)
    if (this.d.tradeFreq > 0 && e.rng.chance(this.d.tradeFreq * 0.6)) this.actProposeTrade();
    return e.choose({ type: 'continue' });
  }

  actStocks(at) {
    const e = this.e, p = this.p;
    const reserve = this.reserveCash() + (this.holdCash || 0) * 0.8; // don't starve the deal fund
    // sell spikes (settled shares only — fresh buys settle at Go)
    for (const d of DISTRICTS) {
      const st = this.s.stocks[d.id];
      const sellable = e.settledShares(p, d.id);
      if (sellable > 0 && st.price > d.par * 1.45 && this.d.stockPlay >= 1) {
        e.do('sellStock', { dist: d.id, n: Math.ceil(sellable / 2), at });
      }
    }
    // own-district compounding: hold ~25-35 shares of districts where we own 3+ tiles
    for (const d of DISTRICTS) {
      const tiles = DISTRICT_TILES[d.id];
      const mine = tiles.filter(i => this.s.props[i].owner === this.seat).length;
      const st = this.s.stocks[d.id];
      const want = mine >= 3 ? 30 : mine >= 2 && this.d.stockPlay >= 1 ? 15 : 0;
      const have = p.stocks[d.id];
      if (want > have && st.price <= d.par * 1.25) {
        const n = Math.min(want - have, Math.floor((p.cash - reserve) / Math.max(1, st.price)));
        if (n >= 5) e.do('buyStock', { dist: d.id, n, at });
      }
    }
    // dip buying
    if (this.d.stockPlay >= 1) {
      for (const d of DISTRICTS) {
        const st = this.s.stocks[d.id];
        if (st.price < d.par * 0.85 && p.cash > reserve * 1.5) {
          const n = Math.min(20, Math.floor((p.cash - reserve) / Math.max(1, st.price)));
          if (n >= 5) e.do('buyStock', { dist: d.id, n, at });
        }
      }
    }
    // mogul corner: rush to 25+ if contested
    if (this.d.stockPlay >= 1) {
      for (const d of DISTRICTS) {
        const tiles = DISTRICT_TILES[d.id];
        const mine = tiles.filter(i => this.s.props[i].owner === this.seat).length;
        if (mine >= 2 && p.stocks[d.id] > 0 && p.stocks[d.id] < 25) {
          const st = this.s.stocks[d.id];
          const n = Math.min(25 - p.stocks[d.id], Math.floor((p.cash - reserve) / Math.max(1, st.price)));
          if (n >= 3) e.do('buyStock', { dist: d.id, n, at });
        }
      }
    }
  }

  actPyramid() {
    const e = this.e, p = this.p, py = this.s.pyramid, d = this.d;
    if (!py.open) return;
    const risk = Math.max(0, py.hype - 55);
    if (!p.pyramid) {
      if (py.hype <= d.pyrJoin && p.cash > 3000) {
        const tier = p.cash > 12000 ? 'gold' : p.cash > 6000 ? 'silver' : 'bronze';
        e.do('joinPyramid', { tier });
      }
      return;
    }
    // exit?
    if (py.hype >= d.pyrExit || (risk > 20 && this.d.stockPlay >= 1)) { e.do('cashOutPyramid'); return; }
    // upgrade in the sweet zone
    if (py.hype > 30 && py.hype < d.pyrExit - 12) {
      const cur = PYRAMID_TIERS.find(t => t.id === p.pyramid.tier);
      if (p.cash > 9000 && cur.id === 'bronze') e.do('upgradePyramid', { tier: 'silver' });
      else if (p.cash > 16000 && (cur.id === 'silver' || cur.id === 'bronze')) e.do('upgradePyramid', { tier: 'gold' });
    }
    // recruit (sharp/ruthless, mid hype)
    if (d.recruit && py.hype > 25 && py.hype < 70 && p.cash > 1500 && e.rng.chance(0.5)) {
      const broke = alivePlayers(this.s).filter(x => x.id !== this.seat && !x.pyramid);
      if (broke.length > 0) {
        // go through prompt path for flavor + commission
        const pend = this.s.pending;
        if (pend && pend.kind === 'roll') { e.s.pending = { kind: 'pitch', player: this.seat, viaAI: true }; }
        e.choose({ type: 'recruit' });
        return;
      }
    }
  }

  actItems() {
    const e = this.e, p = this.p;
    if (p.items.includes('remoteDice') && !this.err()) {
      // aim for own-property with big rent? simplest: aim at a set tile we miss
      let target = -1, bestV = 0;
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = this.s.props[i];
        if (!pr || pr.owner === -1) { const v = this.tileValue(i); if (pr === null && v === 0) continue; }
        if (pr && pr.owner === this.seat && pr.level >= 3) { /* land on own for safety */ }
      }
      // choose to land on Pool if rich pool, else skip
      if (this.s.pool > 3000) { target = 31; }
      if (target >= 0) {
        const need = ringDistance(p.pos, target);
        if (need != null && need >= 2 && need <= 12) { e.do('useItem', { item: 'remoteDice', value: need }); return; }
      }
    }
    if (p.items.includes('roadblock')) {
      // place on highest-traffic tile 1-12 ahead that isn't ours
      let best = -1, bv = 0;
      let cur = p.pos;
      for (let k = 2; k <= 24; k++) {
        cur = nextInRing(cur);
        const t = cur;
        if (this.s.roadblocks[t] != null) continue;
        const v = this.e.traffic[t] * (TILES[t].type === 'property' && this.s.props[t] && this.s.props[t].owner !== this.seat && this.s.props[t].owner !== -1 ? 2 : 1);
        if (v > bv) { bv = v; best = t; }
      }
      if (best >= 0) e.do('useItem', { item: 'roadblock', tile: best });
    }
    if (p.items.includes('bomb') && this.d.chaosIQ >= 0.8) {
      const leader = currentLeader(this.s);
      if (leader && leader.id !== this.seat) {
        let best = -1, bl = 0;
        for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === leader.id && pr.level > bl) { bl = pr.level; best = i; } }
        if (best >= 0 && bl >= 3) e.do('useItem', { item: 'bomb', tile: best });
      }
    }
  }

  actProposeTrade() {
    const e = this.e, p = this.p;
    // find districts where I own all-but-one and the last tile is owned by someone weak-ish
    for (const d of DISTRICTS) {
      const tiles = DISTRICT_TILES[d.id];
      const mine = tiles.filter(i => this.s.props[i].owner === this.seat);
      if (mine.length !== tiles.length - 1) continue;
      const need = tiles.find(i => this.s.props[i].owner >= 0 && this.s.props[i].owner !== this.seat);
      if (need == null) continue;
      const owner = this.e.P(this.s.props[need].owner);
      if (owner.isAI === false && false) continue;
      // offer cash + maybe one of our spare singles
      const mySingles = [];
      for (const dd of DISTRICTS) {
        if (dd.id === d.id) continue;
        const ts = DISTRICT_TILES[dd.id];
        if (ts.every(i => this.s.props[i].owner === this.seat)) continue; // never break sets
        const single = ts.filter(i => this.s.props[i].owner === this.seat);
        if (single.length === 1) mySingles.push(single[0]);
      }
      const price = e.price(TILES[need].price);
      const cash = Math.min(p.cash - this.reserveCash(), Math.round(price * 1.2));
      if (cash < price * 0.8) continue;
      const offer = { to: owner.id, give: { cash }, get: { props: [need] } };
      if (mySingles.length && e.rng.chance(0.5)) {
        const swapTile = e.rng.pick(mySingles);
        offer.give.props = [swapTile];
        offer.give.cash = Math.max(0, cash - Math.round(e.price(TILES[swapTile].price)));
      }
      if (offer.give.cash >= 0) { e.do('proposeTrade', offer); return; }
    }
  }

  offerValue(side) {
    let v = side.cash || 0;
    for (const t of side.props || []) {
      const o = this.s.props[t] ? this.s.props[t].owner : -1;
      v += this.tileValue(t) * (o === this.seat ? 1 : 0);
    }
    for (const d in (side.stocks || {})) v += this.s.stocks[d].price * side.stocks[d];
    v += (side.gojf || 0) * 150;
    return v;
  }
  actTradeResponse() {
    const e = this.e, offer = this.s.tradeOffer;
    const gain = this.offerValue(offer.get), loss = this.offerValue(offer.give);
    const theirId = offer.from;
    const completesTheirs = (offer.get.props || []).some(t => {
      const dist = TILES[t].district;
      const tiles = DISTRICT_TILES[dist];
      return tiles.every(i => i === t || this.s.props[i].owner === theirId);
    });
    let need = this.d.tradeNeed;
    if (completesTheirs) need += 0.8;
    const accept = gain >= loss * need && !this.err();
    e.choose(accept ? 'accept' : 'decline');
  }

  actDeal() {
    const e = this.e, p = this.p, pend = this.s.pending;
    const reserve = this.reserveCash();
    const pick = (list) => {
      let best = null, bv = 0;
      for (const d of list) {
        if (p.cash - d.cost < reserve) continue;
        const v = (d.cf || 0) * 12 + (d.shares ? d.shares * 12 : 0) + (d.flip ? (d.flip[0] + d.flip[1]) / 2 - d.cost : d.val * 0.1);
        if (v > bv) { bv = v; best = d; }
      }
      return best;
    };
    const early = this.s.lap < 4;
    let d = pick(early ? pend.small : pend.big);
    if (!d && p.cash > 2000) d = pick(pend.small);
    if (d) return e.choose({ tier: pend.big.includes(d) ? 'big' : 'small', card: d.id });
    return e.choose(null);
  }

  actPitch() {
    const e = this.e, p = this.p, py = this.s.pyramid, d = this.d;
    if (!py.open) return e.choose(null);
    if (!p.pyramid) {
      if (py.hype <= d.pyrJoin && p.cash > 2500) return e.choose({ type: 'join', tier: p.cash > 12000 ? 'gold' : p.cash > 6000 ? 'silver' : 'bronze' });
      return e.choose(null);
    }
    if (py.hype >= d.pyrExit) return e.choose({ type: 'cashout' });
    if (d.recruit && py.hype > 25 && py.hype < 70 && p.cash > 1500 && e.rng.chance(0.6)) return e.choose({ type: 'recruit' });
    return e.choose(null);
  }

  actSelect() {
    const e = this.e, pend = this.s.pending, p = this.p;
    const kind = pend.selectKind;
    if (kind === 'transit') {
      const opts = pend.options || [];
      let best = null, bv = 1.0; // staying is worth ~1
      for (const t of opts) {
        const tile = TILES[t];
        let v = 0.9; // default: mild preference to stay put
        if (tile.type === 'property') {
          const o = this.s.props[t].owner;
          if (o === -1) v = 1.2 + this.tileValue(t) / 800;
          else if (o === this.seat) v = 1.05 + this.s.props[t].level * 0.1;
          else v = 0.4; // rival rent
        } else if (tile.type === 'pool') v = this.s.pool > 2000 ? 1.5 : 0.8;
        else if (tile.type === 'fortune' || tile.type === 'frenzy') v = 1.0 + this.d.chaosIQ * 0.15;
        else if (tile.type === 'casino') v = 0.6 + this.d.chaosIQ * 0.5;
        else if (tile.type === 'start') v = 1.1; // payday corner
        if (v > bv) { bv = v; best = t; }
      }
      return e.choose(best != null ? { tile: best } : {});
    }
    if (kind === 'freeMove') {
      // best: complete own set tile > Exchange > GO
      let best = 0, bv = -1;
      for (const t of pend.tiles) {
        let v = 0;
        if (TILES[t].type === 'property') {
          const o = this.s.props[t].owner;
          if (o === this.seat) v = 5 + this.e.traffic[t] * 10;
          else if (o === -1) v = this.tileValue(t) / 100;
          else v = 0.1; // avoid rival rent
        } else if (TILES[t].type === 'pool') v = this.s.pool / 800;
        else if (TILES[t].type === 'exchange') v = 1.2;
        else if (TILES[t].type === 'fortune') v = 0.8;
        if (v > bv) { bv = v; best = t; }
      }
      return e.choose({ tile: best });
    }
    if (kind === 'auctionPick') {
      let best = pend.tiles[0], bv = -1;
      for (const t of pend.tiles) { const v = this.tileValue(t); if (v > bv) { bv = v; best = t; } }
      return e.choose({ tile: best });
    }
    if (kind === 'skipPick') {
      const leader = currentLeader(this.s);
      return e.choose({ player: leader.id === this.seat ? pend.players.find(i => i !== this.seat) : leader.id });
    }
    if (kind === 'swapPick') {
      // choose weakest rival with property, and our cheapest non-set tile
      const rivals = pend.players.filter(i => {
        return DISTRICT_TILES_ARR().some(t => this.s.props[t].owner === i);
      });
      if (rivals.length === 0) return e.choose({ player: pend.players[0], myTile: null });
      const other = rivals[0];
      let myTile = null, bv = 1e9;
      for (const t of DISTRICT_TILES_ARR()) {
        const pr = this.s.props[t];
        if (pr.owner !== this.seat) continue;
        const dist = TILES[t].district;
        if (DISTRICT_TILES[dist].every(i => this.s.props[i].owner === this.seat)) continue; // never break sets
        if (TILES[t].price < bv) { bv = TILES[t].price; myTile = t; }
      }
      return e.choose({ player: other, myTile });
    }
    return e.choose({});
  }

  actDebt() {
    const e = this.e, p = this.p, debt = e.debt;
    if (!debt) return;
    // liquidate: stocks (profitable first), pyramid cashout, sell buildings (non-critical), mortgage
    const need = () => debt.amount - p.cash;
    if (need() > 0) {
      for (const d of DISTRICTS) {
        if (need() <= 0) break;
        const sellable = e.settledShares(p, d.id);
        if (sellable > 0 && this.s.stocks[d.id].price >= d.par) e.do('sellStock', { dist: d.id, n: sellable });
      }
    }
    if (need() > 0 && p.pyramid) e.do('cashOutPyramid');
    if (need() > 0) {
      // sell buildings from least-complete districts first
      const ownedTiles = [];
      for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === this.seat && pr.level > 0) ownedTiles.push(i); }
      ownedTiles.sort((a, b) => this.setCompleteness(TILES[a].district) - this.setCompleteness(TILES[b].district));
      for (const t of ownedTiles) { if (need() <= 0) break; e.do('sellBuilding', { tile: t }); }
    }
    if (need() > 0) {
      // mortgage non-set props first, then anything
      const props = [];
      for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === this.seat && !pr.mortgaged) props.push(i); }
      props.sort((a, b) => this.setCompleteness(TILES[a].district) - this.setCompleteness(TILES[b].district) || TILES[a].price - TILES[b].price);
      for (const t of props) { if (need() <= 0) break; e.do('mortgage', { tile: t }); }
    }
    if (p.cash >= debt.amount) e.choose('pay');
    else e.choose('bankrupt');
  }
  setCompleteness(dist) {
    const tiles = DISTRICT_TILES[dist];
    return tiles.filter(i => this.s.props[i].owner === this.seat).length / tiles.length;
  }

  actAuction() {
    const e = this.e, pend = this.s.pending, p = this.p;
    const a = this.s.auction;
    if (!a) return;
    const v = this.tileValue(a.tile);
    const rivalSetPull = DISTRICT_TILES[TILES[a.tile].district].filter(i => this.s.props[i].owner === a.bidder && a.bidder !== this.seat).length;
    let maxBid = Math.max(Math.min(Math.round(v * (this.d.bidFactor + 0.45)), p.cash), Math.min(Math.round(v * 0.7), p.cash));
    // saving for the Dream: not one dollar of the fund goes under the hammer
    if (this.s.flags.winMode === 'freedom' && p.freedom && p.dreams.length === 0) {
      maxBid = Math.min(maxBid, Math.max(0, p.cash - DREAMS[0].cost));
    }
    // never bid into the Dream fund once free in a freedom-mode game
    if (this.s.flags.winMode === 'freedom' && p.freedom && p.dreams.length === 0) {
      maxBid = Math.min(maxBid, Math.max(0, p.cash - DREAMS[0].cost));
    }
    if (a.bidder === this.seat) maxBid = Math.min(maxBid, Math.round(v * this.d.bidFactor * 1.05)); // defend own bid a bit
    if (rivalSetPull >= 2) maxBid = Math.round(maxBid * 1.2); // deny
    if (this.err()) maxBid = Math.round(maxBid * 0.85);
    if (p.cash - (a.bid + 10) < this.reserveCash() * 0.5) return e.choose({ type: 'pass' });
    if (a.bidder === -1) {
      const open = Math.min(Math.max(10, Math.round(v * 0.3)), maxBid);
      if (open >= 10) return e.choose({ type: 'bid', amount: open });
      return e.choose({ type: 'pass' });
    }
    const next = a.bid + 10;
    const bid = Math.min(next, p.cash);
    if (next <= maxBid && bid >= next) return e.choose({ type: 'bid', amount: next });
    return e.choose({ type: 'pass' });
  }
}
function DISTRICT_TILES_ARR() { const a = []; for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].type === 'property') a.push(i); return a; }
function tierName(d, wantBig) { return wantBig ? 'big' : 'small'; }
function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.floor(v))); }
