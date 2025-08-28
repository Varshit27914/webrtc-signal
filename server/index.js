const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (our index.html)
app.use(express.static(__dirname));

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Tell others a new user joined
  socket.broadcast.emit("user-joined", socket.id);

  // Forward offer
  socket.on("offer", (data) => {
    io.to(data.target).emit("offer", {
      sdp: data.sdp,
      caller: socket.id,
    });
  });

  // Forward answer
  socket.on("answer", (data) => {
    io.to(data.target).emit("answer", {
      sdp: data.sdp,
      caller: socket.id,
    });
  });

  // Forward ICE candidates
  socket.on("ice-candidate", (data) => {
    io.to(data.target).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    });
  });

  // On disconnect
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    socket.broadcast.emit("user-left", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
