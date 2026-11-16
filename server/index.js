/* Neon Codex Arenas 3D - co-op relay server (Railway)
 *
 * Rooms of up to 4 players. The HOST's browser runs the wave/enemy simulation; this server only
 * manages rooms (codes + quick match) and relays messages between the players in a room.
 *
 * Env:  PORT (set by Railway)      ORIGINS  optional comma separated allow-list, e.g.
 *       https://you.github.io,https://www.yoursite.com   (empty = allow all)
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ORIGINS = (process.env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_PLAYERS = 4;
const AUTO_START_MS = 15000;           // quick-match rooms auto-start this long after the 2nd player joins
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const rooms = new Map();               // code -> room
let nextId = 1;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  let players = 0; for (const r of rooms.values()) players += r.players.size;
  res.end(JSON.stringify({ ok: true, game: 'neon-codex-coop', rooms: rooms.size, players }));
});
const wss = new WebSocketServer({
  server, maxPayload: 64 * 1024,
  verifyClient: (info, cb) => {
    if (!ORIGINS.length) return cb(true);
    cb(ORIGINS.includes(info.origin));
  }
});

const clean = (s, n = 16) => String(s || '').replace(/[^\w \-.']/g, '').trim().slice(0, n);
const safeCh = c => ['starr', 'aurealius', 'willow', 'akira', 'talos', 'dante'].includes(c) ? c : 'starr';
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

function makeCode() {
  for (let i = 0; i < 50; i++) {
    let c = ''; for (let k = 0; k < 4; k++) c += CODE_CHARS[Math.random() * CODE_CHARS.length | 0];
    if (!rooms.has(c)) return c;
  }
  return null;
}
function roster(room) {
  return [...room.players.values()].map(p => ({ id: p.id, name: p.name, ch: p.ch }));
}
function pushRoom(room) {
  const m = {
    t: 'room', code: room.code, host: room.host, started: room.started, pub: room.pub, max: MAX_PLAYERS,
    players: roster(room), auto: room.autoAt || 0
  };
  for (const p of room.players.values()) send(p.ws, m);
}
function startRoom(room) {
  if (room.started) return;
  room.started = true; room.autoAt = 0;
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  for (const p of room.players.values()) send(p.ws, { t: 'start', code: room.code, host: room.host, players: roster(room) });
  pushRoom(room);
}
function removePlayer(p, reason) {
  const room = p.room; if (!room) return;
  room.players.delete(p.id); p.room = null;
  if (!room.players.size) { if (room.timer) clearTimeout(room.timer); rooms.delete(room.code); return; }
  const wasHost = room.host === p.id;
  if (wasHost) {
    if (room.started) {            // the host's browser IS the simulation, so the match ends
      for (const q of room.players.values()) { send(q.ws, { t: 'closed', reason: 'The host left the match.' }); q.room = null; }
      if (room.timer) clearTimeout(room.timer); rooms.delete(room.code); return;
    }
    room.host = room.players.keys().next().value;   // lobby: hand the host role to the next player
  }
  for (const q of room.players.values()) send(q.ws, { t: 'left', id: p.id, reason: reason || '' });
  if (room.pub && !room.started && room.players.size < 2 && room.timer) { clearTimeout(room.timer); room.timer = null; room.autoAt = 0; }
  pushRoom(room);
}
function addPlayer(room, p) {
  room.players.set(p.id, p); p.room = room;
  if (room.pub && !room.started) {
    if (room.players.size >= MAX_PLAYERS) { startRoom(room); return; }
    if (room.players.size >= 2 && !room.timer) {
      room.autoAt = Date.now() + AUTO_START_MS;
      room.timer = setTimeout(() => startRoom(room), AUTO_START_MS);
    }
  }
  pushRoom(room);
  if (room.started) send(p.ws, { t: 'start', code: room.code, host: room.host, players: roster(room), late: true });
}
function newRoom(p, pub) {
  const code = makeCode(); if (!code) return null;
  const room = { code, host: p.id, players: new Map(), started: false, pub: !!pub, timer: null, autoAt: 0 };
  rooms.set(code, room); return room;
}

wss.on('connection', ws => {
  const p = { id: nextId++, ws, name: 'Player', ch: 'starr', room: null, bucket: 90, last: Date.now(), alive: true };
  send(ws, { t: 'welcome', id: p.id });
  ws.on('pong', () => { p.alive = true; });
  ws.on('message', raw => {
    // basic flood control: refill 60 msgs/sec, burst 90
    const now = Date.now(); p.bucket = Math.min(90, p.bucket + (now - p.last) * .06); p.last = now;
    if (p.bucket < 1) return; p.bucket--;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'create': case 'join': case 'quick': {
        if (p.room) removePlayer(p);
        p.name = clean(m.name) || 'Player'; p.ch = safeCh(m.ch);
        if (m.t === 'create') {
          const room = newRoom(p, false); if (!room) return send(ws, { t: 'err', msg: 'Server is full, try again.' });
          addPlayer(room, p);
        } else if (m.t === 'join') {
          const room = rooms.get(String(m.code || '').toUpperCase().trim());
          if (!room) return send(ws, { t: 'err', msg: 'No room with that code.' });
          if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', msg: 'That room is full.' });
          if (room.started && !room.pub) return send(ws, { t: 'err', msg: 'That match has already started.' });
          addPlayer(room, p);
        } else {
          let best = null;
          for (const r of rooms.values()) if (r.pub && r.players.size < MAX_PLAYERS && (!best || r.players.size > best.players.size)) best = r;
          if (!best) best = newRoom(p, true);
          if (!best) return send(ws, { t: 'err', msg: 'Server is full, try again.' });
          addPlayer(best, p);
        }
        break;
      }
      case 'ch': { p.ch = safeCh(m.ch); if (p.room && !p.room.started) pushRoom(p.room); break; }
      case 'start': { const r = p.room; if (r && r.host === p.id && r.players.size >= 1) startRoom(r); break; }
      case 'leave': removePlayer(p); send(ws, { t: 'left', id: p.id, self: true }); break;
      case 'st': {      // unreliable player state -> everyone else
        const r = p.room; if (!r || !r.started) return;
        const o = JSON.stringify({ t: 'st', id: p.id, d: m.d });
        for (const q of r.players.values()) if (q !== p && q.ws.readyState === 1) q.ws.send(o);
        break;
      }
      case 'ev': {      // game event: to = 'host' | 'all' | <player id>
        const r = p.room; if (!r || !r.started || typeof m.k !== 'string') return;
        const o = JSON.stringify({ t: 'ev', from: p.id, k: m.k.slice(0, 16), d: m.d });
        if (m.to === 'host') { const h = r.players.get(r.host); if (h && h !== p) h.ws.send(o); }
        else if (m.to === 'all' || m.to == null) { for (const q of r.players.values()) if (q !== p && q.ws.readyState === 1) q.ws.send(o); }
        else { const q = r.players.get(+m.to); if (q && q !== p) q.ws.send(o); }
        break;
      }
    }
  });
  ws.on('close', () => removePlayer(p));
  ws.on('error', () => { try { ws.terminate(); } catch { } });
});

// drop dead sockets (Railway proxies silently drop idle connections)
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; try { ws.ping(); } catch { }
  });
}, 25000);
wss.on('connection', ws => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });

server.listen(PORT, () => console.log('Neon Codex co-op server listening on', PORT));
