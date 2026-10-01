// Play 10 full games to completion across rulesets/boards/player counts, with deep
// feature telemetry + invariants. Run: node tests/play10.mjs
import { newGame, netWorth, alivePlayers, passiveIncome, expensesOf } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';
import { TILES } from '../src/data/board.js';

const TOKENS = ['hat', 'car', 'dog', 'cat', 'ship', 'boot', 'rocket', 'crown'];
const DIFFS = ['newbie', 'standard', 'sharp', 'ruthless'];

const GAMES = [
  { rs: 'insane',   board: 'standard', players: 4 },
  { rs: 'insane',   board: 'ultimate', players: 6 },
  { rs: 'classic',  board: 'standard', players: 4 },
  { rs: 'classic',  board: 'grand',    players: 6 },
  { rs: 'wealth',   board: 'standard', players: 3 },
  { rs: 'wealth',   board: 'ultimate', players: 5 },
  { rs: 'ratrace',  board: 'standard', players: 2 },
  { rs: 'ratrace',  board: 'grand',    players: 4 },
  { rs: 'pyramid',  board: 'standard', players: 4 },
  { rs: 'pyramid',  board: 'ultimate', players: 8 },
];

let failures = 0;

function play10cfg(idx, cfg) {
  const rs = RULESETS.find(r => r.id === cfg.rs);
  const players = [];
  for (let i = 0; i < cfg.players; i++) {
    players.push({
      name: `P${i + 1}`, token: TOKENS[i], isAI: true, difficulty: DIFFS[i % 4],
      professionId: PROFESSIONS[i % PROFESSIONS.length].id,
    });
  }
  const seed = 90210 + idx * 1337;
  const state = newGame({ seed, players, ruleset: cfg.rs, flags: { ...rs.flags, boardId: cfg.board } });
  const engine = new Engine(state);
  const brains = state.players.map((_, i) => new Brain(engine, i));

  const count = (type) => engine.emitter.log.filter(e => e.type === type).length;
  let prompts = 0, stallGuards = 0, tradesInjected = 0, humanActs = 0;
  const problems = [];

  engine.beginTurn();
  while (!state.gameOver) {
    const pend = state.pending;
    if (!pend) {
      // driver-equivalent stall guard: a seat still pending after answering an inbox
      // offer or a doubles re-roll must be continued by responding again
      stallGuards++;
      if (stallGuards > 3) { problems.push('STALL: no pending, no game over'); break; }
      const last = state.players[state.turn];
      if (last && !last.bankrupt) brains[state.turn].respond();
      if (!state.pending && !state.gameOver) { problems.push('STALL: respond did not continue'); break; }
      continue;
    }
    stallGuards = 0;
    if (prompts > 600000) { problems.push('INCOMPLETE: prompt cap'); break; }
    prompts++;

    // occasionally negotiate like the browser stress test (offer from a random tycoon)
    if (prompts % 47 === 0 && !state.auction && tradesInjected < 6) {
      const alive = alivePlayers(state);
      const from = alive[prompts % alive.length];
      const to = alive[(prompts + 2) % alive.length];
      if (from.id !== to.id && from.cash >= 300 && to.cash >= 100) {
        const ok = engine.do('proposeTrade', { from: from.id, to: to.id, give: { cash: 300 }, get: { cash: 100 } });
        if (ok) tradesInjected++;
      }
    }

    // invariant probes every 200 prompts
    if (prompts % 200 === 0) {
      for (const p of state.players) {
        if (!Number.isFinite(p.cash)) problems.push(`NaN cash on ${p.name}`);
        if (!Number.isFinite(netWorth(state, p))) problems.push(`NaN worth on ${p.name}`);
      }
      if (!Number.isFinite(state.pool)) problems.push('NaN pool');
    }

    const me = state.players[pend.player];
    if (me.isAI) {
      try { brains[pend.player].respond(); } catch (e) {
        problems.push(`AI crash: ${e.message}`); break;
      }
    } else {
      // a simulated human: rolls, buys sometimes, accepts some trades, plays the places
      humanActs++;
      try {
        switch (pend.kind) {
          case 'roll': engine.do('roll'); break;
          case 'buy': engine.do('choose', me.cash > pend.price + 250 ? 'buy' : 'decline'); break;
          case 'auction': engine.do('choose', state.auction.bid === 0 ? { type: 'bid', amount: 50 } : { type: 'pass' }); break;
          case 'jail': engine.do('choose', me.cash >= 100 && state.lap < 20 ? 'pay' : 'roll'); break;
          case 'deal': engine.do('choose', null); break;
          case 'casino': engine.do('choose', 'leave'); break;
          case 'pitch': engine.do('choose', null); break;
          case 'exchange': engine.do('choose', { type: 'continue' }); break;
          case 'select': engine.do('choose', { tile: (pend.tiles || [0])[0], player: (pend.players || [0])[0], myTile: null }); break;
          case 'debt': engine.do('choose', me.cash >= (engine.debt?.amount || 0) ? 'pay' : 'bankrupt'); break;
          case 'trade': engine.do('choose', 'accept'); break;
          default: engine.do('choose', {});
        }
      } catch (e) { problems.push(`human-act crash: ${e.message}`); break; }
      humanActs++;
    }
  }

  // ---- invariants ----
  if (!state.gameOver && problems.length === 0) problems.push('game did not finish');
  for (const p of state.players) {
    if (!Number.isFinite(p.cash)) problems.push(`NaN cash ${p.name}`);
    if (!Number.isFinite(netWorth(state, p))) problems.push(`NaN worth ${p.name}`);
  }
  if (state.winner == null) problems.push('no winner recorded');
  else if (state.players[state.winner].bankrupt) problems.push('winner is bankrupt');

  const winEv = engine.emitter.log.filter(e => e.type === 'win').pop();
  const decisive = winEv && !winEv.reason.includes('Lap cap');
  const feats = {
    spins: count('fx:spin'),
    tradesDone: count('trade:done') + count('trade:declined'),
    auctions: count('auction:win') + count('auction:start') > 0 ? count('auction:win') : 0,
    collapses: count('fx:pyramidCollapse'),
    promotions: count('fx:promote'),
    bankrupts: count('fx:bankrupt'),
    freedoms: count('fx:freedom'),
    dreams: count('fx:dream'),
    builds: count('fx:build'),
    doubles: count('fx:doubles'),
    jails: count('fx:jail'),
    tradesInjected,
    prompts,
  };
  return { state, problems, decisive, reason: winEv ? winEv.reason : '?', feats };
}

let idx = 0;
for (const cfg of GAMES) {
  idx++;
  const { state, problems, decisive, reason, feats } = play10cfg(idx, cfg);
  const tag = `#${String(idx).padStart(2, '0')} ${cfg.rs.padEnd(8)} ${cfg.board.padEnd(9)} p${cfg.players}`;
  if (problems.length) {
    failures++;
    console.log(`❌ ${tag} — ${problems.join(' | ')}`);
  } else {
    console.log(`✅ ${tag} laps=${String(state.lap).padStart(3)} winner=${state.players[state.winner].name.padEnd(4)} ${decisive ? 'DECISIVE' : 'cap→richest'}  [spin ${feats.spins} · trade ${feats.tradesDone}/${feats.tradesInjected} · auction ${feats.auctions} · build ${feats.builds} · 2x ${feats.doubles} · jail ${feats.jails} · promo ${feats.promotions} · bankrupt ${feats.bankrupts} · free ${feats.freedoms} · dream ${feats.dreams} · collapse ${feats.collapses}]`);
  }
  if (decisive === false && cfg.rs !== 'classic') console.log(`   ↳ note: ${cfg.rs} ended at the lap cap («${reason}»)`);
}

console.log(failures === 0 ? '\n=== 10/10 GAMES COMPLETE — ALL CHECKS PASS ===' : `\n=== ${failures} FAILURES ===`);
process.exit(failures ? 1 : 0);
