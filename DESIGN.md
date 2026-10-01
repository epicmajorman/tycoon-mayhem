# TYCOON MAYHEM — Game Design Document
*An "insane monopoly" fusion: Monopoly × Super Monopoly (Richman) × Ultimate Monopoly × Fortune Street × Cashflow × pyramid-scheme chaos.*
**Target: browser, AAA-feel, 3D, 2–8 players (hot-seat + LAN), 4 AI difficulties, 6 rulesets, interactive tutorial.**

---

## 1. Research Synthesis (what we steal from each reference)

| Source | Steal |
|---|---|
| **Monopoly** | Buy-or-auction on landing, color sets with rent-doubling, even-build ladder house→hotel, mortgage 50%/+10%, jail ($100 bail / doubles / 3 turns), GO salary, taxes, card decks, free-form trading, bankruptcy liquidation & auction-off. |
| **Super Monopoly → Richman (大富翁)** | Attack/defense **item cards** (Remote Dice, Roadblock, Bomb, Teleport, Shield), timed **buff statuses** (Wealth Idol refuses payments 1 lap; Bad Luck pays double), bank **loans**, **wealth-equalizer** chaos card, demolition. |
| **Ultimate Monopoly** | **Speed die** (1/2/3 + BUS + MR. TYCOON faces), **central Pool** for all taxes/fines with a Pool Payout tile (50% back), scaling rent for owning whole asset classes, chaos event deck (rally/crash/demolition), travel/teleport verbs. |
| **Fortune Street (Itadaki Street)** | **District stock market** (buy/sell shares per district, ≥10 shares moved = price tick, development raises price, rent commission paid to shareholders), **Mogul** (top shareholder gets +25% rent), **Total-Assets win**: reach target net worth *and return to START*, suit **seals** on corners → salary **promotion** ladder, forced buyout/sellback cards at multipliers. |
| **Cashflow (Kiyosaki)** | **Professions** with asymmetric salary/expenses (all tuned to same payday ratio), per-lap **expenses**, **passive income** (dividends/commissions/deal cashflow), **Freedom** when passive ≥ expenses, **loans** ($500 units, +10%/lap that raise your expense line), **Doodad** forced impulse buys, **Deal cards** (small/big), phase transition on Freedom (payout + perks). |
| **"Insane Monopoly" genre + MLM math** | Escalation & betrayal verbs, **push-your-luck investment scheme** with hype meter, tiered entry, per-lap yield paid from a shared pot, **recruit** competitors, **collapse** event with early-bird payout, market crash shockwave, comeback chaos. |

**One-line pitch:** Monopoly's negotiation core, Fortune Street's compounding stock engine, Cashflow's income-statement race, Richman's item chaos, Ultimate Monopoly's speed die & pool, and a pyramid scheme you can ride — or ride into the ground.

---

## 2. Core Pillars

1. **Every system feeds net worth three ways** — property value, stock price, passive cashflow. Buying your own district's stock then upgrading it compounds on all three (the Fortune Street engine).
2. **Readable risk** — pyramid hype, stock drift, finite buildings: every gamble has a visible meter. Bots and humans read the same signals.
3. **No dead turns** — pre-roll economy actions (stocks, build, trades, items, pyramid, loans), event cards that hit the whole table, and rent commissions keep eliminated-ish players engaged.
4. **Comebacks are real** — Pool payouts, crash cards, wealth equalizer, pyramid collapse hitting the leader hardest (more shares), Freedom phase payouts.
5. **Insane, not random** — chaos is bounded by meters and knobs (chaosIntensity), so it escalates drama without breaking fairness.

---

## 3. The Board — 52 tiles, 4 corners, 10 districts

Clockwise ring. Corners at 0/13/26/39. Scale: start cash $2,500; property prices $80–$900; target net worth $25k–$100k.

```
 0 START (♥ seal; salary on pass)      1–4  OLD DOCKLANDS      $80  $90  $100 $110
 5 INCOME TAX (max($300, 8% cash)→Pool) 6–9  NEON ROW           $110 $120 $130 $140
10 FORTUNE (card; some cards are deals) 11–14 MAPLE HEIGHTS     $150 $160 $170 $180
15 DOODAD ALLEY (forced impulse buy)    16–19 MIDTOWN           $190 $210 $230 $250
20 GO TO JAIL → 13                      21 FRENZY (chaos card)
22–25 CASINO STRIP   $260 $270 $280 $290
26 STOCK EXCHANGE (corner: trade any stock, take loans, buy Dreams)  ← ♣ seal on pass
27–30 GOLD COAST  $300 $310 $320 $330   31 POOL PAYOUT (collect 50% of Pool)
32–35 SILICON GULCH $340 $350 $360 $380 36 LUXURY TAX ($200 → Pool)
37–38 FINANCIAL QUARTER $420 $450       39 VENTURE CASINO (corner: 2d6 bet; Dreams shop) ← ♠ seal
40–41 FINANCIAL QUARTER $480 $510       42 FRENZY (chaos card)
43–46 DIAMOND PLAZA $520 $560 $600 $650 (skyscraper-capable)
47 PYRAMID PITCH (UpStone recruiter)    48–51 GOLDEN MILE $700 $750 $800 $900 (skyscraper-capable)
13 JAIL corner (visiting / in-jail; bail $100)  ← ♦ seal on pass
```

- **Seals**: passing a corner grants its seal (♥♦♣♠). Complete a lap passing START holding all 4 → **Promotion** (salary level +1), seals reset. Cards can steal seals or grant instant promotions.
- **Salary** (on passing START): `professionBase + $200×level + floor(propertyValue/12)`; ×1.5 after Freedom. Expenses charge here too (cashflow rulesets).
- **Buildings**: 5 tiers (H1–H4, Hotel) + **Skyscraper** tier 6 on Diamond Plaza & Golden Mile. Even-build within a district. Finite supply toggle (40 houses / 12 hotels / 4 skyscrapers shared).
- **Mortgage**: 50% of price; lift = +10%.

## 4. Systems

### 4.1 District stocks (Fortune Street engine)
- 10 listed stocks (one per district). Par = district tier ($20–$120). 200 shares issued each.
- Trade during your **pre-roll phase** (any amounts) and freely at the Exchange corner. Buy/sell ≥10 shares in one order moves price ±$1 per 10 shares (capped ±$8).
- **Drift** each full round: fundamentals (district development spend, rents collected) push up; events (crash/rally cards, pyramid collapse −15%) shock; small noise.
- **Commission**: 15% of every rent collected in a district accrues to that district's dividend pool, paid pro-rata at round end. Dividends count as **passive income**. Open float (no share cap).
- **Mogul** (largest holder with ≥25 shares): +25% rent in that district, visible crown in UI/3D.

### 4.2 Pyramid scheme — "UpStone Ventures" (push-your-luck)
- **Entry tiers**: Bronze $1,000 / Silver $2,500 / Gold $5,000 / Diamond $10,000 (upgrade by paying the difference). One position per player, non-transferable. Yields 35/45/60/85% of tier cost, scaled by hype. Positions mark at **40%** in net worth.
- **Hype meter 0–100** (starts 20). +2/lap drift, +8 per Recruit, +6 per join/upgrade, −5/lap after 2 idle laps. Visible to all (glowing hologram pyramid in 3D).
- **Yield per lap** (paid at START pass, from the **pot**): `tierYield% × invested × (0.7 + hype/125)` where tierYield = 55/70/90/125%. Yields scale down ×0.85 per member beyond 4 (saturation).
- **Pot** = all entry fees + $8,000 bank seed per cycle; pot tops up +$1,500/lap (new suckers).
- **Recruit** (action, $200 pitch cost): target poorest player → they auto-join Bronze at half price unless they pay you $300 "decline fee". You earn 30% of their entry as commission. Hype +8. The pyramid HQ shows **pot coverage** (laps the pot can still pay) and **collapse risk %**.
- **Cash Out**: exit at the Pyramid Pitch tile, receive 65% of tier investment.
- **Collapse**: forced when pot can't cover yields, or per-lap chance `max(0,(hype−55))%` once hype>55. On collapse: 35% of pot splits among the **two earliest** members (early-bird), rest evaporates, all positions die, **all stocks −15% (real percentages)**, hype resets 0, scheme closes 3 laps then reopens fresh. The drama beat of the game.

### 4.3 Cashflow layer
- **Professions** (same payday/expense ratio ≈ 0.62): Janitor $900/$560, Barista $1,100/$680, Mechanic $1,300/$800, Nurse $1,600/$1,000, Teacher $1,900/$1,180, Engineer $2,200/$1,370, Analyst $2,500/$1,560, Surgeon $2,900/$1,800. (base/expense per lap)
- **Loans**: $500 units, max 20 units; each unit +$50 expense/lap (principal +10% effective). Repay anytime.
- **Freedom**: passive income > expenses → payout **15× passive income**, salary ×1.5, unlock **Dreams** (Yacht $10k / Penthouse $18k / Island $32k — bought at the STOCK EXCHANGE; face value counts to net worth; buying any wins Rat Race rulesets). Deal market: one broker deal per lap at the Exchange, 10% fee.
- **Deal cards** (Fortune square): Small (≤$3,000) / Big (≥$4,000) choice: rental units (+cashflow/lap), stock bundles at par, limited partnerships, land flips.

### 4.4 Mayhem layer (items, statuses, casino, chaos deck)
- **Items** (max 2 held): Remote Dice (set next total 2–12), Roadblock (tile; first passer stops & pays $200), Bomb (downgrade building 1 tier), Teleport (move to any tile, resolve it), Shield (negate next negative effect). Source: cards, casino wins, Pool milestones.
- **Statuses** (timed, 1 lap): Wealth Idol (refuse all payments), Bad Luck (pay double rent), Hot Streak (+$100 per rent you collect), Tax Audit next START (−15% cash).
- **Casino** (corner): stake $100–$1,000, bet High(8–12) 2× / Low(2–6) 2× / Seven 5×. Wins can drop items.
- **Frenzy deck** (chaos): Wealth Equalizer (all cash redistributed evenly), Demolition (downgrade rival's best building), Swap Property, Forced Auction (any unowned tile), Rent Storm (rents ×2 for 1 lap), Market Rally/Crash (±20% all stocks), Teleport All (shuffle positions), Insider Tip (+free 10 shares), Tax Flag (audit at next START), Audit the Leader (leader pays Pool 10% net worth).
- **Speed die** (Insane ruleset): faces 1/2/3/BUS/MR. TYCOON. BUS = draw Frenzy card; MR. TYCOON = after normal move, advance to next unowned tile (buy/auction). Triples (all dice equal) = choose any tile.

### 4.5 Classic core (always on)
Buy-or-auction, rent on landing only, set-completion doubles base rent (×1.5 at ¾? no — full set ×2, as Monopoly), mortgages, jail, trading (properties/cash/stocks/items/GOJF cards), bankruptcy to player (assets transfer at market ×0.9) or bank (tiles auctioned off).

---

## 4b. Board Sizes (post-v1 addition)

Three boards, selected at setup; all systems are board-agnostic:

| Board | Tiles | Rings | Districts/Stocks | Salary × | Target × | Lap-cap × | Start cash × |
|---|---|---|---|---|---|---|---|
| Standard City | 52 | 1 | 10 | 1.0 | 1.0 | 1.0 | 1.0 |
| Grand City | 80 | 2 | 12 | 1.25 | 1.3 | 0.7 | 1.15 |
| Ultimate Metropolis | 132 | 3 | 21 | 1.6 | 1.7 | 0.5 | 1.3 |

- **Rings** are concentric square tracks (Ultimate: outer 52 / middle 44 / inner 36). Each ring has its own corners and pay corner (outer START ×1.2, middle BONUS ×1.5, inner PAY DAY ×2.0 salary).
- **Transit Stations** sit on every ring (4 per ring on multi-ring boards), linked station-n ↔ station-n across adjacent rings. Passing a station on an **even 2-dice total** transfers you mid-move; **landing** on one prompts an optional ride. One-way depth rule: outer/middle dive inward, inner returns outward.
- **Seals** live on one ring's corners (Grand: inner ring; Ultimate: inner ring) — completing seals requires deliberate ring routing.
- The tile-traffic heatmap (AI + UI) models ring topology: per-dice-sum walks with parity transfers at stations.

## 5. Win Conditions (by ruleset)

| Ruleset | Systems | Win |
|---|---|---|
| **Classic Tycoon** | no stocks/professions/pyramid; items off; light chaos | Last tycoon standing (bankruptcy) |
| **Wealth Street** | stocks+Mogul on, no expenses | Reach target net worth **and pass START** |
| **Rat Race** | professions, expenses, loans, deals, stocks | **Freedom** then buy any **Dream** (or target) |
| **Pyramid Pandemonium** | pyramid on, stocks on | Target net worth or last standing |
| **Insane Mayhem** (default) | **everything**, speed die, finite buildings, inflation +2%/lap | Target (default $35k) or last standing |
| **Custom** | all knobs | chosen mode |

Game end also when: only one solvent player remains, or hard lap cap (default 80 laps → highest net worth wins).

---

## 6. AI Design (4 difficulties)

Difficulty knobs: valuation accuracy, cash-reserve policy, bidding aggression, trade greed, chaos awareness, pyramid risk appetite, planning horizon.

- **Valuation**: precomputed **tile traffic heatmap** (Markov chain over dice+cards+jail, recomputed when board changes materially) × rent ladder × monopoly-completion probability × cash-pressure. Expected value drives buy/bid/build/auction decisions.
- **Bidding**: max = value × {0.55, 0.8, 0.95, 1.12} (Newbie→Ruthless) with reserve cash floor {60%, 40%, 25%, 15%} of net worth.
- **Building**: builds when cash > reserve; prioritizes highest traffic ROI districts; Ruthless builds to cause housing shortage when finite.
- **Stocks**: buys own district before upgrading (compound play), buys crashed quality (price < 0.8× fundamental), sells into spikes (>1.35×), Ruthless corners a district to become Mogul.
- **Pyramid**: join threshold by difficulty {never, hype<45, hype<55 & exit>70, hype<65 & exit>80 & recruit poorest}; always cash-out before collapse risk > threshold; rides bubbles for drama at high difficulty.
- **Trades**: generates offers that complete its sets without completing yours; accepts if gain ≥ {1.5, 1.25, 1.12, 1.05}× loss; requests get evaluated the same way.
- **Endgame**: when a human is near target, Ruthless denies (auction wars, rent denial, dump stocks to crash their dividends), everyone sprints cash → START when they can hit target.

---

## 7. Turn Flow (authoritative state machine)

`TURN_START → PRE_ROLL (economy actions, unlimited) → ROLL (dice) → MOVE (tile-by-tile; roadblocks, seals, START salary) → RESOLVE (buy/auction/rent/card/casino/pyramid pitch) → [doubles ⇒ another ROLL] → ROUND_END (when last player moved: dividends, pyramid yields, hype drift, stock drift, statuses tick, inflation) → NEXT TURN`

Engine = **pure JS, platform-agnostic, seeded RNG, event-sourced** (`emit(type, data)` log drives 3D/audio/UI + replays + headless tests). Browser-only layers subscribe. AI actions go through the same public action API as humans — no cheating paths (difficulty only shapes decisions, never dice).

## 8. Tech Architecture

```
index.html            boot, import map (three from ./vendor/)
src/core/    rng.js  events.js  state.js  engine.js  rules.js  economy.js   ← pure, runs in Node too
src/data/    board.js  cards.js  professions.js  rulesets.js  tokens.js
src/ai/      brain.js (per-difficulty policy, uses core API)
src/three/   renderer.js  board3d.js  tokens3d.js  dice3d.js  camera.js  fx.js  textures.js
src/audio/   music.js (bar-sequenced synth engine, 8 themes)  sfx.js
src/ui/      hud.js  panels.js  modals.js  tutorial.js  menu.js  netplay-ui
src/net/     client.js  protocol.js        server/server.mjs (pure-Node RFC6455 relay, rooms 2–8)
server/      LAN play: host-authoritative (host runs engine, relays snapshots; peers send actions)
tests/       sim.mjs (headless N-game soak), balance.mjs
```
Rendering: Three.js (vendored, r160) + UnrealBloom. **No build step** — ES modules + import map, served by any static server (Python/Node). Node ≥18 for LAN server & headless tests. Zero npm dependencies.

## 9. Presentation (AAA-feel targets)

- **3D**: stylized night-city board — beveled tile slabs, district color glows, procedural buildings that *grow* with each upgrade level, owner beacons, center skyline + live **stock ticker Jumbotron** (canvas texture), **pyramid hologram** that scales/glows with hype and detonates on collapse, Pool fountain with coin particles. 8 procedural tokens (Top Hat, Racecar, Dog, Cat, Battleship, Boot, Rocket, Crown). Tumbling dice with real pip faces. Cinematic camera (follow, event closeups, orbit/zoom). Bloom + fog + day/night tint by lap. Confetti on buy, cash particle bursts on rent, red debt flashes, shockwave on collapse.
- **Audio** (WebAudio synth, zero assets, seamless loops): themes — Menu (synth-funk), Board (layered groove, intensity layers keyed to leader gap), Tension (auction/bid war), Stock Rally (arps), Pyramid Hype (hypnotic saw), Casino (bossa), Danger, Victory, Defeat, Tutorial (warm pads). Bar-quantized scheduler at 124 BPM; crossfade; ducking for SFX. ~25 synthesized SFX (dice clack, coin chime, gavel, card whoosh, jail clank, collapse rumble, UI ticks).
- **UI**: dark glass + neon, animated money counters, player HUD (cash / net worth / passive / status), contextual action bar, right-side event log + tile card, rich modals (property deed, auction, trade builder, stock desk, pyramid HQ, casino), minimap w/ heat, full **How to Play codex**.

## 10. Tutorial & Onboarding

1. **First-launch coach**: interactive game vs friendly bot "Banker Bess", 12 scripted beats (roll, buy, rent, build, stocks, deal, auction, trade, pyramid visit, freedom, win) with spotlight highlights and "show me" replay.
2. **Codex**: every system explained with numbers (the DESIGN tables above, player-facing).
3. Contextual first-time tooltips on each panel; difficulty presets labeled for humans.

## 11. Multiplayer (2–8)

- **Local**: hot-seat, any mix of humans/AI (setup screen).
- **LAN/Online**: `node server/server.mjs` → rooms (4-char codes), up to 8 seats; **host-authoritative**: host runs the engine, broadcasts compressed snapshots + fx events; peers submit actions. Rejoin on disconnect (seat reservation 60s). All humans-ready start; bots fill open seats.

## 12. Testing & Quality Gates

- `tests/sim.mjs`: headless engine soak — 3 rulesets × difficulties, assert: no exceptions, no NaN/debt holes, games terminate ≤ lap cap, win-mode coverage, median game 20–60 laps, no player stuck >15 laps.
- Balance report per run (avg game length, bankruptcy rate, stock index curve, pyramid collapse count).
- Browser GUI test: load, screenshot, scripted play-through of a few turns, tutorial check.

## 13. Explicit Non-Goals (v1)

No account/cloud servers (LAN only), no mobile touch layout (keyboard+mouse), no localization beyond English, no 3D asset pipelines (all procedural).

## 14. Gateway Spaces (post-v2 addition — systems live all over the board)

Stock houses, deal brokerages and bank branches are ordinary district properties (rent,
build, mortgage, trade like anywhere else) that ALSO front one game system when you land:

| Gateway | Count (std / grand / ult) | System at the space |
|---|---|---|
| 📈 STOCK HOUSE | 3 / 5 / 5 | district stocks (buy & sell) |
| 🤝 DEAL BROKERAGE | 2 / 2 / 3 | broker market (small & big deals, 1/lap) |
| 🏦 BANK BRANCH | 2 / 2 / 3 | loans (borrow & repay; branch rate becomes your loan interest rate) |

**Rates:** the space's owner trades at a **10% discount, +10% more per building level on
that space, +10% for the full color set** (capped at −60%). Everyone else pays a **+10%
commission on purchases — paid to the space's owner** — plus the normal landing fee.
First landing on an unowned gateway = buy it AND use it in the same visit (buying keeps
the visit open). The STOCK EXCHANGE corner still fronts everything; Dreams stay at the bank.

**Transit (reworked):** passing on an even roll still auto-changes lanes; landing opens a
lane-choice modal (ride to a linked station and end your move there, or stay). Arriving at
the linked station never re-prompts the station.

**Presentation v2:** sourced tile artwork (game-icons.net, CC BY 3.0 — assets/icons/
CREDITS.md) tinted per district; big Baloo names on every face; district band + owner
color band side by side; red MORTGAGED stamp with hazard stripes; per-side face rotation
(names read from outside each edge, like a real table board); Monopoly-Go-style HUD
(avatar player cards, action dock with ROLL/Portfolio/Trade, animated dice widget top-right);
auction v2 (asset card with rent ladder + list price, bidder chips, bid ladder).

## 15. Round 3 refinements

- **Transit is landing-only**: passing a station does nothing; landing opens the lane-choice
  modal (ride to a linked station and end your move there). Single-ring Standard City has no
  transit tiles at all.
- **Tile inspection everywhere**: click any tile on the board (raycast pick) → mini card with
  the painted face as artwork, owner, rent now / base-with-set / max rent, house & hotel
  costs, mortgage & unmortgage values, set progress, gateway rate note, and a Request-trade
  button on rival-owned spaces.
- **Property Portfolio** (dock button): the management board — cash/net worth/rent stats,
  set progress chips, per-property rows (artwork thumb, owner, level, all costs) with
  build / sell / mortgage / unmortgage / trade actions, plus a rivals-&-unowned section.
- **Money feedback**: gains fire a cash-register ka-ching + coin cascade fountain + green
  springy floater; losses fire a drawer-thud + bill tear + sinking red floater (screen shake
  on big hits); the sidebar cash counter pulses green/red and spawns floating +/− delta tags.
- **Real foliage**: Quaternius "Ultimate Stylized Nature" GLB models (CC0, assets/models/)
  — pines, maples, birches, normal trees, palms, bushes, rocks, grass and flowers —
  instanced (~1,000 plants) on 8 grass/sand islets around the island plus shore palms and
  lone water rocks.
- **Sidebar v3**: avatar + name + sub-stats row, big unobstructed cash column with the
  YOUR MOVE pill under it (never overlapping money), gold turn ring.

## 16. Round 4: environment & home screen

- **Foliage upright**: model meshes now bake in world space — node-local baking was
  discarding authored rotations (trees lying on their sides). Shore plants stand on the
  beach surface; water rocks are half-submerged.
- **Monopoly-Go-style environment**: wide sandy beach around a bright toy-grass felt,
  tropical turquoise water with sun glitter, bright blue sky with painted cumulus clouds,
  foam past the beach, ~1,100 instanced plants: a palm-lined shore, bush/flower/grass beach
  border, and palm-and-tree islets scattered across the sea.
- **Silent home screen**: the menu board is a static diorama again — pieces sprinkled, no
  engine turns, no AI think timer, no dice, no board SFX. Menu theme plays after the first
  user gesture.
- **Music fixed**: the theme scheduler was storing the theme NAME string where the resolved
  theme object belongs, so chordAt crashed every bar and no music ever played. All three
  assignment sites now resolve THEMES[name]; menu/board themes verified playing (bar counter
  advances, auto-switch to 'board' on match start).

## 17. Round 5: tropical soundtrack, grounded world, wood UI

- **Soundtrack v3 — "island carnival"**: major-key tropical themes with a proper
  percussion section — congas (pitched thumps), shakers, claves (3-2 salsa pattern) and a
  steel-pan lead/arpeggio voice (inharmonic partials). Grooves: `island` (laid-back
  one-drop), `salsa` (tresillo bass + clave), `carnival` (soca four-on-the-floor with conga
  doubles). Menu = island stroll, board = carnival, casino = salsa, victory = carnival.
  End-of-phrase conga fills every 4th bar.
- **Grounded world**: the ocean shader now shades a bright lagoon (distance-based shallows
  hugging the island, deepening to open sea); every islet rises from an underwater sandy
  skirt with extra low sandbars bridging shore to sea — nothing floats in liminal space.
- **UI v3 "The Boardroom"** — full redesign: carved wood-grain panels (layered CSS grain),
  aged brass trim, cream property-paper cards (deeds, auction asset cards, action-feed
  notes) with ink text, felt-green highlights, serif display headers. Wooden plaque
  buttons, wood dice tray, ledger-style portfolio. All screens and modals restyled.

## 18. Round 6: real soundtrack + refined buttons

- **Recorded soundtrack**: five royalty-free Kevin MacLeod tracks (CC BY 4.0,
  incompetech.com — see assets/music/CREDITS.md) replace the synth for the main themes:
  menu "Moonlight Beach", board "Island Meet and Greet", casino "No Frills Salsa",
  victory "Beachfront Celebration", defeat "BossaBossa". HTMLAudio crossfade pair,
  slider-aware volume, mute handling; the tropical synth engine remains as fallback
  and still scores tension/pyramid/danger/rally.
- **Buttons v2**: flatter lacquered-wood plaques — no chunky bottom edge — brass
  hairline borders, soft lift on hover, tighter radii and padding across all screens.

## 19. Round 7: clean board margin, sea-theme buttons, ground textures

- **No foliage on the board**: the island's sand margin is fully clear of plants. Offshore
  vegetation keeps its widest footprint clear of the island edge; tall trees (palms and
  forests) live only on islets ≥ ~34 units out, and near islets are low meadows
  (bushes/grass/flowers/rocks) — measured by projecting every plant into the gameplay
  camera so nothing tall lands on the tiles from gameplay angles. Follow camera raised
  (27 → 34) to steepen the view.
- **Ground textures**: rippled sand on the island beach and islet skirts, mottled
  toy-grass felt with mow stripes, weathered stone on the inner-ring platforms. Islet
  tops are grass-dominant.
- **Buttons re-colored for the sea theme**: deep lagoon teal (default), coral (primary),
  warm sand (money actions) — no more brown/yellow.
- **Action dock decluttered**: the systems explainer text is gone.

## 20. Round 8: groups of 3, spread pieces, tutorials, clean margins

- **Board v4 — Standard City**: 12 color groups of exactly **3 properties**, each group
  confined to ONE side of the board (never spanning a corner). Board templates pin
  properties to explicit districts (`P:neon`, `GS:harbor`, ...). Grand/Ultimate keep
  groups of 4. Gateway mix on standard: 3 stock houses, 3 deal brokerages, 2 bank branches.
- **Pieces never overlap**: occupancy-aware slots — 1 piece centred, 2 split, 3+ in a ring.
- **Movement cinematic**: on roll the camera drops low and chases the piece hop-by-hop,
  then eases back to the overview ~1.5s after landing.
- **First-meeting tutorials**: the first landing on each system (buy/stock house/deal
  brokerage/bank branch/exchange/pyramid/casino) and the first auction/debt call pop a
  short how-it-works card before the panel. Seen-set persists in localStorage.
- **Click-away closes every popup**; a decision left pending shows a coral "resume"
  button in the dock that reopens it.
- **Right mouse = grab-and-release panning** (manual, no inertia, no stuck hold).
- **Perf & looks**: foliage count cut ~45%, foliage shadows off, horizon fog matched to
  the sky hides the world edge, islet dirt skirts reach below the waterline (nothing
  floats), square-aware clearance ends the mound clipping through board corners,
  gameplay camera raised.
- **Readability**: default view a step closer; tile names/prices bigger with a light halo;
  special spaces carry a gold ★ rosette badge; tile cards gained an illustrated landmark
  banner; Diamond Plaza wears a proper cut-diamond mark.

## 21. Round 9: market reports + share settlement

- **End-of-cycle market report**: every full round of turns the market re-prices at
  random (noise widened to ±2 on top of the fundamentals model) and a popup announces
  every district's move (old → new price, ▲/▼). Informational; click-away closes.
- **Share settlement**: shares bought during a cycle (bought, won, gifted, or from deal
  bundles — bankruptcy transfers too) are **unsettled** until the buyer passes Go.
  Unsettled shares can't be sold and earn **no dividends**. The stock panels show the
  fresh count ("N new") and gate the Sell button. AI brains respect the ledger.

## 22. Round 10: piece placement & scrollable markets

- **Pieces stand on the board**: every token is lifted onto the tile card surface
  (slab + face height), so nothing sinks into the board. Each faces outward from the
  board centre — models were authored facing +X, now rotated per-tile to read correctly
  from the camera side. Also fixed a latent crash: the rocket token's build list
  referenced a stray `window` global.
- **Markets scroll**: the Exchange stock grid, gateway panels, portfolio lists and
  report lists all scroll vertically — all 12 districts reachable on every board size.

## 23. Round 11: fit, variation, fog, readability, camera authority

- **Tile cards fit**: mini modals cap at 92vh and scroll internally; the deed art and
  landmark banner are height-capped. No more cut-off content.
- **Group sizes vary on Standard**: 2s, 3s and 4s in one layout (docklands/maple/financial
  are 4s, neon/golden are 2s) — every group still confined to one side, never spanning a
  corner. Bigger boards stay at 4.
- **Right-drag pan rebuilt**: axes derived from the live camera orientation, keeps the
  15s manual override alive while dragging — verified via synthetic pointer events
  (camera + target move together and stay exactly where released).
- **Fog actually fogs now**: the ocean shader ignored scene.fog (ShaderMaterial) — it now
  fades manually to the horizon color (55→150), fog tightened so distance reads.
- **Board text**: bloom dialed way back (0.07/0.97), tile-card emissive removed,
  white halo strokes around names and prices, deeper district band, 16× anisotropy,
  uniform face orientation (every name upright on screen — the table-style per-side
  rotation left three sides illegible).
- **Camera authority**: any roll re-takes the camera from manual drags, so movement
  cinematics always play; default overview a step closer again.

## 24. Round 12: no-mouse navigation

Right-click can trigger browser gestures outside the page, so navigation no longer
depends on it. A **navigation pad** (bottom-right, wood/teal styled) offers pan arrows,
zoom in/out and a reset-home button — hold to repeat. **Keyboard navigation** mirrors it:
WASD / arrow keys pan, +/− zoom, Home resets view. The global contextmenu is suppressed
so the right button never leaves the page; right-drag panning still works when available.

## 25. Round 13: market volatility, trade value meter, camera polish

- **Wider stock swings**: base noise widened to ±3, plus a 25%×chaos chance of a
  spike/crash worth ±4–8 ticks. All shifts still fire after the last player's turn
  (roundEnd), never mid-cycle.
- **Trade broker value meter**: the rebuilt trade panel shows a live Give ⇄ Get value
  comparison with a net-worth bar, plus color-group impact lines ("complements Midtown
  MONOPOLY for you", "Midtown 3/4 — one away") so players see at a glance what a trade
  is worth beyond raw dollar values.
- **AI buys instead of auctioning**: purchase acceptance raised from 1.25× to 1.6×
  perceived value, auction bids raised to max(bidFactor+0.45, 0.7) × tile value,
  mistake rate on auctions reduced. Reserve cash lowered to 25% so bots actually spend.
- **End Turn always available**: the dock shows an End Turn button whenever it's the
  human's turn (not just before rolling) — clicking it during a non-roll prompt
  answers with the safe default to advance past locks.
- **Pieces face travel direction**: tokens rotate toward their hop target mid-move,
  then settle facing outward at the destination tile.
- **Bot badge no longer clipped**: player card widened to 286px, name shrinks to
  reserve room for the HUMAN/STANDARD badge.

## 26. Round 14: turn tracking, pool/grass/sand textures, AI patience

- **Turn indicator + dice widget sync**: turnStart now calls syncTurn() so the
  gold-border highlight and YOUR MOVE pill track the active player instantly.
  Dice widget shows current dice on render, clearing stale animation states.
- **Game pauses for humans**: human prompts clear any lingering AI think timer,
  so the engine truly waits for the human's decision.
- **Realistic textures**: the board felt uses layered grass (organic tonal patches,
  3800 directional blade streaks, mow stripes, micro-noise, vignette); the beach
  uses multi-grain sand with wave ripples, shell fragments and pebbles; the pool
  gets a procedural caustic web texture. All at 512-1024px with 16× anisotropy.
