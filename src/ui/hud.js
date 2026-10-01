// In-game HUD v2: avatar player cards, top bar + goal bar, animated dice widget (top
// right), action dock (bottom center), event log, banners, toasts, action feed.
import { TILES, DISTRICTS, D, SEAL_INFO, nextInRing, BOARD_SIZE } from '../data/board.js?v=8';
import { netWorth, passiveIncome, expensesOf, sealsCount, alivePlayers } from '../core/state.js?v=8';

export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const $ = (sel) => document.querySelector(sel);
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

const TOKEN_ICONS = { hat: '🎩', car: '🏎️', dog: '🐕', cat: '🐈', ship: '🚢', boot: '🥾', rocket: '🚀', crown: '👑' };

// dice pip layouts (row-major 3x3 grid)
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export class Hud {
  constructor(root, driver) {
    this.root = root;
    this.driver = driver;
    this.build();
    this.logLines = [];
    this.shownCash = {};   // playerIdx -> displayed value (animated tick-up)
    this._raf = null;
    this.feed = [];        // show-not-tell action feed
    this._diceTimer = null;
  }
  // visual action feed: icon + text + player color, shown over the board (right edge)
  action(icon, text, color = '#e8ecff') {
    const box = document.getElementById('actionfeed');
    if (!box) return;
    const t = el('div', 'feeditem', `<span class="ic">${icon}</span> <span>${text}</span>`);
    t.style.borderLeftColor = color;
    box.appendChild(t);
    this.feed.push(t);
    while (this.feed.length > 4) { const old = this.feed.shift(); old.remove(); }
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; setTimeout(() => { t.remove(); const i = this.feed.indexOf(t); if (i >= 0) this.feed.splice(i, 1); }, 500); }, 2800);
  }
  // Monopoly-Go-style rolling cash counters + satisfying pulses on every change
  tickCash() {
    const s = this.driver.state;
    if (!s) { this._raf = null; return; }
    let busy = false;
    for (const p of s.players) {
      const cashEl = document.getElementById(`cash-${p.id}`);
      if (!cashEl) continue;
      this._flash = this._flash || {};
      const st = this._flash[p.id] || (this._flash[p.id] = { cash: p.cash, active: false });
      // a fresh real change → flash the counter and spawn a floating delta tag
      if (!st.active && p.cash !== st.cash && Math.abs(p.cash - st.cash) >= 1) {
        const delta = p.cash - st.cash;
        st.active = true;
        cashEl.classList.remove('up', 'down');
        void cashEl.offsetWidth;
        cashEl.classList.add(delta > 0 ? 'up' : 'down');
        const card = cashEl.closest('.pcard');
        if (card) {
          const tag = el('span', 'deltatag ' + (delta > 0 ? 'up' : 'down'),
            (delta > 0 ? '+' : '−') + '$' + Math.abs(Math.round(delta)).toLocaleString('en-US'));
          card.appendChild(tag);
          setTimeout(() => tag.remove(), 1500);
        }
      }
      const shown = this.shownCash[p.id] ?? p.cash;
      const diff = p.cash - shown;
      if (Math.abs(diff) < 1) {
        this.shownCash[p.id] = p.cash;
        cashEl.textContent = '$' + Math.round(p.cash).toLocaleString('en-US');
        if (st.active) { st.active = false; st.cash = p.cash; cashEl.classList.remove('up', 'down'); }
        continue;
      }
      busy = true;
      const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.16);
      let nv = shown + step;
      nv = Math.sign(diff) > 0 ? Math.min(p.cash, nv) : Math.max(p.cash, nv);
      this.shownCash[p.id] = nv;
      cashEl.textContent = '$' + Math.round(nv).toLocaleString('en-US');
    }
    this._raf = busy ? requestAnimationFrame(() => this.tickCash()) : null;
  }
  build() {
    this.el = el('div', '');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div id="players"></div>
      <div id="topbar"></div>
      <div id="goalbar"><div id="goalbar-fill"></div><div id="goalbar-label"></div></div>
      <div id="hudtr">
        <div id="dicewidget">${this.diceHtml()}</div>
        <button class="btn small ghost" id="btn-menu-sm">☰</button>
      </div>
      <div id="log"></div>
      <div id="actionbar"></div>
      <div id="turnbanner"></div>
      <div id="toast"></div>
      <div id="actionfeed"></div>
    `;
    this.root.appendChild(this.el);
    $('#btn-menu-sm').onclick = () => this.driver.openPauseMenu();
    // dice start showing something real, not blank faces
    const s = this.driver.state;
    const ds = this.el.querySelectorAll('#dicewidget .die');
    if (ds[0]) this.setFace(ds[0], (s && s.dice) ? s.dice[0] : 3);
    if (ds[1]) this.setFace(ds[1], (s && s.dice) ? s.dice[1] : 4);
    const sum = this.el.querySelector('#dicewidget .dsum');
    if (sum && s && s.dice) sum.textContent = String(s.dice[0] + s.dice[1]);
  }
  diceHtml() {
    const die = (extra = '') => `
      <div class="die ${extra}">
        ${Array.from({ length: 9 }, (_, i) => `<span class="pip" data-i="${i}"></span>`).join('')}
      </div>`;
    return `${die()}${die()}<span class="dsum">–</span>`;
  }
  setFace(dieEl, face) {
    const pips = dieEl.querySelectorAll('.pip');
    pips.forEach(p => p.classList.remove('on'));
    if (typeof face === 'number') (PIPS[face] || []).forEach(i => pips[i]?.classList.add('on'));
    else {
      // speed die: BUS / MR — show a label instead of pips
      let lbl = dieEl.querySelector('.face-label');
      if (!lbl) { lbl = el('span', 'face-label'); dieEl.appendChild(lbl); }
      lbl.textContent = face === 'BUS' ? '🚌' : '🎩';
    }
  }
  // animated top-right dice widget — readable no matter where the camera is
  diceRoll(e) {
    const w = $('#dicewidget');
    if (!w) return;
    const dice = w.querySelectorAll('.die');
    const sum = w.querySelector('.dsum');
    clearTimeout(this._diceTimer);
    w.classList.remove('dsettle');
    w.classList.add('drolling');
    dice.forEach(d => { const lbl = d.querySelector('.face-label'); if (lbl) lbl.remove(); });
    // third die appears only when the speed die is live
    const wantSpeed = e.speed != null && e.speed !== undefined;
    if (wantSpeed && dice.length === 2) {
      const sd = el('div', 'die speed-die', Array.from({ length: 9 }, (_, i) => `<span class="pip" data-i="${i}"></span>`).join(''));
      w.insertBefore(sd, sum);
    } else if (!wantSpeed && dice.length === 3) dice[2].remove();
    this._diceTimer = setTimeout(() => {
      w.classList.remove('drolling');
      w.classList.add('dsettle');
      const ds = w.querySelectorAll('.die');
      this.setFace(ds[0], e.d1); this.setFace(ds[1], e.d2);
      if (ds[2]) this.setFace(ds[2], e.speed);
      const total = e.d1 + e.d2 + (typeof e.speed === 'number' ? e.speed : 0);
      sum.textContent = String(total);
      sum.classList.remove('pop'); void sum.offsetWidth; sum.classList.add('pop');
    }, 560);
  }
  // called on turnStart — keeps the turn indicator tracking the active player
  syncTurn() {
    const s = this.driver.state;
    if (!s) return;
    document.querySelectorAll('.pcard').forEach((card, i) => {
      card.classList.toggle('turn', s.players[i] && s.players[i].id === s.turn && !s.players[i].bankrupt);
    });
  }
  toast(msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), ms);
  }
  banner(title, sub = '', color = '', ms = 1800) {
    const b = $('#turnbanner');
    b.innerHTML = `<div>${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    if (color) b.style.borderColor = color; else b.style.borderColor = '';
    b.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  log(msg, icon = '•') {
    const box = $('#log');
    if (!box) return;
    const line = el('div', 'logline', `<span>${icon}</span> ${msg}`);
    box.appendChild(line);
    this.logLines.push(line);
    while (this.logLines.length > 120) { const old = this.logLines.shift(); old.remove(); }
    box.scrollTop = box.scrollHeight;
  }
  render() {
    const s = this.driver.state;
    if (!s) return;
    // dice widget: show current state, clear stale animations
    const dw = $('#dicewidget');
    if (dw) {
      dw.classList.remove('drolling');
      const ds = dw.querySelectorAll('.die');
      const sum = dw.querySelector('.dsum');
      if (ds[0] && s.dice) {
        this.setFace(ds[0], s.dice[0]);
        if (ds[1]) this.setFace(ds[1], s.dice[1]);
        if (sum) sum.textContent = String(s.dice[0] + s.dice[1] + (typeof s.speedFace === 'number' ? s.speedFace : 0));
      }
    }
    // topbar
    const target = s.flags.winMode === 'target' ? `<span class="sep">|</span> 🎯 Target <b>${fmt(s.effTarget ?? s.flags.targetWorth)}</b>` : '';
    const leader = s.players.filter(p => !p.bankrupt).reduce((a, b) => netWorth(s, a) >= netWorth(s, b) ? a : b);
    $('#topbar').innerHTML = `
      <span>🗓️ Lap <b>${s.lap}</b>/${s.effLapCap ?? s.flags.lapCap}</span>
      ${target}
      <span class="sep">|</span> 👑 ${leader.name} <b>${fmt(netWorth(s, leader))}</b>
      <span class="sep">|</span> ⛲ Pool <b>${fmt(s.pool)}</b>
      ${s.flags.pyramid ? `<span class="sep">|</span> 🔺 Hype <b>${Math.round(s.pyramid.hype)}%</b>${s.pyramid.open ? '' : ' (closed)'}` : ''}
    `;
    // goal bar: leader progress toward the target / GET HOME state
    const goal = $('#goalbar');
    if (goal) {
      if (s.flags.winMode === 'target') {
        const target = s.effTarget ?? s.flags.targetWorth;
        const hit = s.players.find(p => p.targetHit && !p.bankrupt);
        const frac = Math.min(1, netWorth(s, leader) / Math.max(1, target));
        goal.style.display = 'block';
        goal.classList.toggle('home', !!hit);
        $('#goalbar-fill').style.width = (frac * 100).toFixed(1) + '%';
        $('#goalbar-label').textContent = hit
          ? `🎯 ${hit.name} hit the target — GET HOME PAST START TO WIN!`
          : `🏆 ${leader.name} is ${Math.round(frac * 100)}% of the way to the $${target.toLocaleString()} target`;
      } else if (s.flags.winMode === 'freedom') {
        goal.style.display = 'block';
        goal.classList.toggle('home', false);
        const free = s.players.find(p => p.freedom);
        $('#goalbar-fill').style.width = free ? '100%' : '0%';
        $('#goalbar-label').textContent = free
          ? `🕊️ ${free.name} is FREE — buy a Dream at the Bank to win!`
          : '🐀 Race: build passive income past your expenses to break FREE';
      } else {
        goal.style.display = 'block';
        goal.classList.toggle('home', false);
        $('#goalbar-fill').style.width = Math.round((1 - alivePlayers(s).length / Math.max(2, s.players.length)) * 100) + '%';
        $('#goalbar-label').textContent = `⚔️ Last tycoon standing — ${alivePlayers(s).length} remain`;
      }
    }
    // players
    const box = $('#players');
    box.innerHTML = '';
    for (const p of s.players) {
      const card = el('div', 'pcard' + (p.id === s.turn ? ' turn' : '') + (p.bankrupt ? ' dead' : ''));
      card.style.setProperty('--pc', p.color);
      const nw = netWorth(s, p);
      const chip = [];
      const inboxCount = (s.tradeInbox || []).filter(o => o.to === p.id).length;
      if (inboxCount > 0 && !p.isAI) chip.push(`<span class="chip good" data-inbox="${p.id}" style="cursor:pointer">🔔 ${inboxCount} trade offer${inboxCount > 1 ? 's' : ''} — click</span>`);
      if (p.inJail) chip.push(`<span class="chip bad">⛓️ Jail (${p.jailTurns})</span>`);
      if (p.freedom) chip.push('<span class="chip good">🕊️ Free</span>');
      if (p.targetHit) chip.push('<span class="chip good">🎯 GET HOME!</span>');
      if (p.pyramid) chip.push(`<span class="chip">🔺 ${p.pyramid.tier}</span>`);
      for (const it of p.items) chip.push(`<span class="chip">${itemIcon(it)}</span>`);
      if (p.gojf > 0) chip.push(`<span class="chip">🎫×${p.gojf}</span>`);
      for (const k in p.statuses) chip.push(`<span class="chip ${k === 'wealthIdol' || k === 'hotStreak' ? 'good' : 'bad'}">${statusName(k)}</span>`);
      if (p.skipTurns > 0) chip.push(`<span class="chip bad">⏭️ ${p.skipTurns}</span>`);
      for (const k in p.seals) if (p.seals[k]) chip.push(`<span class="chip" style="color:${SEAL_INFO[k].color}">◈</span>`);
      const cashflow = s.flags.cashflow ? `
        <span> Cashflow <span style="color:${passiveIncome(s, p) >= expensesOf(s, p) ? 'var(--green)' : 'var(--danger)'}">${fmt(passiveIncome(s, p))}/${fmt(expensesOf(s, p))}</span></span>` : '';
      // win progress: target %, freedom ratio, or a GET HOME tile counter
      let prog = '';
      if (s.flags.winMode === 'target') {
        const target = s.effTarget ?? s.flags.targetWorth;
        const frac = Math.min(1, nw / Math.max(1, target));
        prog = `<div class="pbar${p.targetHit ? ' home' : ''}"><div style="width:${(frac * 100).toFixed(0)}%"></div></div>`;
        if (p.targetHit) {
          // tiles to the next payday corner in the current ring
          let steps = 0, cur = p.pos;
          do { cur = nextInRing(cur); steps++; } while (!TILES[cur].pay && steps < 80);
          chip.unshift(`<span class="chip good">🏠 ${steps} to payday</span>`);
        }
      } else if (s.flags.winMode === 'freedom' && s.flags.cashflow) {
        const pi = passiveIncome(s, p), ex = Math.max(1, expensesOf(s, p));
        const frac = Math.min(1, pi / ex);
        prog = `<div class="pbar${p.freedom ? ' home' : ''}"><div style="width:${(frac * 100).toFixed(0)}%"></div></div>`;
      }
      card.innerHTML = `
        <div class="r1">
          <span class="avatar">${TOKEN_ICONS[p.token] || '🎩'}</span>
          <div class="who">
            <div class="nm">${p.name} ${p.isAI
              ? `<span class="bot">${(p.difficulty || 'ai').toUpperCase()}</span>`
              : '<span class="bot human">HUMAN</span>'}</div>
            <div class="psub"><span>🏅 ${fmt(nw)}</span>${cashflow}${p.loans ? `<span style="color:var(--danger)">🏦 -${fmt(Math.round(p.loans * 500 * (p.loanRate ?? 1)))}/lap</span>` : ''}</div>
          </div>
          <div class="moneycol">
            <span class="pcash" id="cash-${p.id}">${fmt(p.cash)}</span>
            ${p.id === s.turn && !p.bankrupt ? '<span class="turnpill">▶ YOUR MOVE</span>' : ''}
          </div>
        </div>
        ${prog}
        ${chip.length ? `<div class="chips">${chip.join('')}</div>` : ''}
        ${!p.isAI && !p.bankrupt && !s.auction ? `<button class="btn small" data-trade="${p.id}" style="margin-top:6px;width:100%">🔄 Propose trade</button>` : ''}
      `;
      box.appendChild(card);
    }
    this.renderActions();
    if (!this._raf) this.tickCash();
    const playersBox = $('#players');
    if (playersBox) {
      playersBox.querySelectorAll('[data-inbox]').forEach(b => b.onclick = () => {
        this.driver.click();
        import('./modals.js').then(M => M.showTradeInbox(this.driver, parseInt(b.dataset.inbox)));
      });
      playersBox.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => {
        this.driver.click();
        import('./modals.js').then(M => M.showTradeBuilder(this.driver, parseInt(b.dataset.trade)));
      });
    }
  }
  renderActions() {
    const s = this.driver.state;
    const bar = $('#actionbar');
    if (!bar || !s) return;
    const pend = s.pending;
    const mine = pend && pend.player === s.turn && !this.driver.isRemoteSeat(s.turn);
    const p = s.players[s.turn];
    const canManage = p && !p.bankrupt && pend && ['roll', 'exchange', 'debt', 'gateway'].includes(pend.kind) && pend.player === p.id && !this.driver.isRemoteSeat(p.id);
    let html = '';
    if (pend && pend.kind === 'roll' && mine) {
      html += `<button class="btn gold big" id="btn-roll">🎲 ROLL</button>`;
    } else if (pend && pend.kind === 'roll' && pend.player === s.turn && this.driver.isRemoteSeat(s.turn)) {
      html += `<span class="chip">⏳ waiting for remote player…</span>`;
    }
    if (canManage) {
      html += `
        <button class="btn" data-open="manage">🏠 Portfolio</button>
        <button class="btn" data-open="trade">🔄 Trade</button>
        ${s.flags.items && p.items.length ? `<button class="btn" data-open="items">🎒 Items (${p.items.length})</button>` : ''}
        ${pend.kind === 'roll' ? '<button class="btn ghost" id="btn-end">End Turn ⏭</button>' : ''}
      `;
    }
    // a decision prompt whose popup was dismissed: offer to resume it
    const DECISIONS = ['buy', 'auction', 'jail', 'deal', 'casino', 'pitch', 'recruit', 'exchange', 'gateway', 'select', 'debt', 'trade'];
    if (pend && DECISIONS.includes(pend.kind) && mine && !document.querySelector('.modal-veil')) {
      html += `<button class="btn primary" id="btn-resume">⏳ ${promptLabel(pend.kind)} — resume</button>`;
    }
    // End Turn always available on your turn — never locked out
    if (mine && p && !p.bankrupt && pend && pend.kind !== 'debt' && pend.kind !== 'trade' && !s.auction) {
      const hasEnd = html.includes('btn-end');
      if (!hasEnd) html += `<button class="btn ghost" id="btn-end">End Turn ⏭</button>`;
    }
    bar.innerHTML = html;
    const resume = $('#btn-resume');
    if (resume) resume.onclick = () => this.driver.reopenPending();
    const roll = $('#btn-roll');
    if (roll) { roll.classList.add('waiting'); roll.onclick = () => { roll.classList.remove('waiting'); this.driver.humanAct('roll'); }; }
    const end = $('#btn-end');
    if (end) end.onclick = () => {
      const s = this.driver.state;
      if (s.pending && s.pending.kind === 'roll' && s.pending.player === s.turn) {
        this.driver.humanAct('endTurn');
      } else {
        // stuck on a non-roll prompt: answer it with the safe default to advance
        this.driver.safeDefault(s.turn);
      }
    };
    bar.querySelectorAll('[data-open]').forEach(b => {
      b.onclick = () => this.driver.openPanel(b.dataset.open);
    });
  }
}

function promptLabel(kind) {
  return {
    buy: 'Buy or auction?', auction: 'The auction is live', jail: 'You are in jail',
    deal: 'Pick a deal', casino: 'Place your bet', pitch: 'The pyramid awaits',
    recruit: 'Answer the pitch', exchange: 'The Exchange is open', gateway: 'Use this space',
    select: 'Make your choice', debt: 'Debt call!', trade: 'Trade offer',
  }[kind] || 'Decide';
}

export function itemIcon(id) { return { remoteDice: '🎲', roadblock: '🚧', bomb: '💥', teleport: '🚇', shield: '🛡️' }[id] || '🎒'; }
export function statusName(k) {
  return { wealthIdol: '🗿 Idol', badLuck: '🐈‍⬛ Bad Luck', hotStreak: '🔥 Streak', audit: '🔍 Audit' }[k] || k;
}
