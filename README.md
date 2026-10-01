# 🎩 TYCOON MAYHEM

*An insane monopoly — Monopoly × Super Monopoly (Richman) × Ultimate Monopoly × Fortune Street × Cashflow, plus a pyramid scheme you can ride into the ground.*

Rich 3D night-city board · procedural soundtrack · 2–8 players (hot-seat + LAN) · bots with 4 difficulty tiers · 6 rulesets + full custom rules · interactive tutorial.

---

## ▶ Play (no install)

**Option A — one click:** double-click **`start.bat`** (starts the LAN relay + opens the game).

**Option B — manual:**
```bash
cd "Monopoly like game"
node server/serve.mjs             # zero-cache static server on :8123
# open http://localhost:8123
```

**LAN multiplayer (2–8 humans + bots):**
```bash
node server/server.mjs            # relay on port 3888
```
Then in-game: **LAN Multiplayer → Host a room**, share the 4-letter code. Friends open the same page on the network and join. (Host runs the match; late join is not supported — join before starting.)

Requires a modern browser (Chrome/Edge/Firefox). No build step, no npm install, no external assets — everything (3D, music, SFX) is generated procedurally.

---

## 🎮 What's in the box

### Boards — pick your city size
| Board | Size | Rings | Districts | Flavor |
|---|---|---|---|---|
| **Standard City** | 52 tiles | 1 | 10 | The classic single-ring board. |
| **Grand City** | 80 tiles | 2 | 12 | Inner ring holds the seals and a double-payday corner — dive in on an even roll. |
| **Ultimate Metropolis** | 132 tiles | 3 | 21 | The full Ultimate-Monopoly experience: transit-station ring switching, inner PAY DAY, 21 stocks. |

**Transit Stations** (multi-ring boards): *pass* a station on an **even roll** and you instantly transfer to the linked ring mid-move; *land* on one and you can ride on purpose (station-to-station links). Salary, targets and lap caps auto-scale with board size (Ultimate: ×1.6 salary, ×1.7 target, 132 tiles ≈ 30-lap games).

### Trading — negotiate anytime
Every player card has a **Propose trade** button (Monopoly-style table talk): offer properties, cash, stocks, jail-free cards and items to any rival, even mid-turn. Offers land in their inbox (🔔 badge on their card); AI rivals evaluate and answer within moments. The **Stock Exchange corner** also hosts the market: stocks, deal broker, loans, Dreams.

### The fusion (and where each piece comes from)
| System | From |
|---|---|
| Buy-or-auction, sets, even-build houses→hotels→**skyscrapers**, mortgages, jail, trades, bankruptcy | **Monopoly** |
| District **stock market** (200 shares each, 10+ share orders move price, development pumps price, 15% rent dividends, **Mogul** +25% rent) | **Fortune Street** |
| **Total-assets win**: hit the target net worth, then return home past START | **Fortune Street** |
| Professions, per-lap **expenses**, **passive income** (deal assets + dividends + rent roll), **Freedom**, **Dreams**, loans that worsen your expense line, doodads, deal market | **Cashflow** |
| Corner **seals** (♥♦♣♠) → salary **promotions**, item cards, statuses, speed-die, finite building shortage, inflation, **multi-ring boards with transit-station track switching** | **Ultimate Monopoly / Richman** |
| **UpStone Ventures** pyramid: tiered buy-in, hype meter, pot coverage & collapse-risk readouts, recruiting, collapse that pays early birds and really crashes every stock 15% | *the "insane monopoly" genre* |
| Casino corner, frenzy deck (wealth equalizer, rent storms, flash crashes, tornado…), remote dice, roadblocks, bombs, subway tokens, shields | **Richman / mayhem** |

### Rulesets
**Classic Tycoon** (last standing) · **Wealth Street** (stock compounding, target win) · **Rat Race** (Cashflow: escape on passive income, buy a Dream) · **Pyramid Pandemonium** (ride the MLM) · **INSANE MAYHEM** (everything: speed die, finite buildings, inflation, high chaos) · **Custom** (every knob).

### AI
Four difficulties (Newbie / Standard / Sharp / Ruthless) driven by a tile-traffic valuation model, auction bidding curves, set-completion trades, stock momentum & mogul corners, pyramid risk appetite — and full denial play at Ruthless. Bots use the same rules and dice as you (seeded, no cheating).

### Tech
- **Engine**: pure-JS, seeded, event-sourced state machine (`src/core/`) — runs in browser AND Node.
- **3D**: Three.js r160 (vendored), procedural board/city/tokens/dice, bloom, cinematic camera.
- **Audio**: WebAudio synth engine — 10 loopable themes with intensity layering + ~26 synthesized SFX. Zero audio files.
- **Net**: pure-Node RFC6455 relay (`server/server.mjs`, zero deps) — host-authoritative action-stream; peers mirror the match deterministically.
- **Tests**: `node tests/sim.mjs 60` runs 60 full AI-vs-AI games headless (termination, no-stall, economy balance).

### Project layout
```
index.html            boot + import map
src/core/             engine, state, RNG, events
src/data/             board (52 tiles), cards, professions, rulesets
src/ai/brain.js       the bots
src/three/            renderer, board, tokens, dice, fx, textures
src/audio/            music director + sfx synth
src/ui/               hud, modals, menu, tutorial
src/net/client.js     relay client
server/server.mjs     LAN relay (pure Node)
tests/sim.mjs         headless soak/balance harness
DESIGN.md             full game design document
```

*Design doc with all the numbers: [DESIGN.md](DESIGN.md).*
