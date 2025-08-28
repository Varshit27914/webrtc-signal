const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, ".")));

let peers = {};

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  peers[socket.id] = socket.id;

  socket.broadcast.emit("user-joined", socket.id);

  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", { from: socket.id, sdp: data.sdp });
  });

  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", { from: socket.id, sdp: data.sdp });
  });

  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", { from: socket.id, candidate: data.candidate });
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    delete peers[socket.id];
    socket.broadcast.emit("user-left", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
