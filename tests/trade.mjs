// Trade-inbox regression: inject offers between AIs mid-game; every offer must be
// answered (trade:done or trade:declined) and the game must keep flowing.
import { newGame } from '../src/core/state.js';
import { Engine } from '../src/core/engine.js';
import { Brain } from '../src/ai/brain.js';
import { RULESETS } from '../src/data/rulesets.js';
import { PROFESSIONS } from '../src/data/professions.js';

const rs = RULESETS.find(r => r.id === 'insane');
const players = [];
for (let i = 0; i < 4; i++) players.push({ name: `B${i + 1}`, token: 'hat', isAI: true, difficulty: 'sharp', professionId: PROFESSIONS[i].id });
const state = newGame({ seed: 777, players, ruleset: 'insane', flags: { ...rs.flags, boardId: 'standard' } });
const engine = new Engine(state);
const brains = state.players.map((_, i) => new Brain(engine, i));
engine.beginTurn();

let prompts = 0, offers = 0, stuckChecks = 0;
while (!state.gameOver && prompts < 300000) {
  const pend = state.pending;
  if (!pend) { console.error('STALL (no pending)'); process.exit(1); }
  // every 60 prompts, inject a cash offer from one AI to another (crosses turns & doubles)
  if (prompts % 60 === 0 && offers < 10) {
    const alive = state.players.filter(p => !p.bankrupt);
    if (alive.length >= 2) {
      const from = alive[prompts % alive.length];
      const to = alive[(prompts + 1) % alive.length];
      if (from.id !== to.id && from.cash >= 250) {
        const ok = engine.do('proposeTrade', { from: from.id, to: to.id, give: { cash: 250 }, get: { cash: 60 } });
        if (ok) offers++;
      }
    }
  }
  const doneBefore = engine.emitter.log.filter(e => e.type === 'trade:done' || e.type === 'trade:declined').length;
  const inboxBefore = (state.tradeInbox || []).length;
  brains[pend.player].respond();
  const doneAfter = engine.emitter.log.filter(e => e.type === 'trade:done' || e.type === 'trade:declined').length;
  const inboxAfter = (state.tradeInbox || []).length;
  // if a response happened, the inbox must have shrunk; if the inbox is untouched, fine
  if (doneAfter > doneBefore && inboxAfter > inboxBefore) {
    console.error('BUG: responded but inbox grew/not drained');
    process.exit(1);
  }
  if (!state.pending && !state.gameOver && !state.auction) {
    stuckChecks++;
    if (stuckChecks > 3) { console.error('STALL: pending cleared, no continuation'); process.exit(1); }
  } else stuckChecks = 0;
  prompts++;
}
const done = engine.emitter.log.filter(e => e.type === 'trade:done').length;
const declined = engine.emitter.log.filter(e => e.type === 'trade:declined').length;
const unanswered = (state.tradeInbox || []).length;
console.log(`offers injected: ${offers} · answered: ${done + declined} (done ${done}, declined ${declined}) · unanswered: ${unanswered} · laps ${state.lap}`);
if (offers > 0 && done + declined === 0) { console.error('FAIL: offers never answered'); process.exit(1); }
if (unanswered > 0) { console.error('FAIL: offers left unanswered in inbox'); process.exit(1); }
console.log('TRADE INBOX: ALL PASS');
