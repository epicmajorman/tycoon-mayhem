// Net client: host-authoritative action-stream protocol.
// Host: applies every action locally and broadcasts it; waits for remote-seat choices.
// Peer: replays the same actions through a mirror engine (identical seed = identical world);
//       shows interactive UI only for its own seat and sends choices to the host.
export class NetLayer {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.role = null;      // 'host' | 'peer'
    this.seat = -1;
    this.code = null;
    this.onMessage = () => { };
    this.onOpen = () => { };
    this.ws.onopen = () => this.onOpen();
    this.ws.onmessage = (e) => {
      try { this.onMessage(JSON.parse(e.data)); } catch (err) { console.error('bad net msg', err); }
    };
  }
  send(obj) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  host(name) { this.role = 'host'; this.send({ t: 'host', name }); }
  join(name, code) { this.role = 'peer'; this.send({ t: 'join', name, code }); }
  startGame(seed, cfg) { this.send({ t: 'start', seed, cfg }); }
  broadcastAct(msg) { this.send({ t: 'act', ...msg }); }
  sendChoice(seat, payload) { this.send({ t: 'choose', seat, payload }); }
}
