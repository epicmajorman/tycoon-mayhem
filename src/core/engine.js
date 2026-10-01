// TYCOON MAYHEM engine — authoritative, seeded, event-sourced, platform-agnostic.
// All player decisions flow through do(action, payload). The engine never reads UI.
import { Emitter } from './events.js?v=8';
import { RNG } from './rng.js?v=8';
import { BOARD_SIZE, TILES, DISTRICTS, D, DISTRICT_TILES, CORNER_SEALS, MAX_LEVEL, RENT_MULT, baseRent, buildingCost, tileTraffic, nextInRing, prevInRing, ringOf, ringSize, transitLinks, JAIL_TILE, setActiveBoard, BOARD_META } from '../data/board.js?v=8';
import { FORTUNE_CARDS, FRENZY_CARDS, SMALL_DEALS, BIG_DEALS, DREAMS, ITEMS, PYRAMID_TIERS, WHEEL_SEGMENTS, makeDeck } from '../data/cards.js?v=8';
import { PROFESSIONS } from '../data/professions.js?v=8';
import {
  netWorth, passiveIncome, expensesOf, salaryOf, sealsCount, alivePlayers, currentLeader,
  buildingLevelsCost, stockValueOf, pyramidValueOf,
} from './state.js?v=8';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

export class Engine {
  constructor(state) {
    setActiveBoard(state.flags.boardId || 'standard');
    this.s = state;
    this.rng = new RNG(state.seed ^ 0x9e3779b9);
    this.emitter = new Emitter();
    this.fortuneDeck = makeDeck(this.rng, FORTUNE_CARDS);
    this.frenzyDeck = makeDeck(this.rng, FRENZY_CARDS);
    this.traffic = tileTraffic();
    this.debt = null;
    this.defer = false; this.speedBonus = null;
    this.justResolvedTile = -1;
  }
  on(t, f) { return this.emitter.on(t, f); }
  emit(type, data = {}) { return this.emitter.emit(type, data); }

  // ---------- tiny helpers ----------
  get flags() { return this.s.flags; }
  cur() { return this.s.players[this.s.turn]; }
  P(i) { return this.s.players[i]; }
  log(msg, icon = '•') { this.emit('log', { msg, icon }); }
  chaos(base) { return Math.round(base * (0.55 + 0.75 * (this.flags.chaos ?? 1))); }
  price(base) { return Math.round((base * this.s.inflationIdx) / 5) * 5; }

  prompt(kind, player, data = {}) {
    this.s.phase = kind === 'roll' ? 'roll' : kind === 'end' ? 'end' : 'await';
    this.s.pending = { kind, player, ...data };
    this.emit('prompt', { kind, player, ...data });
  }
  has(p, item) { return p.items.includes(item); }
  consume(p, item) { const i = p.items.indexOf(item); if (i >= 0) p.items.splice(i, 1); }

  // Money movement with Wealth Idol + Shield handling. `to` = 'pool' | 'bank' | playerIdx
  charge(p, amount, to, reason, opts = {}) {
    amount = Math.round(amount);
    if (amount <= 0) return true;
    if (this.flags.statuses && p.statuses.wealthIdol) {
      this.emit('fx:shield', { player: p.id, reason });
      this.log(`${p.name}'s Wealth Idol refuses the payment (${reason})`, '🛡️');
      return true;
    }
    if (this.has(p, 'shield') && !opts.pierceShield) {
      this.consume(p, 'shield');
      this.emit('fx:shield', { player: p.id, reason });
      this.log(`${p.name}'s Insurance Shield absorbed a $${amount} hit`, '🛡️');
      return true;
    }
    amount = Math.round(amount);
    if (p.cash < amount) { this.openDebt(p, amount, to, reason); return false; }
    p.cash -= amount;
    this.transfer(amount, to);
    this.emit('cash', { player: p.id, delta: -amount, reason, to });
    return true;
  }
  earn(p, amount, reason, from = 'bank') {
    amount = Math.round(amount);
    if (amount <= 0) return;
    p.cash += amount;
    this.emit('cash', { player: p.id, delta: amount, reason, from });
  }
  transfer(amount, to) {
    if (to === 'pool') this.s.pool += amount;
    else if (typeof to === 'number' && to >= 0) this.P(to).cash += amount;
    if (typeof to === 'number' && to >= 0) this.emit('cash', { player: to, delta: amount, reason: 'received', from: 'player' });
  }

  // ---------- DEBT ----------
  openDebt(p, amount, to, reason) {
    this.debt = { player: p.id, amount, to, reason };
    this.log(`${p.name} owes ${money(amount)} (${reason}) but is short on cash!`, '⚠️');
    this.emit('debt', { player: p.id, amount, reason });
    this.prompt('debt', p.id, { amount, reason });
  }
  debtPayable() { return this.debt && this.P(this.debt.player).cash >= this.debt.amount; }
  settleDebt() {
    const d = this.debt, p = this.P(d.player);
    p.cash -= d.amount;
    this.transfer(d.amount, d.to);
    this.emit('cash', { player: p.id, delta: -d.amount, reason: d.reason, to: d.to });
    this.log(`${p.name} settled ${money(d.amount)}`, '💸');
    this.debt = null;
    this.s.pending = null;
    this.emit('debtCleared', { player: p.id });
    this.maybeFinish();
  }
  doBankrupt() {
    const d = this.debt;
    this.bankrupt(this.P(d.player), typeof d.to === 'number' ? this.P(d.to) : null);
    this.debt = null;
    this.s.pending = null;
    this.endTurnNow();
  }
  bankrupt(p, creditor) {
    p.bankrupt = true;
    this.emit('bankrupt', { player: p.id, creditor: creditor ? creditor.id : -1 });
    this.log(`💀 ${p.name} is BANKRUPT!`, '💀');
    if (creditor && !creditor.bankrupt) {
      creditor.cash += p.cash;
      for (const d of DISTRICTS) {
        creditor.stocks[d.id] += p.stocks[d.id]; p.stocks[d.id] = 0;
        creditor.unsettled[d.id] = (creditor.unsettled[d.id] || 0) + (p.unsettled[d.id] || 0); p.unsettled[d.id] = 0;
      }
      creditor.assets.push(...p.assets); p.assets = [];
      creditor.gojf += p.gojf; p.gojf = 0;
      creditor.items.push(...p.items); p.items = [];
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = this.s.props[i];
        if (pr && pr.owner === p.id) pr.owner = creditor.id;
      }
      this.log(`${p.name}'s empire transfers to ${creditor.name}`, '📦');
    } else {
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = this.s.props[i];
        if (pr && pr.owner === p.id) { pr.owner = -1; pr.level = 0; pr.mortgaged = false; }
      }
      for (const d of DISTRICTS) {
        const n = p.stocks[d.id];
        if (n > 0) { this.bumpStock(d.id, -Math.min(8, Math.ceil(n / 12))); p.stocks[d.id] = 0; }
      }
      if (p.pyramid) this.leavePyramid(p, true);
      this.s.pool += Math.max(0, p.cash); p.cash = 0;
      p.assets = []; p.items = []; p.gojf = 0;
      for (const k in this.s.roadblocks) if (this.s.roadblocks[k] === p.id) delete this.s.roadblocks[k];
    }
    this.emit('fx:bankrupt', { player: p.id });
    this.checkWin();
  }

  // ---------- TURN FLOW ----------
  beginTurn() {
    const p = this.cur();
    this.s.doubles = 0; this.s.rollsThisTurn = 0; this.s.pending = null; this.debt = null;
    if (p.bankrupt) { this.advanceTurn(); return; }
    this.emit('turnStart', { player: p.id });
    if (p.skipTurns > 0) {
      p.skipTurns--;
      this.log(`${p.name} sits out this turn (${p.skipTurns} left)`, '⏭️');
      this.prompt('skip', p.id, {});
      return;
    }
    if (p.inJail) { this.prompt('jail', p.id, { bail: 100 }); return; }
    this.prompt('roll', p.id, {});
  }
  advanceTurn() {
    const s = this.s;
    let n = s.turn;
    for (let k = 1; k <= s.players.length; k++) {
      const i = (s.turn + k) % s.players.length;
      if (!s.players[i].bankrupt) { n = i; break; }
    }
    if (n <= s.turn) { s.lap++; this.roundEnd(); if (s.gameOver) return; }
    s.turn = n; s.turnCount++;
    this.beginTurn();
  }
  endTurnNow() {
    const p = this.cur();
    this.s.pending = null; this.debt = null;
    this.checkWin(); if (this.s.gameOver) return;
    // doubles -> roll again
    if (this.s.lastWasDoubles && !p.inJail && !p.bankrupt) {
      this.s.doubles++;
      if (this.flags.doublesJail && this.s.doubles >= 3) {
        this.sendToJail(p, 'Speeding (3 doubles)');
        this.finishTurn(true);
        return;
      }
      this.log(`${p.name} rolled doubles — go again!`, '🎲');
      this.emit('fx:doubles', { player: p.id, count: this.s.doubles });
      this.prompt('roll', p.id, {});
      return;
    }
    this.finishTurn(true);
  }
  finishTurn(advance) {
    this.s.lastWasDoubles = false;
    const p = this.cur();
    if (!p.bankrupt) this.checkTargetWin(p);
    if (this.s.gameOver) return;
    if (advance) this.advanceTurn();
    else this.prompt('roll', p.id, {});
  }
  afterTurnAction() {
    // resolution of a tile or debt finished; decide next: doubles re-roll or end
    if (this.debt) return; // still in debt
    if (this.s.pending && ['buy', 'auction', 'jail', 'deal', 'casino', 'pitch', 'exchange', 'select', 'gateway'].includes(this.s.pending.kind)) return;
    this.endTurnNow();
  }

  // ---------- DICE & MOVEMENT ----------
  doRoll() {
    const p = this.cur();
    if (this.s.phase !== 'roll' || this.s.pending?.player !== p.id) return;
    let d1 = this.rng.int(1, 6), d2 = this.rng.int(1, 6), speed = null;
    if (this.s.forcedTotal) { d1 = Math.min(6, this.s.forcedTotal - 1); d2 = this.s.forcedTotal - d1; if (d2 > 6) { d1 = 6; d2 = this.s.forcedTotal - 6; } this.s.forcedTotal = null; }
    if (this.flags.speedDie && p.laps >= 1) {
      const face = this.rng.pick([1, 2, 3, 'BUS', 'BUS', 'MR']);
      if (typeof face === 'number') speed = face;
      else { speed = face; }
    }
    this.s.dice = [d1, d2]; this.s.speedFace = speed;
    this.s.lastWasDoubles = d1 === d2;
    this.s.rollsThisTurn++;
    this.emit('rolled', { player: p.id, d1, d2, speed });
    const steps = d1 + d2 + (typeof speed === 'number' ? speed : 0);
    const triples = speed != null && typeof speed === 'number' && d1 === d2 && d1 === speed;
    this.s.pending = null; this.s.phase = 'move';
    if (triples) {
      this.log(`TRIPLES! ${p.name} may fly anywhere on the board.`, '✈️');
      this.prompt('select', p.id, { selectKind: 'freeMove', tiles: TILES.map((t, i) => i), title: 'Triples! Choose any tile' });
      return;
    }
    if (speed === 'BUS' || speed === 'MR') { this.defer = true; this.speedBonus = speed; }
    this.moveBy(p, steps, { speedFace: speed, total: d1 + d2 });
  }

  // Continuation gate: lets speed-die bonus moves (BUS/MR.TYCOON) run before the turn can end.
  maybeFinish() {
    if (this.defer && !this.s.pending && !this.debt && !this.s.auction && !this.s.gameOver) {
      this.defer = false;
      const p = this.cur(), sf = this.speedBonus;
      this.speedBonus = null;
      if (sf === 'BUS' && !p.bankrupt) {
        this.log(`🚌 ${p.name} catches the BUS — draw a Frenzy card!`, '🚌');
        const card = this.frenzyDeck.draw();
        this.emit('card', { deck: 'frenzy', card, player: p.id });
        this.applyCard(p, card);
        return;
      }
      if (sf === 'MR' && !p.bankrupt) {
        let target = -1;
        const rSize = ringSize(ringOf(p.pos));
        let cur = p.pos;
        for (let k = 1; k <= rSize; k++) {
          cur = nextInRing(cur);
          if (TILES[cur].type === 'property' && this.s.props[cur].owner === -1) { target = cur; break; }
        }
        if (target >= 0) {
          this.log(`🎩 MR. TYCOON strides to the next unowned property: ${TILES[target].name}.`, '🎩');
          let hop = p.pos;
          let hops = 0;
          while (hop !== target) { hop = nextInRing(hop); hops++; }
          hop = p.pos;
          for (let h = 1; h <= hops; h++) { hop = nextInRing(hop); this.emit('moveStep', { player: p.id, pos: hop, step: h, of: hops, bonus: true }); }
          p.pos = target;
          this.resolveTile(p, target, {});
          return;
        }
        this.log('MR. TYCOON finds nothing unowned. He tips his hat.', '🎩');
      }
    }
    this.afterTurnAction();
  }

  moveBy(p, steps, opts = {}) {
    const s = this.s;
    s.phase = 'move';
    const total = opts.total ?? steps; // 2-dice total drives transit parity
    let i = 0;
    for (; i < steps; i++) {
      p.pos = nextInRing(p.pos);
      this.emit('moveStep', { player: p.id, pos: p.pos, step: i + 1, of: steps });
      const t = TILES[p.pos];
      if (t.pay) { this.passStart(p, t.pay); if (p.bankrupt || p.inJail) { this.finishTurn(true); return; } }
      else if (CORNER_SEALS[p.pos] && this.flags.freeSeals && !p.seals[CORNER_SEALS[p.pos]]) {
        p.seals[CORNER_SEALS[p.pos]] = true;
        this.emit('fx:seal', { player: p.id, seal: CORNER_SEALS[p.pos] });
        this.log(`${p.name} collected the ${CORNER_SEALS[p.pos]} seal`, '🔷');
      }
      if (s.roadblocks[p.pos] != null && s.roadblocks[p.pos] !== p.id) {
        const owner = this.P(s.roadblocks[p.pos]);
        delete s.roadblocks[p.pos];
        this.log(`${p.name} hit ${owner.name}'s Roadblock!`, '🚧');
        this.charge(p, this.price(200), owner.id, 'Roadblock toll');
        if (p.bankrupt) return;
        break;
      }
      // Stock Exchange corner: reaching it (pass or land) opens the market and ends the move —
      // guaranteed market access every lap, Fortune-Street style.
      if (t.type === 'exchange') {
        this.log(`🔔 ${p.name} stops at the Stock Exchange.`, '📈');
        this.emit('tileLand', { player: p.id, tile: p.pos });
        this.prompt('exchange', p.id, {});
        return;
      }
      // Transit stations do NOTHING when passed — lane changes only happen when you
      // land on one and choose to ride (see resolveTile 'transit').
    }
    if (p.bankrupt) return;
    const landed = p.pos;
    this.resolveTile(p, landed, opts);
  }

  passStart(p, mult = 1) {
    p.laps++; p.stats.laps++;
    p.dealsThisLap = 0;
    // shares bought since the last Go settle here: sellable + dividend-earning
    let settling = 0;
    for (const d in p.unsettled) { settling += p.unsettled[d]; p.unsettled[d] = 0; }
    if (settling > 0) this.log(`${p.name}'s ${settling} new share${settling > 1 ? 's' : ''} settled at Go — now sellable.`, '🧾');
    this.emit('fx:lap', { player: p.id, laps: p.laps });
    let dbl = false;
    if (this.flags.statuses && p.statuses.doubleSalary) { dbl = true; delete p.statuses.doubleSalary; }
    const sal = Math.round(salaryOf(this.s, p) * mult * (BOARD_META.salaryMult || 1) * (dbl ? 2 : 1));
    if (dbl) this.log(`💰 ${p.name}'s doubled salary pays out ${money(sal)}!`, '💰');
    this.earn(p, sal, 'Salary');
    this.log(`${p.name} collects salary ${money(sal)}`, '💰');
    if (this.flags.cashflow) {
      const exp = expensesOf(this.s, p);
      if (exp > 0) { this.charge(p, exp, 'bank', 'Living expenses'); this.log(`${p.name} pays expenses ${money(exp)}`, '🧾'); }
      this.grantPyramidYield(p);
      // business income from deal assets
      const cfSum = p.assets.reduce((a, x) => a + (x.cf || 0), 0);
      if (cfSum > 0) { this.earn(p, cfSum, 'Business income'); }
      // rent roll: tenants pay their landlord every lap
      let roll = 0;
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = this.s.props[i];
        if (pr && pr.owner === p.id && !pr.mortgaged) roll += Math.round(baseRent(TILES[i].price) * (1 + pr.level) * 0.55);
      }
      if (roll > 0) { this.earn(p, roll, 'Rent roll'); this.log(`${p.name} collects ${money(roll)} rent roll`, '🏘️'); }
      this.checkFreedom(p);
    }
    if (this.flags.freeSeals && sealsCount(p) >= 4) {
      for (const k in p.seals) p.seals[k] = false;
      p.level++;
      this.emit('fx:promote', { player: p.id, level: p.level });
      this.log(`🔷 ${p.name} completed all 4 seals — PROMOTED to level ${p.level}!`, '⭐');
    }
    if (p.statuses.audit) { delete p.statuses.audit; this.charge(p, Math.round(p.cash * 0.15), 'pool', 'Tax audit'); }
    if (p.targetHit) { this.winGame(p, 'Reached the target and made it home!'); return; }
    if (this.flags.spinWheel && !this.s.gameOver && !p.bankrupt) this.spinWheel(p);
  }

  // ---------- LUCKY SPIN — the free prize wheel every completed lap ----------
  spinWheel(p) {
    const total = WHEEL_SEGMENTS.reduce((a, x) => a + x.weight, 0);
    let roll = this.rng.next() * total;
    let index = 0;
    for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
      roll -= WHEEL_SEGMENTS[i].weight;
      if (roll <= 0) { index = i; break; }
    }
    // the visual reveals the pre-picked result; effects apply right after so the
    // renderer's event queue plays: wheel spin → cash/floaters/jail in order
    this.emit('fx:spin', { player: p.id, segments: WHEEL_SEGMENTS, index });
    const seg = WHEEL_SEGMENTS[index];
    switch (seg.id) {
      case 'cash500': this.earn(p, this.chaos(500), 'Lucky Spin'); break;
      case 'cash150': this.earn(p, this.chaos(150), 'Lucky Spin'); break;
      case 'jackpot': this.earn(p, this.chaos(1500), 'Lucky Spin jackpot'); break;
      case 'shares': {
        const dist = this.rng.pick(DISTRICTS).id;
        this.giveShares(p, dist, 5, 'Lucky Spin');
        break;
      }
      case 'gojf': p.gojf++; this.log(`${p.name} wins a Get Out of Jail Free card on the wheel!`, '🎫'); break;
      case 'item': if (this.flags.items) this.giveItem(p, this.rng.pick(ITEMS)); break;
      case 'poolcut': {
        const cut = Math.round(this.s.pool * 0.25);
        this.s.pool = Math.max(0, this.s.pool - cut);
        this.earn(p, cut, 'Lucky Spin pool refund');
        break;
      }
      case 'dblsal':
        if (this.flags.statuses) { p.statuses.doubleSalary = 1; this.log(`💰 ${p.name} spins double salary for next lap!`, '💰'); this.emit('fx:status', { player: p.id, status: 'doubleSalary' }); }
        else this.earn(p, 400, 'Lucky Spin');
        break;
      case 'seal': {
        const missing = Object.keys(p.seals).filter(k => !p.seals[k]);
        if (missing.length) {
          const sealK = this.rng.pick(missing);
          p.seals[sealK] = true;
          this.emit('fx:seal', { player: p.id, seal: sealK });
          this.log(`◈ ${p.name} spun the ${sealK} seal!`, '🔷');
        } else this.earn(p, 300, 'Lucky Spin (seals full)');
        break;
      }
      case 'pay200': this.charge(p, this.chaos(200), 'pool', 'Lucky Spin misfortune'); break;
      case 'jail': this.sendToJail(p, 'Lucky Spin'); break;
    }
    this.checkWin();
  }

  // ---------- TILE RESOLUTION ----------
  resolveTile(p, tile, opts = {}) {
    if (p.bankrupt) return;
    const t = TILES[tile];
    this.justResolvedTile = tile;
    this.emit('tileLand', { player: p.id, tile });
    switch (t.type) {
      case 'start': this.maybeFinish(); break; // landed on a pay corner (salary already collected on the step onto it)
      case 'transit': {
        // Landed on a Transit Station: optional manual transfer to a linked ring.
        if (opts.viaTransit) { this.log(`${p.name} steps off the line.`, '🚉'); this.maybeFinish(); break; }
        const links = transitLinks(tile);
        if (links.length === 0) { this.maybeFinish(); break; }
        this.prompt('select', p.id, {
          selectKind: 'transit', tile,
          options: links,
          title: 'Transit Station — transfer to a linked ring?',
        });
        break;
      }
      case 'property': this.resolveProperty(p, tile); break;
      case 'tax': {
        const amt = t.pct ? Math.max(this.price(t.amount), Math.round(p.cash * t.pct)) : this.price(t.amount);
        this.log(`${p.name} pays ${t.name}: ${money(amt)}`, '🏛️');
        this.charge(p, amt, 'pool', t.name);
        this.maybeFinish();
        break;
      }
      case 'fortune': {
        const card = this.fortuneDeck.draw();
        this.emit('card', { deck: 'fortune', card, player: p.id });
        this.applyCard(p, card);
        break;
      }
      case 'frenzy': {
        const card = this.frenzyDeck.draw();
        this.emit('card', { deck: 'frenzy', card, player: p.id });
        this.applyCard(p, card);
        break;
      }
      case 'doodad': this.resolveDoodad(p); break;
      case 'pool': {
        const cut = Math.round(this.s.pool * 0.5);
        if (cut > 0) { this.s.pool -= cut; this.earn(p, cut, 'Pool payout'); this.log(`${p.name} scoops ${money(cut)} from the Pool!`, '🏆'); this.emit('fx:pool', { player: p.id }); }
        else this.log(`The Pool is empty. ${p.name} sighs.`, '🕳️');
        this.maybeFinish();
        break;
      }
      case 'jail': this.log(`${p.name} is just visiting Jail.`, '👀'); this.maybeFinish(); break;
      case 'gotojail': this.sendToJail(p, 'Go To Jail'); this.finishTurn(true); break;
      case 'exchange': this.prompt('exchange', p.id, {}); this.log(`${p.name} hits the trading floor.`, '📈'); break;
      case 'pyramid':
        if (!this.flags.pyramid) { this.log(`${p.name} walks past the boarded-up UpStone office.`, '🕸️'); this.maybeFinish(); break; }
        this.prompt('pitch', p.id, {}); break;
      case 'casino':
        if (!this.flags.casino) { this.log(`${p.name} admires the casino from outside. Members only.`, '🎰'); this.maybeFinish(); break; }
        this.prompt('casino', p.id, {}); break;
      default: this.maybeFinish();
    }
  }

  resolveProperty(p, tile) {
    const pr = this.s.props[tile];
    const t = TILES[tile];
    if (pr.owner === -1) {
      if (t.gateway) {
        // gateway space, first landing: buy it AND use its system in one visit
        this.prompt('gateway', p.id, { tile, gateway: t.gateway, price: this.price(t.price), unowned: true });
        return;
      }
      if (this.flags.auctions) this.prompt('buy', p.id, { tile, price: this.price(t.price) });
      else {
        // no auctions: bank keeps it
        this.prompt('buy', p.id, { tile, price: this.price(t.price), noAuction: true });
      }
      return;
    }
    const owner = this.P(pr.owner);
    if (owner.id === p.id) {
      this.log(`${p.name} rests at their own ${t.name}.`, '🏠');
      if (t.gateway) { this.prompt('gateway', p.id, { tile, gateway: t.gateway }); return; }
      this.maybeFinish();
      return;
    }
    if (pr.mortgaged) {
      this.log(`${t.name} is mortgaged — no rent.`, '🏦');
      if (t.gateway) { this.prompt('gateway', p.id, { tile, gateway: t.gateway }); return; }
      this.maybeFinish();
      return;
    }
    const rent = this.rentFor(tile, this.s.dice, p);
    const ok = this.charge(p, rent, owner.id, `Rent: ${t.name}`);
    if (ok) {
      this.log(`${p.name} pays ${money(rent)} rent to ${owner.name} at ${t.name}`, '🏚️');
      owner.stats.rentIn += rent; p.stats.rentOut += rent;
    }
    // dividend commission to shareholders
    if (this.flags.stocks) {
      const dist = t.district, st = this.s.stocks[dist];
      st.divPool += Math.round(rent * 0.15);
    }
    this.emit('fx:rent', { from: p.id, to: owner.id, amount: rent, tile });
    if (ok) {
      // gateway visit after the landing fee — the owner's rates apply for this visit
      if (t.gateway && !this.debt) this.prompt('gateway', p.id, { tile, gateway: t.gateway, rentPaid: rent });
      else this.maybeFinish();
    }
  }

  rentFor(tile, dice, payer) {
    const pr = this.s.props[tile], t = TILES[tile];
    let r = baseRent(t.price) * RENT_MULT[pr.level];
    const dist = t.district, tiles = DISTRICT_TILES[dist];
    if (pr.level === 0 && tiles.every(i => this.s.props[i].owner === pr.owner)) r *= 2;
    if (this.flags.mogulBonus && this.mogulOf(dist) === pr.owner) r = Math.round(r * 1.25);
    if (this.s.rentStorm > 0) r *= 2;
    if (this.flags.statuses && payer && payer.statuses.badLuck) r *= 2;
    if (this.flags.statuses && pr.owner >= 0 && this.P(pr.owner).statuses.hotStreak) r += 100;
    return this.price(r);
  }
  mogulOf(dist) {
    let best = -1, bestN = 24; // requires >= 25 shares
    for (const p of this.s.players) {
      if (p.bankrupt) continue;
      if (p.stocks[dist] > bestN) { bestN = p.stocks[dist]; best = p.id; }
    }
    return best;
  }

  sendToJail(p, reason) {
    p.pos = JAIL_TILE; p.inJail = true; p.jailTurns = 0;
    this.s.lastWasDoubles = false;
    this.emit('fx:jail', { player: p.id, reason });
    this.log(`🚨 ${p.name} is sent to Jail (${reason}).`, '🚔');
  }

  // ---------- CARDS ----------
  applyCard(p, card) {
    const fx = card.fx;
    switch (fx.kind) {
      case 'gain': this.earn(p, this.chaos(fx.amt), 'Card'); this.maybeFinish(); break;
      case 'pay': this.log(`${p.name}: ${card.text}`, '🃏'); this.charge(p, this.chaos(fx.amt), fx.to || 'bank', 'Card'); if (!this.debt) this.maybeFinish(); break;
      case 'gainEach': case 'payEach': {
        const others = alivePlayers(this.s).filter(x => x.id !== p.id);
        for (const o of others) {
          if (fx.kind === 'gainEach') { if (this.charge(o, this.chaos(fx.amt), p.id, card.text)) {} }
          else { if (this.charge(p, this.chaos(fx.amt), o.id, card.text)) {} }
          if (p.bankrupt) break;
        }
        if (this.debt) return; // debt flow continues
        this.maybeFinish(); break;
      }
      case 'poolCut': {
        const cut = Math.round(this.s.pool * fx.pct);
        this.s.pool -= cut; this.earn(p, cut, 'Pool refund');
        this.maybeFinish(); break;
      }
      case 'goto': {
        if (fx.pay) {
          // "Advance to START"-style: move there and collect the corner's salary
          p.pos = fx.tile;
          this.emit('moveStep', { player: p.id, pos: fx.tile, step: 1, of: 1, teleport: true });
          this.passStart(p, fx.pay);
          this.resolveTile(p, fx.tile);
        } else this.teleportTo(p, fx.tile);
        break;
      }
      case 'gotoRel': {
        let steps = fx.delta;
        while (steps > 0) { p.pos = nextInRing(p.pos); steps--; }
        while (steps < 0) { p.pos = prevInRing(p.pos); steps++; }
        this.emit('moveStep', { player: p.id, pos: p.pos, step: 1, of: 1, teleport: true });
        this.resolveTile(p, p.pos);
        break;
      }
      case 'gotoDistrict': {
        // nearest tile of a district: same ring first, then anywhere
        const cand = DISTRICT_TILES[fx.district] || [];
        const myRing = ringOf(p.pos);
        let best = -1, bd = 1e9;
        for (const i of cand) {
          const same = ringOf(i) === myRing;
          let d = 0, cur = p.pos;
          if (same) { while (cur !== i) { cur = nextInRing(cur); d++; } }
          else d = 100 + Math.abs(i - p.pos);
          if (d > 0 && d < bd) { bd = d; best = i; }
        }
        if (best >= 0) this.teleportTo(p, best);
        else this.maybeFinish();
        break;
      }
      case 'gotoBand': {
        let best = fx.from, bd = 99;
        for (let i = fx.from; i <= fx.to; i++) {
          const d = ((i - p.pos) + BOARD_SIZE) % BOARD_SIZE;
          if (d > 0 && d < bd) { bd = d; best = i; }
        }
        this.teleportTo(p, best); break;
      }
      case 'jail': this.sendToJail(p, 'Card'); this.finishTurn(true); break;
      case 'jailFree': p.gojf++; this.log(`${p.name} pockets a Get Out of Jail Free card.`, '🎫'); this.maybeFinish(); break;
      case 'shares': {
        const dist = this.rng.pick(DISTRICTS).id;
        this.giveShares(p, dist, fx.n, 'Card');
        this.maybeFinish(); break;
      }
      case 'stockAll': for (const d of DISTRICTS) this.bumpStockPct(d.id, fx.pct); this.log(card.text, '📈'); this.maybeFinish(); break;
      case 'promote': p.level++; this.emit('fx:promote', { player: p.id, level: p.level }); this.log(`${p.name} promoted to level ${p.level}!`, '⭐'); this.maybeFinish(); break;
      case 'payOrSeal': {
        if (p.cash >= fx.amt) this.charge(p, fx.amt, 'pool', 'Card');
        else { const seal = Object.keys(p.seals).find(k => p.seals[k]); if (seal) { p.seals[seal] = false; this.log(`${p.name} loses the ${seal} seal to the seagull.`, '🕊️'); } else this.charge(p, Math.min(p.cash, fx.amt), 'pool', 'Card'); }
        this.maybeFinish(); break;
      }
      case 'repairs': {
        let total = 0;
        for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === p.id) { if (pr.level >= 5) total += fx.hotel; else if (pr.level > 0) total += fx.house * pr.level; } }
        this.log(`${p.name}: repairs cost ${money(total)}`, '🔧');
        if (total > 0) this.charge(p, total, 'pool', 'Repairs');
        if (!this.debt) this.maybeFinish();
        break;
      }
      case 'donate': { const amt = Math.round(p.cash * fx.pct); this.charge(p, amt, 'pool', 'Charity'); p.karma = (p.karma || 0) + 1; if (!this.debt) this.maybeFinish(); break; }
      case 'status': if (this.flags.statuses) { p.statuses[fx.status] = fx.laps; this.log(`${p.name}: ${card.text}`, '✨'); this.emit('fx:status', { player: p.id, status: fx.status }); } this.maybeFinish(); break;
      case 'item': if (this.flags.items) { const it = this.rng.pick(ITEMS); this.giveItem(p, it); } this.maybeFinish(); break;
      case 'deal':
        if (this.flags.deals) this.prompt('deal', p.id, { small: SMALL_DEALS, big: BIG_DEALS });
        else this.maybeFinish();
        break;
      // ---- FRENZY ----
      case 'equalizer': {
        const alive = alivePlayers(this.s);
        const total = alive.reduce((a, x) => a + x.cash, 0);
        const share = Math.round(total / alive.length);
        for (const x of alive) x.cash = share;
        this.log('⚖️ WEALTH EQUALIZER! Cash redistributed evenly.', '⚖️');
        this.emit('fx:equalizer', {});
        this.maybeFinish(); break;
      }
      case 'demolition': {
        const leader = currentLeader(this.s);
        let best = -1, bl = 0;
        for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === leader.id && pr.level > bl) { bl = pr.level; best = i; } }
        if (best >= 0) { this.downgrade(best); this.log(`💥 Wrecking ball hits ${leader.name}'s ${TILES[best].name}!`, '💥'); this.emit('fx:demolish', { tile: best }); }
        else this.log('The leader has no buildings. The crew goes home.', '😐');
        this.maybeFinish(); break;
      }
      case 'swap': this.prompt('select', p.id, { selectKind: 'swapPick', players: alivePlayers(this.s).filter(x => x.id !== p.id).map(x => x.id), title: 'Swap: choose a player' }); break;
      case 'forcedAuction': {
        const unowned = TILES.map((t, i) => i).filter(i => TILES[i].type === 'property' && this.s.props[i].owner === -1);
        if (unowned.length === 0) { this.log('No unowned property. Court order dismissed.', '😐'); this.maybeFinish(); }
        else this.prompt('select', p.id, { selectKind: 'auctionPick', tiles: unowned, title: 'Choose a property to force to auction' });
        break;
      }
      case 'rentStorm': this.s.rentStorm = this.s.players.length; this.log('🌪️ RENT STORM! Rents ×2 for one lap.', '🌪️'); this.emit('fx:storm', {}); this.maybeFinish(); break;
      case 'teleportAll': {
        for (const x of alivePlayers(this.s)) { x.pos = this.rng.int(0, BOARD_SIZE - 1); this.emit('moveStep', { player: x.id, pos: x.pos, step: 1, of: 1, teleport: true }); }
        this.log('🌆 Blackout! Everyone wakes up somewhere else.', '🌆');
        this.maybeFinish(); break;
      }
      case 'insider': {
        let best = DISTRICTS[0], bv = 99;
        for (const d of DISTRICTS) { const und = d.par / this.s.stocks[d.id].price; if (und < bv) { bv = und; best = d; } }
        this.giveShares(p, best.id, 10, 'Insider tip');
        this.maybeFinish(); break;
      }
      case 'auditLeader': {
        const leader = currentLeader(this.s);
        const amt = Math.round(netWorth(this.s, leader) * 0.1);
        this.log(`🔍 ${leader.name} (leader) is audited for ${money(amt)}.`, '🔍');
        this.charge(leader, amt, 'pool', 'Audit');
        if (!this.debt) this.maybeFinish();
        break;
      }
      case 'hype': if (this.flags.pyramid && this.s.pyramid.open) { this.s.pyramid.hype = clamp(this.s.pyramid.hype + fx.amt, 0, 100); this.s.pyramid.pot += fx.pot; this.emit('pyramid:state', { ...this.s.pyramid }); this.log('🔺 UpStone goes viral!', '🔺'); } this.maybeFinish(); break;
      case 'bailout': {
        const alive = alivePlayers(this.s);
        const poor = alive.reduce((a, b) => netWorth(this.s, a) <= netWorth(this.s, b) ? a : b);
        this.earn(poor, this.chaos(fx.amt || 1200), 'Bailout');
        this.log(`🏦 ${poor.name} receives a bank bailout.`, '🏦');
        this.maybeFinish(); break;
      }
      case 'lottery': {
        const r = this.rng.int(1, 6) + this.rng.int(1, 6);
        this.emit('rolled', { player: p.id, d1: Math.ceil(r / 2), d2: Math.floor(r / 2), speed: null, lottery: true });
        if (r >= 7) { const win = this.chaos(50 * r); this.s.pool = Math.max(0, this.s.pool - win); this.earn(p, win, 'Lottery'); this.log(`🎰 Lottery rolls ${r} — ${p.name} wins ${money(win)}!`, '🎰'); }
        else this.log(`🎰 Lottery rolls ${r}. Nothing. Classic.`, '🎰');
        this.maybeFinish(); break;
      }
      case 'skipChoice': this.prompt('select', p.id, { selectKind: 'skipPick', players: alivePlayers(this.s).filter(x => x.id !== p.id).map(x => x.id), title: 'Jury duty: choose who skips a turn' }); break;
      case 'tornado': {
        let hits = 0;
        for (const x of alivePlayers(this.s)) {
          if (x.id === p.id) continue;
          let best = -1, bl = 0;
          for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === x.id && pr.level > bl) { bl = pr.level; best = i; } }
          if (best >= 0) { this.downgrade(best); hits++; this.emit('fx:demolish', { tile: best }); }
        }
        this.log(hits ? '🌪️ Tornado tears down buildings across the city!' : '🌪️ Tornado passes. Nothing to destroy.', '🌪️');
        this.maybeFinish(); break;
      }
      case 'rentCommission': {
        let n = 0;
        for (let i = 0; i < BOARD_SIZE; i++) { const pr = this.s.props[i]; if (pr && pr.owner === p.id) n++; }
        this.earn(p, this.chaos(fx.per * n), 'Good will');
        this.maybeFinish(); break;
      }
      case 'rollAgain': { this.log('🚌 Free transit — roll again!', '🚌'); this.s.phase = 'roll'; this.prompt('roll', p.id, {}); break; }
      default: this.maybeFinish();
    }
  }

  teleportTo(p, tile) {
    p.pos = tile;
    this.emit('moveStep', { player: p.id, pos: tile, teleport: true });
    this.resolveTile(p, tile);
  }

  giveShares(p, dist, n, reason) {
    const st = this.s.stocks[dist];
    p.stocks[dist] += n;
    p.unsettled[dist] += n;
    this.bumpStock(dist, n >= 10 ? Math.min(8, Math.round(n / 10)) : 0);
    this.emit('stock', { player: p.id, dist, delta: n, price: st.price, reason });
    this.log(`${p.name} gains ${n} shares of ${DISTRICTS[D[dist]].name} (${reason})`, '🧾');
  }
  bumpStock(dist, ticks) {
    const st = this.s.stocks[dist];
    st.price = clamp(Math.round(st.price + ticks), 2, 999);
    this.emit('stockPrice', { dist, price: st.price });
  }
  bumpStockPct(dist, pct) {
    const st = this.s.stocks[dist];
    st.price = clamp(Math.round(st.price * (1 + pct / 100)), 2, 999);
    this.emit('stockPrice', { dist, price: st.price });
  }
  bumpStockPct(dist, pct) {
    const st = this.s.stocks[dist];
    st.price = clamp(Math.round(st.price * (1 + pct / 100)), 2, 999);
    this.emit('stockPrice', { dist, price: st.price });
  }
  giveItem(p, it) {
    if (p.items.length >= 2) { this.log(`${p.name}'s hands are full (2 items max).`, '🤷'); return; }
    p.items.push(it.id);
    this.log(`${p.name} obtains ${it.icon} ${it.name}!`, '🎁');
    this.emit('fx:item', { player: p.id, item: it.id });
  }
  downgrade(tile) {
    const pr = this.s.props[tile];
    if (!pr || pr.level <= 0) return;
    if (this.flags.finiteBuildings) this.returnBuilding(pr.level);
    pr.level--;
  }
  returnBuilding(level) {
    const pool = level === 6 ? 'sky' : level === 5 ? 'hotels' : 'houses';
    this.s.buildings[pool]++;
  }

  // ---------- DEAL MARKET (always-available broker; refreshed every lap) ----------
  refreshMarket() {
    if (!this.flags.deals) return;
    const s = this.s;
    if (!s.market || s.market.lap !== s.lap) {
      const eligible = (list) => list.filter(d => !d.shares || this.flags.stocks);
      s.market = {
        lap: s.lap,
        small: this.rng.pick(eligible(SMALL_DEALS)),
        big: this.rng.pick(eligible(BIG_DEALS)),
      };
      this.emit('market', { ...s.market });
    }
  }
  buyMarketDeal(p, tier, at) {
    if (!this.flags.deals) return false;
    if ((p.dealsThisLap || 0) >= 1) { this.log(`${p.name} already took a broker deal this lap.`, '🚫'); return false; }
    this.refreshMarket();
    const d = tier === 'big' ? this.s.market.big : this.s.market.small;
    if (!d) return false;
    const premium = Math.round(d.cost * 1.1); // broker fee
    if (p.cash < premium) { this.log(`${p.name} can't afford ${d.name} (${money(premium)} with broker fee).`, '🚫'); return false; }
    const total = at != null ? this.applyGatewayPrice(p, at, premium) : premium;
    this.charge(p, total, 'bank', `Deal: ${d.name}`, { pierceShield: true });
    if (this.debt) return false;
    p.dealsThisLap = (p.dealsThisLap || 0) + 1;
    this.acquireDeal(p, d, d.cost);
    return true;
  }
  acquireDeal(p, d, basisVal) {
    if (d.shares) {
      const dist = this.rng.pick(DISTRICTS).id;
      p.stocks[dist] += d.shares;
      p.unsettled[dist] += d.shares;
      this.emit('stock', { player: p.id, dist, delta: d.shares, price: this.s.stocks[dist].price, reason: 'deal' });
      this.log(`${p.name} buys ${d.name}: +${d.shares} shares of ${DISTRICTS[D[dist]].name}.`, '📈');
      // shares count in net worth via stockValueOf — no asset row (would double-count)
    } else if (d.flip) {
      this.log(`${p.name} buys ${d.name} — resolves next round.`, '🃏');
      p.assets.push({ id: d.id, name: d.name, cf: 0, val: basisVal, flip: d.flip, flipsIn: 1 });
    } else {
      p.assets.push({ id: d.id, name: d.name, cf: d.cf, val: basisVal });
      this.log(`${p.name} buys ${d.name}: +${money(d.cf)}/lap passive.`, '📈');
      this.checkFreedom(p);
    }
    this.emit('fx:deal', { player: p.id, deal: d.id });
  }

  // ---------- DOODAD ----------
  resolveDoodad(p) {
    if (!this.flags.doodads) { this.maybeFinish(); return; }
    const doodads = [
      { name: 'Jet-ski weekend', amt: 300 }, { name: 'Concert tickets (the good ones)', amt: 220 },
      { name: 'Impulse puppy (worth it)', amt: 380 }, { name: 'Gym membership (January courage)', amt: 160 },
      { name: 'Sneaker drop', amt: 260 }, { name: 'Steam sale catastrophe', amt: 120 },
    ];
    const d = this.rng.pick(doodads);
    this.log(`🛍️ Doodad: ${d.name} — ${money(this.price(d.amt))}`, '🛍️');
    this.charge(p, this.price(d.amt), 'pool', `Doodad: ${d.name}`);
    if (!this.debt) this.maybeFinish();
  }

  // ---------- PYRAMID (UpStone Ventures) ----------
  grantPyramidYield(p) {
    if (!this.flags.pyramid || !p.pyramid || !this.s.pyramid.open) return;
    const py = this.s.pyramid, tier = PYRAMID_TIERS.find(t => t.id === p.pyramid.tier);
    const members = this.s.players.filter(x => !x.bankrupt && x.pyramid).length;
    const sat = members > 4 ? Math.pow(0.85, members - 4) : 1;
    const factor = 0.7 + py.hype / 125;
    let yieldAmt = Math.round(tier.cost * tier.yieldPct * factor * sat);
    if (yieldAmt > py.pot) { this.collapsePyramid('The pot ran dry'); return; }
    py.pot -= yieldAmt;
    this.earn(p, yieldAmt, 'UpStone yield');
    this.emit('fx:pyramidYield', { player: p.id, amount: yieldAmt });
    this.log(`🔺 ${p.name} rakes ${money(yieldAmt)} from the UpStone pot.`, '🔺');
  }
  pyramidJoin(p, tierId, discount = 1) {
    const tier = PYRAMID_TIERS.find(t => t.id === tierId);
    const cost = Math.round(tier.cost * discount);
    if (p.pyramid) return;
    if (!this.charge(p, cost, 'bank', `UpStone ${tier.name}`, { pierceShield: true })) return;
    p.pyramid = { tier: tierId, joinedCycle: this.s.pyramid.cycle };
    p.pyramidOrder = this.s.pyramid.members.length;
    this.s.pyramid.members.push(p.id);
    this.s.pyramid.pot += cost;
    this.s.pyramid.hype = clamp(this.s.pyramid.hype + 6, 0, 100);
    this.emit('pyramid:join', { player: p.id, tier: tierId, cost });
    this.log(`🔺 ${p.name} joins UpStone Ventures at ${tier.name} (${money(cost)}).`, '🔺');
    this.emit('pyramid:state', { ...this.s.pyramid });
  }
  pyramidUpgrade(p, tierId) {
    if (!p.pyramid) return;
    const cur = PYRAMID_TIERS.find(t => t.id === p.pyramid.tier);
    const nxt = PYRAMID_TIERS.find(t => t.id === tierId);
    if (!nxt || nxt.cost <= cur.cost) return;
    const diff = Math.round((nxt.cost - cur.cost));
    if (!this.charge(p, diff, 'bank', `Upgrade to ${nxt.name}`, { pierceShield: true })) return;
    p.pyramid.tier = tierId;
    this.s.pyramid.pot += diff;
    this.s.pyramid.hype = clamp(this.s.pyramid.hype + 6, 0, 100);
    this.log(`🔺 ${p.name} upgrades to ${nxt.name}. Belief: increased.`, '🔺');
    this.emit('pyramid:state', { ...this.s.pyramid });
  }
  pyramidCashOut(p) {
    if (!p.pyramid) return;
    const tier = PYRAMID_TIERS.find(t => t.id === p.pyramid.tier);
    const refund = Math.round(tier.cost * 0.65);
    this.earn(p, refund, 'UpStone cash-out');
    this.leavePyramid(p, false);
    this.log(`🔺 ${p.name} cashes out of UpStone for ${money(refund)}. Wise... or weak hands?`, '🔺');
  }
  leavePyramid(p, silent) {
    if (!p.pyramid) return;
    const i = this.s.pyramid.members.indexOf(p.id);
    if (i >= 0) this.s.pyramid.members.splice(i, 1);
    p.pyramid = null; p.pyramidOrder = -1;
    this.emit('pyramid:state', { ...this.s.pyramid });
  }
  recruit(p) {
    if (!p.pyramid) return;
    if (!this.charge(p, 200, 'pool', 'Recruiting kit')) return;
    const targets = alivePlayers(this.s).filter(x => x.id !== p.id && !x.pyramid);
    if (targets.length === 0) { this.log('Nobody left to recruit. The ladder is complete.', '😐'); this.maybeFinish(); return; }
    const target = targets.reduce((a, b) => netWorth(this.s, a) <= netWorth(this.s, b) ? a : b);
    this.s.pyramid.hype = clamp(this.s.pyramid.hype + 8, 0, 100);
    this.emit('pyramid:recruit', { from: p.id, to: target.id });
    this.prompt('recruit', target.id, { from: p.id, fee: 300, halfCost: Math.round(PYRAMID_TIERS[0].cost / 2) });
  }
  collapsePyramid(reason) {
    const py = this.s.pyramid;
    if (!py.open) return;
    py.open = false; py.closedFor = 3;
    const members = this.s.players.filter(x => x.pyramid).sort((a, b) => a.pyramidOrder - b.pyramidOrder);
    const payout = Math.round(py.pot * 0.35);
    const tops = members.slice(0, 2);
    this.log(`💣 UPSTONE VENTURES HAS COLLAPSED (${reason})!`, '💣');
    for (const t of tops) { const share = Math.round(payout / Math.max(1, tops.length)); this.earn(t, share, 'Pyramid collapse (early bird)'); this.log(`${t.name} escapes with ${money(share)} — early birds win.`, '🐦'); }
    for (const m of members) { m.pyramid = null; m.pyramidOrder = -1; this.emit('fx:pyramidLoss', { player: m.id }); this.log(`${m.name}'s position evaporates.`, '🫠'); }
    for (const d of DISTRICTS) this.bumpStockPct(d.id, -15);
    py.pot = 0; py.hype = 0; py.members = []; py.cycle++;
    this.emit('fx:pyramidCollapse', {});
    this.emit('pyramid:state', { ...py });
    this.checkWin();
  }
  pyramidRoundTick() {
    const py = this.s.pyramid;
    if (!this.flags.pyramid) return;
    if (!py.open) {
      py.closedFor--;
      if (py.closedFor <= 0) { py.open = true; py.hype = 15; py.pot = 8000; py.cycle++; this.log('🔺 UpStone Ventures reopens under a new name. "Totally legit this time."', '🔺'); this.emit('pyramid:state', { ...py }); }
      return;
    }
    const members = this.s.players.filter(x => !x.bankrupt && x.pyramid).length;
    if (members === 0) { py.hype = clamp(py.hype - 3, 0, 100); return; }
    py.hype = clamp(py.hype + 5, 0, 100);
    py.pot += 1000;
    if (py.hype > 40 && this.rng.chance((py.hype - 40) / 100)) this.collapsePyptonSafe();
    else if (py.hype >= 100) this.collapsePyramid('Peak hype');
  }
  collapsePyptonSafe() { this.collapsePyramid('Hype bubble popped'); }

  // ---------- GATEWAY RATES ----------
  // +rate = owner discount (10% + 10% per building level, +10% for the full set, cap 60%)
  // −rate = visitor commission (10%) on everything bought through someone else's space
  gatewayRate(p, tile) {
    const t = TILES[tile];
    if (!t || !t.gateway) return 0;
    const pr = this.s.props[tile];
    if (pr.owner === p.id) {
      let r = 0.10 + 0.10 * (pr.level || 0);
      if (DISTRICT_TILES[t.district].every(i => this.s.props[i].owner === p.id)) r += 0.10;
      return Math.min(0.6, r);
    }
    return -0.10;
  }
  // apply a gateway rate to a purchase; the visitor commission flows to the space owner
  applyGatewayPrice(p, tile, base) {
    const rate = tile != null ? this.gatewayRate(p, tile) : 0;
    const total = Math.round(base * (1 - rate));
    if (rate < 0) {
      const owner = this.s.props[tile] ? this.s.props[tile].owner : -1;
      const commission = Math.round(base * -rate);
      if (owner >= 0 && !this.P(owner).bankrupt) {
        this.P(owner).cash += commission;
        this.emit('cash', { player: owner, delta: commission, reason: 'Gateway commission', from: 'player' });
      } else this.s.pool += commission;
    }
    return total;
  }

  // ---------- STOCKS / LOANS / DREAMS / ASSETS ----------
  buyStock(p, dist, n, at) {
    if (!this.flags.stocks || n <= 0) return;
    const st = this.s.stocks[dist];
    const total = this.applyGatewayPrice(p, at, st.price * n);
    if (p.cash < total) { this.log(`${p.name} can't afford ${n} shares.`, '🚫'); return; }
    p.cash -= total;
    p.stocks[dist] += n;
    p.unsettled[dist] += n; // fresh shares settle at your next Go
    this.bumpStock(dist, n >= 10 ? clamp(Math.round(n / 10), 1, 8) : 0);
    this.emit('stock', { player: p.id, dist, delta: n, price: st.price, reason: 'buy' });
  }
  // shares bought since your last Go can't be sold yet — no same-cycle day trading
  settledShares(p, dist) {
    return Math.max(0, p.stocks[dist] - (p.unsettled[dist] || 0));
  }
  sellStock(p, dist, n, at) {
    if (!this.flags.stocks || n <= 0) return;
    const sellable = this.settledShares(p, dist);
    if (n > sellable) {
      const pending = p.stocks[dist] - sellable;
      this.log(pending > 0 && sellable === 0
        ? `Freshly bought — ${pending} share${pending > 1 ? 's' : ''} settle once you pass Go.`
        : `Only ${sellable} of ${p.stocks[dist]} shares settled (the rest need a Go).`, '🚫');
      n = sellable;
    }
    if (n <= 0) return;
    const st = this.s.stocks[dist];
    const gross = this.applyGatewayPrice(p, at, st.price * n);
    p.stocks[dist] -= n;
    p.unsettled[dist] = Math.max(0, (p.unsettled[dist] || 0) - n);
    p.cash += gross;
    this.bumpStock(dist, n >= 10 ? -clamp(Math.round(n / 10), 1, 8) : 0);
    this.emit('stock', { player: p.id, dist, delta: -n, price: st.price, reason: 'sell' });
  }
  takeLoan(p, units, at) {
    if (!this.flags.cashflow) return;
    units = clamp(units, 1, 20 - p.loans);
    if (units <= 0) return;
    // banking with someone else's branch costs a little more; your own is cheaper
    if (at != null) {
      const rate = this.gatewayRate(p, at);
      const r = clamp(1 - rate, 0.7, 1.3);
      p.loanRate = Math.min(p.loanRate ?? 1, r); // best branch terms stick
    }
    p.loans += units;
    p.cash += units * 500;
    const per = Math.round(50 * (p.loanRate ?? 1));
    this.log(`${p.name} borrows ${money(units * 500)} (+${money(per)}/lap interest per unit).`, '🏦');
    this.emit('loan', { player: p.id, units });
  }
  repayLoan(p, units) {
    units = clamp(units, 1, p.loans);
    const cost = Math.round(units * 500 * 1.1); // 10% early-repayment fee: leverage is never free
    if (p.cash < cost) return;
    p.loans -= units;
    p.cash -= cost;
    this.log(`${p.name} repays ${money(units * 500)} of loans (fee incl. → ${money(cost)}).`, '🏦');
    this.emit('loan', { player: p.id, units: -units });
  }
  buyDream(p, id) {
    if (!p.freedom) { this.log('Dreams unlock after Freedom. Escape the Rat Race first!', '🔒'); return; }
    const d = DREAMS.find(x => x.id === id);
    if (!d || p.dreams.some(x => x.id === id)) return;
    if (p.cash < d.cost) { this.log(`${p.name} can't afford the ${d.name} yet.`, '🚫'); return; }
    this.charge(p, d.cost, 'bank', `Dream: ${d.name}`, { pierceShield: true });
    if (this.debt) return;
    p.dreams.push({ id: d.id, cost: d.cost });
    this.emit('fx:dream', { player: p.id, dream: id });
    this.log(`🌈 ${p.name} buys their ${d.name}! (${money(d.cost)})`, '🌈');
    if (this.flags.winMode === 'freedom') this.winGame(p, `Living the dream (${d.name})`);
  }
  sellAsset(p, assetIdx) {
    const a = p.assets[assetIdx];
    if (!a) return;
    p.assets.splice(assetIdx, 1);
    p.cash += a.val;
    this.log(`${p.name} sells ${a.name} for ${money(a.val)}.`, '🏷️');
    this.emit('cash', { player: p.id, delta: a.val, reason: `Sold ${a.name}` });
  }

  // ---------- FREEDOM ----------
  checkFreedom(p) {
    if (!this.flags.cashflow || p.freedom) return;
    if (passiveIncome(this.s, p) > expensesOf(this.s, p)) {
      p.freedom = true;
      const bonus = 15 * passiveIncome(this.s, p);
      this.earn(p, bonus, 'FREEDOM bonus');
      this.emit('fx:freedom', { player: p.id, bonus });
      this.log(`🕊️ ${p.name} ESCAPED THE RAT RACE! Passive ${money(passiveIncome(this.s, p))} > expenses. Bonus ${money(bonus)}!`, '🕊️');
    }
  }

  // ---------- PROPERTY ACTIONS ----------
  buyTile(p, tile, atPrice, opts = {}) {
    const pr = this.s.props[tile], t = TILES[tile];
    if (pr.owner !== -1 || p.cash < atPrice) return false;
    if (!this.charge(p, atPrice, 'bank', `Bought ${t.name}`, { pierceShield: true })) return false;
    if (this.debt) return false;
    pr.owner = p.id;
    p.stats.buys++;
    this.log(`${p.name} buys ${t.name} for ${money(atPrice)}`, '🏷️');
    this.emit('fx:buy', { player: p.id, tile, price: atPrice });
    this.s.pending = null;
    if (opts.stay && t.gateway) {
      // first-landing special: the new owner can use the space's system right away
      this.prompt('gateway', p.id, { tile, gateway: t.gateway });
    } else this.maybeFinish();
    return true;
  }
  startAuction(tile, reason) {
    if (this.s.auction) return;
    const active = alivePlayers(this.s).map(x => x.id);
    this.s.auction = { tile, bid: 0, bidder: -1, active, cursor: 0, min: 10, reason };
    this.log(`🔨 AUCTION: ${TILES[tile].name}! Starting at $10.`, '🔨');
    this.emit('auction:start', { tile, reason });
    this.auctionNext();
  }
  auctionNext() {
    const a = this.s.auction;
    if (!a) return;
    // prune bankrupt
    a.active = a.active.filter(i => !this.P(i).bankrupt);
    if (a.active.length === 0 || (a.active.length === 1 && a.bidder !== -1)) {
      // nobody left, or one player left standing: the high bid stands
      this.finishAuction(); return;
    }
    // skip cursor to active
    let guard = 0;
    while (!a.active.includes(a.cursor) && guard++ < 12) a.cursor = (a.cursor + 1) % this.s.players.length;
    if (a.active.length === 1 && a.bidder === -1) { /* sole bidder may open at min or pass */ }
    this.s.phase = 'auction';
    this.prompt('auction', a.cursor, { tile: a.tile, bid: a.bid, bidder: a.bidder, minBid: Math.max(10, a.bid + 10) });
  }
  auctionBid(p, amount) {
    const a = this.s.auction;
    if (!a || p.id !== a.cursor) return;
    const minBid = Math.max(10, a.bid + 10);
    if (p.cash < minBid) { this.auctionPass(p); return; } // can't afford the minimum -> fold
    amount = clamp(Math.round(amount) || minBid, minBid, p.cash); // clamp into legality, never stall
    a.bid = amount; a.bidder = p.id;
    this.emit('auction:bid', { player: p.id, amount, tile: a.tile });
    a.cursor = (a.cursor + 1) % this.s.players.length;
    this.auctionNext();
  }
  auctionPass(p) {
    const a = this.s.auction;
    if (!a || p.id !== a.cursor) return;
    a.active = a.active.filter(i => i !== p.id);
    this.emit('auction:pass', { player: p.id, tile: a.tile });
    if (a.active.length === 0) { this.finishAuction(); return; }
    a.cursor = (a.cursor + 1) % this.s.players.length;
    this.auctionNext();
  }
  finishAuction() {
    const a = this.s.auction;
    this.s.auction = null;
    this.s.pending = null;
    if (a.bidder === -1) {
      this.log(`${TILES[a.tile].name} goes unsold. The bank keeps it.`, '🏦');
    } else {
      const w = this.P(a.bidder);
      const pr = this.s.props[a.tile];
      w.cash -= a.bid;
      pr.owner = w.id;
      w.stats.buys++;
      this.log(`🔨 ${w.name} wins ${TILES[a.tile].name} at auction for ${money(a.bid)}!`, '🔨');
      this.emit('auction:win', { player: w.id, tile: a.tile, amount: a.bid });
      this.emit('fx:buy', { player: w.id, tile: a.tile, price: a.bid });
    }
    this.maybeFinish();
  }

  buildOn(p, tile) {
    const pr = this.s.props[tile], t = TILES[tile];
    if (!pr || pr.owner !== p.id || pr.mortgaged) return false;
    const dist = t.district, tiles = DISTRICT_TILES[dist];
    if (!tiles.every(i => this.s.props[i].owner === p.id)) { this.log(`You need the full ${DISTRICTS[D[dist]].name} set to build.`, '🚫'); return false; }
    if (this.flags.evenBuild) {
      const lv = pr.level;
      if (!tiles.every(i => this.s.props[i].level >= lv)) { this.log('Even-build rule: raise every property in the district together.', '🚫'); return false; }
    }
    const maxL = MAX_LEVEL(dist);
    if (pr.level >= maxL) { this.log(`${t.name} is fully upgraded.`, '🚫'); return false; }
    const next = pr.level + 1;
    const cost = this.price(buildingCost(t.price) * (next === 6 ? 2 : 1));
    if (p.cash < cost) { this.log(`Not enough cash (${money(cost)} needed).`, '🚫'); return false; }
    if (this.flags.finiteBuildings) {
      const pool = next === 6 ? 'sky' : next === 5 ? 'hotels' : 'houses';
      if (this.s.buildings[pool] <= 0) { this.log(`No ${pool} left in the bank — shortage!`, '🚫'); return false; }
      this.s.buildings[pool]--;
    }
    p.cash -= cost;
    pr.level = next;
    p.stats.builds++;
    this.log(`${p.name} builds on ${t.name} (${next === 6 ? 'SKYSCRAPER' : 'level ' + next}) for ${money(cost)}`, '🏗️');
    this.emit('fx:build', { player: p.id, tile, level: next, cost });
    // development pushes district stock
    if (this.flags.stocks) this.bumpStock(dist, 1);
    return true;
  }
  sellBuilding(p, tile) {
    const pr = this.s.props[tile], t = TILES[tile];
    if (!pr || pr.owner !== p.id || pr.level <= 0) return false;
    const dist = t.district, tiles = DISTRICT_TILES[dist];
    if (this.flags.evenBuild && !tiles.every(i => this.s.props[i].level >= pr.level)) { this.log('Even-build rule: sell evenly.', '🚫'); return false; }
    const lvl = pr.level;
    const refund = Math.round(buildingCost(t.price) * (lvl === 6 ? 2 : 1) * 0.5);
    if (this.flags.finiteBuildings) {
      const pool = lvl === 6 ? 'sky' : lvl === 5 ? 'hotels' : 'houses';
      this.s.buildings[pool]++;
    }
    pr.level--;
    p.cash += refund;
    this.log(`${p.name} sells a building on ${t.name} for ${money(refund)}.`, '🏷️');
    this.emit('fx:sell', { player: p.id, tile, level: pr.level, refund });
    if (this.flags.stocks) this.bumpStock(dist, -1);
    return true;
  }
  mortgage(p, tile) {
    const pr = this.s.props[tile], t = TILES[tile];
    if (!pr || pr.owner !== p.id || pr.mortgaged) return false;
    const dist = t.district;
    if (DISTRICT_TILES[dist].some(i => this.s.props[i].level > 0)) { this.log('Sell the buildings in this district first.', '🚫'); return false; }
    pr.mortgaged = true;
    const v = Math.round(this.price(t.price) / 2);
    p.cash += v;
    this.log(`${p.name} mortgages ${t.name} for ${money(v)}.`, '🏦');
    this.emit('fx:mortgage', { player: p.id, tile, value: v });
    return true;
  }
  unmortgage(p, tile) {
    const pr = this.s.props[tile], t = TILES[tile];
    if (!pr || pr.owner !== p.id || !pr.mortgaged) return false;
    const cost = Math.round(this.price(t.price) / 2 * 1.1);
    if (p.cash < cost) { this.log(`Unmortgaging ${t.name} costs ${money(cost)}.`, '🚫'); return false; }
    pr.mortgaged = false;
    p.cash -= cost;
    this.log(`${p.name} lifts the mortgage on ${t.name} (${money(cost)} incl. 10% interest).`, '🏦');
    this.emit('fx:unmortgage', { player: p.id, tile, cost });
    return true;
  }

  // ---------- TRADE ----------
  proposeTrade(fromId, offer) {
    // offer: {to, give:{cash, props[], stocks:{d:n}, gojf, items[]}, get:{cash, props[], stocks:{d:n}, gojf, items[]}}
    const from = this.P(fromId);
    if (!this.validateTrade(from, offer.give)) { this.log('Invalid trade (you dont own that).', '🚫'); return false; }
    const to = this.P(offer.to);
    if (!this.validateTrade(to, offer.get)) { this.log('Invalid trade (they dont own that).', '🚫'); return false; }
    if (this.s.auction) { this.log('Wait for the auction to finish.', '🚫'); return false; }
    this.s.tradeOffer = { from: fromId, ...offer };
    this.emit('trade:offer', { offer: this.s.tradeOffer });
    if (!to.isAI && to.id === this.s.turn && !this.debt) {
      // they are mid-decision — ask them right now
      this.prompt('trade', offer.to, { from: fromId });
      return true;
    }
    // everyone else gets the offer in their inbox (AI answer at their next decision point)
    this.s.tradeInbox.push({ from: fromId, to: offer.to, offer: this.s.tradeOffer });
    this.emit('trade:inbox', { to: offer.to, from: fromId });
    return true;
  }

  respondInboxTrade(seat, accept) {
    const idx = (this.s.tradeInbox || []).findIndex(o => o.to === seat);
    if (idx < 0) return false;
    const entry = this.s.tradeInbox.splice(idx, 1)[0];
    this.respondTrade(accept, entry.from, entry.offer);
    return true;
  }
  validateTrade(p, side) {
    if (!side) return true;
    if ((side.cash || 0) > p.cash) return false;
    if (side.props) for (const t of side.props) { const pr = this.s.props[t]; if (!pr || pr.owner !== p.id) return false; }
    if (side.stocks) for (const d in side.stocks) if (p.stocks[d] < side.stocks[d]) return false;
    if ((side.gojf || 0) > p.gojf) return false;
    if (side.items) for (const it of side.items) if (!p.items.includes(it)) return false;
    return true;
  }
  respondTrade(accept, fromOverride, offerOverride) {
    const offer = offerOverride
      ? offerOverride
      : fromOverride != null
        ? { ...(this.s.tradeOffer || {}), from: fromOverride }
        : this.s.tradeOffer;
    const fromInbox = fromOverride != null;
    if (!fromInbox) { this.s.tradeOffer = null; this.s.pending = null; }
    if (!offer) { if (!fromInbox) this.maybeFinish(); return; }
    const from = this.P(offer.from), to = this.P(offer.to);
    if (accept && this.validateTrade(from, offer.give) && this.validateTrade(to, offer.get)) {
      // execute
      from.cash -= offer.give.cash || 0; to.cash += offer.give.cash || 0;
      to.cash -= offer.get.cash || 0; from.cash += offer.get.cash || 0;
      for (const t of offer.give.props || []) this.s.props[t].owner = to.id;
      for (const t of offer.get.props || []) this.s.props[t].owner = from.id;
      if (offer.give.stocks) for (const d in offer.give.stocks) { from.stocks[d] -= offer.give.stocks[d]; to.stocks[d] += offer.give.stocks[d]; }
      if (offer.get.stocks) for (const d in offer.get.stocks) { to.stocks[d] -= offer.get.stocks[d]; from.stocks[d] += offer.get.stocks[d]; }
      if (offer.give.gojf) { from.gojf -= offer.give.gojf; to.gojf += offer.give.gojf; }
      if (offer.get.gojf) { to.gojf -= offer.get.gojf; from.gojf += offer.get.gojf; }
      if (offer.give.items) for (const it of offer.give.items) { from.items.splice(from.items.indexOf(it), 1); to.items.push(it); }
      if (offer.get.items) for (const it of offer.get.items) { to.items.splice(to.items.indexOf(it), 1); from.items.push(it); }
      from.stats.trades++; to.stats.trades++;
      this.log(`🤝 Trade sealed: ${from.name} ⇄ ${to.name}`, '🤝');
      this.emit('trade:done', { offer });
    } else {
      this.log(`${to.name} declines the trade.`, '🙅');
      this.emit('trade:declined', { offer });
    }
    if (this.s.pending?.kind === 'trade') this.s.pending = null;
    if (fromInbox) return; // inbox responses never disturb the current turn
    // return control to proposer flow
    if (this.s.turn === offer.from && !this.debt) { this.s.phase = 'roll'; this.prompt('roll', offer.from, {}); }
    else if (!this.debt && !this.s.pending) this.maybeFinish();
  }

  // ---------- CHOICES ----------
  choose(choice) {
    const pend = this.s.pending;
    if (!pend) return;
    this.s.pending = null; // every branch below either re-prompts or finishes the turn
    const p = this.P(pend.player);
    switch (pend.kind) {
      case 'buy':
        if (choice === 'buy') { const ok = this.buyTile(p, pend.tile, pend.price); if (!ok && !this.debt) { this.s.pending = null; if (this.flags.auctions) this.startAuction(pend.tile, 'declined'); else this.maybeFinish(); } }
        else { this.s.pending = null; if (this.flags.auctions) this.startAuction(pend.tile, `${p.name} declined`); else this.maybeFinish(); }
        break;
      case 'auction':
        if (choice.type === 'bid') this.auctionBid(p, choice.amount);
        else this.auctionPass(p); // pass, or any malformed choice folds safely
        break;
      case 'jail': {
        if (choice === 'pay') {
          if (this.charge(p, 100, 'pool', 'Bail')) { p.inJail = false; this.log(`${p.name} pays $100 bail.`, '🔓'); this.s.pending = null; this.prompt('roll', p.id, {}); }
        } else if (choice === 'card') {
          if (p.gojf > 0) { p.gojf--; p.inJail = false; this.log(`${p.name} uses a Get Out of Jail Free card.`, '🎫'); this.s.pending = null; this.prompt('roll', p.id, {}); }
        } else if (choice === 'roll') {
          const d1 = this.rng.int(1, 6), d2 = this.rng.int(1, 6);
          this.emit('rolled', { player: p.id, d1, d2, speed: null, jailTry: true });
          this.s.pending = null;
          if (d1 === d2) {
            p.inJail = false; this.s.dice = [d1, d2]; this.s.lastWasDoubles = true;
            this.log(`Doubles! ${p.name} walks free.`, '🔓');
            this.s.phase = 'move';
            this.moveBy(p, d1 + d2, { total: d1 + d2 });
          } else {
            p.jailTurns++;
            if (p.jailTurns >= 3) {
              this.log(`Third strike — ${p.name} pays $100 and moves.`, '🚔');
              p.inJail = false;
              this.charge(p, 100, 'pool', 'Jail fine');
              if (this.debt) return;
              this.s.dice = [d1, d2]; this.s.lastWasDoubles = false;
              this.s.phase = 'move';
              this.moveBy(p, d1 + d2, { total: d1 + d2 });
            } else {
              this.log(`${p.name} fails to roll doubles (${d1}+${d2}).`, '😬');
              this.finishTurn(true);
            }
          }
        }
        break;
      }
      case 'deal': {
        const tier = choice?.tier, card = choice?.card;
        if (!card) { this.log(`${p.name} passes on the deals.`, '🙈'); this.maybeFinish(); break; }
        const list = tier === 'big' ? BIG_DEALS : SMALL_DEALS;
        const d = list.find(x => x.id === card);
        if (!d) { this.maybeFinish(); break; }
        if (p.cash < d.cost) { this.log(`${p.name} can't afford ${d.name} (${money(d.cost)}).`, '🚫'); this.maybeFinish(); break; }
        this.charge(p, d.cost, 'bank', `Deal: ${d.name}`, { pierceShield: true });
        if (this.debt) break;
        this.acquireDeal(p, d, d.cost);
        this.maybeFinish();
        break;
      }
      case 'casino': {
        if (!choice || choice === 'leave') { this.log(`${p.name} leaves the casino with their wallet intact.`, '🎲'); this.maybeFinish(); break; }
        const stake = clamp(choice.stake || 100, 100, 1000);
        const bet = choice.bet;
        const d1 = this.rng.int(1, 6), d2 = this.rng.int(1, 6);
        const r = d1 + d2;
        this.emit('rolled', { player: p.id, d1, d2, speed: null, casino: true });
        let winAmt = 0;
        if (bet === 'high' && r >= 8) winAmt = stake * 2;
        else if (bet === 'low' && r <= 6) winAmt = stake * 2;
        else if (bet === 'seven' && r === 7) winAmt = stake * 5;
        this.charge(p, stake, 'pool', 'Casino stake', { pierceShield: true });
        if (this.debt) break;
        if (winAmt > 0) {
          this.earn(p, winAmt, 'Casino win');
          this.log(`🎲 ${p.name} bets ${money(stake)} on ${bet} — rolls ${r} — WINS ${money(winAmt)}!`, '🎉');
          if (this.rng.chance(0.2)) { const it = this.rng.pick(ITEMS); this.giveItem(p, it); }
        } else {
          this.log(`🎲 ${p.name} bets ${money(stake)} on ${bet} — rolls ${r}. The house smiles.`, '🎲');
        }
        this.maybeFinish();
        break;
      }
      case 'pitch': {
        if (choice?.type === 'join') { this.pyramidJoin(p, choice.tier); this.maybeFinish(); }
        else if (choice?.type === 'upgrade') { this.pyramidUpgrade(p, choice.tier); this.maybeFinish(); }
        else if (choice?.type === 'recruit') { this.recruit(p); if (!this.s.pending) this.maybeFinish(); }
        else if (choice?.type === 'cashout') { this.pyramidCashOut(p); this.maybeFinish(); }
        else { this.log(`${p.name} walks past the pitch. "Not today."`, '🙅'); this.maybeFinish(); }
        break;
      }
      case 'recruit': {
        if (choice === 'join') {
          const cost = pend.halfCost;
          if (p.cash >= cost) {
            if (this.charge(p, cost, 'bank', 'UpStone Bronze', { pierceShield: true })) {
              p.pyramid = { tier: 'bronze', joinedCycle: this.s.pyramid.cycle };
              p.pyramidOrder = this.s.pyramid.members.length;
              this.s.pyramid.members.push(p.id);
              this.s.pyramid.pot += cost;
              this.P(pend.from).cash += Math.round(cost * 0.3);
              this.log(`🔺 ${p.name} joins UpStone (recruited by ${this.P(pend.from).name}).`, '🔺');
              this.emit('pyramid:join', { player: p.id, tier: 'bronze', cost });
              this.emit('pyramid:state', { ...this.s.pyramid });
            }
          } else { this.log(`${p.name} can't afford it — takes a loan to join. Peer pressure works.`, '😬'); this.takeLoan(p, Math.ceil(cost / 500)); this.s.pyramid.members.push(p.id); p.pyramid = { tier: 'bronze', joinedCycle: this.s.pyramid.cycle }; p.pyramidOrder = this.s.pyramid.members.length - 1; }
        } else {
          this.charge(p, pend.fee, this.P(pend.from).id, 'Recruitment decline fee');
          this.log(`${p.name} pays ${this.P(pend.from).name} ${money(pend.fee)} to be left alone.`, '🙅');
        }
        this.s.pending = null;
        // return control to recruiter's turn
        const from = this.P(pend.from);
        if (this.s.turn === from.id && !this.debt && !from.bankrupt) { this.s.phase = 'roll'; this.prompt('roll', from.id, {}); }
        else if (!this.debt) this.maybeFinish();
        break;
      }
      case 'exchange': {
        this.s.pending = null;
        this.maybeFinish();
        break;
      }
      case 'gateway': {
        // visit continues until the player leaves; buying first keeps the visit alive
        if (choice === 'buy' && pend.unowned) {
          const ok = this.buyTile(p, pend.tile, pend.price, { stay: true });
          if (!ok) {
            this.s.pending = null;
            if (this.flags.auctions) this.startAuction(pend.tile, `${p.name} declined`);
            else this.maybeFinish();
          }
          break;
        }
        if (choice === 'pass' && pend.unowned) {
          this.s.pending = null;
          if (this.flags.auctions) this.startAuction(pend.tile, `${p.name} declined`);
          else this.maybeFinish();
          break;
        }
        this.s.pending = null;
        this.maybeFinish();
        break;
      }
      case 'select': {
        this.s.pending = null;
        const kind = pend.selectKind;
        if (kind === 'freeMove') { this.teleportTo(p, choice.tile); }
        else if (kind === 'transit') {
          if (choice.tile != null && pend.options.includes(choice.tile)) {
            this.log(`🚉 ${p.name} changes lanes — riding the line to another ring.`, '🚉');
            this.emit('fx:transfer', { player: p.id, from: p.pos, to: choice.tile });
            p.pos = choice.tile;
            this.emit('moveStep', { player: p.id, pos: choice.tile, step: 1, of: 1, teleport: true });
            // arrival at the linked station does NOT re-open the station prompt
            this.resolveTile(p, choice.tile, { viaTransit: true });
          } else this.maybeFinish();
        }
        else if (kind === 'auctionPick') { this.startAuction(choice.tile, 'Court order'); if (!this.s.auction) this.maybeFinish(); }
        else if (kind === 'skipPick') { const t = this.P(choice.player); t.skipTurns += 1; this.log(`⚖️ ${t.name} is sentenced to jury duty (skip 1 turn).`, '⚖️'); this.maybeFinish(); }
        else if (kind === 'swapPick') {
          // choose which of their props to give, and take priciest of theirs <= value
          this.executeSwap(p, choice.player, choice.myTile);
        }
        break;
      }
      case 'debt': {
        if (choice === 'pay' && this.debtPayable()) { this.s.pending = null; this.settleDebt(); }
        else if (choice === 'bankrupt') this.doBankrupt();
        break;
      }
      case 'trade': {
        this.respondTrade(choice === 'accept');
        break;
      }
      case 'skip': { this.s.pending = null; this.finishTurn(true); break; }
      case 'end': { this.s.pending = null; this.finishTurn(true); break; }
      default: break;
    }
  }

  executeSwap(p, otherId, myTile) {
    const other = this.P(otherId);
    if (!myTile || this.s.props[myTile]?.owner !== p.id) { this.maybeFinish(); return; }
    const theirs = DISTRICT_TILES_ALL_ARR().filter(i => this.s.props[i].owner === other.id)
      .sort((a, b) => TILES[a].price - TILES[b].price);
    if (theirs.length === 0) { this.log(`${other.name} has no property to swap.`, '😐'); this.maybeFinish(); return; }
    const take = theirs[theirs.length - 1];
    this.s.props[myTile].owner = other.id;
    this.s.props[take].owner = p.id;
    this.log(`🔄 SWAP: ${p.name} gives ${TILES[myTile].name}, receives ${TILES[take].name} from ${other.name}.`, '🔄');
    this.emit('fx:swap', { a: p.id, b: other.id, tiles: [myTile, take] });
    this.maybeFinish();
  }

  // ---------- ROUND ECONOMY ----------
  roundEnd() {
    const s = this.s;
    if (s.gameOver) return;
    this.refreshMarket();
    // 1) dividends
    if (this.flags.stocks) {
      const settled = (x, dId) => Math.max(0, x.stocks[dId] - (x.unsettled[dId] || 0));
      for (const p of s.players) p.lastDividends = 0;
      for (const d of DISTRICTS) {
        const st = s.stocks[d.id];
        if (st.divPool > 0) {
          const totalShares = s.players.reduce((a, x) => a + settled(x, d.id), 0);
          if (totalShares > 0) {
            for (const p of s.players) {
              const sh = settled(p, d.id);
              if (p.bankrupt || sh === 0) continue; // unsettled shares earn nothing yet
              const div = Math.round(st.divPool * sh / totalShares);
              if (div > 0) { p.cash += div; p.lastDividends += div; this.emit('cash', { player: p.id, delta: div, reason: `Dividends: ${d.name}` }); }
            }
          }
          st.divPool = 0;
        }
      }
    }
    // 2) stock drift: fundamentals + noise
    if (this.flags.stocks) {
      const shifts = [];
      for (const d of DISTRICTS) {
        const tiles = DISTRICT_TILES[d.id];
        const dev = tiles.reduce((a, i) => a + s.props[i].level, 0);
        const owned = tiles.filter(i => s.props[i].owner >= 0).length;
        let tick = 0;
        tick += dev > 0 ? 1 : 0;
        if (owned >= 3) tick += 1;
        const par = d.par;
        if (s.stocks[d.id].price > par * 1.8) tick -= 1;
        if (s.stocks[d.id].price < par * 0.7) tick += 1;
          tick += this.rng.int(-1, 1);
        const before = s.stocks[d.id].price;
        this.bumpStock(d.id, tick);
        if (s.stocks[d.id].price !== before) shifts.push({ dist: d.id, old: before, price: s.stocks[d.id].price });
      }
      this.emit('stockDrift', {});
      shifts.sort((a, b) => Math.abs(b.price - b.old) - Math.abs(a.price - a.old));
      this.emit('stockShift', { lap: s.lap, changes: shifts });
    }
    // 3) pyramid
    this.pyramidRoundTick();
    // 4) statuses tick
    if (this.s.rentStorm > 0) this.s.rentStorm--;
    for (const p of s.players) {
      for (const k in p.statuses) { if (--p.statuses[k] <= 0) delete p.statuses[k]; }
      // deal flips resolve
      for (const a of p.assets) {
        if (a.flip && a.flipsIn > 0) {
          a.flipsIn--;
          if (a.flipsIn === 0) { const v = this.rng.chance(0.5) ? a.flip[0] : a.flip[1]; a.val = v; a.flip = null; this.log(`🃏 ${p.name}'s ${a.name} resolves at ${money(v)}.`, '🃏'); }
        }
      }
    }
    // 5) inflation
    if (this.flags.inflation) { s.inflationIdx = Math.min(4, s.inflationIdx * 1.02); }
    this.emit('roundEnd', { lap: s.lap });
    this.log(`— Lap ${s.lap} begins —`, '🗓️');
    // 6) lap cap
    if (s.lap > (s.effLapCap ?? this.flags.lapCap)) {
      const rich = currentLeader(this.s);
      this.winGame(rich, 'Lap cap reached — richest tycoon wins');
      return;
    }
    for (const p of alivePlayers(s)) this.checkFreedom(p);
    for (const p of alivePlayers(s)) this.checkTargetWin(p);
    this.checkWin();
  }

  checkTargetWin(p) {
    if (this.s.gameOver || this.flags.winMode !== 'target') return;
    const target = this.s.effTarget ?? this.flags.targetWorth;
    if (!p.targetHit && netWorth(this.s, p) >= target) {
      p.targetHit = true;
      this.emit('fx:targetHit', { player: p.id, target });
      this.log(`🎯 ${p.name} reached the ${money(target)} target — now get home past a payday corner to win!`, '🎯');
    }
  }
  checkWin() {
    const s = this.s;
    if (s.gameOver) return;
    const alive = alivePlayers(s);
    if (this.flags.winMode === 'lastStanding' && alive.length === 1) { this.winGame(alive[0], 'Last tycoon standing'); return; }
    if (alive.length === 1 && s.players.length > 1) { this.winGame(alive[0], 'Everyone else went broke'); return; }
  }
  winGame(p, reason) {
    if (this.s.gameOver) return;
    this.s.gameOver = true;
    this.s.winner = p.id;
    this.s.pending = null;
    this.log(`🏆 ${p.name} WINS — ${reason}`, '🏆');
    this.emit('win', { player: p.id, reason });
  }

  // ---------- ACTION DISPATCH ----------
  do(action, payload = {}) {
    if (this.s.gameOver) return false;
    const p = this.cur();
    try {
      switch (action) {
        case 'roll': if (this.s.pending?.kind === 'roll' && this.s.pending.player === p.id) { this.doRoll(); return true; } return false;
        case 'choose': this.choose(payload); return true;
        case 'build': if (this.canManage(p)) return this.buildOn(p, payload.tile); return false;
        case 'sellBuilding': if (this.canManage(p)) return this.sellBuilding(p, payload.tile); return false;
        case 'mortgage': if (this.canManage(p) || this.inDebt(p)) return this.mortgage(p, payload.tile); return false;
        case 'unmortgage': if (this.canManage(p)) return this.unmortgage(p, payload.tile); return false;
        case 'buyStock': if (this.atMarket(p, 'stocks')) { this.buyStock(p, payload.dist, payload.n, payload.at); return true; } return false;
        case 'sellStock': if (this.atMarket(p, 'stocks')) { this.sellStock(p, payload.dist, payload.n, payload.at); return true; } return false;
        case 'loan': if (this.atMarket(p, 'loans')) { this.takeLoan(p, payload.units, payload.at); return true; } return false;
        case 'repay': if (this.atMarket(p, 'loans')) { this.repayLoan(p, payload.units); return true; } return false;
        case 'dream': if (this.atMarket(p, 'dreams')) { this.buyDream(p, payload.id); return true; } return false;
        case 'sellAsset': if (this.atMarket(p)) { this.sellAsset(p, payload.index); return true; } return false;
        case 'buyDeal': if (this.atMarket(p, 'deals')) { this.buyMarketDeal(p, payload.tier, payload.at); return true; } return false;
        case 'joinPyramid': return false;  // UpStone only takes new blood at the Pyramid Pitch tile
        case 'upgradePyramid': if (this.canManage(p)) { this.pyramidUpgrade(p, payload.tier); return true; } return false;
        case 'cashOutPyramid': if (this.canManage(p) || this.inDebt(p)) { this.pyramidCashOut(p); return true; } return false;
        case 'useItem': if (this.canManage(p)) return this.useItem(p, payload); return false;
        case 'proposeTrade': {
          const proposer = payload.from != null ? this.P(payload.from) : p;
          if (proposer.bankrupt || this.s.auction) return false;
          if (proposer.id !== this.s.turn && proposer.isAI) return false; // humans may negotiate anytime
          return this.proposeTrade(proposer.id, payload);
        }
        case 'respondInbox': {
          return this.respondInboxTrade(payload.seat, payload.accept);
        }
        case 'endTurn': if (this.s.pending?.kind === 'roll' && this.s.pending.player === p.id) { this.finishTurn(true); return true; } return false;
        default: return false;
      }
    } catch (e) {
      console.error('Engine action error', action, e);
      return false;
    }
  }
  canManage(p) {
    const pend = this.s.pending;
    return !p.bankrupt && ((pend && ['roll', 'exchange', 'debt', 'gateway'].includes(pend.kind) && pend.player === p.id));
  }
  // market actions live at the Stock Exchange corner, at their gateway spaces, or during
  // a debt call where liquidation is always allowed. `system` limits gateway visits to
  // what that space fronts ('stocks' | 'deals' | 'loans' | 'dreams').
  atMarket(p, system) {
    const pend = this.s.pending;
    if (this.inDebt(p)) return true;
    if (!pend || pend.player !== p.id) return false;
    if (pend.kind === 'exchange') return true;
    if (pend.kind === 'gateway') return !system || system === pend.gateway;
    return false;
  }
  inDebt(p) { return this.debt && this.debt.player === p.id; }

  useItem(p, { item, ...args }) {
    if (!this.flags.items || !p.items.includes(item)) return false;
    switch (item) {
      case 'remoteDice': {
        const v = clamp(args.value || 7, 2, 12);
        this.s.forcedTotal = v;
        this.consume(p, item);
        this.log(`🎲 ${p.name} calibrates their Remote Dice to ${v}.`, '🎲');
        return true;
      }
      case 'roadblock': {
        const tile = args.tile;
        if (tile == null || this.s.roadblocks[tile] != null) return false;
        this.s.roadblocks[tile] = p.id;
        this.consume(p, item);
        this.log(`🚧 ${p.name} drops a Roadblock on ${TILES[tile].name}.`, '🚧');
        this.emit('fx:roadblock', { tile, player: p.id });
        return true;
      }
      case 'bomb': {
        const tile = args.tile;
        const pr = this.s.props[tile];
        if (!pr || pr.level <= 0) return false;
        this.consume(p, item);
        this.downgrade(tile);
        this.log(`💥 ${p.name}'s Demolition Note flattens a level on ${TILES[tile].name}!`, '💥');
        this.emit('fx:demolish', { tile });
        return true;
      }
      case 'teleport': {
        const tile = args.tile;
        if (tile == null) return false;
        this.consume(p, item);
        this.s.pending = null;
        this.log(`🚇 ${p.name} takes the subway to ${TILES[tile].name}.`, '🚇');
        this.teleportTo(p, tile);
        return true;
      }
      case 'shield': return false; // passive
      default: return false;
    }
  }

  publicState() { return JSON.parse(JSON.stringify(this.s)); }

  // ---------- SAVE / RESTORE ----------
  serialize() {
    return {
      v: 3,
      savedAt: Date.now(),
      state: this.s,
      rng: this.rng.s,
      fortunePile: this.fortuneDeck.pile,
      frenzyPile: this.frenzyDeck.pile,
      debt: this.debt,
      defer: this.defer,
      speedBonus: this.speedBonus,
    };
  }
  static restore(saved) {
    const e = new Engine(saved.state);
    e.rng.s = saved.rng >>> 0;
    if (saved.fortunePile) e.fortuneDeck.pile = saved.fortunePile;
    if (saved.frenzyPile) e.frenzyDeck.pile = saved.frenzyPile;
    e.debt = saved.debt || null;
    e.defer = !!saved.defer;
    e.speedBonus = saved.speedBonus || null;
    return e;
  }
}

function DISTRICT_TILES_ALL_ARR() { const a = []; for (let i = 0; i < BOARD_SIZE; i++) if (TILES[i].type === 'property') a.push(i); return a; }
