// main.js - WebRTC front-end using WebSocket signalling
const SIGNALING_SERVER = (window.SIGNALING_SERVER_URL || 'ws://localhost:3000'); 
// On Netlify set window.SIGNALING_SERVER_URL via a small inline script or use your deployed Render ws URL.

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302'] }
  ],
  iceCandidatePoolSize: 10
};

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

let ws = null;
let myPeerId = null;
let currentRoomId = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// open websocket
function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(SIGNALING_SERVER);

  ws.addEventListener('open', () => {
    console.log('Connected to signalling server');
  });

  ws.addEventListener('message', async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    const { type, roomId, from, payload } = msg;
    console.log('Signalling msg', msg);

    if (type === 'created') {
      currentRoomId = roomId;
      callInput.value = roomId;
      callButton.disabled = true;
      answerButton.disabled = false;
      hangupButton.disabled = false;
      console.log('Room created', roomId);
      return;
    }
    if (type === 'joined') {
      // you joined a room
      currentRoomId = roomId;
      callInput.value = roomId;
      hangupButton.disabled = false;
      console.log('Joined room', roomId);
      return;
    }

    if (type === 'peer-joined') {
      console.log('Peer joined:', msg.peerId);
      // nothing special — wait for network messages
      return;
    }

    if (type === 'offer') {
      // remote created an offer
      const offerDesc = new RTCSessionDescription(payload);
      await pc.setRemoteDescription(offerDesc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'answer', roomId: currentRoomId, payload: pc.localDescription }));
      return;
    }

    if (type === 'answer') {
      const answerDesc = new RTCSessionDescription(payload);
      await pc.setRemoteDescription(answerDesc);
      return;
    }

    if (type === 'candidate') {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      } catch (e) {
        console.warn('Error adding candidate', e);
      }
      return;
    }

    if (type === 'peer-left') {
      console.log('Peer left', msg.peerId);
      // Optionally cleanup remote tracks
      remoteStream && remoteStream.getTracks().forEach(t => t.stop());
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
      return;
    }

    if (type === 'error') {
      console.error('Signalling error', msg.message);
    }
  });

  ws.addEventListener('close', () => {
    console.log('Signalling server connection closed');
  });

  ws.addEventListener('error', (e) => {
    console.error('WebSocket error', e);
  });
}

// helper to send
function sendToServer(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('ws not open, reconnecting');
    connectWS();
    // small delay to send after open
    setTimeout(() => ws.send(JSON.stringify(obj)), 200);
  } else {
    ws.send(JSON.stringify(obj));
  }
}

// 1. Setup media sources
webcamButton.onclick = async () => {
  connectWS();

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
  };

  pc.oniceconnectionstatechange = () => {
    console.log('ICE state:', pc.iceConnectionState);
  };

  // ICE candidates -> send to remote via server
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendToServer({ type: 'candidate', roomId: currentRoomId, payload: event.candidate.toJSON() });
    }
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer (create room)
callButton.onclick = async () => {
  connectWS();
  // ask server to create a room
  sendToServer({ type: 'create' });

  // Wait a tick for server to reply with 'created' (client will get created msg)
  // Create offer after created - but we can create offer now; we'll wait for created
  // Create offer and send after we have a currentRoomId (received in 'created' message)
  // So we wait until currentRoomId is set, with a short poll
  const waitForRoom = () => new Promise((res, rej) => {
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      if (currentRoomId) {
        clearInterval(t);
        res(currentRoomId);
      }
      if (attempts > 20) {
        clearInterval(t);
        rej(new Error('room creation timeout'));
      }
    }, 100);
  });

  try {
    await waitForRoom();

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    sendToServer({ type: 'offer', roomId: currentRoomId, payload: pc.localDescription });

    hangupButton.disabled = false;
    callButton.disabled = true;
  } catch (e) {
    console.error(e);
  }
};

// 3. Answer / Join the call (by ID)
answerButton.onclick = async () => {
  connectWS();

  const joinId = callInput.value.trim();
  if (!joinId) {
    alert('Enter call ID to join or create a new call first.');
    return;
  }

  // Join room on server
  sendToServer({ type: 'join', roomId: joinId });

  currentRoomId = joinId;

  // From here, when an offer is received via ws message handler, it will createAnswer
  // But if the creator already sent an offer earlier, you'll receive the 'offer' message and the handler will createAnswer

  hangupButton.disabled = false;
  callButton.disabled = true;
};

// Hangup & cleanup
hangupButton.onclick = () => {
  // send leave message
  if (currentRoomId) {
    sendToServer({ type: 'leave', roomId: currentRoomId });
  }

  // close peer connection tracks
  localStream && localStream.getTracks().forEach((t) => t.stop());
  remoteStream && remoteStream.getTracks().forEach((t) => t.stop());
  try { pc.getSenders().forEach(s => s.track && s.track.stop()); } catch {}

  // close pc and create a fresh one to allow new calls without reloading (simple approach: page reload recommended)
  // but we'll just reload to be safe
  window.location.reload();
};
