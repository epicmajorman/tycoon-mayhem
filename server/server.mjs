// TYCOON MAYHEM LAN relay — zero-dependency RFC6455 WebSocket server (pure Node).
// Rooms of up to 8. The HOST relays its authoritative action stream; peers replay it.
// Run: node server/server.mjs  [port=3888]
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const PORT = parseInt(process.argv[2] || '3888');

const rooms = new Map(); // code -> { code, hostWs, peers: Set, started, seed, cfg, seatNames }
const names = new Map(); // ws -> name

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function wsf(buf) { // server->client frame (no mask)
  const len = buf.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, buf]);
}
function send(ws, obj) { try { ws.socket.write(wsf(Buffer.from(JSON.stringify(obj)))); } catch { } }
function broadcast(room, obj, except = null) {
  const data = wsf(Buffer.from(JSON.stringify(obj)));
  for (const ws of [room.hostWs, ...room.peers]) {
    if (ws && ws !== except) { try { ws.socket.write(data); } catch { } }
  }
}

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TYCOON MAYHEM relay. Connect via WebSocket.\n');
});

httpServer.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' + 'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  const ws = { socket, room: null, isHost: false, id: randomUUID().slice(0, 8) };
  socket.on('data', (chunk) => {
    try { ws.buf = ws.buf ? Buffer.concat([ws.buf, chunk]) : chunk; drain(ws); } catch (e) { console.error('frame error', e); }
  });
  socket.on('error', () => drop(ws));
  socket.on('close', () => drop(ws));
});

function drain(ws) {
  while (ws.buf && ws.buf.length >= 2) {
    const b0 = ws.buf[0], b1 = ws.buf[1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (ws.buf.length < 4) return; len = ws.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (ws.buf.length < 10) return; len = Number(ws.buf.readBigUInt64BE(2)); off = 10; }
    if (ws.buf.length < off + len + (masked ? 4 : 0)) return;
    let payload = ws.buf.subarray(off, off + len + (masked ? 4 : 0));
    if (masked) {
      const mask = payload.subarray(0, 4);
      const data = payload.subarray(4);
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      payload = data;
    }
    ws.buf = ws.buf.subarray(off + len + (masked ? 4 : 0));
    if (opcode === 0x8) { drop(ws); return; }
    if (opcode === 0x9) { ws.socket.write(Buffer.from([0x8a, payload.length]), ...[]); ws.socket.write(payload); continue; }
    if (opcode === 0x1) {
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch { continue; }
      handle(ws, msg);
    }
  }
}

function seatList(room) {
  const seats = [];
  if (room.hostWs) seats.push({ id: room.hostWs.id, name: names.get(room.hostWs) || 'Host', host: true });
  for (const p of room.peers) seats.push({ id: p.id, name: names.get(p) || 'Player', host: false });
  return seats;
}

function handle(ws, msg) {
  if (msg.t === 'host') {
    names.set(ws, (msg.name || 'Host').slice(0, 14));
    const code = makeCode();
    const room = { code, hostWs: ws, peers: new Set(), started: false, seed: 0, cfg: null };
    rooms.set(code, room);
    ws.room = room; ws.isHost = true;
    send(ws, { t: 'hosted', code, seat: 0 });
    console.log(`room ${code} hosted by ${names.get(ws)}`);
  } else if (msg.t === 'join') {
    const room = rooms.get((msg.code || '').toUpperCase());
    if (!room) { send(ws, { t: 'error', msg: 'Room not found.' }); return; }
    if (room.started) { send(ws, { t: 'error', msg: 'Match already started (no late join).' }); return; }
    if (room.peers.size >= 7) { send(ws, { t: 'error', msg: 'Room full (8).' }); return; }
    names.set(ws, (msg.name || 'Player').slice(0, 14));
    room.peers.add(ws);
    ws.room = room;
    const seat = seatList(room).findIndex(s => s.id === ws.id);
    send(ws, { t: 'joined', code: room.code, seat });
    broadcast(room, { t: 'room', code: room.code, seats: seatList(room) });
    console.log(`${names.get(ws)} joined ${code} (seat ${seat})`);
  } else if (msg.t === 'start' && ws.isHost && ws.room) {
    ws.room.started = true;
    ws.room.seed = msg.seed;
    broadcast(ws.room, { t: 'start', seed: msg.seed, cfg: msg.cfg });
    console.log(`room ${ws.room.code} started`);
  } else if (msg.t === 'act' && ws.isHost && ws.room) {
    broadcast(ws.room, { t: 'act', action: msg.action, payload: msg.payload, choice: msg.choice });
  } else if (msg.t === 'choose' && !ws.isHost && ws.room && ws.room.started) {
    // peer decision -> to host, host applies + relays as act
    if (ws.room.hostWs) send(ws.room.hostWs, { t: 'peerChoose', seat: msg.seat, payload: msg.payload });
  } else if (msg.t === 'chat' && ws.room) {
    broadcast(ws.room, { t: 'chat', from: names.get(ws), msg: String(msg.msg || '').slice(0, 140) });
  }
}

function drop(ws) {
  if (!ws.room) return;
  const room = ws.room;
  if (ws.isHost) {
    broadcast(room, { t: 'error', msg: 'Host disconnected — room closed.' });
    for (const p of room.peers) { try { p.socket.destroy(); } catch { } }
    rooms.delete(room.code);
    console.log(`room ${room.code} closed (host left)`);
  } else {
    room.peers.delete(ws);
    broadcast(room, { t: 'room', code: room.code, seats: seatList(room) });
    console.log(`${names.get(ws)} left ${room.code}`);
  }
}

httpServer.listen(PORT, () => console.log(`🎭 TYCOON MAYHEM relay on ws://<your-ip>:${PORT} — host from the game menu.`));
