// Card decks. Effects are data descriptors the engine interprets (see core/engine.js applyCard).
// chaosIntensity (0..2) scales the mean Frenzy outcomes.

export const FORTUNE_CARDS = [
  { id: 'f_bank', text: 'Bank error in your favor. Collect $400.', fx: { kind: 'gain', amt: 400 } },
  { id: 'f_fees', text: 'ATM fees stack up. Pay $150.', fx: { kind: 'pay', amt: 150, to: 'pool' } },
  { id: 'f_birthday', text: 'Its your birthday! Collect $100 from every player.', fx: { kind: 'gainEach', amt: 100 } },
  { id: 'f_chair', text: 'Elected chairman of the board. Pay each player $80.', fx: { kind: 'payEach', amt: 80 } },
  { id: 'f_taxref', text: 'Tax refund! Collect 20% of the central Pool.', fx: { kind: 'poolCut', pct: 0.2 } },
  { id: 'f_go', text: 'Advance to START. Collect salary as you pass.', fx: { kind: 'goto', tile: 0, pay: 1 } },
  { id: 'f_jail', text: 'Caught jaywalking in Midtown. Go directly to Jail.', fx: { kind: 'jail' } },
  { id: 'f_jailfree', text: 'GET OUT OF JAIL FREE. Keep this card.', fx: { kind: 'jailFree' } },
  { id: 'f_nearest_gold', text: 'Take the limo to the nearest Golden Mile property.', fx: { kind: 'gotoDistrict', district: 'golden' } },
  { id: 'f_back3', text: 'You missed your exit. Go back 3 spaces.', fx: { kind: 'gotoRel', delta: -3 } },
  { id: 'f_rally', text: 'Bulls stampede: every stock +10%.', fx: { kind: 'stockAll', pct: 10 } },
  { id: 'f_dip', text: 'Quiet correction: every stock −10%.', fx: { kind: 'stockAll', pct: -10 } },
  { id: 'f_shares', text: 'ESPP vest: gain 10 shares of a random district at market price.', fx: { kind: 'shares', n: 10 } },
  { id: 'f_promote', text: 'Headhunted! Instant Promotion (level +1).', fx: { kind: 'promote' } },
  { id: 'f_pickpocket', text: 'A seagull steals your wallet. Pay $250 or lose a seal.', fx: { kind: 'payOrSeal', amt: 250 } },
  { id: 'f_repairs', text: 'City inspection: pay $60 per house level, $150 per hotel/skyscraper.', fx: { kind: 'repairs', house: 60, hotel: 150 } },
  { id: 'f_dividend', text: 'Legacy portfolio matures. Collect $350.', fx: { kind: 'gain', amt: 350 } },
  { id: 'f_doodad', text: 'Weekend in the Strip. Pay $220.', fx: { kind: 'pay', amt: 220, to: 'pool' } },
  { id: 'f_deal', text: 'An investment broker catches you at the light. Small Deal or Big Deal?', fx: { kind: 'deal' } },
  { id: 'f_item', text: 'A mysterious suitcase: gain a random item.', fx: { kind: 'item' } },
  { id: 'f_wealth_idol', text: 'Golden statue blessing: refuse all payments for 1 lap.', fx: { kind: 'status', status: 'wealthIdol', laps: 1 } },
  { id: 'f_donate', text: 'Charity gala: pay 10% of your cash to the Pool. The city thanks you.', fx: { kind: 'donate', pct: 0.1 } },
  { id: 'f_hot', text: 'Hot streak! Collect +$100 extra on every rent you collect for 1 lap.', fx: { kind: 'status', status: 'hotStreak', laps: 1 } },
];

export const FRENZY_CARDS = [
  { id: 'z_equal', text: 'WEALTH EQUALIZER: all players cash is redistributed evenly.', fx: { kind: 'equalizer' } },
  { id: 'z_demo', text: 'WRECKING BALL: downgrade the best building of the current leader.', fx: { kind: 'demolition' } },
  { id: 'z_swap', text: 'PROPERTY SWAP: trade your cheapest property for anothers priciest (their pick of equal price).', fx: { kind: 'swap' } },
  { id: 'z_auction', text: 'COURT ORDER: an unowned property goes to auction immediately.', fx: { kind: 'forcedAuction' } },
  { id: 'z_storm', text: 'RENT STORM: all rents ×2 for one full lap.', fx: { kind: 'rentStorm' } },
  { id: 'z_rally', text: 'MARKET MELT-UP: every stock +20%.', fx: { kind: 'stockAll', pct: 20 } },
  { id: 'z_crash', text: 'FLASH CRASH: every stock −20%.', fx: { kind: 'stockAll', pct: -20 } },
  { id: 'z_tele', text: 'CITY-WIDE BLACKOUT: every player teleports to a random tile.', fx: { kind: 'teleportAll' } },
  { id: 'z_insider', text: 'INSIDER TIP: gain 10 shares of the most Undervalued district. (Nobody saw anything.)', fx: { kind: 'insider' } },
  { id: 'z_audit', text: 'AUDIT THE LEADER: the net-worth leader pays 10% of their net worth to the Pool.', fx: { kind: 'auditLeader' } },
  { id: 'z_flag', text: 'TAX FLAG: you are audited at next START — pay 15% of your cash.', fx: { kind: 'status', status: 'audit', laps: 1 } },
  { id: 'z_hype', text: 'UpStone goes VIRAL: pyramid hype +15, pot +$2,000.', fx: { kind: 'hype', amt: 15, pot: 2000 } },
  { id: 'z_gift', text: 'BANK BAILOUT: the poorest player receives $1,200.', fx: { kind: 'bailout' } },
  { id: 'z_lotto', text: 'CITY LOTTERY: roll 2 dice — 7+ pays you $50× the roll from the Pool.', fx: { kind: 'lottery' } },
  { id: 'z_skip', text: 'JURY DUTY: choose any player to lose their next turn.', fx: { kind: 'skipChoice' } },
  { id: 'z_tornado', text: 'TORNADO: every player except you loses one building level (if any).', fx: { kind: 'tornado' } },
  { id: 'z_rent', text: 'GOOD WILL: collect $30 rent commission on every property you own.', fx: { kind: 'rentCommission', per: 30 } },
  { id: 'z_item', text: 'LOST & FOUND: gain a random item.', fx: { kind: 'item' } },
  { id: 'z_move', text: 'FREE TRANSIT: immediately move again by rolling both dice.', fx: { kind: 'rollAgain' } },
];

// Deal cards (Fortune square, Small/Big choice). cf = passive income per lap.
export const SMALL_DEALS = [
  { id: 'd_room', name: 'Rental Room', cost: 500, cf: 70, val: 600, text: 'Rent out the garage.' },
  { id: 'd_hustle', name: 'Side Hustle', cost: 750, cf: 90, val: 900, text: 'Weekend flea-market empire.' },
  { id: 'd_truck', name: 'Food Truck', cost: 1150, cf: 140, val: 1400, text: 'Tacos are an asset class.' },
  { id: 'd_duplex', name: 'Duplex', cost: 1550, cf: 180, val: 1900, text: 'Two doors, double drama.' },
  { id: 'd_stocks', name: 'Stock Bundle', cost: 1000, shares: 12, val: 1000, text: '12 shares of a random district, at par.' },
  { id: 'd_flip', name: 'Land Flip', cost: 800, flip: [1600, 500], val: 800, text: 'Buy $800 — resolves next round: $1,600 or $500.' },
  { id: 'd_atm', name: 'Vending Route', cost: 950, cf: 125, val: 1200, text: 'Machines that sell sugar back to its victims.' },
];
export const BIG_DEALS = [
  { id: 'D_carwash', name: 'Car Wash', cost: 3800, cf: 460, val: 4500, text: 'Subscription car washes. Genius. Evil, but genius.' },
  { id: 'D_franchise', name: 'Franchise', cost: 4600, cf: 580, val: 5500, text: 'Flywheel included.' },
  { id: 'D_apartments', name: 'Apartment Block', cost: 5400, cf: 670, val: 6500, text: 'Forty doors, four complaints.' },
  { id: 'D_office', name: 'Office Floor', cost: 7000, cf: 860, val: 8500, text: 'Open plan. Open wallet.' },
  { id: 'D_index', name: 'Index Bundle', cost: 5000, shares: 40, val: 5000, text: '40 shares of a random district, at par.' },
  { id: 'D_plaza', name: 'Shopping Plaza', cost: 9500, cf: 1250, val: 12000, text: 'Anchor tenant: a gym. Somehow.' },
];

export const DREAMS = [
  { id: 'yacht', name: 'Superyacht', cost: 10000, icon: '🛥️', line: 'Feed the soup to the sea.' },
  { id: 'penthouse', name: 'Sky Penthouse', cost: 18000, icon: '🌇', line: 'Above the smog, above it all.' },
  { id: 'island', name: 'Private Island', cost: 32000, icon: '🏝️', line: 'Off the grid. On the map.' },
];

export const ITEMS = [
  { id: 'remoteDice', name: 'Remote Dice', icon: '🎲', text: 'Set your next roll total (2–12).' },
  { id: 'roadblock', name: 'Roadblock', icon: '🚧', text: 'Place on any tile. First passer stops and pays you $200.' },
  { id: 'bomb', name: 'Demolition Note', icon: '💥', text: 'Downgrade a building on any tile by one level.' },
  { id: 'teleport', name: 'Subway Token', icon: '🚇', text: 'Travel to any tile and resolve it.' },
  { id: 'shield', name: 'Insurance Shield', icon: '🛡️', text: 'Negate the next negative effect on you.' },
];

export const PYRAMID_TIERS = [
  { id: 'bronze',  name: 'Bronze Starter Kit', cost: 1000,  yieldPct: 0.35 },
  { id: 'silver',  name: 'Silver Hustler Pack', cost: 2500,  yieldPct: 0.45 },
  { id: 'gold',    name: 'Gold Mindset Elite', cost: 5000,  yieldPct: 0.60 },
  { id: 'diamond', name: 'Diamond Topliner',   cost: 10000, yieldPct: 0.85 },
];

// Lucky Spin — the free prize wheel you get every time you complete a lap.
// Weights are relative; everything it can grant comes from another system on purpose:
// cash, district stocks, items, jail, seals, the Pool, statuses.
export const WHEEL_SEGMENTS = [
  { id: 'cash500',  label: '+$500',        short: '$500',     weight: 15, color: '#26de81' },
  { id: 'cash150',  label: '+$150',        short: '$150',     weight: 18, color: '#3fb8e8' },
  { id: 'jackpot',  label: 'JACKPOT +$1,500', short: '$1,500', weight: 5,  color: '#ffd32a' },
  { id: 'shares',   label: '+5 shares',    short: '5 SHR',    weight: 10, color: '#7ee3ff' },
  { id: 'gojf',     label: 'Jail-free card', short: '🎫',     weight: 7,  color: '#b48cff' },
  { id: 'item',     label: 'Mystery item', short: '🎁',       weight: 7,  color: '#ff8f3f' },
  { id: 'poolcut',  label: '25% of Pool',  short: 'POOL',     weight: 5,  color: '#59d46b' },
  { id: 'dblsal',   label: '2× salary',    short: '2× SAL',   weight: 6,  color: '#f472b6' },
  { id: 'seal',     label: '+1 seal',      short: '◈',        weight: 4,  color: '#5ec8ff' },
  { id: 'pay200',   label: '−$200',        short: '−$200',    weight: 14, color: '#ff5e5e' },
  { id: 'jail',     label: 'GO TO JAIL',   short: '🚨',       weight: 5,  color: '#e04545' },
];

export function makeDeck(rng, cards) {
  return {
    pile: rng.shuffle(cards),
    draw() {
      if (this.pile.length === 0) this.pile = rng.shuffle(cards);
      return this.pile.pop();
    },
  };
}
