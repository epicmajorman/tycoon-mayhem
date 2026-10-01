// Synthesized SFX — every sound generated live from oscillators + noise. No assets.
import { MusicDirector } from './music.js?v=8';

export const SFX_NAMES = ['click', 'hover', 'dice', 'hop', 'buy', 'rent', 'card', 'gavel', 'jail', 'alarm',
  'collapse', 'stockUp', 'stockDown', 'coin', 'gain', 'loss', 'seal', 'promote', 'build', 'demolish', 'casino', 'freedom',
  'win', 'lose', 'debt', 'item', 'teleport', 'shock'];

export class Sfx {
  constructor(music) { this.m = music; this.enabled = true; }
  ctx() { return this.m.ensure(); }
  // wet path: a share of each sfx feeds the hall reverb
  sendBus() { return this.m.sfxVerb ? this.m.sfxVerb() : null; }
  play(name, opt = {}) {
    if (!this.enabled) return;
    const ctx = this.ctx();
    if (ctx.state === 'suspended') return;
    const t = ctx.currentTime + 0.01;
    const bus = this.m.sfxBusNode();
    const verb = this.m.sfxVerb ? this.m.sfxVerb() : null;
    const out = (g) => { g.connect(bus); if (verb) { const vs = ctx.createGain(); vs.gain.value = 0.35; g.connect(vs); vs.connect(verb); } };
    const osc = (type, f0, f1, t0, dur, vol, curve = 'exp') => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      if (f1) { if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur); else o.frequency.linearRampToValueAtTime(f1, t0 + dur); }
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); out(g); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    const noise = (t0, dur, vol, type = 'highpass', freq = 4000, q = 0.7) => {
      const src = ctx.createBufferSource(); src.buffer = this.m.noiseBuf();
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); out(g); src.start(t0); src.stop(t0 + dur + 0.05);
    };
    const chord = (semitones, t0, dur, vol, type = 'triangle') => semitones.forEach((s, i) => osc(type, 440 * Math.pow(2, (s - 9) / 12), null, t0 + i * 0.03, dur, vol));
    switch (name) {
      case 'click': osc('square', 900, 500, t, 0.05, 0.08); break;
      case 'hover': osc('sine', 600, 800, t, 0.04, 0.03); break;
      case 'dice':
        for (let i = 0; i < 7; i++) noise(t + i * 0.07 + Math.random() * 0.02, 0.05, 0.12, 'bandpass', 1800 + Math.random() * 2200, 1.4);
        osc('sine', 200, 90, t + 0.5, 0.1, 0.12);
        break;
      case 'hop': osc('sine', 340, 560, t, 0.09, 0.09); break;
      case 'buy':
        chord([0, 4, 7, 12], t, 0.22, 0.09);
        for (let i = 0; i < 4; i++) osc('sine', 900 * Math.pow(1.25, i), null, t + 0.05 + i * 0.045, 0.12, 0.05);
        noise(t, 0.06, 0.04, 'highpass', 6000);
        break;
      case 'rent': osc('triangle', 950, 1500, t, 0.09, 0.11); osc('triangle', 1250, 1900, t + 0.08, 0.11, 0.1); break;
      case 'card': noise(t, 0.16, 0.1, 'bandpass', 900, 0.5); osc('sine', 300, 700, t + 0.05, 0.1, 0.05); break;
      case 'gavel':
        noise(t, 0.05, 0.22, 'lowpass', 900);
        osc('sine', 180, 70, t, 0.12, 0.28);
        osc('sine', 185, 75, t + 0.16, 0.14, 0.24);
        break;
      case 'sold':
        osc('sawtooth', 320, 520, t, 0.16, 0.08);
        chord([0, 4, 7], t + 0.14, 0.3, 0.09);
        noise(t + 0.14, 0.18, 0.06, 'bandpass', 3000, 0.6);
        break;
      case 'jail': osc('square', 220, 160, t, 0.18, 0.12); noise(t, 0.12, 0.12, 'lowpass', 500); break;
      case 'alarm': for (let i = 0; i < 3; i++) osc('square', 880, 660, t + i * 0.18, 0.14, 0.07); break;
      case 'collapse':
        noise(t, 1.6, 0.32, 'lowpass', 260, 0.4);
        osc('sine', 90, 26, t, 1.4, 0.34);
        osc('sawtooth', 300, 40, t, 0.9, 0.1);
        for (let i = 0; i < 7; i++) noise(t + 0.15 + i * 0.14, 0.24, 0.13, 'bandpass', 300 + Math.random() * 1100, 0.6);
        break;
      case 'stockUp': osc('sine', 700, 1050, t, 0.08, 0.08); break;
      case 'stockDown': osc('sine', 700, 460, t, 0.09, 0.08); break;
      case 'coin': chord([12, 16, 19], t, 0.16, 0.07, 'sine'); break;
      // satisfying money moments: a cash-register "ka-ching" + coin cascade for gains,
      // a dull drawer-thud with a paper tear for losses. size scales intensity.
      case 'gain': {
        const big = (opt.size || 1) > 1.4;
        // register bell
        osc('square', 1245, null, t, 0.09, 0.10);
        osc('square', 1865, null, t + 0.075, 0.14, 0.09);
        osc('sine', 2489, null, t + 0.075, 0.2, 0.05);
        // coin cascade: 6-10 staggered pings, pitch climbing
        const n = big ? 10 : 6;
        for (let i = 0; i < n; i++) {
          const p = 900 + i * 105 + Math.random() * 160;
          osc('sine', p, p * 1.06, t + 0.1 + i * 0.045, 0.16, 0.05);
          osc('triangle', p * 2.01, null, t + 0.1 + i * 0.045, 0.08, 0.022);
        }
        // drawer slap
        noise(t, 0.05, 0.10, 'lowpass', 1400);
        osc('sine', 210, 90, t, 0.09, 0.12);
        if (big) chord([0, 4, 7, 12], t + 0.32, 0.3, 0.05, 'sine');
        break;
      }
      case 'loss': {
        const big = (opt.size || 1) > 1.4;
        // cash drawer thud (money leaving)
        osc('sine', 160, 55, t, 0.22, 0.20);
        noise(t, 0.09, 0.14, 'lowpass', 900);
        // paper / bill tear
        noise(t + 0.06, 0.30, 0.05, 'bandpass', 5200, 0.8);
        // descending "womp" — bigger hits sink lower
        osc('sawtooth', big ? 260 : 330, big ? 70 : 120, t + 0.05, big ? 0.5 : 0.3, 0.06);
        if (big) { osc('sine', 90, 38, t + 0.08, 0.5, 0.12); }
        break;
      }
      case 'seal':
        chord([0, 7, 12, 16], t, 0.55, 0.06, 'sine');
        osc('sine', 2093, 2093, t + 0.08, 0.4, 0.035);
        break;
      case 'promote':
        for (let i = 0; i < 5; i++) osc('triangle', 440 * Math.pow(1.26, i), null, t + i * 0.07, 0.28, 0.07);
        osc('sine', 2093, 2600, t + 0.35, 0.4, 0.04);
        break;
      case 'build': noise(t, 0.08, 0.1, 'lowpass', 700); osc('square', 300, 420, t + 0.08, 0.1, 0.07); break;
      case 'demolish': noise(t, 0.4, 0.22, 'lowpass', 420, 0.5); osc('sawtooth', 160, 60, t, 0.3, 0.12); break;
      case 'casino': for (let i = 0; i < 5; i++) osc('square', 500 + i * 130, null, t + i * 0.06, 0.06, 0.05); break;
      case 'freedom': chord([0, 4, 7, 12], t, 0.35, 0.09); chord([7, 12, 16, 19], t + 0.3, 0.5, 0.09); break;
      case 'win':
        [0, 4, 7, 12, 16, 19, 24].forEach((s2, i) => {
          osc('triangle', 440 * Math.pow(2, (s2 - 9) / 12), null, t + i * 0.09, 0.5, 0.1);
          osc('sawtooth', 442 * Math.pow(2, (s2 - 9) / 12), null, t + i * 0.09, 0.35, 0.045);
        });
        chord([12, 16, 19, 24], t + 0.75, 0.7, 0.08);
        break;
      case 'lose': [0, -2, -5, -9].forEach((s, i) => osc('sawtooth', 440 * Math.pow(2, (s - 9) / 12), null, t + i * 0.22, 0.5, 0.07)); break;
      case 'debt': osc('sawtooth', 220, 180, t, 0.25, 0.1); osc('sawtooth', 233, 190, t, 0.25, 0.1); break;
      case 'item': osc('sine', 800, 1600, t, 0.2, 0.08); noise(t + 0.1, 0.1, 0.05, 'highpass', 7000); break;
      case 'teleport': osc('sine', 200, 2000, t, 0.35, 0.09); noise(t, 0.3, 0.06, 'bandpass', 2400, 2); break;
      case 'shock': noise(t, 0.5, 0.2, 'lowpass', 800, 0.5); osc('sawtooth', 300, 40, t, 0.5, 0.18); break;
      case 'tick': osc('square', 1200, 900, t, 0.03, 0.05); break;
      case 'jackpot':
        for (let i = 0; i < 8; i++) osc('sine', 700 * Math.pow(1.18, i), null, t + i * 0.06, 0.25, 0.06);
        chord([0, 4, 7, 12, 16], t + 0.5, 0.6, 0.08);
        break;
      default: break;
    }
  }
}

let _sfx = null;
export function initSfx(music) { _sfx = new Sfx(music); return _sfx; }
export function getSfx() { return _sfx; }
