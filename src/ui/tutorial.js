// Interactive tutorial coach: scripted beats over a real game vs Banker Bess.
import { el, $ } from './hud.js?v=8';

export class Coach {
  constructor(driver) {
    this.driver = driver;
    this.steps = [
      { id: 'welcome', text: 'Welcome to <b>TYCOON MAYHEM</b>! I\'m <b>Banker Bess</b> — I\'ll be your opponent. This city prints money for whoever understands it. Let\'s take a lap.', watch: null },
      { id: 'roll', text: 'Your turn! Before rolling you may <b>manage</b> your empire — but on turn one, just smash <b>ROLL</b>.', watch: { kind: 'roll', highlight: '#btn-roll' } },
      { id: 'moving', text: 'See your token hop? Tiles come in <b>districts</b> of four. Land on an unowned one and you can buy it — or send it to <b>auction</b> where everyone can bid.', watch: null },
      { id: 'salary', text: 'Passing <b>START</b> pays your <b>salary</b> and charges your <b>expenses</b>. Collect all four corner <b>seals</b> (♥♦♣♠) in one lap to get <b>promoted</b> — permanent +$200 salary per level!', watch: null },
      { id: 'rent', text: 'Land on MY property and rent is due. Rent doubles when a rival owns a full district — and skyscrapers on Diamond Plaza or the Golden Mile pay a fortune.', watch: null },
      { id: 'stocks', text: 'The secret weapon: <b>stocks</b>. Every district trades shares. Buy shares of a district you own, then <b>build</b> there — property value, share price AND dividends rise together. Try <b>Stocks</b> and grab a few shares.', watch: { kind: 'roll', highlight: '[data-open="stocks"]' } },
      { id: 'build', text: 'Own a full district? Open <b>Property</b> and build a house — even-build rule: all four rise together. More buildings = more rent = higher share price.', watch: { kind: 'roll', highlight: '[data-open="manage"]' } },
      { id: 'deals', text: 'The <b>Deal Market</b> sells cashflow businesses every lap. Passive income is how you escape the <b>Rat Race</b>: when passive > expenses, you go <b>FREE</b> and Dreams unlock.', watch: { kind: 'roll', highlight: '[data-open="market"]' } },
      { id: 'pyramid', text: 'That glowing pyramid downtown? <b>UpStone Ventures</b> — a pyramid scheme. Yields are juicy while hype is low, but the higher it climbs, the closer the <b>collapse</b>. Cash out before the pop. Capisce?', watch: { kind: 'roll', highlight: '[data-open="pyramid"]' } },
      { id: 'win', text: 'Win by hitting the <b>target net worth</b> and strolling home past START — or bankrupting us all in Classic. Full rules live in the codex. Now go take my money!', watch: null },
    ];
    this.idx = 0;
    this.build();
  }
  build() {
    this.el = el('div', 'glass');
    this.el.id = 'coach';
    document.getElementById('app').appendChild(this.el);
    this.render();
  }
  render() {
    if (this.idx >= this.steps.length) { this.finish(); return; }
    const st = this.steps[this.idx];
    this.el.innerHTML = `
      <div class="step">Tutorial ${this.idx + 1}/${this.steps.length}</div>
      <div class="txt">${st.text}</div>
      <div style="display:flex;gap:8px">
        <button class="btn small" id="coach-next">${st.watch ? 'Got it' : 'Next'} →</button>
        <button class="btn small ghost" id="coach-skip">Skip tutorial</button>
      </div>`;
    $('#coach-next').onclick = () => { this.driver.click(); this.advance(); };
    $('#coach-skip').onclick = () => { this.driver.click(); this.finish(); };
    this.applyWatch();
  }
  applyWatch() {
    document.querySelectorAll('.spotlight').forEach(e => e.classList.remove('spotlight'));
    const st = this.steps[this.idx];
    if (!st.watch) return;
    const pend = this.driver.state?.pending;
    if (pend && pend.kind === st.watch.kind) {
      const target = document.querySelector(st.watch.highlight);
      if (target) target.classList.add('spotlight');
    }
  }
  advance() { this.idx++; this.render(); }
  onPrompt() { this.applyWatch(); }
  finish() {
    this.el?.remove();
    this.el = null;
    document.querySelectorAll('.spotlight').forEach(e => e.classList.remove('spotlight'));
    try { localStorage.setItem('tm_tutorial_done', '1'); } catch { }
    this.driver.hud?.toast('Tutorial complete — you\'re a tycoon now. 🎩');
  }
}
