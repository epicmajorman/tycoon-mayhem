// Headless soak test: full AI-vs-AI games across rulesets. Asserts termination, no crashes,
// sane economy. Run: node tests/sim.mjs [games]
import { newGame } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';
import { netWorth, alivePlayers } from '../src/core/state.js';

const N = parseInt(process.argv[2] || '24');
const TOKENS = ['hat', 'car', 'dog', 'cat', 'ship', 'boot', 'rocket', 'crown'];
const DIFFS = ['newbie', 'standard', 'sharp', 'ruthless'];

function runGame(rulesetId, seed, playerCount, boardId = 'standard') {
  const rsDef = RULESETS.find(r => r.id === rulesetId);
  const flags = { ...rsDef.flags, boardId };
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      name: `Bot${i + 1}`, token: TOKENS[i], isAI: true,
      difficulty: DIFFS[i % DIFFS.length],
      professionId: PROFESSIONS[i % PROFESSIONS.length].id,
    });
  }
  const state = newGame({ seed, players, ruleset: rulesetId, flags });
  const engine = new Engine(state);
  const brains = state.players.map((p, i) => new Brain(engine, i));
  let errors = 0, prompts = 0, collapses = 0;
  engine.on('fx:pyramidCollapse', () => collapses++);
  engine.on('log', () => {});
  engine.beginTurn();
  let guard = 0;
  const MAX_STEPS = 400000;
  let lastSig = '', sigCount = 0;
  while (!state.gameOver && guard++ < MAX_STEPS) {
    const pend = state.pending;
    if (!pend) {
      console.error(`NO PENDING PROMPT — stuck. seed=${seed} rs=${rulesetId} turn=${state.turn} phase=${state.phase} lap=${state.lap} gameOver=${state.gameOver}`);
      console.error('last events:', engine.emitter.log.slice(-14).map(e => `${e.type}:${JSON.stringify(e).slice(0, 120)}`).join('\n  '));
      errors++; break;
    }
    const p = state.players[pend.player];
    if (p.bankrupt) { console.error('PROMPT TO BANKRUPT PLAYER', pend.kind, seed); errors++; break; }
    try {
      prompts++;
      brains[pend.player].respond();
    } catch (e) {
      console.error(`CRASH seed=${seed} ruleset=${rulesetId} prompt=${pend.kind}:`, e);
      errors++;
      break;
    }
    if (!state.pending && !state.gameOver && !state.auction) {
      console.error(`PROMPT CLEARED WITHOUT NEXT — kind=${pend.kind} seed=${seed}`);
      errors++;
      break;
    }
    // stall detector
    const sig = JSON.stringify({ t: state.turn, p: state.pending, a: state.auction, cash: state.players.map(x => x.cash) });
    if (sig === lastSig) { sigCount++; if (sigCount >= 3000) {
      console.error(`STALL LOOP seed=${seed} rs=${rulesetId} pending=${JSON.stringify(state.pending)} auction=${JSON.stringify(state.auction)} turn=${state.turn} cash=${state.players.map(x=>x.cash)} debt=${JSON.stringify(engine.debt)}`);
      errors++; break;
    } } else { lastSig = sig; sigCount = 0; }
  }
  if (!state.gameOver && guard >= MAX_STEPS) { console.error(`STALL seed=${seed} (step cap)`); errors++; }
  const alive = alivePlayers(state);
  const worths = state.players.map(p => ({ name: p.name, worth: Math.round(netWorth(state, p)), out: p.bankrupt }));
  const winEv = engine.emitter.log.filter(e => e.type === 'win').pop();
  return { errors, laps: state.lap, winner: state.winner != null ? state.players[state.winner].name : null, reason: winEv ? winEv.reason : '?', worths, prompts, collapses, alive: alive.length };
}

const rulesetsToTest = ['insane', 'classic', 'wealth', 'ratrace', 'pyramid'];
let totalErrors = 0;
const lapCounts = [];
const BOARD_CYCLE = ['standard', 'standard', 'grand', 'ultimate'];
let boardIdx = 0;
for (const rsId of rulesetsToTest) {
  for (let g = 0; g < Math.ceil(N / rulesetsToTest.length); g++) {
    const playerCount = 2 + (g % 4) + (g % 3); // 2..7 variety
    const boardId = BOARD_CYCLE[boardIdx++ % BOARD_CYCLE.length];
    const r = runGame(rsId, 1000 + g * 77 + rsId.length * 13, Math.min(8, playerCount), boardId);
    totalErrors += r.errors;
    lapCounts.push(r.laps);
    const tag = r.errors ? '❌' : '✅';
    console.log(`${tag} ${rsId.padEnd(9)} ${boardId.padEnd(9)} p${Math.min(8, playerCount)} laps=${String(r.laps).padStart(3)}  winner=${String(r.winner).padEnd(6)} alive=${r.alive} collapses=${r.collapses} errors=${r.errors}  «${r.reason}»`);
    if (r.errors) {
      console.log('   worths:', r.worths.map(w => `${w.name}:${w.worth}${w.out ? '(OUT)' : ''}`).join(' '));
    }
  }
}
lapCounts.sort((a, b) => a - b);
const med = lapCounts[Math.floor(lapCounts.length / 2)];
console.log(`\n=== ${totalErrors === 0 ? 'ALL PASS' : totalErrors + ' ERRORS'} — median game length ${med} laps (cap ${RULESETS[0].flags.lapCap}) ===`);
process.exit(totalErrors ? 1 : 0);
