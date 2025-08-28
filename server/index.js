// Simple WebSocket signalling server for WebRTC
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// simple health route
app.get('/', (req, res) => res.send('WebRTC signalling server is running'));

// Start HTTP server (used by Render)
const server = app.listen(PORT, () => {
  console.log(`Signalling server listening on port ${PORT}`);
});

// Start WebSocket server on the same server
const wss = new WebSocketServer({ server });

// rooms mapping: roomId -> Set of ws clients
const rooms = new Map();

function send(ws, payload) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (e) {
    console.error('send failed', e);
  }
}

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.peerId = nanoid(8);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.warn('invalid json', raw);
      return;
    }

    const { type, roomId, payload } = msg;

    // CREATE: create a new room and add the socket
    if (type === 'create') {
      const newRoomId = nanoid(8);
      rooms.set(newRoomId, new Set([ws]));
      ws.roomId = newRoomId;
      send(ws, { type: 'created', roomId: newRoomId, peerId: ws.peerId });
      return;
    }

    // JOIN: join an existing room
    if (type === 'join') {
      if (!rooms.has(roomId)) {
        send(ws, { type: 'error', message: 'room-not-found' });
        return;
      }
      const set = rooms.get(roomId);
      set.add(ws);
      ws.roomId = roomId;

      // notify existing peers that a new peer joined
      set.forEach((peer) => {
        if (peer !== ws) {
          send(peer, { type: 'peer-joined', peerId: ws.peerId });
        }
      });

      // confirm join to the new peer and send peer count
      send(ws, { type: 'joined', roomId, peerId: ws.peerId, peers: set.size });
      return;
    }

    // For all other message types (offer/answer/candidate/leave) - forward to other peers in room
    if (!ws.roomId) {
      send(ws, { type: 'error', message: 'not-in-room' });
      return;
    }

    const set = rooms.get(ws.roomId);
    if (!set) {
      send(ws, { type: 'error', message: 'room-not-found' });
      return;
    }

    // Forward to other peers in the same room
    set.forEach((peer) => {
      // don't echo back to sender
      if (peer !== ws) {
        send(peer, { type, from: ws.peerId, payload });
      }
    });

    // handle leave
    if (type === 'leave') {
      set.delete(ws);
      ws.roomId = null;
      // notify remaining peers
      set.forEach((peer) => send(peer, { type: 'peer-left', peerId: ws.peerId }));
      // cleanup empty room
      if (set.size === 0) rooms.delete(ws.roomId);
    }
  });

  ws.on('close', () => {
    // remove from room if present
    const r = ws.roomId;
    if (r && rooms.has(r)) {
      const set = rooms.get(r);
      set.delete(ws);
      set.forEach((peer) => send(peer, { type: 'peer-left', peerId: ws.peerId }));
      if (set.size === 0) rooms.delete(r);
    }
  });
});
