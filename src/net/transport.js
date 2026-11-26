// Connection transports. Both expose the same small interface:
//   const t = await openTransport(kind)
//   await t.host(code, onConnection)        // host: onConnection(conn) per joining player
//   const conn = await t.join(code)         // client: connection to the host
//   conn.send(obj); conn.onData(fn); conn.onClose(fn); conn.close()
//   t.destroy()
//
// 'peer'  — WebRTC via PeerJS. The public PeerJS server only introduces the browsers;
//           game traffic then flows directly between them.
// 'local' — BroadcastChannel between tabs of the same browser. Used by automated tests
//           and for trying co-op on one machine without internet.

const PREFIX = 'riverbend-';

function makeConn(sendRaw, closeRaw) {
  const dataFns = [], closeFns = [];
  let closed = false;
  return {
    send: obj => { if (!closed) sendRaw(obj); },
    onData: fn => dataFns.push(fn),
    onClose: fn => closeFns.push(fn),
    close: () => { if (closed) return; closed = true; closeRaw?.(); closeFns.forEach(f => f()); },
    _data: d => dataFns.forEach(f => f(d)),
    _closed: () => { if (closed) return; closed = true; closeFns.forEach(f => f()); },
  };
}

// ------------------------------------------------------------------ PeerJS

function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/peerjs.min.js';
    s.onload = () => resolve(window.Peer);
    s.onerror = () => reject(new Error('Could not load vendor/peerjs.min.js'));
    document.head.append(s);
  });
}

function wrapPeerConn(dc) {
  const conn = makeConn(obj => dc.send(obj), () => dc.close());
  dc.on('data', d => conn._data(d));
  dc.on('close', () => conn._closed());
  dc.on('error', () => conn._closed());
  return conn;
}

async function peerTransport() {
  const Peer = await loadPeerJS();
  let peer = null;
  const opened = p => new Promise((resolve, reject) => {
    p.on('open', resolve);
    p.on('error', err => reject(new Error(err.type === 'unavailable-id' ? 'That room code is already in use.' : err.type === 'peer-unavailable' ? 'No game found with that code.' : (err.message || String(err)))));
  });
  return {
    kind: 'peer',
    async host(code, onConnection) {
      peer = new Peer(PREFIX + code, { debug: 1 });
      await opened(peer);
      peer.on('connection', dc => dc.on('open', () => onConnection(wrapPeerConn(dc))));
    },
    async join(code) {
      peer = new Peer({ debug: 1 });
      await opened(peer);
      return new Promise((resolve, reject) => {
        const dc = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        const timer = setTimeout(() => reject(new Error('Timed out connecting to the host.')), 15000);
        peer.on('error', err => { clearTimeout(timer); reject(new Error(err.type === 'peer-unavailable' ? 'No game found with that code.' : (err.message || String(err)))); });
        dc.on('open', () => { clearTimeout(timer); resolve(wrapPeerConn(dc)); });
      });
    },
    destroy() { peer?.destroy(); peer = null; },
  };
}

// ------------------------------------------------------------------ BroadcastChannel

function localTransport() {
  const bc = new BroadcastChannel('riverbend-net');
  const me = Math.random().toString(36).slice(2, 10);
  const conns = new Map();               // remote id -> conn
  let hostId = null, onConnection = null;
  bc.onmessage = ({ data: m }) => {
    if (m.to !== me) return;
    if (m.type === 'connect' && onConnection) {
      const conn = makeConn(d => bc.postMessage({ to: m.from, from: me, type: 'data', d }), () => bc.postMessage({ to: m.from, from: me, type: 'close' }));
      conns.set(m.from, conn);
      bc.postMessage({ to: m.from, from: me, type: 'accept' });
      onConnection(conn);
    } else if (m.type === 'accept') conns.get(m.from)?._accept?.();
    else if (m.type === 'data') conns.get(m.from)?._data(m.d);
    else if (m.type === 'close') { conns.get(m.from)?._closed(); conns.delete(m.from); }
  };
  // Hosts answer "who is room X?" lookups so clients learn the host's channel id.
  bc.addEventListener('message', ({ data: m }) => {
    if (m.type === 'lookup' && hostId && m.code === hostId) bc.postMessage({ to: m.from, from: me, type: 'found' });
  });
  return {
    kind: 'local',
    async host(code, cb) { hostId = code; onConnection = cb; },
    join(code) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('No game found with that code.')), 4000);
        const onFound = ({ data: m }) => {
          if (m.to !== me || m.type !== 'found') return;
          bc.removeEventListener('message', onFound);
          const conn = makeConn(d => bc.postMessage({ to: m.from, from: me, type: 'data', d }), () => bc.postMessage({ to: m.from, from: me, type: 'close' }));
          conn._accept = () => { clearTimeout(timer); resolve(conn); };
          conns.set(m.from, conn);
          bc.postMessage({ to: m.from, from: me, type: 'connect' });
        };
        bc.addEventListener('message', onFound);
        bc.postMessage({ from: me, type: 'lookup', code });
      });
    },
    destroy() { for (const c of conns.values()) c.close(); conns.clear(); bc.close(); },
  };
}

export async function openTransport(kind) {
  return kind === 'local' ? localTransport() : peerTransport();
}

export function randomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
