// Rulesets = the "modified rulesets" system. Every flag is a knob; presets are curated knobs.
export const DEFAULT_FLAGS = {
  winMode: 'target',        // 'target' | 'lastStanding' | 'freedom'
  targetWorth: 32000,
  lapCap: 60,
  // subsystems
  stocks: true,             // district stock market + dividends
  mogulBonus: true,         // top shareholder: +25% district rent
  pyramid: true,            // UpStone Ventures MLM w/ hype & collapse
  cashflow: true,           // professions, expenses, loans, passive income, Freedom
  professions: true,        // asymmetric starts (requires cashflow)
  deals: true,              // Fortune-square deal cards (small/big)
  doodads: true,            // forced impulse buys
  items: true,              // item cards (remote dice, roadblock, bomb...)
  statuses: true,           // timed buff/debuff statuses
  casino: true,
  spinWheel: true,       // Lucky Spin: free prize wheel every completed lap
  chaos: 1.0,               // 0..2 intensity multiplier on Frenzy effects
  // classic knobs
  auctions: true,
  evenBuild: true,
  finiteBuildings: false,   // shared 40 houses / 12 hotels / 4 skyscrapers
  speedDie: false,          // 1/2/3/BUS/BUS/MR.TYCOON (activates after first lap)
  doublesJail: true,        // 3 doubles -> jail
  freeSeals: true,          // corner seals -> promotions
  inflation: false,         // +2%/lap price inflation
  startCash: 2500,
  salary: 500,              // base salary if professions off
};

export const RULESETS = [
  {
    id: 'classic', name: 'Classic Tycoon', icon: '🎩', tag: 'Pure negotiation. No markets, no MLM.',
    desc: 'Faithful Monopoly-style play on the 52-tile board: buy-or-auction, sets, houses, jail, trades. Last tycoon standing wins.',
    flags: { ...DEFAULT_FLAGS, winMode: 'lastStanding', lapCap: 45, stocks: false, pyramid: false, cashflow: false, professions: false, deals: false, doodads: false, items: false, statuses: true, casino: true, chaos: 0.6, speedDie: false, inflation: false },
  },
  {
    id: 'wealth', name: 'Wealth Street', icon: '📈', tag: 'Fortune Street flavor: compound everything.',
    desc: 'The district stock market is the game. Develop your districts to pump their stock, become Mogul, hit the target net worth and sprint home past START.',
    flags: { ...DEFAULT_FLAGS, winMode: 'target', targetWorth: 10000, salary: 650, stocks: true, pyramid: false, cashflow: false, professions: false, deals: true, doodads: false, items: false, casino: true, chaos: 0.8 },
  },
  {
    id: 'ratrace', name: 'Rat Race', icon: '🐀', tag: 'Cashflow: escape on passive income.',
    desc: 'Professions, expenses and loans are live. Build passive income past your expenses to break Free, then buy a Dream to win. Deals and doodads included.',
    flags: { ...DEFAULT_FLAGS, winMode: 'freedom', targetWorth: 40000, stocks: true, pyramid: false, cashflow: true, professions: true, deals: true, doodads: true, items: false, casino: false, chaos: 0.7 },
  },
  {
    id: 'pyramid', name: 'Pyramid Pandemonium', icon: '🔺', tag: 'Ride the MLM. Exit before the pop.',
    desc: 'UpStone Ventures is open: join, recruit, rake yields from the pot — and watch the hype meter. Collapse pays the early birds and crashes every stock.',
    flags: { ...DEFAULT_FLAGS, winMode: 'target', targetWorth: 20000, stocks: true, pyramid: true, cashflow: true, professions: true, deals: true, doodads: true, items: true, casino: true, chaos: 1.0 },
  },
  {
    id: 'insane', name: 'INSANE MAYHEM', icon: '🔥', tag: 'Everything. Speed die. Finite buildings. Inflation.',
    desc: 'All systems at once, speed die after lap one, shared building shortage, creeping inflation, high chaos. The definitive TYCOON MAYHEM experience.',
    flags: { ...DEFAULT_FLAGS, winMode: 'target', targetWorth: 23000, stocks: true, pyramid: true, cashflow: true, professions: true, deals: true, doodads: true, items: true, statuses: true, casino: true, chaos: 1.3, speedDie: true, finiteBuildings: true, inflation: true },
  },
  {
    id: 'custom', name: 'Custom Rules', icon: '🎛️', tag: 'Every knob, your game.',
    desc: 'Tune every flag: win mode, target, subsystems, chaos intensity, finite buildings, speed die, inflation and more.',
    flags: { ...DEFAULT_FLAGS },
  },
];
