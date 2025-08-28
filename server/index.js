import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Create a room
  socket.on("createRoom", (roomCode, callback) => {
    if (io.sockets.adapter.rooms.has(roomCode)) {
      callback({ success: false, message: "Room already exists" });
    } else {
      socket.join(roomCode);
      callback({ success: true });
      console.log(`✅ Room ${roomCode} created by ${socket.id}`);
    }
  });

  // Join a room
  socket.on("joinRoom", (roomCode, callback) => {
    if (io.sockets.adapter.rooms.has(roomCode)) {
      socket.join(roomCode);
      callback({ success: true });
      console.log(`👤 ${socket.id} joined room ${roomCode}`);
      // Notify the other peer
      socket.to(roomCode).emit("ready");
    } else {
      callback({ success: false, message: "Room not found" });
    }
  });

  // WebRTC signaling
  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", data.offer);
  });

  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", data.answer);
  });

  socket.on("candidate", (data) => {
    socket.to(data.room).emit("candidate", data.candidate);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Signaling server running on ${PORT}`));
