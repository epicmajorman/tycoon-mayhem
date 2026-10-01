// Save-system roundtrip test: run a live game N turns, snapshot, restore, verify continuity.
import { newGame } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';
import { netWorth } from '../src/core/state.js';

function mkEngine(seed, boardId) {
  const rs = RULESETS.find(r => r.id === 'insane');
  const players = [];
  for (let i = 0; i < 4; i++) players.push({ name: `B${i + 1}`, token: ['hat', 'car', 'dog', 'cat'][i], isAI: true, difficulty: 'sharp', professionId: PROFESSIONS[i].id });
  const state = newGame({ seed, players, ruleset: 'insane', flags: { ...rs.flags, boardId } });
  const engine = new Engine(state);
  const brains = state.players.map((_, i) => new Brain(engine, i));
  return { engine, brains };
}

let errors = 0;
for (const boardId of ['standard', 'grand', 'ultimate']) {
  const { engine, brains } = mkEngine(4242, boardId);
  engine.beginTurn();
  // play 150 prompts
  for (let k = 0; k < 150 && !engine.s.gameOver; k++) {
    const pend = engine.s.pending;
    if (!pend) { console.error('NO PENDING mid-game', boardId); errors++; break; }
    brains[pend.player].respond();
  }
  // snapshot
  const snap = JSON.parse(JSON.stringify(engine.serialize()));
  const before = {
    turn: engine.s.turn, lap: engine.s.lap,
    cash: engine.s.players.map(p => p.cash),
    pos: engine.s.players.map(p => p.pos),
    worth: engine.s.players.map(p => Math.round(netWorth(engine.s, p))),
    stocks: JSON.stringify(engine.s.stocks),
    pending: engine.s.pending?.kind,
    hype: engine.s.pyramid.hype,
    pool: engine.s.pool,
  };
  // restore and compare
  const e2 = Engine.restore(snap);
  const after = {
    turn: e2.s.turn, lap: e2.s.lap,
    cash: e2.s.players.map(p => p.cash),
    pos: e2.s.players.map(p => p.pos),
    worth: e2.s.players.map(p => Math.round(netWorth(e2.s, p))),
    stocks: JSON.stringify(e2.s.stocks),
    pending: e2.s.pending?.kind,
    hype: e2.s.pyramid.hype,
    pool: e2.s.pool,
  };
  const same = JSON.stringify(before) === JSON.stringify(after);
  if (!same) {
    errors++;
    console.error(`❌ ${boardId}: restore mismatch\n  before=${JSON.stringify(before)}\n  after=${JSON.stringify(after)}`);
  } else {
    // continuity: play 100 more prompts on both engines in lockstep; states must stay identical
    const b2 = e2.s.players.map((_, i) => new Brain(e2, i));
    let diverged = false;
    for (let k = 0; k < 100 && !engine.s.gameOver && !e2.s.gameOver; k++) {
      const p1 = engine.s.pending, p2 = e2.s.pending;
      if (!p1 || !p2) break;
      const sig1 = JSON.stringify([engine.s.turn, engine.s.players.map(p => p.cash), engine.s.pending?.kind]);
      const sig2 = JSON.stringify([e2.s.turn, e2.s.players.map(p => p.cash), e2.s.pending?.kind]);
      if (sig1 !== sig2) { diverged = true; break; }
      brains[p1.player].respond();
      b2[p2.player].respond();
    }
    if (diverged) { console.error(`❌ ${boardId}: diverged after restore`); errors++; }
    else console.log(`✅ ${boardId}: snapshot + restore + 100-prompt continuity OK (lap ${engine.s.lap})`);
  }
}
console.log(errors ? `${errors} ERRORS` : 'SAVE SYSTEM: ALL PASS');
process.exit(errors ? 1 : 0);
