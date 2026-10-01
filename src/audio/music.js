// TYCOON MAYHEM audio engine — AAA-grade procedural score + SFX bus.
// Master chain: compressor -> limiter; music bus w/ sidechain duck + reverb + echo sends.
const NOTE = (semi) => 440 * Math.pow(2, (semi - 9) / 12); // semi 0 = C4

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export const THEMES = {
  menu:     { bpm: 96,  root: 0,  scale: MAJOR, prog: [0, 3, 4, 3],         bass: 'island', drums: 'island',   pad: true,  arp: true,  lead: false, stab: false, vibe: 'tropical', swing: 0.04 },
  board:    { bpm: 118, root: 2,  scale: MAJOR, prog: [0, 3, 4, 0],         bass: 'salsa',  drums: 'carnival', pad: true,  arp: true,  lead: true,  stab: true,  vibe: 'tropical', swing: 0 },
  boardNight:{ bpm: 88, root: -3, scale: MAJOR, prog: [0, 5, 3, 4],         bass: 'island', drums: 'island',   pad: true,  arp: true,  lead: false, stab: false, vibe: 'tropical', swing: 0.06 },
  tension:  { bpm: 132, root: -4, scale: MINOR, prog: [0, 1, 0, 1],         bass: 'pulse',  drums: 'hard',     pad: false, arp: true,  lead: true,  stab: true,  vibe: 'tense',    swing: 0 },
  rally:    { bpm: 128, root: 2,  scale: MAJOR, prog: [0, 4, 5, 3],         bass: 'salsa',  drums: 'carnival', pad: true,  arp: true,  lead: true,  stab: true,  vibe: 'tropical', swing: 0 },
  pyramid:  { bpm: 100, root: -6, scale: MINOR, prog: [0, 0, 5, 5],         bass: 'pulse',  drums: 'tribal',   pad: true,  arp: false, lead: true,  stab: false, vibe: 'hypnotic', swing: 0 },
  casino:   { bpm: 114, root: -1, scale: MAJOR, prog: [0, 3, 4, 3],         bass: 'salsa',  drums: 'salsa',    pad: true,  arp: true,  lead: false, stab: true,  vibe: 'tropical', swing: 0.03 },
  danger:   { bpm: 140, root: -3, scale: MINOR, prog: [0, 6, 5, 6],         bass: 'pulse',  drums: 'hard',     pad: false, arp: true,  lead: true,  stab: false, vibe: 'alarm',    swing: 0 },
  victory:  { bpm: 124, root: 0,  scale: MAJOR, prog: [0, 3, 4, 0],         bass: 'salsa',  drums: 'carnival', pad: true,  arp: true,  lead: true,  stab: true,  vibe: 'tropical', swing: 0 },
  defeat:   { bpm: 76,  root: -10, scale: MINOR, prog: [0, 5, 6, 4],        bass: 'walk',   drums: 'soft',     pad: true,  arp: false, lead: false, stab: false, vibe: 'sad',      swing: 0.05 },
};

// ---- real recorded soundtrack (royalty-free; Kevin MacLeod, CC BY 4.0 --
// see assets/music/CREDITS.md). Themes without a file keep the synth engine. ----
const REAL_TRACKS = {
  menu: 'assets/music/menu.mp3',      // "Moonlight Beach"
  board: 'assets/music/board.mp3',    // "Island Meet and Greet"
  casino: 'assets/music/casino.mp3',  // "No Frills Salsa"
  victory: 'assets/music/victory.mp3',// "Beachfront Celebration"
  defeat: 'assets/music/defeat.mp3',  // "BossaBossa"
};
const TRACK_GAIN = { menu: 0.6, board: 0.62, casino: 0.58, victory: 0.62, defeat: 0.5 };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.theme = null;      // resolved THEMES entry (object)
    this.themeName = null;  // what callers compare against
    this.nextTheme = null;
    this.intensity = 0.5;
    this.muted = false;
    this.vol = { master: 0.9, music: 0.6, sfx: 0.9 };
    this.bar = 0;
    this.nextBarTime = 0;
    this.timer = null;
    this.noiseCache = null;
    this.trackA = null; this.trackB = null; // HTMLAudio crossfade pair
    this.trackName = null;
  }
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
    this.master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music;
    this.musicDuck = ctx.createGain(); this.musicDuck.gain.value = 1;
    this.musicComp = ctx.createDynamicsCompressor();
    this.musicComp.threshold.value = -20; this.musicComp.knee.value = 18; this.musicComp.ratio.value = 4;
    this.musicBus.connect(this.musicDuck); this.musicDuck.connect(this.musicComp); this.musicComp.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx;
    this.sfxBus.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeImpulse(2.2, 2.6);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.32;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.verbSendMusic = ctx.createGain(); this.verbSendMusic.gain.value = 0.5;
    this.verbSendMusic.connect(this.verb);
    this.verbSendSfx = ctx.createGain(); this.verbSendSfx.gain.value = 0.32;
    this.verbSendSfx.connect(this.verb);
    this.delay = ctx.createDelay(1.2); this.delay.delayTime.value = 0.31;
    this.delayFb = ctx.createGain(); this.delayFb.gain.value = 0.3;
    this.delayWet = ctx.createGain(); this.delayWet.gain.value = 0.2;
    this.musicBus.connect(this.delay); this.delay.connect(this.delayFb); this.delayFb.connect(this.delay);
    this.delay.connect(this.delayWet); this.delayWet.connect(this.musicComp);
    return this.ctx;
  }
  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  resume() {
    this.ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.trackName && !this.muted) {
      const el = this.grabAudioEl(this.trackName);
      if (el.paused) el.play().then(() => this.audioFade(el, this.trackVol(), 0.6)).catch(() => { });
    }
  }
  setVolumes(v = {}) {
    Object.assign(this.vol, v);
    this.ensure();
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, this.ctx.currentTime, 0.05);
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.vol.music, this.ctx.currentTime, 0.05);
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.vol.sfx, this.ctx.currentTime, 0.05);
    const el = this.trackA && !this.trackA.paused ? this.trackA : (this.trackB && !this.trackB.paused ? this.trackB : null);
    if (el) this.audioFade(el, this.trackVol(), 0.2);
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol.master, this.ctx.currentTime, 0.05);
    if (m) this.stopTracks(0.3);
    else if (this.trackName) {
      const el = this.grabAudioEl(this.trackName);
      if (el.paused) el.play().then(() => this.audioFade(el, this.trackVol(), 0.6)).catch(() => { });
      else this.audioFade(el, this.trackVol(), 0.3);
    }
  }
  setIntensity(x) { this.intensity = Math.max(0, Math.min(1, x)); }
  sfxBusNode() { this.ensure(); return this.sfxBus; }
  sfxVerb() { this.ensure(); return this.verbSendSfx; }
  musicVerb() { this.ensure(); return this.verbSendMusic; }

  play(name) {
    if (REAL_TRACKS[name]) { this.playTrack(name); return; }
    this.stopTracks(0.6); // synth-only theme: fade any record out
    if (!THEMES[name]) return;
    this.ensure(); this.resume();
    if (this.themeName === name && this.timer) return;
    this.nextTheme = name;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 60);
    if (!this.theme) { this.themeName = name; this.theme = THEMES[name] || null; this.nextTheme = null; this.bar = 0; this.nextBarTime = this.ctx.currentTime + 0.06; }
  }
  // ---- recorded-track crossfader ----
  trackVol() {
    if (this.muted) return 0;
    const v = (this.vol.master ?? 0.9) * (this.vol.music ?? 0.6) * (TRACK_GAIN[this.trackName] ?? 0.6);
    return Math.max(0, Math.min(1, v));
  }
  grabAudioEl(name) {
    if (!this.trackA) this.trackA = new Audio();
    if (!this.trackB) this.trackB = new Audio();
    const wants = REAL_TRACKS[name];
    if (this.trackA.src && this.trackA.src.endsWith(wants)) return this.trackA;
    if (this.trackB.src && this.trackB.src.endsWith(wants)) return this.trackB;
    return !this.trackA.paused ? this.trackB : this.trackA;
  }
  audioFade(el, to, dur, done) {
    const from = el.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
      try { el.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch (e) { return; }
      if (k < 1) requestAnimationFrame(step); else done && done();
    };
    step();
  }
  playTrack(name) {
    if (this.trackName === name && !this.muted) return; // already the live record
    this.ensure(); this.resume();
    const el = this.grabAudioEl(name);
    el.src = REAL_TRACKS[name];
    el.loop = true;
    el.volume = 0;
    this.themeName = name;
    this.theme = null; this.nextTheme = null;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.trackName = name;
    const fail = () => { // file missing or blocked -> synth fallback
      if (this.trackName === name && el.paused) {
        this.trackName = null;
        if (THEMES[name]) { this.nextTheme = name; if (!this.timer) this.timer = setInterval(() => this.tick(), 60); }
      }
    };
    el.addEventListener('error', fail, { once: true });
    el.play().then(() => this.audioFade(el, this.trackVol(), 1.4)).catch(fail);
    const outgoing = el === this.trackA ? this.trackB : this.trackA;
    if (outgoing && !outgoing.paused) this.audioFade(outgoing, 0, 1.1, () => { try { outgoing.pause(); } catch (e) { } });
  }
  stopTracks(dur = 0.4) {
    this.trackName = null;
    for (const el of [this.trackA, this.trackB]) {
      if (el && !el.paused) this.audioFade(el, 0, dur, () => { try { el.pause(); } catch (e) { } });
    }
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.theme = null; this.themeName = null; this.nextTheme = null;
    this.stopTracks(0.3);
  }
  tick() {
    // nextTheme is a NAME string; resolve it to the THEMES object before scheduling —
    // scheduling off the raw string is what crashed chordAt (string has no .prog)
    if (!this.theme && this.nextTheme) { this.themeName = this.nextTheme; this.theme = THEMES[this.nextTheme] || null; this.nextTheme = null; this.bar = 0; this.nextBarTime = this.ctx.currentTime + 0.06; }
    if (!this.theme) return;
    const spb = 60 / this.theme.bpm;
    const barLen = spb * 4;
    while (this.nextBarTime < this.ctx.currentTime + 0.25) {
      this.scheduleBar(this.nextBarTime, spb);
      this.nextBarTime += barLen;
      this.bar++;
      if (this.nextTheme && this.bar % 4 === 0) { this.themeName = this.nextTheme; this.theme = THEMES[this.nextTheme] || this.theme; this.nextTheme = null; this.bar = 0; }
    }
  }
  chordAt(bar) {
    const deg = this.theme.prog[bar % this.theme.prog.length];
    const s = this.theme.scale;
    const rootSemi = this.theme.root + s[deg % 7] + 12 * Math.floor(deg / 7);
    const third = rootSemi + s[(deg + 2) % 7] + (deg + 2 >= 7 ? 12 : 0);
    const fifth = rootSemi + s[(deg + 4) % 7] + (deg + 4 >= 7 ? 12 : 0);
    const seventh = rootSemi + s[(deg + 6) % 7] + (deg + 6 >= 7 ? 12 : 0);
    return [rootSemi, third, fifth, seventh];
  }
  scheduleBar(t0, spb) {
    const th = this.theme, inten = this.intensity;
    const chord = this.chordAt(this.bar);
    const sectionB = (this.bar % 16) >= 8;
    if (th.pad) for (let i = 0; i < chord.length; i++) this.pad(t0 + i * 0.02, spb * 4, NOTE(chord[i] + 12), 0.045 + inten * 0.028);
    if (th.stab && inten > 0.4) {
      this.stab(t0 + spb * 1.5, chord, 0.06 + inten * 0.04);
      if (sectionB) this.stab(t0 + spb * 3.5, chord, 0.05 + inten * 0.04);
    }
    for (const [beat, dur, deg] of this.bassPattern(th.bass)) {
      this.bassNote(t0 + beat * spb, dur * spb * 0.9, NOTE(chord[0] + (deg || 0) - 12), 0.2);
    }
    this.drums(t0, spb, th.drums, inten);
    const tropical = th.vibe === 'tropical';
    if (th.arp && inten > 0.25) {
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 1 && inten < 0.55) continue;
        const deg = chord[i % 3] + (i >= 3 ? 12 : 0) + 12;
        if (tropical) this.steelPan(t0 + i * spb / 2, NOTE(deg), 0.055 + inten * 0.05, i % 2 === 0 ? -0.35 : 0.35);
        else this.pluck(t0 + i * spb / 2, NOTE(deg), 0.05 + inten * 0.05, i % 2 === 0 ? -0.35 : 0.35);
      }
    }
    if (tropical && this.bar % 4 === 3) {
      // end-of-phrase conga fill + a steel-pan answer
      this.conga(t0 + spb * 3.5, 200, 0.26); this.conga(t0 + spb * 3.75, 250, 0.3); this.conga(t0 + spb * 3.9, 300, 0.24);
      if (inten > 0.4) this.steelPan(t0 + spb * 3.5, NOTE(chord[2] + 24), 0.06, 0.2);
    }
    if (th.lead && inten > 0.45) {
      for (const [beat, dur, degOff] of this.leadMotif(this.bar)) {
        this.lead(t0 + beat * spb, dur * spb, NOTE(chord[0] + degOff + 12), 0.085 + inten * 0.05);
      }
    }
    if (this.bar % 8 === 7) {
      for (let i = 0; i < 4; i++) this.snare(t0 + spb * 3.5 + i * (spb / 8), 0.16 + i * 0.06);
    }
  }
  bassPattern(kind) {
    switch (kind) {
      case 'walk': return [[0, 0.5, 0], [1, 0.5, 7], [2, 0.5, 0], [3, 0.5, 5]];
      case 'funk': return [[0, 0.25, 0], [0.75, 0.25, 12], [1.5, 0.25, 0], [2, 0.5, 7], [3, 0.25, 10], [3.5, 0.25, 7]];
      case 'pulse': return [[0, 0.25, 0], [0.5, 0.25, 0], [1, 0.25, 0], [1.5, 0.25, 0], [2, 0.25, 0], [2.5, 0.25, 0], [3, 0.25, 0], [3.5, 0.25, 0]];
      // island bounce: lazy root-fifth with an upbeat push
      case 'island': return [[0, 0.75, 0], [1.5, 0.5, 7], [2.5, 0.5, 0], [3.25, 0.5, 5]];
      // salsa tresillo (3-3-2) - the engine of the whole latin groove
      case 'salsa': return [[0, 0.5, 0], [1.5, 0.5, 0], [3, 0.75, 7], [3.75, 0.25, 5]];
      default: return [[0, 1, 0], [2, 1, 0]];
    }
  }
  leadMotif(bar) {
    const s = this.theme.scale;
    const shapes = [
      [[0, 0.5, 0], [1, 0.5, 4], [2, 1, 2]],
      [[0, 0.25, 7], [0.5, 0.25, 4], [1, 1, 2], [3, 0.5, 0]],
      [[0, 1, 4], [2, 0.5, 2], [3, 0.5, 0]],
      [[0, 0.5, 9], [1, 0.5, 7], [2, 0.5, 4], [3, 0.5, 2]],
    ];
    const shape = shapes[(bar + this.theme.root + 12) % shapes.length];
    return shape.map(([b, d, deg]) => [b, d, s[deg % 7] + 12 * Math.floor(deg / 7)]);
  }
  drums(t0, spb, style, inten) {
    const b = t0, q = spb / 2;
    if (style === 'soft') {
      this.kick(b, 0.5); this.kick(b + spb * 2, 0.4);
      for (let i = 0; i < 4; i++) this.hat(b + i * q * 2 + q, 0.05);
    } else if (style === 'hard') {
      for (let i = 0; i < 8; i++) { this.kick(b + i * q, i % 2 === 0 ? 0.9 : 0.5); this.hat(b + i * q + q / 2, 0.09 + inten * 0.05); if (i % 4 === 2) this.snare(b + i * q, 0.5); }
    } else if (style === 'tribal') {
      this.kick(b, 0.9); this.kick(b + 1.5 * spb, 0.7); this.kick(b + 2.5 * spb, 0.7); this.kick(b + 3.25 * spb, 0.5);
      for (let i = 0; i < 8; i++) this.hat(b + i * q, i % 2 ? 0.04 : 0.09);
    } else if (style === 'island') {
      // laid-back one-drop: kick on 1, skanking off-beat hats, conga conversation
      this.kick(b, 0.7);
      this.conga(b + spb * 1.5, 210, 0.32); this.conga(b + spb * 1.75, 260, 0.24);
      this.conga(b + spb * 3.25, 190, 0.3);
      for (let i = 0; i < 8; i++) this.hat(b + i * q + q / 2, i % 2 ? 0.07 : 0.035);
      this.shaker(b, 0.16); this.shaker(b + spb * 2, 0.14);
    } else if (style === 'salsa') {
      // 3-2 clave with congas + cascade shaker - the classic latin engine
      for (const [pos, tone] of [[0, 1], [1.5, 0], [3, 0], [6, 0], [7, 1]]) this.clave(b + pos * q, tone ? 0.34 : 0.26);
      this.kick(b, 0.8); this.kick(b + spb * 3, 0.55);
      this.conga(b + spb * 0.75, 250, 0.26); this.conga(b + spb * 2, 200, 0.34);
      this.conga(b + spb * 2.5, 250, 0.26); this.conga(b + spb * 3.5, 200, 0.3);
      for (let i = 0; i < 8; i++) this.shaker(b + i * q, i % 2 ? 0.1 : 0.15);
    } else if (style === 'carnival') {
      // soca: four-on-the-floor, conga doubles, steady shaker, offbeat open hat
      for (let i = 0; i < 4; i++) this.kick(b + i * spb, i === 0 ? 0.9 : 0.62);
      this.conga(b + spb * 0.5, 240, 0.3); this.conga(b + spb * 0.75, 190, 0.24);
      this.conga(b + spb * 2.5, 240, 0.3); this.conga(b + spb * 3.25, 190, 0.26);
      for (let i = 0; i < 8; i++) this.shaker(b + i * q, i % 2 ? 0.12 : 0.17);
      this.hat(b + q, 0.14 + inten * 0.05); this.hat(b + 3 * q, 0.14 + inten * 0.05);
      this.hat(b + 5 * q, 0.12 + inten * 0.05); this.hat(b + 7 * q, 0.12 + inten * 0.05);
      if (inten > 0.55) this.snare(b + spb * 3 + q * 1.5, 0.3);
    } else {
      this.kick(b, 0.85); this.kick(b + 2.5 * q * 2, 0.6); this.kick(b + 4.5 * q, 0.5);
      this.snare(b + q * 2, 0.6); this.snare(b + 6 * q, 0.4);
      for (let i = 0; i < 8; i++) this.hat(b + i * q, i % 2 ? 0.05 : 0.1 + inten * 0.04);
      this.hat(b + 3.5 * q, 0.12 + inten * 0.04);
    }
  }
  env(node, t, a, d, s, r, peak, dest) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    node.connect(g);
    g.connect(dest || this.musicDuck);
    return g;
  }
  pad(t, dur, freq, vol) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + this.intensity * 600; f.Q.value = 0.5;
    for (const det of [-7, 0, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = freq; o.detune.value = det;
      o.connect(f);
      o.start(t); o.stop(t + dur + 1.2);
    }
    const g = this.env(f, t, 0.6, 0.5, 0.75, dur, vol);
    g.connect(this.verbSendMusic);
  }
  bassNote(t, dur, freq, vol) {
    const ctx = this.ctx;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = freq;
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = freq * 1.005;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(Math.min(8000, freq * 8), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 2.5), t + Math.min(0.25, dur));
    const gs = ctx.createGain(); gs.gain.value = 0.6; sub.connect(gs); gs.connect(f);
    saw.connect(f);
    const g = this.env(f, t, 0.01, 0.1, 0.6, dur, vol);
    g.connect(this.musicBus);
    sub.start(t); saw.start(t); sub.stop(t + dur + 0.3); saw.stop(t + dur + 0.3);
  }
  pluck(t, freq, vol, pan = 0) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 2.001;
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2);
    const mix = ctx.createGain(); o.connect(mix); g2.connect(mix);
    const g = this.env(mix, t, 0.005, 0.08, 0.2, 0.3, vol);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.musicBus); g.connect(this.verbSendMusic); }
    else { g.connect(this.musicBus); }
    o.start(t); o2.start(t); o.stop(t + 0.5); o2.stop(t + 0.5);
  }
  stab(t, chord, vol) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    for (const semi of chord) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = NOTE(semi + 12); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + 0.3);
      }
    }
    const g = this.env(f, t, 0.004, 0.12, 0.2, 0.18, vol);
    g.connect(this.musicBus);
  }
  lead(t, dur, freq, vol) {
    if (this.theme.vibe === 'tropical') { this.steelPan(t, freq, vol * 1.1, 0.15); return; }
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = this.theme.vibe === 'hypnotic' ? 'sawtooth' : 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    o.frequency.setValueAtTime(freq, t);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
    const vg = ctx.createGain(); vg.gain.value = freq * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    o.connect(f);
    const g = this.env(f, t, 0.02, 0.15, 0.7, dur, vol);
    g.connect(this.musicBus); g.connect(this.verbSendMusic);
    vib.start(t); o.start(t); o.stop(t + dur + 0.4); vib.stop(t + dur + 0.4);
  }
  noiseBuf() {
    if (this.noiseCache) return this.noiseCache;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseCache = buf;
    return buf;
  }
  kick(t, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = this.env(o, t, 0.002, 0.1, 0.3, 0.16, vol * 0.55);
    g.connect(this.musicBus);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.12, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    src.connect(f); f.connect(ng); ng.connect(this.musicBus);
    src.start(t); src.stop(t + 0.05);
    const duck = this.musicDuck.gain;
    duck.cancelScheduledValues(t);
    duck.setValueAtTime(0.55, t);
    duck.linearRampToValueAtTime(1, t + 0.16);
  }
  snare(t, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = this.env(f, t, 0.001, 0.09, 0.25, 0.12, vol * 0.35);
    g.connect(this.musicBus); g.connect(this.verbSendMusic);
    src.start(t); src.stop(t + 0.3);
    const tone = ctx.createOscillator(); tone.type = 'triangle'; tone.frequency.value = 185;
    const tg = this.env(tone, t, 0.001, 0.06, 0.2, 0.08, vol * 0.22);
    tg.connect(this.musicBus);
    tone.start(t); tone.stop(t + 0.2);
  }
  hat(t, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    src.connect(f);
    const g = this.env(f, t, 0.001, 0.03, 0.15, 0.04, vol * 0.28);
    g.connect(this.musicBus);
    src.start(t); src.stop(t + 0.12);
  }
  // pitched hand-drum thump - the congas carry the tropical grooves
  conga(t, freq, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.045);
    const g = this.env(o, t, 0.001, 0.05, 0.25, 0.14, vol * 0.5);
    g.connect(this.musicBus); g.connect(this.verbSendMusic);
    o.start(t); o.stop(t + 0.3);
    const click = ctx.createBufferSource(); click.buffer = this.noiseBuf();
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = freq * 8; cf.Q.value = 1.2;
    const cg = this.env(click, t, 0.001, 0.015, 0.1, 0.02, vol * 0.14);
    click.connect(cf); cf.connect(cg); cg.connect(this.musicBus);
    click.start(t); click.stop(t + 0.06);
  }
  // soft egg-shaker
  shaker(t, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5800; f.Q.value = 0.9;
    const g = this.env(src, t, 0.012, 0.025, 0.1, 0.05, vol * 0.4);
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(t); src.stop(t + 0.14);
  }
  // woodblock - the clave voice
  clave(t, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(2450, t);
    o.frequency.exponentialRampToValueAtTime(1750, t + 0.02);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = 2.5;
    o.connect(f);
    const g = this.env(f, t, 0.001, 0.028, 0.08, 0.05, vol * 0.5);
    g.connect(this.musicBus); g.connect(this.verbSendMusic);
    o.start(t); o.stop(t + 0.15);
  }
  // steel pan: bright sine + inharmonic partials, the tropical lead voice
  steelPan(t, freq, vol, pan = 0) {
    const ctx = this.ctx;
    const mix = ctx.createGain(); mix.gain.value = 1;
    const partials = [[1, 1], [2.76, 0.32], [5.4, 0.12], [1.004, 0.4]];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain(); g.gain.value = amp;
      o.connect(g); g.connect(mix);
      o.start(t); o.stop(t + 0.7);
    }
    const g = this.env(mix, t, 0.003, 0.09, 0.28, 0.42, vol);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.musicBus); g.connect(this.verbSendMusic); }
    else { g.connect(this.musicBus); g.connect(this.verbSendMusic); }
  }
}

// backwards-compatible alias
export { AudioEngine as MusicDirector };
