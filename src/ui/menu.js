// Menus: main, setup, codex, settings, LAN lobby.
import { el, $ } from './hud.js?v=8';
import { RULESETS, DEFAULT_FLAGS } from '../data/rulesets.js?v=8';
import { PROFESSIONS } from '../data/professions.js?v=8';
import { DISTRICTS, TILES, BOARDS } from '../data/board.js?v=8';
import { closeModal, modal } from './modals.js?v=8';

const TOKENS = [
  { id: 'hat', icon: '🎩' }, { id: 'car', icon: '🏎️' }, { id: 'dog', icon: '🐕' }, { id: 'cat', icon: '🐈' },
  { id: 'ship', icon: '🚢' }, { id: 'boot', icon: '🥾' }, { id: 'rocket', icon: '🚀' }, { id: 'crown', icon: '👑' },
];
const NAMES = ['Vex', 'Luna', 'Moss', 'Ivy', 'Rex', 'Nova', 'Ash', 'Kiki'];
const esc = (t) => String(t).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOT_NAMES = ['Banker Bess', 'Dice Rey', 'Mogul Max', 'Count Vex', 'Lady Aurea', 'Baron Otto', 'Duchess Ito', 'Sir Flips'];

export function showMainMenu(driver) {
  closeModal();
  let menu = $('#screen-menu');
  if (!menu) {
    menu = el('div', 'screen');
    menu.id = 'screen-menu';
    document.getElementById('app').appendChild(menu);
  }
  menu.classList.remove('hidden');
  const save = driver.saveSlotInfo ? driver.saveSlotInfo() : null;
  const continueBtn = save ? `<button class="btn gold" id="mn-continue">▸ Continue · lap ${save.lap}</button>` : '';
  menu.innerHTML = `
    <div class="menu-top">
      <h1 class="logo">TYCOON MAYHEM</h1>
    </div>
    <div class="menu-buttons">
      ${continueBtn}
      <button class="btn primary" id="mn-play">New Game</button>
      <button class="btn" id="mn-net">Multiplayer</button>
      <button class="btn" id="mn-codex">How to Play</button>
      <button class="btn" id="mn-settings">Settings</button>
      <button class="btn" id="mn-tutorial">Tutorial</button>
    </div>
  `;
  if (save) $('#mn-continue').onclick = () => { driver.click(); driver.loadSavedGame(); };
  $('#mn-play').onclick = () => { driver.click(); showSetup(driver); };
  $('#mn-net').onclick = () => { driver.click(); showNetLobby(driver); };
  $('#mn-codex').onclick = () => { driver.click(); showCodex(driver); };
  $('#mn-settings').onclick = () => { driver.click(); showSettings(driver); };
  $('#mn-tutorial').onclick = () => { driver.click(); driver.startTutorial(); };
}

export function hideMainMenu() { const m = $('#screen-menu'); if (m) m.classList.add('hidden'); }

export function showSetup(driver, presetId = 'insane') {
  const cfg = {
    rulesetId: presetId,
    boardId: 'standard',
    flags: { ...RULESETS.find(r => r.id === presetId).flags },
    players: [],
  };
  for (let i = 0; i < 4; i++) {
    cfg.players.push({
      name: i === 0 ? 'You' : BOT_NAMES[i - 1],
      token: TOKENS[i].id,
      isAI: i !== 0,
      difficulty: 'standard',
      professionId: PROFESSIONS[i].id,
    });
  }
  let menu = $('#screen-setup');
  if (!menu) { menu = el('div', 'screen'); menu.id = 'screen-setup'; document.getElementById('app').appendChild(menu); }
  const render = () => {
    menu.classList.remove('hidden');
    const rs = RULESETS.find(r => r.id === cfg.rulesetId);
    menu.innerHTML = `
    <div class="setup-wrap glass">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2 style="font-size:24px">Game Setup</h2>
        <button class="btn small ghost" id="su-back">← Back</button>
      </div>
      <div class="setup-grid">
        <div>
          <div class="section-title">Players (2–8)</div>
          <div id="su-players"></div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="btn small" id="su-add" ${cfg.players.length >= 8 ? 'disabled' : ''}>+ Add player</button>
            <button class="btn small" id="su-fill">Fill with bots</button>
          </div>
        </div>
        <div>
          <div class="section-title">Board</div>
          <div id="su-boards"></div>
          <div class="section-title" style="margin-top:14px">Ruleset</div>
          <div id="su-rulesets"></div>
          ${cfg.rulesetId === 'custom' ? `
            <div class="section-title">Custom rules</div>
            <div class="flag-grid" id="su-flags"></div>
            <div class="range-row">🎯 Target net worth: <b id="su-target-v" style="color:var(--gold)">$${cfg.flags.targetWorth.toLocaleString()}</b>
              <input type="range" id="su-target" min="5000" max="100000" step="1000" value="${cfg.flags.targetWorth}"></div>
            <div class="range-row">⚡ Chaos intensity: <b id="su-chaos-v" style="color:var(--gold)">${cfg.flags.chaos.toFixed(1)}×</b>
              <input type="range" id="su-chaos" min="0" max="2" step="0.1" value="${cfg.flags.chaos}"></div>
            <div class="range-row">🗓️ Lap cap: <b id="su-lapcap-v" style="color:var(--gold)">${cfg.flags.lapCap}</b>
              <input type="range" id="su-lapcap" min="20" max="120" step="5" value="${cfg.flags.lapCap}"></div>
          ` : ''}
          <div class="row" style="justify-content:flex-end;margin-top:18px">
            <button class="btn primary big" id="su-start">START 🎲</button>
          </div>
        </div>
      </div>
    </div>`;
    // players
    const pbox = menu.querySelector('#su-players');
    cfg.players.forEach((p, i) => {
      const row = el('div', 'player-row');
      const tok = TOKENS.find(t => t.id === p.token) || TOKENS[i % TOKENS.length];
      row.innerHTML = `
        <button class="token-dot" data-token="${i}" title="Click to change piece" style="background:rgba(255,255,255,0.05);cursor:pointer;border:1px solid var(--line);font-size:17px">${tok.icon}</button>
        <input value="${p.name}" data-k="name" data-i="${i}" maxlength="14">
        <select data-k="kind" data-i="${i}">
          <option value="human" ${!p.isAI ? 'selected' : ''}>🧑 Human</option>
          <option value="ai" ${p.isAI ? 'selected' : ''}>🤖 Bot</option>
        </select>
        <select data-k="diff" data-i="${i}" ${p.isAI ? '' : 'disabled'}>
          ${['newbie', 'standard', 'sharp', 'ruthless'].map(d => `<option value="${d}" ${p.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <select data-k="prof" data-i="${i}">
          ${PROFESSIONS.map(pf => `<option value="${pf.id}" ${p.professionId === pf.id ? 'selected' : ''}>${pf.icon} ${pf.name}</option>`).join('')}
        </select>
        <button class="btn small ghost" data-del="${i}" ${cfg.players.length <= 2 ? 'disabled' : ''}>✕</button>
      `;
      pbox.append(row);
    });
    pbox.querySelectorAll('[data-token]').forEach(btn => btn.onclick = () => {
      const i = parseInt(btn.dataset.token);
      const used = new Set(cfg.players.filter((_, j) => j !== i).map(x => x.token));
      const grid = document.createElement('div');
      grid.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(4,6,12,0.6);display:flex;align-items:center;justify-content:center;';
      const panel = document.createElement('div');
      panel.className = 'glass';
      panel.style.cssText = 'padding:20px;border-radius:16px;';
      panel.innerHTML = `<div style="font-weight:800;margin-bottom:12px">Choose a piece — ${esc(cfg.players[i].name)}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px" id="tok-grid"></div>
        <div style="text-align:right;margin-top:12px"><button class="btn small ghost" id="tok-x">Cancel</button></div>`;
      grid.append(panel);
      document.body.append(grid);
      const tgrid = panel.querySelector('#tok-grid');
      for (const t of TOKENS) {
        const taken = used.has(t.id);
        const b = document.createElement('button');
        b.className = 'btn';
        b.style.cssText = `font-size:26px;padding:12px 0;${taken ? 'opacity:0.25;cursor:not-allowed' : ''}`;
        b.textContent = t.icon;
        b.title = taken ? 'Taken' : t.id;
        if (!taken) b.onclick = () => { cfg.players[i].token = t.id; grid.remove(); render(); };
        tgrid.append(b);
      }
      panel.querySelector('#tok-x').onclick = () => grid.remove();
    });
    pbox.querySelectorAll('input,select').forEach(inp => {
      inp.onchange = () => {
        const i = parseInt(inp.dataset.i), k = inp.dataset.k;
        if (k === 'name') cfg.players[i].name = inp.value.slice(0, 14) || `P${i + 1}`;
        if (k === 'kind') cfg.players[i].isAI = inp.value === 'ai';
        if (k === 'diff') cfg.players[i].difficulty = inp.value;
        if (k === 'prof') cfg.players[i].professionId = inp.value;
      };
    });
    pbox.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cfg.players.splice(parseInt(b.dataset.del), 1); render(); });
    menu.querySelector('#su-add').onclick = () => {
      const i = cfg.players.length;
      cfg.players.push({ name: BOT_NAMES[i - 1] || `Bot ${i}`, token: TOKENS[i].id, isAI: true, difficulty: 'standard', professionId: PROFESSIONS[i % 8].id });
      render();
    };
    menu.querySelector('#su-fill').onclick = () => {
      while (cfg.players.length < 4) {
        const i = cfg.players.length;
        cfg.players.push({ name: BOT_NAMES[i - 1] || `Bot ${i}`, token: TOKENS[i].id, isAI: true, difficulty: 'standard', professionId: PROFESSIONS[i % 8].id });
      }
      render();
    };
    // board size
    const bbox = menu.querySelector('#su-boards');
    for (const bId of ['standard', 'grand', 'ultimate']) {
      const b = BOARDS[bId];
      const card = el('div', 'ruleset-card' + (cfg.boardId === bId ? ' selected' : ''));
      card.style.padding = '9px 12px';
      card.innerHTML = `<div class="ic">${bId === 'standard' ? '⬜' : bId === 'grand' ? '⬜⬜' : '⬜⬜⬜'}</div><div><div class="nm">${b.name} <span class="tg">${b.tag}</span></div><div class="tg">${b.desc}</div></div>`;
      card.onclick = () => { cfg.boardId = bId; render(); };
      bbox.append(card);
    }
    // rulesets
    const rbox = menu.querySelector('#su-rulesets');
    for (const r of RULESETS) {
      const card = el('div', 'ruleset-card' + (cfg.rulesetId === r.id ? ' selected' : ''));
      card.innerHTML = `<div class="ic">${r.icon}</div><div><div class="nm">${r.name} <span class="tg">${r.tag}</span></div><div class="tg">${r.desc}</div></div>`;
      card.onclick = () => {
        cfg.rulesetId = r.id;
        if (r.id !== 'custom') cfg.flags = { ...r.flags };
        render();
      };
      rbox.append(card);
    }
    // custom flags
    if (cfg.rulesetId === 'custom') {
      const fbox = menu.querySelector('#su-flags');
      const flagDefs = [
        ['stocks', '📈 Stock market'], ['pyramid', '🔺 Pyramid scheme'], ['cashflow', '💵 Expenses & Freedom'],
        ['professions', '🧑‍💻 Professions'], ['deals', '🤝 Deal market'], ['doodads', '🛍️ Doodads'],
        ['items', '🎒 Items'], ['statuses', '✨ Statuses'], ['casino', '🎲 Casino'], ['auctions', '🔨 Auctions'],
        ['evenBuild', '🏗️ Even-build'], ['finiteBuildings', '🧱 Finite buildings'], ['speedDie', '🎲 Speed die'],
        ['doublesJail', '🚔 3-doubles jail'], ['freeSeals', '◈ Seal promotions'], ['inflation', '📈 Inflation'],
      ];
      for (const [k, label] of flagDefs) {
        const f = el('label', 'flag' + (cfg.flags[k] ? ' on' : ''));
        f.innerHTML = `<input type="checkbox" ${cfg.flags[k] ? 'checked' : ''}> ${label}`;
        f.querySelector('input').onchange = (e) => { cfg.flags[k] = e.target.checked; f.classList.toggle('on'); };
        fbox.append(f);
      }
      const winSel = el('select', '');
      winSel.style.cssText = 'width:100%;margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);color:var(--text);border:1px solid var(--line);border-radius:9px';
      winSel.innerHTML = `
        <option value="target" ${cfg.flags.winMode === 'target' ? 'selected' : ''}>Win: reach target net worth + return home</option>
        <option value="lastStanding" ${cfg.flags.winMode === 'lastStanding' ? 'selected' : ''}>Win: last tycoon standing</option>
        <option value="freedom" ${cfg.flags.winMode === 'freedom' ? 'selected' : ''}>Win: Freedom, then buy a Dream</option>`;
      winSel.onchange = (e) => { cfg.flags.winMode = e.target.value; };
      fbox.parentElement.insertBefore(winSel, fbox.parentElement.querySelector('.range-row'));
      menu.querySelector('#su-target').oninput = (e) => { cfg.flags.targetWorth = parseInt(e.target.value); menu.querySelector('#su-target-v').textContent = '$' + cfg.flags.targetWorth.toLocaleString(); };
      menu.querySelector('#su-chaos').oninput = (e) => { cfg.flags.chaos = parseFloat(e.target.value); menu.querySelector('#su-chaos-v').textContent = cfg.flags.chaos.toFixed(1) + '×'; };
      menu.querySelector('#su-lapcap').oninput = (e) => { cfg.flags.lapCap = parseInt(e.target.value); menu.querySelector('#su-lapcap-v').textContent = cfg.flags.lapCap; };
    }
    menu.querySelector('#su-back').onclick = () => { driver.click(); menu.classList.add('hidden'); showMainMenu(driver); };
    menu.querySelector('#su-start').onclick = () => {
      driver.click();
      menu.classList.add('hidden');
      cfg.flags.boardId = cfg.boardId;
      driver.startGame(cfg);
    };
  };
  render();
}

// ---------- CODEX ----------
export function showCodex(driver) {
  modal(`
    <h2>📖 How to Play — TYCOON MAYHEM</h2>
    <p class="sub">A fusion of the greatest wealth games ever made. Here is everything, with numbers.</p>

    <h2>The Loop</h2>
    <p>On your turn: <b>manage</b> (build, trade, stocks, deals, items, pyramid) → <b>roll</b> → move → resolve the tile. Doubles roll again; three doubles land you in jail. Land on a rival's property and rent is due instantly.</p>

    <h2>The Board — up to 132 tiles, 3 rings, 21 districts</h2>
    <p><b>Boards:</b> Standard City (52 tiles, 1 ring), Grand City (80 tiles, 2 rings) and Ultimate Metropolis (132 tiles, 3 rings). On multi-ring boards, <b>Transit Stations</b> link the rings: pass one on an even roll and you change lanes automatically; <b>land on one to choose your lane</b> — ride to a linked ring and end your move there. Inner-ring PAY DAY corners pay double salary. Salary, targets and lap caps scale with board size automatically.</p>
    <p>Four properties per district; own all four to build (even levels). Rent doubles on a full unimproved set, and climbs ×5 → ×64 with houses and hotels. Shareholders get 15% of every rent in a district as dividends. Diamond Plaza and the Golden Mile accept <b>Skyscrapers</b> (level 6). Passing a corner grants its <b>seal</b> (♥♦♣♠) — finish a lap with all four to be <b>promoted</b> (+$200 salary per level, forever). Mortgaged spaces show a red <b>MORTGAGED</b> stamp and collect no rent; every owned space carries its owner's color band right beside the district color.</p>
    <table><tr><th>Tile</th><th>Effect</th></tr>
    <tr><td>🚀 START</td><td>Salary + expenses + rent roll. Pass with the target hit to WIN.</td></tr>
    <tr><td>📈 STOCK HOUSE</td><td>A district property that fronts the stock market — trade here at the owner's rates (see Gateway Spaces below).</td></tr>
    <tr><td>🤝 DEAL BROKERAGE</td><td>A district property that fronts the deal broker — sign deals at the owner's rates.</td></tr>
    <tr><td>🏦 BANK BRANCH</td><td>A district property that fronts the bank — borrow & repay at the owner's rates.</td></tr>
    <tr><td>🏛️ Taxes</td><td>Into the central Pool.</td></tr>
    <tr><td>🎁 COMMUNITY CHEST</td><td>Draw a chest card — cash, deals, and deal offers (Small/Big).</td></tr>
    <tr><td>🎡 LUCKY SPIN</td><td>Complete a lap → free prize-wheel spin: cash, jackpots, shares, items, jail-free cards, seals, double salary… or jail.</td></tr>
    <tr><td>⚡ FRENZY</td><td>Chaos card — wealth equalizer, rent storms, market crashes…</td></tr>
    <tr><td>🛍️ Doodad Alley</td><td>Forced impulse buy. The bank happily loans you the money.</td></tr>
    <tr><td>⛲ Pool Payout</td><td>Collect 50% of everything in the Pool.</td></tr>
    <tr><td>🚨 Fraud Squad</td><td>Go directly to jail.</td></tr>
    <tr><td>🔺 Pyramid Pitch</td><td>UpStone Ventures recruiting office.</td></tr>
    <tr><td>🚉 Transit</td><td>Land here to change lanes — ride to a linked ring and end your move there. Passing does nothing. (Multi-ring boards only — the single-ring Standard City has no transit.)</td></tr>
    <tr><td>📈 Exchange (corner)</td><td>Full market floor: any stock, bank loans, dreams.</td></tr>
    <tr><td>🎲 Casino (corner)</td><td>Bet High/Low (×2) or Seven (×5).</td></tr>
    <tr><td>⛓️ Jail (corner)</td><td>Bail $100, card, or doubles within 3 turns.</td></tr></table>

    <h2>🏷️ Gateway Spaces — systems live all over the board</h2>
    <p> STOCK HOUSES, DEAL BROKERAGES and BANK BRANCHES are ordinary district properties — they collect rent, build, mortgage and trade like anywhere else — but landing on one also opens its system, right there. <b>Rates depend on who owns the space:</b> the owner trades at a <b>10% discount, +10% more per building level, +10% for the full set</b> (up to −60%); anyone else pays a <b>+10% commission</b> — which the space's owner pockets — plus the normal landing fee. Buy the space on your first landing and you can use it in the same visit. The STOCK EXCHANGE corner still fronts everything, and dreams stay at the bank.</p>

    <h2>📈 District Stocks (Fortune Street)</h2>
    <p>Every district is a listed stock (200 shares). Big orders (10+ shares) move the price; developing your districts pumps it; dividends pay shareholders 15% of all rent in the district. Hold 25+ and be the top holder to become <b>Mogul</b> (+25% rent there). The compounding play: buy your own district's stock, then build — property value, share price and dividends all rise together.</p>

    <h2>🔺 UpStone Ventures (the pyramid)</h2>
    <p>Buy in (Bronze $1,000 → Diamond $10,000). Each lap you're paid a yield from the shared <b>pot</b>, scaled by the <b>hype meter</b> — check the HQ panel for <b>pot coverage</b> and the <b>collapse risk %</b> before you ride. Recruit poorer players (they join at half price, you skim 30%). Cash out any time for 65% of your tier. But when hype blows past ~55%, collapse odds climb every lap: the pot pays the two earliest birds 35% and <b>everyone else's position evaporates</b> — and every stock crashes 15% for real. Early birds win. Greedy birds ride it down. Positions count as only 40% of face value in your net worth — belief is not liquid.</p>

    <h2>💵 The Rat Race (Cashflow)</h2>
    <p>Your profession sets salary and expenses. Every lap at START: salary in, expenses out, business income and rent roll in. Build <b>passive income</b> (deal assets + dividends + rent roll) past your expenses to break <b>FREE</b>: an 8× passive bonus, 1.5× salary, and Dreams unlock — buy one to win in Rat Race rulesets. Loans: $500 units, +$50/lap each, 10% fee to repay early — leverage raises the very bar you're jumping.</p>

    <h2>🎒 Items & Statuses (Richman energy)</h2>
    <ul>
      <li>🎲 <b>Remote Dice</b> — set your next roll (2–12).</li>
      <li>🔥 <b>Hot Streak</b> (status) — +$100 on every rent you collect, one lap.</li>
      <li>🚧 <b>Roadblock</b> — first player to pass stops and pays you $200.</li>
      <li>💥 <b>Demolition Note</b> — downgrade a rival building.</li>
      <li>🚇 <b>Subway Token</b> — travel anywhere and resolve it.</li>
      <li>🛡️ <b>Insurance Shield</b> — auto-blocks the next hit on you.</li>
      <li>🗿 <b>Wealth Idol</b> (status) — refuse all payments for a lap.</li>
    </ul>

    <h2>Winning</h2>
    <ul>
      <li><b>Target</b> — reach the net-worth target, then pass START. (Wealth Street, Pyramid Pandemonium, Insane Mayhem)</li>
      <li><b>Freedom</b> — escape the Rat Race, then buy a Dream. (Rat Race)</li>
      <li><b>Last Standing</b> — bankrupt everyone. (Classic Tycoon)</li>
    </ul>
    <p>Mortgages pay half, cost +10% to lift — and a mortgaged space wears its stamp openly on the board. In a debt call you can mortgage, sell buildings and sell stocks from the debt panel. Auctions: decline a purchase and the table bids. Speed die (Insane): 1/2/3, BUS (draw Frenzy), MR. TYCOON (stride to the next unowned property). Finite buildings on Insane: 40 houses, 12 hotels, 4 skyscrapers — shared. Inflation: +2%/lap on prices.</p>
    <p style="opacity:0.6;font-size:11.5px">Tile artwork: icons from <b>game-icons.net</b> (Lorc, Delapouite, Carl Olsen, Caro Asercion) — CC BY 3.0, see assets/icons/CREDITS.md.<br>Music: "Moonlight Beach", "Island Meet and Greet", "Beachfront Celebration", "No Frills Salsa", "BossaBossa" by <b>Kevin MacLeod</b> (incompetech.com) — CC BY 4.0. Foliage models: Quaternius, CC0.</p>
    <div class="row"><button class="btn primary" id="cx-ok">Got it</button></div>
  `, { sticky: true });
  $('#cx-ok').onclick = closeModal;
}

// ---------- SETTINGS ----------
export function showSettings(driver) {
  const st = driver.settings;
  const THEMES = {
    menu: 'Menu (dreamy)', board: 'Board (groove)', boardNight: 'Board Night (mellow)',
    tension: 'Tension', rally: 'Rally (bright)', pyramid: 'UpStone (hypnotic)',
    casino: 'Casino (sly)', danger: 'Danger', victory: 'Victory', defeat: 'Defeat',
  };
  const box = modal(`
    <h2>⚙️ Settings</h2>
    <div class="settings-grid">
      <div class="settings-col">
        <div class="section-title">🔊 Audio</div>
        <div class="range-row">🎚️ <b id="set-mv2" style="color:var(--gold);min-width:44px">${Math.round(st.masterVol * 100)}%</b>
          <input type="range" id="set-master" min="0" max="100" value="${Math.round(st.masterVol * 100)}"></div>
        <div class="range-row">🎵 <b id="set-mv" style="color:var(--gold);min-width:44px">${Math.round(st.musicVol * 100)}%</b>
          <input type="range" id="set-music" min="0" max="100" value="${Math.round(st.musicVol * 100)}"></div>
        <div class="range-row">🔔 <b id="set-sv2" style="color:var(--gold);min-width:44px">${Math.round((st.sfxVol ?? 0.9) * 100)}%</b>
          <input type="range" id="set-sfxvol" min="0" max="100" value="${Math.round((st.sfxVol ?? 0.9) * 100)}"></div>
        <div class="flag ${st.sfx ? 'on' : ''}" style="margin-top:8px"><input type="checkbox" id="set-sfx" ${st.sfx ? 'checked' : ''}> 🔔 Effects enabled</div>
      </div>
      <div class="settings-col">
        <div class="section-title">🎵 Soundtrack</div>
        <div class="field" style="margin-bottom:8px">
          <select id="set-mmode" class="settings-select">
            <option value="auto" ${(st.musicMode || 'auto') === 'auto' ? 'selected' : ''}>Auto (reacts to game)</option>
            <option value="manual" ${(st.musicMode) === 'manual' ? 'selected' : ''}>Fixed theme</option>
            <option value="off" ${(st.musicMode) === 'off' ? 'selected' : ''}>Off</option>
          </select>
        </div>
        <div class="field" style="${(st.musicMode) === 'manual' ? '' : 'display:none'}">
          <select id="set-mtheme" class="settings-select">
            ${Object.keys(THEMES).map(k => `<option value="${k}" ${st.musicTheme === k ? 'selected' : ''}>${THEMES[k]}</option>`).join('')}
          </select>
        </div>
        <div class="section-title" style="margin-top:6px">⚡ Pacing</div>
        <div class="range-row">🤖 <b id="set-sv" style="color:var(--gold);min-width:64px">${driver.aiSpeedLabel()}</b>
          <input type="range" id="set-speed" min="1" max="5" value="${st.aiSpeed}"></div>
        <div class="range-row">🎬 <b id="set-av" style="color:var(--gold);min-width:44px">${(st.animSpeed || 1).toFixed(1)}×</b>
          <input type="range" id="set-anim" min="0.5" max="1.6" step="0.1" value="${st.animSpeed || 1}"></div>
      </div>
    </div>
    <div class="row"><button class="btn primary" id="set-ok">Done</button></div>`, { sticky: true });
  box.querySelector('#set-master').oninput = (e) => {
    st.masterVol = parseInt(e.target.value) / 100;
    box.querySelector('#set-mv2').textContent = Math.round(st.masterVol * 100) + '%';
    driver.applyAudioSettings();
  };
  box.querySelector('#set-music').oninput = (e) => {
    st.musicVol = parseInt(e.target.value) / 100;
    box.querySelector('#set-mv').textContent = Math.round(st.musicVol * 100) + '%';
    driver.applyAudioSettings();
  };
  box.querySelector('#set-sfxvol').oninput = (e) => {
    st.sfxVol = parseInt(e.target.value) / 100;
    box.querySelector('#set-sv2').textContent = Math.round(st.sfxVol * 100) + '%';
    driver.applyAudioSettings();
  };
  box.querySelector('#set-speed').oninput = (e) => { st.aiSpeed = parseInt(e.target.value); box.querySelector('#set-sv').textContent = driver.aiSpeedLabel(); };
  box.querySelector('#set-anim').oninput = (e) => { st.animSpeed = parseFloat(e.target.value); box.querySelector('#set-av').textContent = st.animSpeed.toFixed(1) + '×'; driver.applyAudioSettings(); };
  box.querySelector('#set-sfx').onchange = (e) => { st.sfx = e.target.checked; driver.applyAudioSettings(); };
  box.querySelector('#set-mmode').onchange = (e) => {
    st.musicMode = e.target.value;
    box.querySelector('#set-mtheme').style.display = st.musicMode === 'manual' ? '' : 'none';
    driver.applyAudioSettings();
    if (st.musicMode === 'manual') {
      const th = box.querySelector('#set-mtheme').value;
      driver.music.play(th);
    } else if (st.musicMode === 'auto') {
      driver.autoMusic(driver.mode === 'menu' ? 'menu' : 'board');
    } else {
      driver.music.stop();
    }
  };
  box.querySelector('#set-mtheme').onchange = (e) => {
    st.musicTheme = e.target.value;
    driver.music.play(st.musicTheme);
  };
  box.querySelector('#set-ok').onclick = closeModal;
}

// ---------- NET LOBBY ----------
export function showNetLobby(driver) {
  const box = modal(`
    <h2>🌐 LAN Multiplayer</h2>
    <div class="sub">Start the relay server first: <code style="color:var(--accent)">node server/server.mjs</code> — then share the room code. Up to 8 seats; the host runs the match, everyone else joins from a browser on the same network.</div>
    <div class="field" style="display:flex;gap:10px;margin-bottom:14px">
      <input id="net-name" placeholder="Your name" maxlength="14" value="Player" style="flex:1;background:rgba(255,255,255,0.05);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px">
    </div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn primary" id="net-host">🏛️ Host a room</button>
      <input id="net-code" placeholder="CODE" maxlength="4" style="width:110px;text-transform:uppercase;background:rgba(255,255,255,0.05);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font-family:var(--mono);letter-spacing:4px">
      <button class="btn" id="net-join">Join →</button>
    </div>
    <div id="net-status" class="sub" style="margin-top:14px"></div>
    <div class="row"><button class="btn ghost" id="net-back">Back</button></div>`, { sticky: true });
  box.querySelector('#net-back').onclick = closeModal;
  box.querySelector('#net-host').onclick = () => {
    const name = box.querySelector('#net-name').value || 'Host';
    box.querySelector('#net-status').textContent = 'Connecting…';
    driver.netHost(name, (msg) => box.querySelector('#net-status').innerHTML = msg);
  };
  box.querySelector('#net-join').onclick = () => {
    const name = box.querySelector('#net-name').value || 'Player';
    const code = (box.querySelector('#net-code').value || '').toUpperCase().trim();
    if (code.length !== 4) { box.querySelector('#net-status').textContent = 'Room code is 4 characters.'; return; }
    box.querySelector('#net-status').textContent = 'Connecting…';
    driver.netJoin(name, code, (msg) => box.querySelector('#net-status').innerHTML = msg);
  };
}
