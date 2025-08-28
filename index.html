const socket = io();
const peers = {};
const videos = document.getElementById("videos");

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
  // Show my video
  const myVideo = document.createElement("video");
  myVideo.srcObject = stream;
  myVideo.autoplay = true;
  myVideo.muted = true;
  videos.appendChild(myVideo);

  socket.emit("join-room");

  socket.on("new-peer", async (id) => {
    const pc = createPeer(id, stream, true);
    peers[id] = pc;
  });

  socket.on("peer-offer", async ({ from, offer }) => {
    const pc = createPeer(from, stream, false);
    peers[from] = pc;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("peer-answer", { to: from, answer });
  });

  socket.on("peer-answer", async ({ from, answer }) => {
    await peers[from].setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on("peer-ice", ({ from, candidate }) => {
    if (peers[from]) {
      peers[from].addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
}

function createPeer(id, stream, initiator) {
  const pc = new RTCPeerConnection();
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  pc.ontrack = (event) => {
    const video = document.createElement("video");
    video.srcObject = event.streams[0];
    video.autoplay = true;
    videos.appendChild(video);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("peer-ice", { to: id, candidate: event.candidate });
    }
  };

  if (initiator) {
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("peer-offer", { to: id, offer });
    };
  }

  return pc;
}

init();
