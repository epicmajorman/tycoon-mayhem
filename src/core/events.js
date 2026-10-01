// Tiny event emitter. The engine emits a log of typed events; renderer/audio/UI subscribe.
export class Emitter {
  constructor() { this.handlers = new Map(); this.log = []; }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    const hs = this.handlers.get(type);
    if (hs) { const i = hs.indexOf(fn); if (i >= 0) hs.splice(i, 1); }
  }
  emit(type, data = {}) {
    const e = { type, ...data, t: this.log.length };
    this.log.push(e);
    const hs = this.handlers.get(type);
    if (hs) for (const h of hs.slice()) h(e);
    const all = this.handlers.get('*');
    if (all) for (const h of all.slice()) h(e);
    return e;
  }
}
