import { newGame, passiveIncome, expensesOf, netWorth } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';

const rsId = process.argv[2] || 'ratrace';
const seed = parseInt(process.argv[3] || '1091');
const n = parseInt(process.argv[4] || '4');
const rs = RULESETS.find(r => r.id === rsId);
const players = [];
for (let i = 0; i < n; i++) players.push({ name: `B${i + 1}`, token: 'hat', isAI: true, difficulty: ['newbie', 'standard', 'sharp', 'ruthless'][i % 4], professionId: PROFESSIONS[i % 8].id });
const state = newGame({ seed, players, ruleset: rsId, flags: { ...rs.flags } });
const engine = new Engine(state);
const brains = state.players.map((_, i) => new Brain(engine, i));
let lastLap = 1;
engine.on('roundEnd', () => {
  if (state.lap % 10 !== 0) return;
  console.log(`--- lap ${state.lap} ---`);
  for (const p of state.players) {
    console.log(`  ${p.name} cash=${p.cash} passive=${passiveIncome(state, p)} exp=${expensesOf(state, p)} assets=${p.assets.length} free=${p.freedom} worth=${Math.round(netWorth(state, p))} loans=${p.loans}`);
  }
});
engine.beginTurn();
for (let step = 0; step < 400000 && !state.gameOver; step++) {
  const pend = state.pending;
  if (!pend) { console.log('NO PENDING'); break; }
  brains[pend.player].respond();
}
console.log('end laps=', state.lap, 'winner=', state.winner);
