const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.broadcast.emit("new-peer", socket.id);

  socket.on("peer-offer", ({ to, offer }) => {
    io.to(to).emit("peer-offer", { from: socket.id, offer });
  });

  socket.on("peer-answer", ({ to, answer }) => {
    io.to(to).emit("peer-answer", { from: socket.id, answer });
  });

  socket.on("peer-ice", ({ to, candidate }) => {
    io.to(to).emit("peer-ice", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
