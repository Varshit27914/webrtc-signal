const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname)); // serve index.html from root

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Forward WebRTC signals (offer, answer, ice candidates)
  socket.on("signal", (data) => {
    io.emit("signal", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    io.emit("user-disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
