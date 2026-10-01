// All modal dialogs. UI is dumb: it renders engine state and calls back into the driver.
import { el, $, itemIcon } from './hud.js?v=8';
import { TILES, DISTRICTS, D, DISTRICT_TILES, MAX_LEVEL, RENT_MULT, baseRent, buildingCost, SEAL_INFO, BOARD_SIZE, RING_META, ringOf, GATEWAYS } from '../data/board.js?v=8';
import { SMALL_DEALS, BIG_DEALS, DREAMS, ITEMS, PYRAMID_TIERS } from '../data/cards.js?v=8';
import { tileFace } from '../three/propertyArt.js?v=8';
import { tileIconFile } from '../three/board3d.js?v=8';
import { iconEl } from '../three/icons.js?v=8';
import { netWorth, passiveIncome, expensesOf, alivePlayers } from '../core/state.js?v=8';

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let veilEl = null;
export function closeModal() { if (veilEl) { veilEl.remove(); veilEl = null; } }
export function modal(html, opts = {}) {
  closeModal();
  veilEl = el('div', 'modal-veil');
  const box = el('div', 'modal glass' + (opts.mini ? ' mini' : ''));
  box.innerHTML = html;
  veilEl.appendChild(box);
  document.getElementById('app').appendChild(veilEl);
  // clicking away dismisses any popup (opts.lock screens — win/pause — stay up)
  if (!opts.lock) veilEl.addEventListener('click', (e) => { if (e.target === veilEl) closeModal(); });
  return box;
}

// ---------- DEED / MANAGE ----------
export function showDeed(driver, tileIdx, opts = {}) {
  const s = driver.state;
  const t = TILES[tileIdx];
  const pr = s.props[tileIdx] || {};
  const dist = t.type === 'property' ? DISTRICTS[D[t.district]] : null;
  const owner = pr.owner >= 0 ? s.players[pr.owner] : null;
  const me = s.players[s.turn];
  const mine = owner && owner.id === me.id;
  const maxL = dist ? MAX_LEVEL(dist.id) : 0;
  let rows = '';
  if (dist) {
    const br = baseRent(t.price);
    for (let l = 0; l <= maxL; l++) {
      const nm = ['Base rent (set ×2)', '1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel', 'SKYSCRAPER'][l];
      rows += `<tr class="${pr.level === l ? 'hot' : ''}"><td>${nm}</td><td>${fmt(driver.engine.price(br * RENT_MULT[l]))}</td></tr>`;
    }
    rows += `<tr><td>House cost</td><td>${fmt(driver.engine.price(buildingCost(t.price)))}</td></tr>`;
    rows += `<tr><td>Mortgage value</td><td>${fmt(driver.engine.price(t.price) / 2)}</td></tr>`;
    const setOwned = DISTRICT_TILES[dist.id].filter(i => s.props[i].owner === me.id).length;
    rows += `<tr><td>You own</td><td>${setOwned}/${DISTRICT_TILES[dist.id].length}</td></tr>`;
  }
  const headColor = dist ? dist.color : (t.gateway ? GATEWAYS[t.gateway].color : '#53d8ff');
  const ownerRow = owner
    ? `<div class="ownrow"><span class="odot" style="background:${owner.color};color:${owner.color}"></span>
        <b style="color:${owner.color}">${esc(owner.name)}</b>
        ${pr.mortgaged ? '<span class="chip bad">🔒 MORTGAGED — no rent</span>' : '<span class="chip good">Collecting rent</span>'}
        ${dist ? `<span class="chip">Level ${pr.level} · ${['—','House','2 Hs','3 Hs','4 Hs','Hotel','SKY'][pr.level] || ''}</span>` : ''}</div>`
    : `<div class="ownrow"><span class="chip">🏷️ FOR SALE — unowned</span></div>`;
  const box = modal(`
    <div class="deed" style="border-color:${headColor}">
      <div class="head" style="background:linear-gradient(180deg, ${headColor}, ${shadeCss(headColor, -0.18)})">${esc(t.name)}${dist ? `<span class="dsub">${esc(dist.name.toUpperCase())}</span>` : ''}</div>
      <div class="body">
        ${ownerRow}
        ${dist ? `<div class="sub" style="margin:6px 0 8px">${esc(dist.blurb)}</div>` : `<div class="sub">${esc(t.blurb || '')}</div>`}
        ${rows ? `<table>${rows}</table>` : ''}
      </div>
    </div>
    <div class="row" id="deed-actions"></div>
  `, { sticky: true });
  const acts = box.querySelector('#deed-actions');
  if (opts.buyPrice != null && !owner) {
    const b1 = el('button', 'btn gold', `Buy for ${fmt(opts.buyPrice)}`);
    b1.onclick = () => { closeModal(); driver.humanChoose('buy'); };
    const b2 = el('button', 'btn', opts.noAuction ? 'Pass' : `Auction it 🔨`);
    b2.onclick = () => { closeModal(); driver.humanChoose('decline'); };
    acts.append(b1, b2);
  } else if (mine) {
    const canBuild = driver.engineCanManage();
    if (canBuild) {
      if (pr.level < maxL) {
        const cost = driver.engine.price(buildingCost(t.price) * (pr.level + 1 === 6 ? 2 : 1));
        const bb = el('button', 'btn gold', `Build (${fmt(cost)})`);
        bb.onclick = () => { driver.humanAct('build', { tile: tileIdx }); showDeed(driver, tileIdx, opts); };
        acts.append(bb);
      }
      if (pr.level > 0) {
        const sb = el('button', 'btn', 'Sell building');
        sb.onclick = () => { driver.humanAct('sellBuilding', { tile: tileIdx }); showDeed(driver, tileIdx, opts); };
        acts.append(sb);
      }
      if (!pr.mortgaged) {
        const mb = el('button', 'btn', `Mortgage (+${fmt(driver.engine.price(t.price) / 2)})`);
        mb.onclick = () => { driver.humanAct('mortgage', { tile: tileIdx }); showDeed(driver, tileIdx, opts); };
        acts.append(mb);
      } else {
        const um = el('button', 'btn', `Lift mortgage (${fmt(driver.engine.price(t.price) / 2 * 1.1)})`);
        um.onclick = () => { driver.humanAct('unmortgage', { tile: tileIdx }); showDeed(driver, tileIdx, opts); };
        acts.append(um);
      }
    }
  }
  const close = el('button', 'btn ghost', 'Close');
  close.onclick = closeModal;
  acts.append(close);
  return box;
}

function shadeCss(hex, amt) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = 1 + amt;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

// ---------- GATEWAY VISIT — own the space, use the system, one visit ----------
export function showGateway(driver, pend) {
  const s = driver.state;
  const me = s.players[s.turn];
  const tile = pend.tile;
  const t = TILES[tile];
  const gw = GATEWAYS[pend.gateway];
  const pr = s.props[tile];
  const owner = pr.owner >= 0 ? s.players[pr.owner] : null;
  const dist = t.district ? DISTRICTS[D[t.district]] : null;
  const rate = driver.engine.gatewayRate(me, tile); // +discount / -markup
  const pct = Math.round(Math.abs(rate) * 100);
  // rate chips
  let rateChips = '';
  if (rate > 0) {
    rateChips = `<span class="rate-chip disc">↓ −${pct}% for you (you own this space${pr.level ? `, level ${pr.level}` : ''})</span>
      <span class="rate-chip info">Visitors pay +10% — the commission is yours</span>`;
  } else if (rate < 0) {
    rateChips = `<span class="rate-chip mark">↑ +${pct}% commission — this is ${esc(owner ? owner.name : 'the bank')}'s space</span>`;
    if (pend.rentPaid) rateChips += `<span class="rate-chip info">Landing fee paid: ${fmt(pend.rentPaid)}</span>`;
  } else {
    rateChips = `<span class="rate-chip info">Standard rates — own this space for a discount</span>`;
  }
  const deedBits = `
    <div class="deed" style="border-color:${dist ? dist.color : gw.color};margin-bottom:8px">
      <div class="head" style="background:linear-gradient(180deg, ${dist ? dist.color : gw.color}, ${shadeCss(dist ? dist.color : gw.color, -0.18)})">${esc(t.name)}<span class="dsub">${dist ? esc(dist.name.toUpperCase()) : ''}</span></div>
      <div class="body" style="padding:10px 14px">
        <div class="ownrow">
          ${owner ? `<span class="odot" style="background:${owner.color};color:${owner.color}"></span><b style="color:${owner.color}">${esc(owner.name)}</b>${pr.mortgaged ? ' <span class="chip bad">🔒 mortgaged</span>' : ''}` : '<span class="chip">🏷️ FOR SALE</span>'}
          <span class="chip">Price ${fmt(driver.engine.price(t.price))}</span>
        </div>
      </div>
    </div>`;
  const box = modal(`
    <h2 style="color:${gw.color}">${gw.icon} ${esc(gw.name)}</h2>
    <div class="sub">${esc(gw.blurb)}</div>
    ${deedBits}
    <div class="gw-panel" style="--gwc:${gw.color}">
      <div class="gw-head">Rates at this space</div>
      <div class="gw-rate">${rateChips}</div>
    </div>
    <div id="gw-body" style="max-height:38vh;overflow:hidden"></div>
    <div class="row">
      <span style="margin-right:auto;color:var(--dim);font-family:var(--mono)">Cash <b style="color:var(--gold)">${fmt(me.cash)}</b></span>
      ${pend.unowned ? `<button class="btn gold" id="gw-buy">Buy for ${fmt(pend.price)}</button>
      <button class="btn" id="gw-auction">Auction 🔨</button>` : ''}
      <button class="btn primary" id="gw-leave">Done ✓</button>
    </div>
  `, { sticky: true });
  const body = box.querySelector('#gw-body');
  const renderSystem = () => {
    body.innerHTML = '';
    if (pend.gateway === 'stocks' && s.flags.stocks) renderStocksInto(body, driver, renderSystem, tile);
    else if (pend.gateway === 'deals' && s.flags.deals) renderMarketInto(body, driver, renderSystem, tile);
    else if (pend.gateway === 'loans' && s.flags.cashflow) renderLoansInto(body, driver, renderSystem, tile);
    else body.innerHTML = `<div class="sub">This system is switched off in this ruleset.</div>`;
  };
  const buyBtn = box.querySelector('#gw-buy');
  if (buyBtn) buyBtn.onclick = () => { driver.humanChoose('buy'); };
  const aucBtn = box.querySelector('#gw-auction');
  if (aucBtn) aucBtn.onclick = () => { closeModal(); driver.humanChoose('pass'); };
  box.querySelector('#gw-leave').onclick = () => { closeModal(); driver.humanChoose({ type: 'continue' }); };
  renderSystem();
  return box;
}

// ---------- STOCKS ----------
export function showStocks(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  const box = modal(`
    <h2>📈 District Exchange</h2>
    <div class="sub">Buy low, develop, sell high. Big orders (10+ shares) move the price. Top shareholder (25+) becomes <b>Mogul</b>: +25% rent in the district. Dividends: 15% of all rent in a district is shared by its shareholders.</div>
    <div class="stock-list" id="stocklist"></div>
    <div class="row"><span style="margin-right:auto;color:var(--dim);font-family:var(--mono)">Cash: <b style="color:var(--gold)">${fmt(me.cash)}</b></span>
    <button class="btn ghost" id="st-close">Close</button></div>
  `, { sticky: true });
  const list = box.querySelector('#stocklist');
  const render = () => {
    list.innerHTML = '';
    for (const d of DISTRICTS) {
      const st = s.stocks[d.id];
      const have = me.stocks[d.id];
      const mogul = driver.engine.mogulOf(d.id);
      const row = el('div', 'stock-row');
      row.innerHTML = `
        <span class="nm"><span style="color:${d.color}">■</span> ${d.name} ${mogul === me.id ? '<span class="mogul">MOGUL</span>' : ''}<br>
          <span style="color:var(--dim);font-size:11.5px">par $${d.par} · you hold ${have} · shares out 200</span></span>
        <span class="pr">$${st.price}</span>
        <span class="chg ${st.price >= st.par ? 'up' : 'down'}">${st.price >= st.par ? '▲' : '▼'} ${Math.abs(st.price - st.par)}</span>
        <input type="number" min="1" value="10" data-n="${d.id}">
        <button class="btn small gold" data-buy="${d.id}">Buy</button>
        <button class="btn small" data-sell="${d.id}" ${have ? '' : 'disabled'}>Sell</button>
      `;
      list.appendChild(row);
    }
    list.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const n = parseInt(list.querySelector(`[data-n="${b.dataset.buy}"]`).value || '1');
      driver.humanAct('buyStock', { dist: b.dataset.buy, n });
      render();
    });
    list.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
      const n = parseInt(list.querySelector(`[data-n="${b.dataset.sell}"]`).value || '1');
      driver.humanAct('sellStock', { dist: b.dataset.sell, n });
      render();
    });
  };
  render();
  box.querySelector('#st-close').onclick = closeModal;
  return box;
}

// ---------- TRADE ----------
export function showTradeBuilder(driver, fromSeat, opts = {}) {
  const s = driver.state;
  const me = s.players[fromSeat ?? s.turn];
  const others = alivePlayers(s).filter(p => p.id !== me.id);
  const sel = { to: opts.to ?? others[0]?.id, give: { cash: 0, props: [...(opts.wantProps || [])], stocks: {}, items: [], gojf: 0 }, get: { cash: 0, props: [], stocks: {}, items: [], gojf: 0 } };

  // ---- value analysis helpers ----
  const propValue = (i) => {
    const t = TILES[i];
    let v = t.price;
    const dist = DISTRICTS[D[t.district]];
    if (!dist) return v;
    const dtiles = DISTRICT_TILES[dist.id];
    const mine = dtiles.filter(x => s.props[x].owner === me.id).length;
    const theirs = dtiles.filter(x => s.props[x].owner === sel.to).length;
    return v;
  };
  const setImpact = (sideKey, tileIdx) => {
    // what does giving/receiving this tile do to color-group completion?
    const t = TILES[tileIdx];
    if (t.type !== 'property') return '';
    const dist = DISTRICTS[D[t.district]];
    const dtiles = DISTRICT_TILES[dist.id];
    const receiver = sideKey === 'give' ? sel.to : me.id;
    const after = dtiles.filter(x => x !== tileIdx && s.props[x].owner === receiver).length + 1;
    if (after === dtiles.length) return `✓ completes ${esc(dist.name)} MONOPOLY for ${sideKey === 'give' ? esc(s.players[sel.to]?.name || 'them') : 'you'}`;
    if (after >= dtiles.length - 1) return `▸ ${esc(dist.name)} ${after}/${dtiles.length} — one away`;
    return `${esc(dist.name)} ${after}/${dtiles.length}`;
  };
  const sideValue = (sideKey) => {
    const side = sel[sideKey];
    let v = side.cash || 0;
    for (const t of side.props || []) v += TILES[t] ? TILES[t].price : 0;
    for (const d in (side.stocks || {})) v += (s.stocks[d]?.price || 0) * side.stocks[d];
    v += (side.gojf || 0) * 150;
    return v;
  };
  const sideLabel = (sideKey) => {
    const side = sel[sideKey];
    const bits = [];
    for (const t of side.props || []) {
      const imp = setImpact(sideKey, t);
      if (imp) bits.push(imp);
    }
    return bits;
  };

  const renderSide = (sideKey, boxId, who) => {
    const holder = box.querySelector('#' + boxId);
    holder.innerHTML = '';
    const side = sel[sideKey];
    const cash = el('div', 'tr-item', `Cash: <input type="number" min="0" value="${side.cash}" data-cash="${sideKey}">`);
    holder.append(cash);
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pr = s.props[i];
      if (!pr || pr.owner !== who.id) continue;
      const it = el('div', 'tr-item' + (side.props.includes(i) ? ' sel' : ''), `<span style="color:${DISTRICTS[D[TILES[i].district]].color}">■</span> ${TILES[i].name} ${pr.mortgaged ? '(mortgaged)' : ''}`);
      it.onclick = () => {
        const k = side.props.indexOf(i);
        if (k >= 0) side.props.splice(k, 1); else side.props.push(i);
        it.classList.toggle('sel');
        updateAnalysis();
      };
      holder.append(it);
    }
    for (const d of DISTRICTS) {
      if (who.stocks[d.id] <= 0) continue;
      const it = el('div', 'tr-item', `${d.name}: <input type="number" min="0" max="${who.stocks[d.id]}" value="0" data-stock="${sideKey}:${d.id}"> / ${who.stocks[d.id]}`);
      holder.append(it);
    }
    if (who.gojf > 0) {
      const it = el('div', 'tr-item', `Jail-free cards: <input type="number" min="0" max="${who.gojf}" value="0" data-gojf="${sideKey}"> / ${who.gojf}`);
      holder.append(it);
    }
    for (const itId of who.items) {
      const it = el('div', 'tr-item' + (side.items.includes(itId) ? ' sel' : ''), `${itemIcon(itId)} ${itId}`);
      it.onclick = () => {
        const k = side.items.indexOf(itId);
        if (k >= 0) side.items.splice(k, 1); else side.items.push(itId);
        it.classList.toggle('sel');
      };
      holder.append(it);
    }
  };

  const updateAnalysis = () => {
    // read inputs into sel
    box.querySelectorAll('[data-cash]').forEach(i => { sel[i.dataset.cash].cash = Math.max(0, parseInt(i.value || '0')); });
    box.querySelectorAll('[data-stock]').forEach(i => {
      const [sk, d] = i.dataset.stock.split(':');
      sel[sk].stocks[d] = Math.max(0, parseInt(i.value || '0'));
    });
    box.querySelectorAll('[data-gojf]').forEach(i => { sel[i.dataset.gojf].gojf = Math.max(0, parseInt(i.value || '0')); });
    const give = sideValue('give'), get = sideValue('get');
    const net = get - give;
    const el2 = box.querySelector('#tr-analysis');
    if (!el2) return;
    const impacts = [...sideLabel('get'), ...sideLabel('give')];
    el2.innerHTML = `
      <div class="tr-vals">
        <span>You give <b class="${give > 0 ? 'tr-warn' : ''}">${fmt(give)}</b></span>
        <span class="tr-arrow">⇄</span>
        <span>You get <b class="${get > 0 ? 'tr-good' : ''}">${fmt(get)}</b></span>
        <span class="tr-net ${net >= 0 ? 'tr-good' : 'tr-warn'}">Net: ${net >= 0 ? '+' : ''}${fmt(net)}</span>
      </div>
      ${impacts.length ? `<div class="tr-impacts">${impacts.map(i => `<div>${i}</div>`).join('')}</div>` : ''}
    `;
    box.querySelector('#tr-send').disabled = give === 0 && get === 0;
  };

  const box = modal(`
    <h2>🔄 Trade Broker</h2>
    <div class="sub">Properties, cash, stocks, jail cards and items. Watch the value meter — and what each tile does to color-group monopolies.</div>
    <div class="field" style="margin-bottom:10px">Partner: <select id="tr-partner">${others.map(p => `<option value="${p.id}" ${p.id === sel.to ? 'selected' : ''}>${esc(p.name)}${p.isAI ? ' (AI)' : ''}</option>`).join('')}</select></div>
    <div id="tr-analysis" class="tr-analysis"></div>
    <div class="trade-cols">
      <div class="trade-side"><h3 style="color:${me.color}">You give</h3><div id="tr-give"></div></div>
      <div class="trade-side"><h3 id="tr-getname">They give</h3><div id="tr-get"></div></div>
    </div>
    <div class="row">
      <button class="btn ghost" id="tr-cancel">Cancel</button>
      <button class="btn primary" id="tr-send">Propose</button>
    </div>
  `, { sticky: true });

  const render = () => {
    const partner = s.players[sel.to];
    box.querySelector('#tr-getname').textContent = `${partner.name} gives`;
    renderSide('give', 'tr-give', me);
    renderSide('get', 'tr-get', partner);
    box.querySelector('#tr-partner').onchange = (e) => {
      sel.to = parseInt(e.target.value);
      sel.give.props = []; sel.get.props = []; sel.give.stocks = {}; sel.get.stocks = {};
      render();
    };
    updateAnalysis();
  };
  render();

  box.querySelector('#tr-cancel').onclick = closeModal;
  box.querySelector('#tr-send').onclick = () => {
    updateAnalysis();
    const offer = JSON.parse(JSON.stringify(sel));
    offer.give.cash = Math.max(0, offer.give.cash | 0);
    offer.get.cash = Math.max(0, offer.get.cash | 0);
    closeModal();
    driver.humanAct('proposeTrade', { ...offer, from: fromSeat ?? s.turn });
  };
}


export function showTradeRespond(driver) {
  const s = driver.state;
  const offer = s.tradeOffer;
  if (!offer) return;
  const from = s.players[offer.from], to = s.players[offer.to];
  const fmtSide = (side, who) => {
    const bits = [];
    if (side.cash) bits.push(fmt(side.cash));
    for (const t of side.props || []) bits.push(TILES[t].name);
    if (side.stocks) for (const d in side.stocks) if (side.stocks[d] > 0) bits.push(`${side.stocks[d]}× ${DISTRICTS[D[d]].name} stock`);
    if (side.gojf) bits.push(`${side.gojf}× jail-free`);
    for (const it of side.items || []) bits.push(itemIcon(it) + ' ' + it);
    return bits.length ? bits.join(', ') : '(nothing)';
  };
  const box = modal(`
    <h2>🤝 Trade Offer</h2>
    <div class="sub"><b style="color:${from.color}">${esc(from.name)}</b> offers you a deal:</div>
    <div class="trade-cols">
      <div class="trade-side"><h3>You receive</h3><div>${fmtSide(offer.get, to)}</div></div>
      <div class="trade-side"><h3>You give</h3><div>${fmtSide(offer.give, to)}</div></div>
    </div>
    <div class="row">
      <button class="btn" id="tr-decline">Decline</button>
      <button class="btn primary" id="tr-accept">Accept 🤝</button>
    </div>
  `, { sticky: true });
  box.querySelector('#tr-accept').onclick = () => { closeModal(); driver.humanChoose('accept'); };
  box.querySelector('#tr-decline').onclick = () => { closeModal(); driver.humanChoose('decline'); };
}

// ---------- CARDS ----------
export function showCard(driver, deckName, card) {
  const color = deckName === 'fortune' ? '#b48cff' : '#ff8f3f';
  const box = modal(`
    <h2 style="color:${color}">${deckName === 'fortune' ? '🎁 COMMUNITY CHEST' : '⚡ FRENZY'}</h2>
    <div class="card-fly" style="border-color:${color}">${esc(card.text)}</div>
    <div class="row"><button class="btn primary" id="card-ok">OK</button></div>
  `, { sticky: true });
  box.querySelector('#card-ok').onclick = closeModal;
}

export function showDealChoice(driver, pend) {
  const s = driver.state;
  const me = s.players[s.turn];
  const list = (cards) => cards.map(d => `
    <div class="deal-card">
      <div><div class="nm">${d.name} — ${fmt(d.cost)}</div>
      <div class="ds">${d.text}</div>
      ${d.cf ? `<div class="cf">+$${d.cf}/lap passive</div>` : ''}
      ${d.shares ? `<div class="cf">+${d.shares} shares</div>` : ''}
      ${d.flip ? `<div class="cf">Flip: $${d.flip[0]} or $${d.flip[1]} next round</div>` : ''}</div>
      <button class="btn small ${me.cash >= d.cost ? 'gold' : ''}" data-deal="${d.id}" ${me.cash >= d.cost ? '' : 'disabled'}>Buy</button>
    </div>`).join('');
  const box = modal(`
    <h2>💼 Investment Broker</h2>
    <div class="sub">A broker flags you down. Small deals are safe; big deals build real cashflow. You can walk away.</div>
    <div class="section-title">Small Deals</div>${list(pend.small)}
    <div class="section-title" style="margin-top:14px">Big Deals</div>${list(pend.big)}
    <div class="row"><button class="btn ghost" id="dl-pass">Walk away</button></div>
  `, { sticky: true });
  box.querySelectorAll('[data-deal]').forEach(b => b.onclick = () => {
    const id = b.dataset.deal;
    const tier = pend.big.find(x => x.id === id) ? 'big' : 'small';
    closeModal();
    driver.humanChoose({ tier, card: id });
  });
  box.querySelector('#dl-pass').onclick = () => { closeModal(); driver.humanChoose(null); };
}

export function showMarket(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  driver.engine.refreshMarket();
  const mk = s.market;
  const cardHtml = (d, tier) => d ? `
    <div class="deal-card">
      <div><div class="nm">${d.name} — ${fmt(Math.round(d.cost * 1.1))} <span style="color:var(--dim);font-size:11px">(incl. 10% broker fee)</span></div>
      <div class="ds">${d.text}</div>
      ${d.cf ? `<div class="cf">+$${d.cf}/lap passive</div>` : ''}
      ${d.shares ? `<div class="cf">+${d.shares} shares</div>` : ''}
      ${d.flip ? `<div class="cf">Flip: $${d.flip[0]} or $${d.flip[1]}</div>` : ''}</div>
      <button class="btn small gold" data-buy="${tier}" ${me.cash >= d.cost * 1.1 ? '' : 'disabled'}>Buy</button>
    </div>` : '';
  const box = modal(`
    <h2>🤝 Deal Market</h2>
    <div class="sub">Fresh inventory every lap — one broker deal per lap. Deals pay passive income every salary: the Rat Race escape route.</div>
    ${cardHtml(mk?.small, 'small')}
    ${cardHtml(mk?.big, 'big')}
    <div class="row"><button class="btn ghost" id="mk-close">Close</button></div>
  `, { sticky: true });
  box.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { driver.humanAct('buyDeal', { tier: b.dataset.buy }); showMarket(driver); });
  box.querySelector('#mk-close').onclick = closeModal;
}

// ---------- CASINO ----------
export function showCasino(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  let bet = 'high', stake = 100;
  const box = modal(`
    <h2>🎲 Venture Casino</h2>
    <div class="sub">High (8–12) pays 2× · Low (2–6) pays 2× · Seven pays 5×. The house thanks you for your donation.</div>
    <div class="row" style="justify-content:flex-start" id="cs-bets">
      <button class="btn" data-bet="low">Low (2–6) ×2</button>
      <button class="btn" data-bet="seven">Seven ×5</button>
      <button class="btn" data-bet="high">High (8–12) ×2</button>
    </div>
    <div class="range-row">Stake: <b id="cs-stake-v" style="color:var(--gold)">$100</b>
      <input type="range" min="100" max="1000" step="100" value="100" id="cs-stake"></div>
    <div class="row">
      <button class="btn ghost" id="cs-leave">Leave</button>
      <button class="btn primary" id="cs-go">Place bet</button>
    </div>
  `, { sticky: true });
  box.querySelectorAll('[data-bet]').forEach(b => b.onclick = () => {
    bet = b.dataset.bet;
    box.querySelectorAll('[data-bet]').forEach(x => x.classList.remove('gold'));
    b.classList.add('gold');
  });
  box.querySelector('[data-bet="high"]').classList.add('gold');
  box.querySelector('#cs-stake').oninput = (e) => {
    stake = parseInt(e.target.value);
    box.querySelector('#cs-stake-v').textContent = fmt(stake);
  };
  box.querySelector('#cs-leave').onclick = () => { closeModal(); driver.humanChoose('leave'); };
  box.querySelector('#cs-go').onclick = () => { closeModal(); driver.humanChoose({ bet, stake: Math.min(stake, me.cash) }); };
}

// ---------- PYRAMID ----------
export function showPyramid(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  const py = s.pyramid;
  const members = s.players.filter(p => p.pyramid);
  // pot coverage: how many laps of current member yields the pot could still pay
  const factor = 0.7 + py.hype / 125;
  const demandPerLap = members.reduce((a, m) => {
    const t = PYRAMID_TIERS.find(x => x.id === m.pyramid.tier);
    return a + Math.round(t.cost * t.yieldPct * factor);
  }, 0);
  const potLaps = demandPerLap > 0 ? py.pot / demandPerLap : Infinity;
  const risk = Math.max(0, py.hype - 55);
  const tierRow = (t) => {
    const cur = me.pyramid && me.pyramid.tier === t.id;
    return `<div class="pyr-tier ${cur ? 'current' : ''}">
      <div><b>${t.name}</b><div style="color:var(--dim);font-size:12px">${fmt(t.cost)} · yield ${Math.round(t.yieldPct * 100)}%/lap of cost</div></div>
      ${!me.pyramid ? `<button class="btn small gold" data-join="${t.id}" ${me.cash >= t.cost ? '' : 'disabled'}>Join</button>`
        : cur ? '<span class="chip good">YOUR TIER</span>'
          : `<button class="btn small" data-up="${t.id}" ${me.cash >= t.cost ? '' : 'disabled'}>Upgrade</button>`}
    </div>`;
  };
  const box = modal(`
    <h2>🔺 UpStone Ventures</h2>
    <div class="sub">"We're not a pyramid. We're a TRIANGLE of opportunity." Yields are paid from the pot. When the hype pops, only the earliest birds keep anything.</div>
    <div class="kv"><span>Hype</span><b>${Math.round(py.hype)}%</b></div>
    <div class="hypebar"><div style="width:${py.hype}%"></div><div class="danger-zone"></div></div>
    <div class="kv"><span>Pot</span><b>${fmt(py.pot)}</b></div>
    <div class="kv"><span>Members</span><b>${members.length}${members.length ? ' — ' + members.map(m => m.name).join(', ') : ''}</b></div>
    <div class="kv"><span>Status</span><b>${py.open ? 'RECRUITING' : `closed (${py.closedFor} laps)`}</b></div>
    <div class="kv"><span>Pot coverage</span><b style="color:${potLaps >= 2 ? 'var(--green)' : potLaps >= 1 ? 'var(--gold)' : 'var(--danger)'}">${potLaps === Infinity ? '∞' : potLaps.toFixed(1)} laps</b></div>
    <div class="kv"><span>Collapse risk / lap</span><b style="color:${risk > 20 ? 'var(--danger)' : risk > 5 ? 'var(--gold)' : 'var(--green)'}">${Math.round(risk)}%</b></div>
    <div style="height:12px"></div>
    ${me.pyramid ? `<div class="kv"><span>Your position</span><b>${me.pyramid.tier}</b></div>` : ''}
    ${py.open && py.hype < 100 ? PYRAMID_TIERS.map(tierRow).join('') : ''}
    <div class="row">
      ${me.pyramid ? `<button class="btn" id="py-recruit" ${me.cash >= 200 && members.length < s.players.length - 1 ? '' : 'disabled'}>📣 Recruit ($200)</button>
      <button class="btn danger" id="py-cashout">Cash out (55% back)</button>` : ''}
      <button class="btn ghost" id="py-close">Close</button>
    </div>
  `, { sticky: true });
  box.querySelectorAll('[data-join]').forEach(b => b.onclick = () => { closeModal(); driver.humanAct('joinPyramid', { tier: b.dataset.join }); });
  box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { closeModal(); driver.humanAct('upgradePyramid', { tier: b.dataset.up }); });
  const rec = box.querySelector('#py-recruit');
  if (rec) rec.onclick = () => { closeModal(); driver.humanChoose({ type: 'recruit' }); };
  const co = box.querySelector('#py-cashout');
  if (co) co.onclick = () => { closeModal(); driver.humanAct('cashOutPyramid'); };
  box.querySelector('#py-close').onclick = closeModal;
}

// ---------- ITEMS ----------
export function showItems(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  const box = modal(`
    <h2>🎒 Items</h2>
    <div class="sub">Max 2 items. Acquired from cards, the casino and lucky breaks.</div>
    ${me.items.map(it => { const def = ITEMS.find(x => x.id === it); return `
      <div class="deal-card"><div><div class="nm">${def.icon} ${def.name}</div><div class="ds">${def.text}</div></div>
      <button class="btn small gold" data-use="${it}" ${it === 'shield' ? 'disabled title="Passive — triggers automatically"' : ''}>Use</button></div>`; }).join('') || '<div class="sub">Empty. Win some.</div>'}
    <div class="row"><button class="btn ghost" id="it-close">Close</button></div>
  `, { sticky: true });
  box.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
    const id = b.dataset.use;
    if (id === 'remoteDice') {
      closeModal();
      pickValue('Remote Dice — set your next roll (2–12)', 2, 12, 7, (v) => driver.humanAct('useItem', { item: id, value: v }));
    } else if (id === 'teleport' || id === 'bomb' || id === 'roadblock') {
      closeModal();
      pickTile(driver, id === 'teleport' ? 'Subway Token — travel to:' : id === 'bomb' ? 'Demolition Note — target building:' : 'Roadblock — place on tile:', (tile) => driver.humanAct('useItem', { item: id, tile }));
    }
  });
  box.querySelector('#it-close').onclick = closeModal;
}

function pickValue(title, min, max, val, cb) {
  const box = modal(`
    <h2>${title}</h2>
    <div class="range-row"><input type="range" min="${min}" max="${max}" value="${val}" id="pv-r" style="flex:1">
      <b id="pv-v" style="color:var(--gold);font-family:var(--mono);font-size:20px">${val}</b></div>
    <div class="row"><button class="btn primary" id="pv-ok">Set</button></div>`, { sticky: true });
  box.querySelector('#pv-r').oninput = (e) => box.querySelector('#pv-v').textContent = e.target.value;
  box.querySelector('#pv-ok').onclick = () => { const v = parseInt(box.querySelector('#pv-r').value); closeModal(); cb(v); };
}

function pickTile(driver, title, cb) {
  const box = modal(`<h2>${title}</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px" id="tp-grid"></div>
    <div class="row"><button class="btn ghost" id="tp-x">Cancel</button></div>`, { sticky: true });
  const grid = box.querySelector('#tp-grid');
  for (let i = 0; i < BOARD_SIZE; i++) {
    const t = TILES[i];
    const color = t.type === 'property' ? DISTRICTS[D[t.district]].color : '#7ee3ff';
    const b = el('button', 'btn small', `<span style="color:${color}">■</span> ${i}: ${t.name}`);
    b.style.fontSize = '11px';
    b.onclick = () => { closeModal(); cb(i); };
    grid.append(b);
  }
  box.querySelector('#tp-x').onclick = closeModal;
}

// ---------- BANK ----------
export function showBank(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  const box = modal(`
    <h2>🏦 Mayhem Bank</h2>
    <div class="kv"><span>Cash</span><b>${fmt(me.cash)}</b></div>
    <div class="kv"><span>Loans</span><b>${me.loans} × $500 (${fmt(me.loans * 50)}/lap interest)</b></div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="bk-loan" ${me.loans < 20 ? '' : 'disabled'}>Borrow $500</button>
      <button class="btn" id="bk-repay" ${me.loans > 0 && me.cash >= 500 ? '' : 'disabled'}>Repay $500</button>
    </div>
    ${s.flags.cashflow ? `<div class="section-title" style="margin-top:16px">Dreams ${me.freedom ? '' : '<span class="chip bad">🔒 unlock at Freedom</span>'}</div>` : ''}
    ${s.flags.cashflow ? DREAMS.map(d => `
      <div class="deal-card"><div><div class="nm">${d.icon} ${d.name} — ${fmt(d.cost)}</div><div class="ds">${d.line}</div></div>
      <button class="btn small gold" data-dream="${d.id}" ${me.freedom && me.cash >= d.cost && !me.dreams.some(x => x.id === d.id) ? '' : 'disabled'}>Buy</button></div>`).join('') : ''}
    <div class="section-title" style="margin-top:16px">Your assets</div>
    ${me.assets.map((a, i) => `<div class="deal-card"><div><div class="nm">${a.name}</div><div class="ds">${a.cf ? `+$${a.cf}/lap` : ''} value ${fmt(a.val)}</div></div>
      <button class="btn small" data-sell="${i}">Sell ${fmt(a.val)}</button></div>`).join('') || '<div class="sub">No assets yet — visit the Deal Market.</div>'}
    <div class="row"><button class="btn ghost" id="bk-close">Close</button></div>
  `, { sticky: true });
  box.querySelector('#bk-loan').onclick = () => { driver.humanAct('loan', { units: 1 }); showBank(driver); };
  box.querySelector('#bk-repay').onclick = () => { driver.humanAct('repay', { units: 1 }); showBank(driver); };
  box.querySelectorAll('[data-dream]').forEach(b => b.onclick = () => { driver.humanAct('dream', { id: b.dataset.dream }); showBank(driver); });
  box.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { driver.humanAct('sellAsset', { index: parseInt(b.dataset.sell) }); showBank(driver); });
  box.querySelector('#bk-close').onclick = closeModal;
}

// ---------- JAIL ----------
export function showJail(driver, pend) {
  const s = driver.state;
  const me = s.players[s.turn];
  const box = modal(`
    <h2>⛓️ Jail</h2>
    <div class="sub">Attempt ${me.jailTurns + 1} of 3. Roll doubles to walk — or pay up like a respectable criminal.</div>
    <div class="row" style="justify-content:center">
      <button class="btn primary" id="jl-roll">🎲 Roll for doubles</button>
      <button class="btn" id="jl-pay" ${me.cash >= 100 ? '' : 'disabled'}>Pay $100 bail</button>
      <button class="btn" id="jl-card" ${me.gojf > 0 ? '' : 'disabled'}>🎫 Use card (${me.gojf})</button>
    </div>`, { sticky: true });
  box.querySelector('#jl-roll').onclick = () => { closeModal(); driver.humanChoose('roll'); };
  box.querySelector('#jl-pay').onclick = () => { closeModal(); driver.humanChoose('pay'); };
  box.querySelector('#jl-card').onclick = () => { closeModal(); driver.humanChoose('card'); };
}

// ---------- DEBT ----------
export function showDebt(driver, pend) {
  const s = driver.state;
  const me = s.players[s.turn];
  const debt = driver.engine.debt;
  const box = modal(`
    <h2 style="color:var(--danger)">⚠️ Debt Call</h2>
    <div class="sub">You owe <b style="color:var(--danger)">${fmt(debt.amount)}</b> — ${esc(debt.reason)}. Raise cash or go under.</div>
    <div class="kv"><span>Cash on hand</span><b style="color:${me.cash >= debt.amount ? 'var(--green)' : 'var(--danger)'}">${fmt(me.cash)}</b></div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="db-manage">🏠 Liquidate (property panel)</button>
      <button class="btn" id="db-stocks">📈 Sell stocks</button>
      ${me.pyramid ? '<button class="btn" id="db-pyr">🔺 Cash out pyramid</button>' : ''}
    </div>
    <div class="row">
      <button class="btn danger" id="db-bankrupt">Declare bankruptcy 💀</button>
      <button class="btn gold" id="db-pay" ${me.cash >= debt.amount ? '' : 'disabled'}>Pay ${fmt(debt.amount)}</button>
    </div>`, { sticky: true });
  box.querySelector('#db-manage').onclick = () => { showDeed(driver, firstOwnedTile(driver) ?? 0); };
  box.querySelector('#db-stocks').onclick = () => { showStocks(driver); };
  const pyr = box.querySelector('#db-pyr');
  if (pyr) pyr.onclick = () => { driver.humanAct('cashOutPyramid'); showDebt(driver, pend); };
  box.querySelector('#db-pay').onclick = () => { closeModal(); driver.humanChoose('pay'); };
  box.querySelector('#db-bankrupt').onclick = () => { closeModal(); driver.humanChoose('bankrupt'); };
}
function firstOwnedTile(driver) {
  const s = driver.state, me = s.players[s.turn];
  for (let i = 0; i < BOARD_SIZE; i++) { const pr = s.props[i]; if (pr && pr.owner === me.id) return i; }
  return null;
}

// ---------- AUCTION ----------
export function showAuction(driver, pend) {
  const s = driver.state;
  const a = s.auction;
  if (!a) return;
  const t = TILES[a.tile];
  const isMe = pend.player === a.cursor && !driver.isRemoteSeat(a.cursor);
  const dist = t.type === 'property' ? DISTRICTS[D[t.district]] : null;
  const accent = dist ? dist.color : '#53d8ff';
  const minNext = Math.max(10, a.bid + 10);
  // reference card: what the property is worth
  let refRows = '';
  if (dist) {
    const br = baseRent(t.price);
    refRows = `
      <div class="row2"><span>Base rent</span><b>$${driver.engine.price(br)}</b></div>
      <div class="row2"><span>Full set rent</span><b>$${driver.engine.price(br * 2)}</b></div>
      <div class="row2"><span>1 House</span><b>$${driver.engine.price(br * RENT_MULT[1])}</b></div>
      <div class="row2"><span>Hotel</span><b>$${driver.engine.price(br * RENT_MULT[5])}</b></div>
      <div class="row2"><span>House cost</span><b>$${driver.engine.price(buildingCost(t.price))}</b></div>`;
  } else {
    refRows = `<div class="row2"><span>List price</span><b>$${driver.engine.price(t.price || 0)}</b></div>
      <div class="aa-body-sub sub" style="font-size:11.5px">${esc(t.blurb || '')}</div>`;
  }
  const box = modal(`
    <h2>🔨 AUCTION — <span style="color:${accent}">${esc(t.name)}</span></h2>
    <div class="auction-wrap" style="--auc:${accent};margin-top:10px">
      <div class="auction-art">
        <div class="aa-head" style="background:linear-gradient(180deg, ${accent}, ${shadeCss(accent, -0.18)})">${esc(t.name)}</div>
        <div class="aa-body">${refRows}
          <div class="aa-price">$${driver.engine.price(t.price || 0)}</div>
          <div class="aa-owner">${dist ? esc(dist.name) : 'special space'}</div>
        </div>
      </div>
      <div class="bidbox">
        <div class="bid-high" id="au-bid">${a.bidder >= 0 ? fmt(a.bid) + ` <small>— ${esc(s.players[a.bidder].name)}</small>` : '<small>no bids yet — opening at $10</small>'}</div>
        <div class="bidders" id="au-bidders">
          ${s.players.filter(p => !p.bankrupt).map(p => `<span class="bidder ${a.active.includes(p.id) ? '' : 'out'} ${a.bidder === p.id ? 'top' : ''}" data-bidder="${p.id}"><span class="bdot" style="background:${p.color}"></span>${esc(p.name)}</span>`).join('')}
        </div>
        <div class="row" id="au-actions" style="justify-content:flex-start;margin-top:4px"></div>
      </div>
    </div>
  `, { sticky: true });
  const acts = box.querySelector('#au-actions');
  const me = s.players[s.turn];
  if (isMe) {
    const inp = el('input');
    inp.type = 'number'; inp.value = minNext; inp.min = minNext; inp.max = me.cash;
    const mkBtn = (label, delta, cls) => {
      const b = el('button', 'btn small ' + (cls || ''), label);
      b.onclick = () => {
        const minBid = Math.max(10, driver.state.auction.bid + 10);
        const amount = Math.min(me.cash, Math.max(minBid, (parseInt(inp.value || '0') || minBid) + delta));
        inp.value = amount;
      };
      return b;
    };
    const bid = el('button', 'btn gold', `Bid ${fmt(minNext)}`);
    const syncBidLabel = () => { bid.textContent = `Bid ${fmt(Math.max(minNext, parseInt(inp.value || '0') || minNext))}`; };
    inp.oninput = syncBidLabel;
    bid.onclick = () => {
      const minBid = Math.max(10, driver.state.auction.bid + 10);
      const amount = Math.min(me.cash, Math.max(minBid, parseInt(inp.value || '0') || minBid));
      driver.humanChoose({ type: 'bid', amount });
    };
    const pass = el('button', 'btn', 'Pass');
    pass.onclick = () => { closeModal(); driver.humanChoose({ type: 'pass' }); };
    acts.append(mkBtn('+$10', 10), mkBtn('+$50', 50), mkBtn('+$100', 100), inp, bid, pass);
    if (me.cash < minNext) acts.innerHTML = `<span class="sub">You can't cover the minimum bid (${fmt(minNext)}) — sitting this out.</span>`;
  } else {
    acts.append(el('span', 'sub', `Waiting for ${esc(s.players[a.cursor]?.name || 'bids')}…`));
  }
  // live refresh; auto-closes with a SOLD stamp the moment the gavel falls
  const iv = setInterval(() => {
    if (!veilEl) { clearInterval(iv); return; }
    const a2 = driver.state.auction;
    if (!a2) {
      clearInterval(iv);
      const winner = box.dataset.lastWinner;
      const price = box.dataset.lastPrice;
      box.querySelector('#au-bid').innerHTML = `<span style="color:var(--gold)">SOLD${winner ? ' — ' + esc(winner) + ' · ' + fmt(Number(price)) : ''}</span>`;
      const acts = box.querySelector('#au-actions');
      if (acts) acts.innerHTML = '<span class="sub">🔨 The gavel has fallen.</span>';
      setTimeout(() => { if (veilEl) closeModal(); }, 1400);
      return;
    }
    box.querySelector('#au-bid').innerHTML = a2.bidder >= 0
      ? fmt(a2.bid) + ` <small>— ${esc(driver.state.players[a2.bidder].name)}</small>`
      : '<small>no bids yet — opening at $10</small>';
    box.querySelectorAll('[data-bidder]').forEach(b => {
      const pid = parseInt(b.dataset.bidder);
      b.classList.toggle('out', !a2.active.includes(pid));
      b.classList.toggle('top', a2.bidder === pid);
    });
    if (a2.bidder >= 0) { box.dataset.lastWinner = driver.state.players[a2.bidder].name; box.dataset.lastPrice = a2.bid; }
    // if it's suddenly my turn, give me the bid controls
    const myTurn = pend.player === a2.cursor && !driver.isRemoteSeat(a2.cursor);
    const curActs = box.querySelector('#au-actions');
    if (myTurn && curActs && !curActs.querySelector('input') && !curActs.querySelector('.btn.gold')) {
      curActs.innerHTML = '';
      const me2 = driver.state.players[pend.player];
      const minBid = Math.max(10, a2.bid + 10);
      const inp = el('input');
      inp.type = 'number'; inp.value = minBid; inp.min = minBid; inp.max = me2.cash;
      const bid = el('button', 'btn gold', `Bid ${fmt(minBid)}`);
      bid.onclick = () => {
        const mb = Math.max(10, driver.state.auction.bid + 10);
        const amount = Math.min(me2.cash, Math.max(mb, parseInt(inp.value || '0') || mb));
        driver.humanChoose({ type: 'bid', amount });
      };
      const pass = el('button', 'btn', 'Pass');
      pass.onclick = () => { closeModal(); driver.humanChoose({ type: 'pass' }); };
      curActs.append(inp, bid, pass);
      if (me2.cash < minBid) curActs.innerHTML = `<span class="sub">You can't cover the minimum bid (${fmt(minBid)}).</span>`;
    }
  }, 300);
}

// ---------- SELECT ----------
export function showSelect(driver, pend) {
  const kind = pend.selectKind;
  if (kind === 'transit') {
    const ringName = (tile) => ['Outer', 'Middle', 'Inner'][ringOf(tile)] || `Ring ${ringOf(tile)}`;
    const box = modal(`<h2>🚉 Transit Station — change lanes?</h2>
      <div class="sub">Ride the line to a linked station and end your move there — or stay put where you are.</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${pend.options.map(t => {
          const lt = TILES[t];
          const ltDist = lt.type === 'property' ? DISTRICTS[D[lt.district]] : null;
          return `<button class="btn gold" data-t="${t}" style="display:flex;align-items:center;gap:12px;text-align:left">
            <span style="font-size:22px">🚉</span>
            <span style="flex:1"><b>${ringName(t)} Ring</b> · ${esc(lt.name)}${ltDist ? ` <span style="color:${ltDist.color}">■</span>` : ''}<br>
            <span style="font-size:12px;opacity:0.85">${lt.type === 'property' ? (driver.state.props[t].owner >= 0 ? `Owned by ${esc(driver.state.players[driver.state.props[t].owner].name)}` : 'Unowned — could be yours') : esc(lt.blurb || '')}</span></span>
            <span>→</span>
          </button>`;
        }).join('')}
        <button class="btn" id="tp-stay">🚫 Stay on this ring</button>
      </div>`, { sticky: true });
    box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { closeModal(); driver.humanChoose({ tile: parseInt(b.dataset.t) }); });
    box.querySelector('#tp-stay').onclick = () => { closeModal(); driver.humanChoose({}); };
    return;
  }
  if (kind === 'freeMove' || kind === 'auctionPick') {
    pickTile(driver, pend.title || 'Choose a tile:', (tile) => { closeModal(); driver.humanChoose({ tile }); });
  } else if (kind === 'skipPick') {
    const box = modal(`<h2>⚖️ Jury Duty</h2><div class="sub">Choose who loses their next turn.</div>
      <div class="row" style="justify-content:flex-start">${pend.players.map(i => `<button class="btn" data-p="${i}">${esc(driver.state.players[i].name)}</button>`).join('')}</div>`, { sticky: true });
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { closeModal(); driver.humanChoose({ player: parseInt(b.dataset.p) }); });
  } else if (kind === 'swapPick') {
    const box = modal(`<h2>🔄 Property Swap</h2><div class="sub">Pick a rival. You give your cheapest non-set property and take their priciest. "Totally fair."</div>
      <div class="row" style="justify-content:flex-start">${pend.players.map(i => `<button class="btn" data-p="${i}">${esc(driver.state.players[i].name)}</button>`).join('')}</div>`, { sticky: true });
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const other = parseInt(b.dataset.p);
      const s = driver.state, me = s.players[s.turn];
      let myTile = null, bv = 1e9;
      for (let i = 0; i < BOARD_SIZE; i++) {
        const pr = s.props[i];
        if (!pr || pr.owner !== me.id) continue;
        if (DISTRICT_TILES[TILES[i].district].every(x => s.props[x].owner === me.id)) continue;
        if (TILES[i].price < bv) { bv = TILES[i].price; myTile = i; }
      }
      closeModal();
      driver.humanChoose({ player: other, myTile });
    });
  }
}

export function showRecruit(driver, pend) {
  const from = driver.state.players[pend.from];
  const box = modal(`
    <h2>📣 Recruitment Pitch</h2>
    <div class="sub"><b style="color:${from.color}">${esc(from.name)}</b> slides a brochure across the table: <i>"Be your own boss. Bosses of bosses. Of bosses."</i></div>
    <div class="row" style="justify-content:center">
      <button class="btn danger" id="rc-no">Pay $${pend.fee} to be left alone</button>
      <button class="btn gold" id="rc-yes">Join Bronze ($${pend.halfCost} — half price!)</button>
    </div>`, { sticky: true });
  box.querySelector('#rc-no').onclick = () => { closeModal(); driver.humanChoose('decline'); };
  box.querySelector('#rc-yes').onclick = () => { closeModal(); driver.humanChoose('join'); };
}

export function showExchangeHub(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  const tabs = ['stocks', 'deals', 'bank', 'trade'];
  const labels = { stocks: '📈 Stocks', deals: '🤝 Deals', bank: '🏦 Bank', trade: '🔄 Trade' };
  const avail = tabs.filter(t => (t !== 'bank' || s.flags.cashflow) && (t !== 'stocks' || s.flags.stocks) && (t !== 'deals' || s.flags.deals));
  const box = modal(`
    <h2>📈 STOCK EXCHANGE <span style="color:var(--dim);font-size:14px;font-weight:600">· ${esc(me.name)}'s seat</span></h2>
    <div class="tabrow" id="ex-tabs">${avail.map((t, i) => `<button class="tab ${i === 0 ? 'on' : ''}" data-tab="${t}">${labels[t]}</button>`).join('')}</div>
    <div id="ex-body" style="height:46vh;overflow:hidden"></div>
    <div class="row">
      <span style="margin-right:auto;color:var(--dim);font-family:var(--mono)">Cash <b style="color:var(--gold)">${fmt(me.cash)}</b></span>
      <button class="btn primary" id="ex-done">Ring the bell 🔔</button>
    </div>`, { sticky: true });
  const body = box.querySelector('#ex-body');
  let curTab = avail[0];
  const render = (tab = curTab) => {
    curTab = tab;
    body.innerHTML = '';
    if (tab === 'stocks') renderStocksInto(body, driver, render);
    else if (tab === 'deals') renderMarketInto(body, driver, render);
    else if (tab === 'bank') renderBankInto(body, driver, render);
    else if (tab === 'trade') renderTradeInto(body, driver, render);
  };
  box.querySelectorAll('#ex-tabs .tab').forEach(b => b.onclick = () => {
    box.querySelectorAll('#ex-tabs .tab').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    render(b.dataset.tab);
  });
  box.querySelector('#ex-done').onclick = () => { closeModal(); driver.humanChoose({ type: 'continue' }); };
  render(avail[0]);
}

// ---- embedded renderers for the hub (no separate modals, no scrolling) ----
// `at` = gateway tile index; when set, trades run at that space's rates.
function renderStocksInto(holder, driver, refresh, at = null) {
  const s = driver.state;
  const me = s.players[s.turn];
  const cols = DISTRICTS.length > 12 ? 3 : 2;
  const PAGE_SIZE = 9;
  let stockPage = 0;
  const totalPages = Math.ceil(DISTRICTS.length / PAGE_SIZE);
  const grid = el('div', 'stock-grid-paged');
  const renderPage = (page) => {
    stockPage = Math.max(0, Math.min(page, totalPages - 1));
    grid.innerHTML = '';
    const startIdx = stockPage * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, DISTRICTS.length);
    for (let di = startIdx; di < endIdx; di++) {
      const d = DISTRICTS[di];
    const st = s.stocks[d.id];
    const have = me.stocks[d.id];
    const fresh = me.unsettled[d.id] || 0;
    const sellable = driver.engine.settledShares(me, d.id);
    const mogul = driver.engine.mogulOf(d.id) === me.id;
    const cell = el('div', 'stock-cell');
    cell.innerHTML = `
      <div class="sc-band" style="background:${d.color}"></div>
      <div class="sc-nm">${d.name} ${mogul ? '<span class="mogul">M</span>' : ''}</div>
      <div class="sc-pr">$${st.price} <span class="chg ${st.price >= st.par ? 'up' : 'down'}">${st.price >= st.par ? '▲' : '▼'}</span></div>
      <div class="sc-have">you ${have}${fresh ? ` · <span class="fresh" title="Sellable and dividend-earning after you pass Go">${fresh} new</span>` : ''}</div>
      <div class="sc-btns"><input type="number" min="1" value="5" data-n="${d.id}"><button class="btn small gold" data-buy="${d.id}">Buy</button><button class="btn small" data-sell="${d.id}" ${sellable ? '' : 'disabled'} title="${sellable ? '' : 'New shares settle after you pass Go'}">Sell</button></div>`;
      grid.append(cell);
    }
    // pagination controls
    if (totalPages > 1) {
      const pag = el('div', 'stock-pagination');
      for (let p = 0; p < totalPages; p++) {
        const b = el('button', 'pg-btn' + (p === stockPage ? ' on' : ''), String(p + 1));
        b.onclick = () => renderPage(p);
        pag.append(b);
      }
      grid.append(pag);
    }
  };
  renderPage(0);
  holder.append(grid);
  grid.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    driver.humanAct('buyStock', { dist: b.dataset.buy, n: parseInt(grid.querySelector(`[data-n="${b.dataset.buy}"]`).value || '1'), at });
    refresh();
  });
  grid.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
    driver.humanAct('sellStock', { dist: b.dataset.sell, n: parseInt(grid.querySelector(`[data-n="${b.dataset.sell}"]`).value || '1'), at });
    refresh();
  });
}
function renderMarketInto(holder, driver, refresh, at = null) {
  const s = driver.state;
  const me = s.players[s.turn];
  driver.engine.refreshMarket();
  const mk = s.market;
  const rate = at != null ? driver.engine.gatewayRate(me, at) : 0;
  const priceOf = (d) => Math.round(Math.round(d.cost * 1.1) * (1 - rate));
  const card = (d, tier) => d ? `
    <div class="deal-card">
      <div><div class="nm">${d.name} — ${fmt(priceOf(d))} <span style="color:var(--dim);font-size:11px">(broker fee incl.${at != null && rate !== 0 ? (rate > 0 ? ` · −${Math.round(rate * 100)}% space discount` : ' · +10% commission') : ''})</span></div>
      <div class="ds">${d.text}</div>
      ${d.cf ? `<div class="cf">+$${d.cf}/lap passive</div>` : ''}
      ${d.shares ? `<div class="cf">+${d.shares} shares</div>` : ''}
      ${d.flip ? `<div class="cf">Flip: $${d.flip[0]} or $${d.flip[1]}</div>` : ''}</div>
      <button class="btn small gold" data-buy="${tier}" ${me.cash >= priceOf(d) ? '' : 'disabled'}>Buy</button>
    </div>` : '';
  holder.innerHTML = `
    <div class="sub" style="margin-bottom:8px">${at != null ? 'One broker deal per lap. Deals pay passive income every salary — the Freedom route.' : 'Fresh inventory every lap — one broker deal per lap. Deals pay passive income every salary: the Rat Race escape route.'}</div>
    ${card(mk?.small, 'small')}${card(mk?.big, 'big')}`;
  holder.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { driver.humanAct('buyDeal', { tier: b.dataset.buy, at }); refresh(); });
}
function renderLoansInto(holder, driver, refresh, at = null) {
  const s = driver.state;
  const me = s.players[s.turn];
  const rate = at != null ? driver.engine.gatewayRate(me, at) : 0;
  const perLap = Math.round(50 * clamp(1 - rate, 0.7, 1.3));
  const repayCost = (units) => Math.round(units * 500 * 1.1);
  holder.innerHTML = `
    <div class="sub" style="margin-bottom:8px">Borrow $500 per unit${at != null && rate !== 0 ? ` at this branch: <b style="color:${rate > 0 ? 'var(--green)' : 'var(--danger)'}">${perLap}$/lap per unit interest</b>` : ''}. Loans count against your expenses — the Rat Race math.</div>
    <div class="kv"><span>Outstanding</span><b>${me.loans} × $500 (${fmt(Math.round(me.loans * 50 * (me.loanRate ?? 1)))}/lap interest)</b></div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="ln-borrow" ${me.loans < 20 ? '' : 'disabled'}>Borrow $500</button>
      <button class="btn" id="ln-repay" ${me.loans > 0 && me.cash >= repayCost(1) ? '' : 'disabled'}>Repay $500 (${fmt(repayCost(1))} incl. fee)</button>
    </div>`;
  holder.querySelector('#ln-borrow').onclick = () => { driver.humanAct('loan', { units: 1, at }); refresh(); };
  holder.querySelector('#ln-repay').onclick = () => { driver.humanAct('repay', { units: 1 }); refresh(); };
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function renderBankInto(holder, driver, refresh) {
  const s = driver.state;
  const me = s.players[s.turn];
  holder.innerHTML = `
    <div class="hubrow">
      <div class="hubbox">
        <div class="section-title">Loans</div>
        <div class="kv"><span>Outstanding</span><b>${me.loans} × $500 (${fmt(me.loans * 50)}/lap)</b></div>
        <div class="row" style="justify-content:flex-start">
          <button class="btn" id="bk-loan" ${me.loans < 20 ? '' : 'disabled'}>Borrow $500</button>
          <button class="btn" id="bk-repay" ${me.loans > 0 && me.cash >= 550 ? '' : 'disabled'}>Repay $550</button>
        </div>
      </div>
      <div class="hubbox">
        <div class="section-title">Dreams ${me.freedom ? '' : '<span class="chip bad">🔒 at Freedom</span>'}</div>
        ${DREAMS.map(d => `<div class="deal-card" style="padding:8px 10px"><div><div class="nm">${d.icon} ${d.name} — ${fmt(d.cost)}</div></div>
          <button class="btn small gold" data-dream="${d.id}" ${me.freedom && me.cash >= d.cost && !me.dreams.some(x => x.id === d.id) ? '' : 'disabled'}>Buy</button></div>`).join('')}
      </div>
      <div class="hubbox">
        <div class="section-title">Sell assets</div>
        ${me.assets.map((a, i) => `<div class="deal-card" style="padding:8px 10px"><div class="nm">${a.name}</div><button class="btn small" data-sell="${i}">${fmt(a.val)}</button></div>`).join('') || '<div class="sub">None yet.</div>'}
      </div>
    </div>`;
  holder.querySelector('#bk-loan').onclick = () => { driver.humanAct('loan', { units: 1 }); refresh('bank'); };
  holder.querySelector('#bk-repay').onclick = () => { driver.humanAct('repay', { units: 1 }); refresh('bank'); };
  holder.querySelectorAll('[data-dream]').forEach(b => b.onclick = () => { driver.humanAct('dream', { id: b.dataset.dream }); refresh('bank'); });
  holder.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { driver.humanAct('sellAsset', { index: parseInt(b.dataset.sell) }); refresh('bank'); });
}
function renderTradeInto(holder, driver, refresh) {
  holder.innerHTML = `<div class="sub">Propose a trade to any rival — properties, cash, stocks, cards and items.</div>`;
  const btn = el('button', 'btn primary', 'Open trade broker 🔄');
  btn.onclick = () => showTradeBuilder(driver);
  holder.append(btn);
}

export function showSkipNotice(driver) {
  const box = modal(`<h2>⏭️ Skipping Turn</h2><div class="sub">The city holds your seat. Take a breath.</div>
    <div class="row"><button class="btn primary" id="sk-ok">Continue</button></div>`, { sticky: true });
  box.querySelector('#sk-ok').onclick = () => { closeModal(); driver.humanChoose({}); };
}

export function showWin(driver, data) {
  const s = driver.state;
  const ranked = s.players.filter(p => !p.bankrupt).sort((a, b) => netWorth(s, b) - netWorth(s, a));
  const pods = ranked.slice(0, 3).map((p, i) => `
    <div class="pod ${i === 0 ? 'first' : ''}"><div class="ic">${['🥇', '🥈', '🥉'][i]}</div>
    <div class="nm" style="color:${p.color}">${esc(p.name)}</div><div class="wt">${fmt(netWorth(s, p))}</div></div>`).join('');
  modal(`
    <h2 style="text-align:center;font-size:30px">🏆 ${esc(s.players[data.player].name)} WINS</h2>
    <div class="sub" style="text-align:center">${esc(data.reason)}</div>
    <div class="podium" style="justify-content:center">${pods}</div>
    <table class="codex" style="width:100%"><tr><th>Player</th><th>Cash</th><th>Net Worth</th><th>Laps</th><th>Properties</th><th>Trades</th></tr>
      ${s.players.map(p => `<tr><td style="color:${p.color}">${esc(p.name)}${p.bankrupt ? ' 💀' : ''}</td><td>${fmt(p.cash)}</td><td>${fmt(netWorth(s, p))}</td><td>${p.stats.laps}</td><td>${p.stats.buys}</td><td>${p.stats.trades}</td></tr>`).join('')}
    </table>
    <div class="row" style="justify-content:center">
      <button class="btn primary" id="win-again">Play Again</button>
      <button class="btn" id="win-menu">Main Menu</button>
    </div>`, { sticky: true, lock: true });
  $('#win-again').onclick = () => driver.restartSameSetup();
  $('#win-menu').onclick = () => driver.quitToMenu();
}

export function showTradeInbox(driver, seat) {
  const s = driver.state;
  const offers = (s.tradeInbox || []).map((o, i) => ({ ...o, i })).filter(o => o.to === seat);
  const me = s.players[seat];
  const fmtSide = (side) => {
    const bits = [];
    if (side.cash) bits.push(fmt(side.cash));
    for (const t of side.props || []) bits.push(TILES[t].name);
    if (side.stocks) for (const d in side.stocks) if (side.stocks[d] > 0) bits.push(`${side.stocks[d]}× ${DISTRICTS[D[d]].name} stock`);
    if (side.gojf) bits.push(`${side.gojf}× jail-free`);
    for (const it of side.items || []) bits.push(itemIcon(it) + ' ' + it);
    return bits.length ? bits.join(', ') : '(nothing)';
  };
  const box = modal(`
    <h2>🔔 Trade Offers</h2>
    ${offers.map((o, oi) => {
      const from = s.players[o.from];
      return `<div class="trade-cols" style="margin-bottom:10px">
        <div class="trade-side"><h3>From <span style="color:${from.color}">${esc(from.name)}</span> — you receive</h3><div>${fmtSide(o.offer.get)}</div></div>
        <div class="trade-side"><h3>You give</h3><div>${fmtSide(o.offer.give)}</div></div>
      </div>
      <div class="row" style="margin-top:0">
        <button class="btn danger" data-dec="${oi}">Decline</button>
        <button class="btn gold" data-acc="${oi}">Accept 🤝</button>
      </div>`;
    }).join('') || '<div class="sub">No pending offers.</div>'}
    <div class="row"><button class="btn ghost" id="ib-x">Close</button></div>
  `, { sticky: true });
  box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { closeModal(); driver.humanAct('respondInbox', { seat, accept: true }); });
  box.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { closeModal(); driver.humanAct('respondInbox', { seat, accept: false }); });
  box.querySelector('#ib-x').onclick = closeModal;
}

export function showPause(driver) {
  const box = modal(`
    <h2>⏸️ Paused</h2>
    <div class="row" style="justify-content:center;flex-direction:column;align-items:stretch;gap:10px">
      <button class="btn primary" id="pm-res">Resume</button>
      <button class="btn" id="pm-codex">📖 How to Play</button>
      <button class="btn gold" id="pm-save">💾 Save & Quit</button>
      <button class="btn danger" id="pm-quit">Quit without saving</button>
    </div>`, { sticky: true, lock: true });
  box.querySelector('#pm-res').onclick = closeModal;
  box.querySelector('#pm-codex').onclick = () => { driver.openCodex(); };
  box.querySelector('#pm-save').onclick = () => { closeModal(); driver.saveAndQuit(); };
  box.querySelector('#pm-quit').onclick = () => { driver.clearSave(); driver.quitToMenu(); };
}

// ---------- MARKET REPORT — end-of-cycle stock shift announcement ----------
export function showMarketReport(driver, e) {
  const s = driver.state;
  const changes = (e.changes || []).slice(0, 12);
  const rows = changes.map(ch => {
    const d = DISTRICTS[D[ch.dist]];
    const up = ch.price >= ch.old;
    return `<div class="rp-row">
      <span class="rp-dot" style="background:${d.color}"></span>
      <span class="rp-nm">${esc(d.name)}</span>
      <span class="rp-move ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} $${ch.old} → $${ch.price}</span>
    </div>`;
  }).join('') || '<div class="sub" style="margin:6px 0">The market closed flat this cycle.</div>';
  const box = modal(`
    <h2>📰 Market Report <span style="color:var(--dim);font-size:14px;font-weight:700">· end of cycle ${e.lap}</span></h2>
    <div class="sub">Every full round of turns the market re-prices at random. Shares bought this cycle settle once you pass Go — until then they can't be sold and earn no dividends.</div>
    <div class="rp-list">${rows}</div>
    <div class="row"><button class="btn" id="rp-ok">Close</button></div>
  `);
  box.querySelector('#rp-ok').onclick = closeModal;
}

// ---------- MECHANIC TUTORIALS — first time you meet each system ----------
const TUTORIALS = {
  buy: { icon: '🏷️', color: '#e3ab45', title: 'Buying Property', text: 'Unowned spaces sell to whoever lands on them — buy before someone else does, or pass and it goes to <b>AUCTION</b>, where anyone at the table can steal it. Sets of one color double rent and unlock building.' },
  'gw-stocks': { icon: '📈', color: '#26de81', title: 'Stock Houses', text: 'District <b>stocks</b> trade here. Owning <i>this</i> space cuts your price 10% — +10% more per building level, +10% for the full color set. Rivals landing here pay you a 10% commission on every trade. You can also buy the space itself right now.' },
  'gw-deals': { icon: '🤝', color: '#b48cff', title: 'Deal Brokerages', text: 'A broker sets up here with <b>Small & Big Deals</b> — assets that pay passive income every lap (the Freedom route). The space\'s owner signs at a discount; visitors pay a 10% commission.' },
  'gw-loans': { icon: '🏦', color: '#f0932b', title: 'Bank Branches', text: 'Borrow $500 per unit here — interest is charged every lap, at <i>this branch\'s</i> rate (owning the branch = cheaper money). Loans raise your expenses: leverage lifts the bar you are jumping.' },
  exchange: { icon: '📈', color: '#7ee3ff', title: 'The Stock Exchange', text: 'The full market floor: trade <b>any</b> district stock, take bank loans, and — once you escape the Rat Race — buy Dreams. Big orders move prices; develop districts you hold to pump them. Ring the bell when done.' },
  pitch: { icon: '🔺', color: '#ff9de2', title: 'Pyramid Pitch', text: '<b>UpStone Ventures</b> is recruiting: buy into a tier, earn yields from the shared pot every lap, recruit poorer players... The <b>hype meter</b> drives the yields — and the collapse. Cash out before the pop or ride it down.' },
  casino: { icon: '🎲', color: '#ff5e7a', title: 'Venture Casino', text: 'Bet on <b>High (8–12)</b> or <b>Low (2–6)</b> for 2× — or <b>Seven</b> for 5×. The house edge is 17%; the house says thanks for your donation.' },
  auction: { icon: '🔨', color: '#ffd32a', title: 'Auctions', text: 'When someone declines a property it goes to the <b>highest bidder</b> — often far under list price. Bid what it\'s worth to <i>your</i> sets, not what it costs. Rivals completing a color group will pay extra to deny you.' },
  debt: { icon: '⚠️', color: '#ff5e5e', title: 'Debt Calls', text: 'You owe more than your cash — raise money <b>fast</b>: mortgage properties (half value, +10% to lift), sell buildings and stocks, cash out assets. Settle before the timer of patience runs out, or declare bankruptcy and hand everything to your creditor.' },
};

export function seenTutorials() {
  try { return new Set(JSON.parse(localStorage.getItem('tm_tutorials') || '[]')); } catch { return new Set(); }
}
function markTutorialSeen(key) {
  try {
    const s = seenTutorials();
    s.add(key);
    localStorage.setItem('tm_tutorials', JSON.stringify([...s]));
  } catch { }
}
export function tutorialKeyFor(pend) {
  if (!pend) return null;
  switch (pend.kind) {
    case 'buy': return 'buy';
    case 'gateway': return 'gw-' + pend.gateway;
    case 'exchange': return 'exchange';
    case 'pitch': return 'pitch';
    case 'casino': return 'casino';
    case 'auction': return 'auction';
    case 'debt': return 'debt';
    default: return null;
  }
}
// shows the how-it-works popup (first meeting only), then hands off to the real panel
export function maybeShowTutorial(driver, key, onDone) {
  if (!key || !TUTORIALS[key] || seenTutorials().has(key)) { onDone(); return; }
  markTutorialSeen(key);
  const t = TUTORIALS[key];
  const box = modal(`
    <div class="tutorial-pop" style="--tuc:${t.color}">
      <div class="tp-head">${t.icon} <span>${t.title}</span></div>
      <p class="tp-text">${t.text}</p>
      <div class="row"><button class="btn primary" id="tp-ok">Got it ✓</button></div>
    </div>
  `, { sticky: true, mini: true });
  box.querySelector('#tp-ok').onclick = () => { closeModal(); onDone(); };
}

// ---------- TILE CARD — click any board tile for its full attribute card ----------
const TYPE_ACCENTS = {
  start: '#2ee6a8', jail: '#8b93a7', exchange: '#7ee3ff', casino: '#ff5e7a', tax: '#c9a227',
  fortune: '#b48cff', frenzy: '#ff8f3f', doodad: '#ff6b9d', pool: '#59d46b', gotojail: '#e04545',
  pyramid: '#ff9de2', transit: '#5ec8ff',
};

function accentOf(t) {
  return t.type === 'property' ? DISTRICTS[D[t.district]].color : (TYPE_ACCENTS[t.type] || '#7ee3ff');
}

// render the tile's painted face to a PNG data URL (same art as the board itself)
export function tileArtUrl(driver, tileIdx) {
  const s = driver.state;
  const t = TILES[tileIdx];
  const pr = s.props[tileIdx] || {};
  const tex = tileFace(t, {
    accent: accentOf(t),
    districtName: t.district ? DISTRICTS[D[t.district]].name : '',
    iconFile: tileIconFile(t),
    ownerColor: pr.owner >= 0 ? s.players[pr.owner].color : null,
    mortgaged: !!pr.mortgaged,
  });
  const url = tex.image.toDataURL('image/png');
  tex.dispose();
  return url;
}

// the numbers everyone asks about: rents, build costs, mortgage values
export function tileStats(driver, tileIdx) {
  const s = driver.state;
  const t = TILES[tileIdx];
  const pr = s.props[tileIdx] || {};
  const dist = t.district ? DISTRICTS[D[t.district]] : null;
  const out = {};
  if (!dist) return out;
  const eng = driver.engine;
  const br = baseRent(t.price);
  const owner = pr.owner;
  const fullSet = owner >= 0 && DISTRICT_TILES[dist.id].every(i => s.props[i].owner === owner);
  const maxL = MAX_LEVEL(dist.id);
  out.rentNow = pr.mortgaged ? 0 : eng.price(br * RENT_MULT[pr.level || 0] * (fullSet && (pr.level || 0) === 0 ? 2 : 1) * (s.rentStorm > 0 ? 2 : 1));
  out.rentBaseSet = eng.price(br * 2);
  out.rentMax = eng.price(br * RENT_MULT[maxL]);
  out.houseCost = eng.price(buildingCost(t.price));
  out.hotelCost = eng.price(buildingCost(t.price));
  out.skyCost = maxL >= 6 ? eng.price(buildingCost(t.price) * 2) : null;
  out.mortgageValue = Math.round(eng.price(t.price) / 2);
  out.unmortgageCost = Math.round(eng.price(t.price) / 2 * 1.1);
  return out;
}

// big illustrated banner for the tile card: the sourced landmark icon on a gradient
export function tileBannerUrl(driver, tileIdx) {
  const t = TILES[tileIdx];
  const accent = accentOf(t);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 168;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 168);
  g.addColorStop(0, livenCss(accent, 0.28));
  g.addColorStop(1, shadeCss(accent, -0.3));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 168);
  // sun glow
  const rg = ctx.createRadialGradient(396, 42, 6, 396, 42, 130);
  rg.addColorStop(0, 'rgba(255,244,214,0.8)'); rg.addColorStop(1, 'rgba(255,210,130,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, 512, 168);
  const img = iconEl(tileIconFile(t));
  if (img && img.naturalWidth) {
    const sc = document.createElement('canvas');
    sc.width = 256; sc.height = 256;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, 256, 256);
    const data = sctx.getImageData(0, 0, 256, 256);
    const px = data.data;
    const dark = { r: 34, g: 40, b: 66 };
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
      px[i] = dark.r; px[i + 1] = dark.g; px[i + 2] = dark.b;
      px[i + 3] = Math.round(lum * 255);
    }
    sctx.putImageData(data, 0, 0);
    ctx.drawImage(sc, 256 - 74, 84 - 74, 148, 148);
  }
  return c.toDataURL('image/png');
}
function livenCss(hex, lift) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = 1 + lift;
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f + 40 * lift));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f + 30 * lift));
  const b = Math.min(255, Math.round((n & 255) * f + 20 * lift));
  return `rgb(${r},${g},${b})`;
}
export function showTileCard(driver, tileIdx, opts = {}) {
  const s = driver.state;
  const t = TILES[tileIdx];
  const pr = s.props[tileIdx] || {};
  const dist = t.district ? DISTRICTS[D[t.district]] : null;
  const owner = pr.owner >= 0 ? s.players[pr.owner] : null;
  const me = s.players[s.turn];
  const mine = owner && owner.id === me.id;
  const art = tileArtUrl(driver, tileIdx);
  const st = tileStats(driver, tileIdx);
  const gw = t.gateway ? GATEWAYS[t.gateway] : null;
  const rate = t.gateway ? driver.engine.gatewayRate(me, tileIdx) : 0;

  const rows = [];
  if (dist) {
    rows.push(['Rent to land on it (now)', fmt(st.rentNow), true]);
    rows.push(['Base rent (full unimproved set)', fmt(st.rentBaseSet)]);
    rows.push(['Max rent (' + (MAX_LEVEL(dist.id) >= 6 ? 'skyscraper' : 'hotel') + ')', fmt(st.rentMax)]);
    rows.push(['House cost', fmt(st.houseCost)]);
    rows.push(['Hotel cost', fmt(st.hotelCost)]);
    if (st.skyCost) rows.push(['Skyscraper cost', fmt(st.skyCost)]);
    rows.push(['Mortgage value', fmt(st.mortgageValue)]);
    rows.push(['Unmortgage cost', fmt(st.unmortgageCost)]);
    const setCount = DISTRICT_TILES[dist.id].filter(i => s.props[i].owner === (owner ? owner.id : -1)).length;
    rows.push([`Set (${esc(dist.name)})`, `${setCount}/${DISTRICT_TILES[dist.id].length}${pr.level ? ` · level ${pr.level}` : ''}`]);
  } else if (t.price) {
    rows.push(['Amount', fmt(driver.engine.price(t.price)), true]);
  }

  const box = modal(`
    <div class="tilecard">
      <img class="tc-banner" src="${tileBannerUrl(driver, tileIdx)}" alt="">
      <img class="art" src="${art}" alt="${esc(t.name)}">
      <div class="tc-body">
        <div class="ownrow">
          ${owner
            ? `<span class="odot" style="background:${owner.color};color:${owner.color}"></span><b style="color:${owner.color}">${esc(owner.name)}</b>${pr.mortgaged ? ' <span class="chip bad">🔒 mortgaged</span>' : ''}`
            : '<span class="chip">🏷️ Unowned — buy it by landing on it</span>'}
        </div>
        ${rows.length ? `<table class="tc-rows">${rows.map(r => `<tr class="${r[2] ? 'hot' : ''}"><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>` : `<div class="sub">${esc(t.blurb || '')}</div>`}
        ${gw ? `<div class="gw-chipline" style="--gwc:${gw.color}">${gw.icon} ${esc(gw.name)} · ${rate > 0 ? `owner discount −${Math.round(rate * 100)}%` : rate < 0 ? `visitor commission +${Math.round(-rate * 100)}%` : 'standard rates'}</div>` : ''}
        <div class="row" id="tc-actions"></div>
      </div>
    </div>
  `, { sticky: true, mini: true });
  const acts = box.querySelector('#tc-actions');
  if (owner && owner.id !== me.id) {
    const tb = el('button', 'btn gold small', '🔄 Request trade');
    tb.onclick = () => { closeModal(); showTradeBuilder(driver, me.id, { to: owner.id, wantProps: [tileIdx] }); };
    acts.append(tb);
  }
  if (mine && driver.engineCanManage()) {
    const fullSet = dist && DISTRICT_TILES[dist.id].every(i => s.props[i].owner === me.id);
    if (fullSet && pr.level < MAX_LEVEL(dist.id) && !pr.mortgaged) {
      const bb = el('button', 'btn small gold', `Build (${fmt(driver.engine.price(buildingCost(t.price) * (pr.level + 1 === 6 ? 2 : 1)))})`);
      bb.onclick = () => { driver.humanAct('build', { tile: tileIdx }); showTileCard(driver, tileIdx, opts); };
      acts.append(bb);
    }
    if (pr.level > 0) {
      const sb = el('button', 'btn small', 'Sell building');
      sb.onclick = () => { driver.humanAct('sellBuilding', { tile: tileIdx }); showTileCard(driver, tileIdx, opts); };
      acts.append(sb);
    }
    if (!pr.mortgaged) {
      const mb = el('button', 'btn small', `Mortgage +${fmt(driver.engine.price(t.price) / 2)}`);
      mb.onclick = () => { driver.humanAct('mortgage', { tile: tileIdx }); showTileCard(driver, tileIdx, opts); };
      acts.append(mb);
    } else {
      const ub = el('button', 'btn small', `Unmortgage ${fmt(Math.round(driver.engine.price(t.price) / 2 * 1.1))}`);
      ub.onclick = () => { driver.humanAct('unmortgage', { tile: tileIdx }); showTileCard(driver, tileIdx, opts); };
      acts.append(ub);
    }
  }
  const close = el('button', 'btn ghost small', 'Close');
  close.onclick = closeModal;
  acts.append(close);
  return box;
}

// ---------- PORTFOLIO — the property management board ----------
export function showPortfolio(driver) {
  const s = driver.state;
  const me = s.players[s.turn];
  const eng = driver.engine;
  const canManage = driver.engineCanManage();

  const groupBy = {};
  for (let i = 0; i < BOARD_SIZE; i++) {
    const t = TILES[i];
    if (t.type !== 'property' || !t.district) continue;
    (groupBy[t.district] = groupBy[t.district] || []).push(i);
  }

  const tileRow = (i) => {
    const t = TILES[i];
    const pr = s.props[i];
    const owner = pr.owner >= 0 ? s.players[pr.owner] : null;
    const dist = DISTRICTS[D[t.district]];
    const st = tileStats(driver, i);
    const gw = t.gateway ? GATEWAYS[t.gateway] : null;
    const mine = owner && owner.id === me.id;
    const acts = [];
    if (mine && canManage) {
      const fullSet = DISTRICT_TILES[t.district].every(x => s.props[x].owner === me.id);
      if (fullSet && pr.level < MAX_LEVEL(t.district) && !pr.mortgaged) {
        acts.push(`<button class="btn small gold" data-build="${i}">Build ${fmt(driver.engine.price(buildingCost(t.price) * (pr.level + 1 === 6 ? 2 : 1)))}</button>`);
      }
      if (pr.level > 0) acts.push(`<button class="btn small" data-sellb="${i}">Sell bldg</button>`);
      if (!pr.mortgaged) acts.push(`<button class="btn small" data-mort="${i}">Mortgage +${fmt(driver.engine.price(t.price) / 2)}</button>`);
      else acts.push(`<button class="btn small" data-unmort="${i}">Unmortgage ${fmt(Math.round(driver.engine.price(t.price) / 2 * 1.1))}</button>`);
    }
    if (owner && owner.id !== me.id) acts.push(`<button class="btn small gold" data-trade="${i}">🔄 Trade</button>`);
    return `
      <div class="pf-tile${mine ? ' mine' : ''}" style="--pc:${dist.color}">
        <img src="${tileArtUrl(driver, i)}" alt="${esc(t.name)}">
        <div class="pf-main">
          <div class="pf-nm">${esc(t.name)} ${gw ? `<span class="chip" style="color:${gw.color};border-color:${gw.color}">${gw.icon} ${esc(gw.name)}</span>` : ''}</div>
          <div class="pf-owner">${owner
            ? `<span class="odot" style="background:${owner.color};color:${owner.color}"></span> <b style="color:${owner.color}">${esc(owner.name)}</b>${pr.mortgaged ? ' · 🔒 mortgaged' : ''} · level ${pr.level || 0}`
            : '<span class="chip">Unowned</span>'}</div>
          <div class="pf-stats">
            <span>Land cost <b>${fmt(st.rentNow)}</b></span>
            <span>Base+set <b>${fmt(st.rentBaseSet)}</b></span>
            <span>Max rent <b>${fmt(st.rentMax)}</b></span>
            <span>House <b>${fmt(st.houseCost)}</b></span>
            <span>Hotel <b>${fmt(st.hotelCost)}</b></span>
            <span>Mortgage <b>${fmt(st.mortgageValue)}</b>/<b>${fmt(st.unmortgageCost)}</b></span>
          </div>
          ${acts.length ? `<div class="pf-acts">${acts.join('')}</div>` : ''}
        </div>
      </div>`;
  };

  const myTiles = [], otherTiles = [];
  for (const d in groupBy) for (const i of groupBy[d]) (s.props[i].owner === me.id ? myTiles : otherTiles).push(i);

  const sets = DISTRICTS.map(d => {
    const tiles = groupBy[d.id] || [];
    const n = tiles.filter(i => s.props[i].owner === me.id).length;
    return { d, n, total: tiles.length };
  }).filter(x => x.n > 0);

  const box = modal(`
    <h2>🏠 Property Portfolio <span style="color:var(--dim);font-size:14px;font-weight:700">· ${esc(me.name)}</span></h2>
    <div class="pf-summary">
      <span>Cash <b style="color:var(--gold)">${fmt(me.cash)}</b></span>
      <span>Net worth <b style="color:var(--gold)">${fmt(netWorth(s, me))}</b></span>
      <span>Properties <b>${myTiles.length}</b></span>
      <span>Rent collected <b>${fmt(me.stats.rentIn)}</b></span>
      <span>Rent paid <b>${fmt(me.stats.rentOut)}</b></span>
    </div>
    ${sets.length ? `<div class="pf-sets">${sets.map(x => `<span class="chip" style="border-color:${x.d.color};color:${x.d.color}"><span style="color:${x.d.color}">■</span> ${esc(x.d.name)} ${x.n}/${x.total}${x.n === x.total ? ' ✓' : ''}</span>`).join('')}</div>` : ''}
    <div class="section-title" style="margin-top:12px">Your properties (${myTiles.length})</div>
    <div class="pf-list">${myTiles.map(tileRow).join('') || '<div class="sub">You don\'t own any districts yet. Land on properties to buy them — or win them at auction.</div>'}</div>
    <div class="section-title" style="margin-top:12px">Rivals & unowned (${otherTiles.length})</div>
    <div class="pf-list">${otherTiles.map(tileRow).join('')}</div>
    <div class="row"><button class="btn ghost" id="pf-close">Close</button></div>
  `, { sticky: true });
  const refresh = () => showPortfolio(driver);
  box.querySelectorAll('[data-build]').forEach(b => b.onclick = () => { driver.humanAct('build', { tile: +b.dataset.build }); refresh(); });
  box.querySelectorAll('[data-sellb]').forEach(b => b.onclick = () => { driver.humanAct('sellBuilding', { tile: +b.dataset.sellb }); refresh(); });
  box.querySelectorAll('[data-mort]').forEach(b => b.onclick = () => { driver.humanAct('mortgage', { tile: +b.dataset.mort }); refresh(); });
  box.querySelectorAll('[data-unmort]').forEach(b => b.onclick = () => { driver.humanAct('unmortgage', { tile: +b.dataset.unmort }); refresh(); });
  box.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => {
    const i = +b.dataset.trade;
    closeModal();
    showTradeBuilder(driver, me.id, { to: s.props[i].owner, wantProps: [i] });
  });
  box.querySelector('#pf-close').onclick = closeModal;
  return box;
}
