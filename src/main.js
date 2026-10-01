// TYCOON MAYHEM — game driver. Wires engine + AI + 3D + audio + UI + net.
import { newGame } from './core/state.js?v=8';
import { Engine } from './core/engine.js?v=8';
import { Brain } from './ai/brain.js?v=8';
import { RULESETS } from './data/rulesets.js?v=8';
import { PROFESSIONS } from './data/professions.js?v=8';
import { TILES, DISTRICTS, D, BOARD_SIZE } from './data/board.js?v=8';
import { Renderer } from './three/renderer.js?v=8';
import { loadIcons } from './three/icons.js?v=8';
import { MusicDirector } from './audio/music.js?v=8';
import { initSfx, getSfx } from './audio/sfx.js?v=8';
import { Hud } from './ui/hud.js?v=8';
import * as M from './ui/modals.js?v=8';
import { showMainMenu, hideMainMenu, showSetup, showCodex, showSettings, showNetLobby } from './ui/menu.js?v=8';
import { Coach } from './ui/tutorial.js?v=8';
import { NetLayer } from './net/client.js?v=8';

const $ = (s) => document.querySelector(s);

class Driver {
  constructor() {
    loadIcons(); // sourced tile artwork loads in parallel with everything else
    this.music = new MusicDirector();
    initSfx(this.music);
    this.settings = { masterVol: 0.9, musicVol: 0.6, sfxVol: 0.9, sfx: true, aiSpeed: 1, animSpeed: 0.8, musicMode: 'auto', musicTheme: 'board' };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('tm_settings') || '{}')); } catch { }
    this.renderer = new Renderer(document.getElementById('gl'));
    this.mode = 'menu';        // 'menu' (demo) | 'play' | 'net-host' | 'net-peer' | 'tutorial'
    this.engine = null;
    this.brains = [];
    this.hud = null;
    this.coach = null;
    this.net = null;
    this.myNetSeat = -1;
    this.netSeats = [];
    this.lastCfg = null;
    this.thinkTimer = null;
    this.applyAudioSettings();
    this.renderer.pace = this.animPace();
    // click any board tile (not a drag) to inspect it
    this.renderer.onTileClick = (i) => {
      if (this.mode === 'menu') return;
      this.click();
      M.showTileCard(this, i);
    };
    this.startDemo();
    showMainMenu(this);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mode !== 'menu' && this.engine) this.openPauseMenu();
    });
    // keep the right button inside the app — never a browser back/menu gesture
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    // first user gesture unlocks audio
    const unlock = () => { this.music.resume(); this.autoMusic(this.mode === 'menu' ? 'menu' : 'board'); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  get state() { return this.engine?.s; }

  // ---------- audio ----------
  applyAudioSettings() {
    this.music.setVolumes({
      master: this.settings.masterVol ?? 0.9,
      music: this.settings.musicVol ?? 0.6,
      sfx: this.settings.sfxVol ?? 0.9,
    });
    this.music.setMuted(this.settings.musicMode === 'off');
    if (this.settings.musicMode === 'manual' && this.settings.musicTheme) this.music.play(this.settings.musicTheme);
    const s = getSfx();
    if (s) s.enabled = this.settings.sfx && (this.settings.sfxVol ?? 1) > 0;
    this.renderer.pace = this.settings.animSpeed || 1;
    try { localStorage.setItem('tm_settings', JSON.stringify(this.settings)); } catch { }
  }

  // called by roundEnd/unlock: only auto-switch when the user hasn't picked a fixed theme
  autoMusic(name) {
    if ((this.settings.musicMode || 'auto') !== 'auto') return;
    this.music.play(name);
  }
  animPace() { return this.settings.animSpeed || 1; }
  aiSpeedLabel() { return ['zZz', 'Slow', 'Normal', 'Snappy', 'Turbo'][this.settings.aiSpeed] || 'Normal'; }
  aiDelay() {
    const d = [2600, 1600, 950, 550, 260][this.settings.aiSpeed] ?? 950;
    return d + Math.random() * d * 0.5;
  }
  click() { getSfx()?.play('click'); }

  // ---------- demo behind the menu ----------
  startDemo() {
    this.mode = 'menu';
    this.teardownGame();
    this.renderer.autoOrbit = true;
    const players = [];
    for (let i = 0; i < 6; i++) {
      players.push({ name: `Bot ${i + 1}`, token: ['hat', 'car', 'dog', 'cat', 'ship', 'crown'][i], isAI: true, difficulty: 'sharp', professionId: PROFESSIONS[i].id });
    }
    const rs = RULESETS.find(r => r.id === 'insane');
    this.engine = new Engine(newGame({ seed: 20260928, players, ruleset: 'insane', flags: { ...rs.flags } }));
    this.renderer.setEngine(this.engine);
    // decorative home board: pieces sprinkled around, nobody moves, no dice, no sfx —
    // the menu must never play the game at itself
    const BOARD_N = this.engine.s.props.length;
    this.engine.s.players.forEach((p, i) => { p.pos = (i * 9 + 4) % BOARD_N; });
    this.renderer.tokens?.syncPositions?.();
  }

  teardownGame() {
    if (this.thinkTimer) { clearTimeout(this.thinkTimer); this.thinkTimer = null; }
    this.coach?.finish?.();
    this.coach = null;
    $('#hud')?.remove();
    this.hud = null;
    M.closeModal();
  }

  // ---------- game start ----------
  startGame(cfg, opts = {}) {
    this.teardownGame();
    hideMainMenu();
    this.lastCfg = cfg;
    const seed = opts.seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    const players = cfg.players.map(p => ({
      name: p.name, token: p.token, isAI: p.isAI, difficulty: p.difficulty, professionId: p.professionId,
    }));
    this.engine = new Engine(newGame({ seed, players, ruleset: cfg.rulesetId, flags: { ...cfg.flags } }));
    this.brains = this.engine.s.players.map((_, i) => new Brain(this.engine, i));
    this.renderer.setEngine(this.engine);
    this.renderer.autoOrbit = false;
    this.hud = new Hud(document.getElementById('app'), this);
    this.bindEngineEvents(false);
    this.mode = opts.mode || 'play';
    this.autoMusic('board');
    this.hud.banner('TYCOON MAYHEM', RULESETS.find(r => r.id === cfg.rulesetId)?.name || '', '#ffd32a', 2400);
    if (opts.tutorial) this.coach = new Coach(this);
    // seat event for remote info
    this.engine.beginTurn();
    this.hud.render();
  }
  // ---------- SAVE ----------
  autosave() {
    if (this.mode !== 'play' || !this.engine || this.engine.s.gameOver) return;
    try { localStorage.setItem('tm_save', JSON.stringify(this.engine.serialize())); } catch (e) { console.warn('save failed', e); }
  }
  hasSave() { try { return !!localStorage.getItem('tm_save'); } catch { return false; } }
  loadSavedGame() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem('tm_save')); } catch { }
    if (!saved || !saved.state) { this.hud?.toast('No saved game found.'); return; }
    this.teardownGame();
    hideMainMenu();
    try {
      this.engine = Engine.restore(saved);
      this.brains = this.engine.s.players.map((_, i) => new Brain(this.engine, i));
      this.renderer.setEngine(this.engine);
      this.renderer.pace = this.animPace();
      this.renderer.autoOrbit = false;
      this.hud = new Hud(document.getElementById('app'), this);
      this.bindEngineEvents(false);
      this.mode = 'play';
      this.music.play('board');
      this.hud.banner('Welcome back', `${this.engine.s.players.filter(p => !p.bankrupt).length} tycoons · lap ${this.engine.s.lap}`, '#7ee3ff', 2200);
      this.hud.render();
      // re-surface the current prompt
      const pend = this.engine.s.pending;
      if (pend) this.onPrompt({ kind: pend.kind, player: pend.player, ...pend }, false);
    } catch (e) {
      console.error('load failed', e);
      this.hud?.toast('Save was corrupted — starting fresh.');
      this.quitToMenu();
    }
  }
  clearSave() { try { localStorage.removeItem('tm_save'); } catch { } }
  saveAndQuit() {
    if (this.mode === 'play' && this.engine && !this.engine.s.gameOver) {
      try { localStorage.setItem('tm_save', JSON.stringify(this.engine.serialize())); this.hud?.toast('Game saved.'); } catch { }
    }
    setTimeout(() => this.quitToMenu(), 300);
  }
  saveSlotInfo() {
    try {
      const raw = localStorage.getItem('tm_save');
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const st = saved.state || {};
      return { lap: st.lap, players: (st.players || []).filter(p => !p.bankrupt).length, board: st.boardId, when: saved.savedAt };
    } catch { return null; }
  }

  restartSameSetup() {
    M.closeModal();
    if (this.mode === 'net-host') { /* re-host flow: simplest = quit */ this.quitToMenu(); return; }
    this.startGame(this.lastCfg, { mode: this.mode, tutorial: false });
  }
  quitToMenu() {
    this.net?.ws?.close?.();
    this.net = null;
    this.startDemo();
    showMainMenu(this);
  }
  openPauseMenu() { if (this.engine && !this.engine.s.gameOver) M.showPause(this); }
  openCodex() { showCodex(this); }

  // ---------- engine events ----------
  bindEngineEvents(demo) {
    const eng = this.engine;
    eng.on('log', (e) => { if (!demo) this.hud?.log(e.msg, e.icon); });
    eng.on('prompt', (e) => this.onPrompt(e, demo));
    if (!demo) {
      const nm = (i) => this.engine.s.players[i]?.name || '?';
      const dn = (i) => this.engine.s.players[i]?.color || '#fff';
      eng.on('turnStart', (e) => {
        this.hud?.action('▶', `${nm(e.player)}'s turn`, dn(e.player));
        this.hud?.syncTurn();
      });
    eng.on('rolled', (e) => this.hud?.diceRoll(e));
      eng.on('stock', (e) => this.hud?.action(e.delta >= 0 ? '📈' : '📉', `${nm(e.player)} ${e.delta >= 0 ? 'buys' : 'sells'} ${Math.abs(e.delta)} shares · ${DISTRICTS[D[e.dist]].name}`, dn(e.player)));
      eng.on('fx:build', (e) => this.hud?.action('🏗️', `${nm(e.player)} builds on ${TILES[e.tile].name}`, dn(e.player)));
      eng.on('fx:buy', (e) => this.hud?.action('🏷️', `${nm(e.player)} buys ${TILES[e.tile].name}`, dn(e.player)));
      eng.on('auction:win', (e) => {
        const nmw = nm(e.player);
        this.hud?.banner(`🔨 SOLD to ${nmw}!`, `${TILES[e.tile].name} — $${e.amount.toLocaleString('en-US')}`, '#ffd32a', 2600);
        this.hud?.action('🔨', `${nmw} wins ${TILES[e.tile].name} at auction ($${e.amount.toLocaleString('en-US')})`, dn(e.player));
      });
      eng.on('loan', (e) => this.hud?.action(e.units > 0 ? '🏦' : '💸', `${nm(e.player)} ${e.units > 0 ? 'borrows' : 'repays'} $${Math.abs(e.units) * 500}`, dn(e.player)));
      eng.on('fx:deal', (e) => this.hud?.action('🤝', `${nm(e.player)} signs a deal`, dn(e.player)));
      eng.on('fx:dream', (e) => this.hud?.action('🌈', `${nm(e.player)} buys a Dream!`, dn(e.player)));
      eng.on('fx:freedom', (e) => this.hud?.action('🕊️', `${nm(e.player)} escapes the Rat Race!`, dn(e.player)));
      eng.on('pyramid:join', (e) => this.hud?.action('🔺', `${nm(e.player)} joins UpStone Ventures`, dn(e.player)));
      eng.on('fx:jail', (e) => this.hud?.action('🚔', `${nm(e.player)} goes to jail`, dn(e.player)));
      eng.on('trade:done', (e) => this.hud?.action('🤝', `Trade sealed: ${this.engine.s.players[e.offer.from]?.name} ⇄ ${this.engine.s.players[e.offer.to]?.name}`));
      eng.on('stockShift', (e) => { if (this.mode !== 'menu') M.showMarketReport(this, e); });
    }
    eng.on('win', (e) => {
      this.music.play('victory'); // victory always plays
      if (!demo) { this.clearSave(); setTimeout(() => M.showWin(this, e), 1800); }
    });
    if (demo) {
      eng.on('fx:bankrupt', () => { });
      eng.on('win', () => { setTimeout(() => this.startDemo(), 9000); });
    }
    // music intensity follows the leader gap
    eng.on('roundEnd', () => {
      const s = eng.s;
      let rich = 0, poor = 1e18;
      for (const p of s.players) {
        if (p.bankrupt) continue;
        const w = p.cash + Object.values(p.stocks).reduce((a, b) => a + b, 0) * 50;
        rich = Math.max(rich, w); poor = Math.min(poor, w);
      }
      const gap = poor === 0 ? 1 : Math.min(1, Math.max(0, (rich - poor) / (rich + 1)));
      this.music.setIntensity(0.35 + gap * 0.5);
      if ((this.settings.musicMode || 'auto') === 'auto') {
        if (s.flags.pyramid && s.pyramid.open && s.pyramid.hype > 60 && this.mode !== 'menu') this.music.play('pyramid');
        else if (this.mode !== 'menu' && this.music.themeName !== 'board' && this.music.themeName !== 'victory') this.music.play('board');
      }
    });
  }

  isRemoteSeat(seatIdx) {
    if (this.mode === 'net-host') {
      // seat is remote if the net seat mapping says a peer owns it
      return this.netSeatMap?.[seatIdx] === 'peer';
    }
    if (this.mode === 'net-peer') return seatIdx !== this.myNetSeat && this.engine.s.players[seatIdx]?.isAI === false && seatIdx !== this.localHotseatSeat();
    return false;
  }
  localHotseatSeat() { return -1; }

  onPrompt(e, demo) {
    const s = this.engine.s;
    this.hud?.render();
    this.coach?.onPrompt();
    if (!demo && (this.mode === 'play')) this.autosave();
    if (demo) {
      this.thinkTimer = setTimeout(() => {
        if (this.engine?.s.pending && !this.engine.s.gameOver) this.brains[e.player]?.respond();
      }, 420);
      return;
    }
    const p = s.players[e.player];
    if (this.mode === 'net-peer') {
      // authoritative actions stream in from the host; only our own seat is interactive
      if (!p.isAI && e.player === this.myNetSeat) this.showPeerPrompt(e);
      return;
    }
    if (p.isAI) {
      this.scheduleAI(e.player);
      return;
    }
    // human prompt: clear any lingering AI think timer — the game waits for you
    clearTimeout(this.thinkTimer);
    if (this.isRemoteSeat(e.player)) {
      if (this.mode === 'net-host') {
        this.net.send({ t: 'prompt', kind: e.kind, player: e.player });
        // deadlock guard: if no choice in 75s, take a safe default
        clearTimeout(this.remoteGuard);
        this.remoteGuard = setTimeout(() => {
          if (this.engine.s.pending?.player === e.player) this.applyAction({ choice: safeChoice(this.engine.s.pending.kind, this.engine.s.pending) });
        }, 75000);
      }
      return; // peer draws its own UI from its mirror
    }
    // local human — nothing decision-related may appear until the piece has landed
    const showNow = () => {
      this.hud.banner(`${p.name}, you're up!`, promptHint(e.kind), p.color, 1600);
      // first time meeting a system: pop the how-it-works card first
      M.maybeShowTutorial(this, M.tutorialKeyFor(e), () => this.showPromptModal(e));
    };
    if (e.kind === 'roll' || e.kind === 'end') {
      // action bar is live immediately; no banner spam on every roll
      this.hud.render();
    } else if (this.renderer.queue.length > 0 || this.renderer.processing) this.renderer.whenIdle(showNow);
    else showNow();
  }

  scheduleAI(seat) {
    clearTimeout(this.thinkTimer);
    const engine = this.engine;
    // one "think" can leave the same seat pending — e.g. it answered a trade offer
    // mid-turn, or doubled for another roll — so keep thinking until the seat is done
    const think = () => {
      const s = this.engine?.s;
      if (!s || s.gameOver || this.engine !== engine) return;
      if (s.pending && s.pending.player === seat) {
        try { this.brains[seat].respond(); } catch (err) { console.error('AI error', err); s.players[seat] && this.safeDefault(seat); }
        if (this.engine === engine && s.pending && s.pending.player === seat && !s.gameOver) {
          this.thinkTimer = setTimeout(think, 450);
          return;
        }
      }
    };
    this.thinkTimer = setTimeout(think, this.mode === 'tutorial' ? Math.min(700, this.aiDelay()) : this.aiDelay());
  }
  safeDefault(seat) {
    const pend = this.engine.s.pending;
    if (!pend || pend.player !== seat) return;
    this.applyAction({ choice: safeChoice(pend.kind, pend) });
  }

  engineCanManage() {
    const s = this.engine.s;
    const pend = s.pending;
    return pend && ['roll', 'exchange', 'debt', 'gateway'].includes(pend.kind) && pend.player === s.turn && !this.isRemoteSeat(s.turn);
  }

  // ---------- human inputs ----------
  humanAct(action, payload = {}) {
    this.click();
    if (this.mode === 'net-peer') { this.net.sendChoice(this.myNetSeat, { act: { action, payload } }); return; }
    this.applyAction({ action, payload });
  }
  humanChoose(choice) {
    if (this.mode === 'net-peer') { this.net.sendChoice(this.myNetSeat, { choice }); return; }
    this.applyAction({ choice });
  }
  applyAction(msg) {
    // single funnel: local apply (+ broadcast for host / nothing for peer here)
    const { action, payload, choice } = msg;
    const ok = action ? this.engine.do(action, payload ?? {}) : (this.engine.choose(choice), true);
    if (this.mode === 'net-host' && this.net) {
      this.net.broadcastAct(action ? { action, payload } : { choice });
    }
    if (this.coach) this.coach.onPrompt();
    this.hud?.render();
    return ok;
  }
  // the panel/popup for a given pending prompt (shared by onPrompt and resume)
  showPromptModal(e) {
    switch (e.kind) {
      case 'buy': M.showDeed(this, e.tile, { buyPrice: e.price, noAuction: e.noAuction }); break;
      case 'gateway': M.showGateway(this, e); break;
      case 'auction': M.showAuction(this, e); break;
      case 'jail': M.showJail(this, e); break;
      case 'deal': M.showDealChoice(this, e); break;
      case 'casino': M.showCasino(this); break;
      case 'pitch': M.showPyramid(this); break;
      case 'recruit': M.showRecruit(this, e); break;
      case 'exchange': M.showExchangeHub(this); break;
      case 'select': M.showSelect(this, e); break;
      case 'debt': M.showDebt(this, e); break;
      case 'trade': M.showTradeRespond(this); break;
      case 'skip': M.showSkipNotice(this); break;
      default: break;
    }
  }
  // the player dismissed a decision popup — bring it back on demand
  reopenPending() {
    const pend = this.engine && this.engine.s.pending;
    if (!pend) return;
    this.click();
    this.showPromptModal({ kind: pend.kind, player: pend.player, ...pend });
  }

  openPanel(name) {
    const pend = this.engine.s.pending;
    if (!this.engineCanManage()) { this.hud.toast('Not right now — finish the current action first.'); return; }
    switch (name) {
      case 'manage': {
        M.showPortfolio(this);
        break;
      }
      case 'stocks': M.showStocks(this); break;
      case 'market': M.showMarket(this); break;
      case 'trade': M.showTradeBuilder(this); break;
      case 'items': M.showItems(this); break;
      case 'pyramid': M.showPyramid(this); break;
      case 'bank': M.showBank(this); break;
    }
  }

  // ---------- tutorial ----------
  startTutorial() {
    hideMainMenu();
    const rs = RULESETS.find(r => r.id === 'insane');
    const flags = { ...rs.flags, chaos: 0.7, speedDie: false, finiteBuildings: false };
    this.startGame({
      rulesetId: 'insane',
      flags,
      players: [
        { name: 'You', token: 'hat', isAI: false, difficulty: 'standard', professionId: PROFESSIONS[1].id },
        { name: 'Banker Bess', token: 'crown', isAI: true, difficulty: 'newbie', professionId: PROFESSIONS[0].id },
      ],
    }, { tutorial: true });
  }

  // ---------- net ----------
  netHost(name, status) {
    const url = `ws://${location.hostname}:3888`;
    try {
      this.net = new NetLayer(url);
    } catch (e) { status('Could not connect — is <code>node server/server.mjs</code> running?'); return; }
    this.net.onOpen = () => this.net.host(name);
    this.net.onMessage = (msg) => {
      if (msg.t === 'hosted') {
        this.myNetSeat = 0;
        this.net.code = msg.code;
        status(`Room <b style="color:var(--gold);font-size:20px;letter-spacing:6px">${msg.code}</b> — share this code. Waiting for players…<br><button class="btn gold" id="net-start" style="margin-top:10px">Start Match ▶</button>`);
        setTimeout(() => {
          $('#net-start')?.addEventListener('click', () => this.netStartMatch());
        }, 50);
      } else if (msg.t === 'room') {
        this.netSeats = msg.seats;
      } else if (msg.t === 'peerChoose') {
        // apply the peer's decision through the authority
        const pend = this.engine?.s.pending;
        if (pend && pend.player === msg.seat) {
          clearTimeout(this.remoteGuard);
          if (msg.payload?.act) this.applyAction({ action: msg.payload.act.action, payload: msg.payload.act.payload });
          else this.applyAction({ choice: msg.payload?.choice });
        }
      } else if (msg.t === 'error') {
        status('⚠️ ' + msg.msg);
      }
    };
  }
  netJoin(name, code, status) {
    const url = `ws://${location.hostname}:3888`;
    this.net = new NetLayer(url);
    this.net.onOpen = () => this.net.join(name, code);
    this.net.onMessage = (msg) => {
      if (msg.t === 'joined') {
        this.myNetSeat = msg.seat;
        status(`Joined room <b style="color:var(--gold)">${msg.code}</b> as seat ${msg.seat}. Waiting for the host to start…`);
      } else if (msg.t === 'start') {
        this.netStartAsPeer(msg.seed, msg.cfg);
      } else if (msg.t === 'act') {
        this.mirrorApply(msg);
      } else if (msg.t === 'prompt') {
        // host explicitly prompts our seat (we also get mirror prompts; ignore dupes)
        const pend = this.engine?.s.pending;
        if (pend && pend.player === this.myNetSeat) this.showPeerPrompt(pend);
      } else if (msg.t === 'error') {
        status('⚠️ ' + msg.msg);
      }
    };
  }
  netStartMatch() {
    if (!this.lastCfg) {
      // default match config from current setup defaults
      const seats = this.netSeats || [];
      const players = seats.map((s, i) => ({
        name: s.name, token: ['hat', 'car', 'dog', 'cat', 'ship', 'boot', 'rocket', 'crown'][i % 8],
        isAI: !s.host && false || false, difficulty: 'standard', professionId: PROFESSIONS[i % 8].id,
      }));
      this.lastCfg = { rulesetId: 'insane', flags: { ...RULESETS.find(r => r.id === 'insane').flags }, players };
    }
    // map: seats without a connected human become bots
    const cfg = JSON.parse(JSON.stringify(this.lastCfg));
    const seats = this.netSeats || [];
    this.netSeatMap = [];
    cfg.players.forEach((p, i) => {
      const seatInfo = seats[i];
      if (seatInfo && (seatInfo.host || !seatInfo.host)) {
        p.isAI = false;
        p.name = seatInfo.name;
        this.netSeatMap[i] = seatInfo.host ? 'host-local' : 'peer';
      } else {
        p.isAI = true;
        this.netSeatMap[i] = 'ai';
      }
    });
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.net.startGame(seed, cfg);
    this.startGame(cfg, { mode: 'net-host', seed });
    M.closeModal();
  }
  netStartAsPeer(seed, cfg) {
    this.netSeatMap = null;
    this.startGame(cfg, { mode: 'net-peer', seed });
    M.closeModal();
    this.hud?.toast(`Connected as seat ${this.myNetSeat} — ${this.engine.s.players[this.myNetSeat]?.name}`);
  }
  mirrorApply(msg) {
    // peers apply the host's authoritative actions to their mirror engine
    if (!this.engine) return;
    if (msg.action) this.engine.do(msg.action, msg.payload ?? {});
    else if (msg.choice !== undefined) this.engine.choose(msg.choice);
  }
  showPeerPrompt(pend) {
    if (pend.player !== this.myNetSeat) return;
    const p = this.engine.s.players[this.myNetSeat];
    this.hud.banner('Your move!', promptHint(pend.kind), p.color, 1600);
    switch (pend.kind) {
      case 'buy': M.showDeed(this, pend.tile, { buyPrice: pend.price, noAuction: pend.noAuction }); break;
      case 'gateway': M.showGateway(this, pend); break;
      case 'auction': M.showAuction(this, pend); break;
      case 'jail': M.showJail(this, pend); break;
      case 'deal': M.showDealChoice(this, pend); break;
      case 'casino': M.showCasino(this); break;
      case 'pitch': M.showPyramid(this); break;
      case 'recruit': M.showRecruit(this, pend); break;
      case 'exchange': M.showExchangeHub(this); break;
      case 'select': M.showSelect(this, pend); break;
      case 'debt': M.showDebt(this, pend); break;
      case 'trade': M.showTradeRespond(this); break;
      case 'skip': M.showSkipNotice(this); break;
      default: break;
    }
  }
}

function promptHint(kind) {
  return {
    roll: 'Manage, then roll the dice',
    buy: 'Buy or auction?',
    gateway: 'Use this space — own it for better rates',
    auction: 'The gavel is falling',
    jail: 'Pay, card, or roll?',
    deal: 'Small deal or big deal?',
    casino: 'Feeling lucky?',
    pitch: 'The pyramid awaits',
    recruit: 'You\'ve been pitched',
    exchange: 'Ring the bell when done',
    debt: 'Raise cash — fast',
    trade: 'A trade offer!',
    select: 'Make your choice',
    skip: 'Taking five',
  }[kind] || '';
}
function safeChoice(kind, pend = {}) {
  switch (kind) {
    case 'buy': return 'decline';
    case 'gateway': return pend.unowned ? 'pass' : { type: 'continue' };
    case 'auction': return { type: 'pass' };
    case 'jail': return 'roll';
    case 'deal': return null;
    case 'casino': return 'leave';
    case 'pitch': return null;
    case 'recruit': return 'decline';
    case 'exchange': return { type: 'continue' };
    case 'select': return {};
    case 'debt': return 'pay';
    case 'trade': return 'decline';
    case 'skip': case 'end': return {};
    default: return {};
  }
}

window.DRIVER = new Driver();
// once web fonts finish loading, rebuild the board once so deed names render in Baloo
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    const d = window.DRIVER;
    if (d && d.mode === 'menu') d.startDemo();
  });
}
