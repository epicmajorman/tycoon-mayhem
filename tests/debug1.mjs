import { newGame } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';

const rsId = process.argv[2] || 'insane';
const seed = parseInt(process.argv[3] || '1078');
const n = parseInt(process.argv[4] || '2');
const rs = RULESETS.find(r => r.id === rsId);
const players = [];
for (let i = 0; i < n; i++) players.push({ name: `Bot${i + 1}`, token: 'hat', isAI: true, difficulty: ['newbie', 'standard', 'sharp', 'ruthless'][i % 4], professionId: PROFESSIONS[i % 8].id });
const state = newGame({ seed, players, ruleset: rsId, flags: { ...rs.flags } });
const engine = new Engine(state);
const brains = state.players.map((_, i) => new Brain(engine, i));
engine.beginTurn();
for (let step = 0; step < 200000 && !state.gameOver; step++) {
  const pend = state.pending;
  if (!pend) {
    console.log(`\n!!! NO PENDING at step=${step} turn=${state.turn} lap=${state.lap}`);
    console.log('tail:', engine.emitter.log.slice(-8).map(e => `${e.type} ${JSON.stringify(e).slice(0, 100)}`).join('\n '));
    break;
  }
  const before = engine.emitter.log.length;
  const r = brains[pend.player].respond();
  const newEvents = engine.emitter.log.slice(before);
  if (newEvents.length === 0) {
    console.log(`\n!!! SILENT respond() step=${step} ret=${r} pending=${JSON.stringify(pend)}`);
    console.log(`    auction=${JSON.stringify(state.auction)} cash=${state.players.map(p => p.cash)}`);
    const b = brains[pend.player];
    if (pend.kind === 'auction' && state.auction) {
      const a = state.auction;
      const t = pend.tile ?? a.tile;
      console.log(`    tileValue=${b.tileValue(a.tile)} bidFactor=${b.d.bidFactor} reserve=${b.reserveCash()} cash=${b.p.cash}`);
    }
    break;
  }
}
console.log('done. laps=', state.lap, 'winner=', state.winner);
