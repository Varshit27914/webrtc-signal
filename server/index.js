const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // roomCode -> [socketIds]

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Create Room
  socket.on("createRoom", (code, cb) => {
    if (rooms[code]) {
      cb({ success: false, message: "Room already exists" });
      return;
    }
    rooms[code] = [socket.id];
    socket.join(code);
    cb({ success: true });
    console.log(`✅ Room created: ${code}`);
  });

  // Join Room
  socket.on("joinRoom", (code, cb) => {
    if (rooms[code] && rooms[code].length < 2) {
      rooms[code].push(socket.id);
      socket.join(code);
      cb({ success: true });
      io.to(code).emit("ready"); // notify both peers
      console.log(`👥 ${socket.id} joined room ${code}`);
    } else {
      cb({ success: false, message: "Room full or not found" });
    }
  });

  // Offer
  socket.on("offer", ({ room, offer }) => {
    socket.to(room).emit("offer", offer);
  });

  // Answer
  socket.on("answer", ({ room, answer }) => {
    socket.to(room).emit("answer", answer);
  });

  // ICE Candidate
  socket.on("candidate", ({ room, candidate }) => {
    socket.to(room).emit("candidate", candidate);
  });

  // Cleanup
  socket.on("disconnect", () => {
    for (const code in rooms) {
      rooms[code] = rooms[code].filter((id) => id !== socket.id);
      if (rooms[code].length === 0) {
        delete rooms[code];
        console.log(`🗑️ Room ${code} deleted`);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
