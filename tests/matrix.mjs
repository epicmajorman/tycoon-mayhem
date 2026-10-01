// Full completion matrix: every ruleset x every board x player counts.
// Asserts every game reaches a decisive end (win condition or cap decision) with zero stalls.
import process from 'node:process';
import { newGame, netWorth, alivePlayers } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';

const TOKENS = ['hat', 'car', 'dog', 'cat', 'ship', 'boot', 'rocket', 'crown'];
const DIFFS = ['newbie', 'standard', 'sharp', 'ruthless'];
const BOARDS = ['standard', 'grand', 'ultimate'];

function runGame(rulesetId, boardId, seed, playerCount) {
  const rs = RULESETS.find(r => r.id === rulesetId);
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      name: `B${i + 1}`, token: TOKENS[i], isAI: true, difficulty: DIFFS[i % 4],
      professionId: PROFESSIONS[i % PROFESSIONS.length].id,
    });
  }
  const state = newGame({ seed, players, ruleset: rulesetId, flags: { ...rs.flags, boardId } });
  const engine = new Engine(state);
  const brains = state.players.map((_, i) => new Brain(engine, i));
  engine.beginTurn();
  let guard = 0;
  while (!state.gameOver && guard++ < 500000) {
    const pend = state.pending;
    if (!pend) return { ok: false, why: 'STALL (no pending)', lap: state.lap };
    try { brains[pend.player].respond(); } catch (e) { return { ok: false, why: 'CRASH ' + e.message, lap: state.lap }; }
    if (!state.pending && !state.gameOver && !state.auction) return { ok: false, why: 'DANGLING (prompt cleared)', lap: state.lap };
  }
  if (!state.gameOver) return { ok: false, why: 'INCOMPLETE (step cap)', lap: state.lap };
  const decisive = state.winner != null && engine.emitter.log.filter(e => e.type === 'win').pop()?.reason !== 'Lap cap reached — richest tycoon wins';
  return { ok: true, lap: state.lap, decisive, winner: state.players[state.winner]?.name };
}

const rulesets = RULESETS.filter(r => r.id !== 'custom').map(r => r.id);
const counts = [2, 4, 6, 8];
let total = 0, failed = 0, decisive = 0, capOut = 0;
const lapList = [];
for (const rsId of rulesets) {
  for (const boardId of BOARDS) {
    for (const pc of counts) {
      const seed = 55000 + rsId.length * 977 + boardId.length * 31 + pc * 7;
      const r = runGame(rsId, boardId, seed, pc);
      total++;
      if (!r.ok) { failed++; console.log(`❌ ${rsId} ${boardId} p${pc}: ${r.why} (lap ${r.lap})`); continue; }
      lapList.push(r.lap);
      if (r.decisive) decisive++; else capOut++;
      console.log(`✅ ${rsId.padEnd(9)} ${boardId.padEnd(9)} p${pc}  laps=${String(r.lap).padStart(3)}  winner=${r.winner}  ${r.decisive ? 'DECISIVE' : 'cap→richest'}`);
    }
  }
}
lapList.sort((a, b) => a - b);
console.log(`\n=== ${total} games: ${failed} failures · ${decisive} decisive wins · ${capOut} cap-decided · median ${lapList[Math.floor(lapList.length / 2)]} laps ===`);
process.exit(failed ? 1 : 0);
