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
  socket.on("create-room", () => {
    let code;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms[code]); // ensure unique

    rooms[code] = [socket.id];
    socket.join(code);
    socket.emit("room-created", code);
    console.log(`✅ Room created: ${code}`);
  });

  // Join Room
  socket.on("join-room", (code) => {
    if (rooms[code] && rooms[code].length < 2) {
      rooms[code].push(socket.id);
      socket.join(code);
      socket.emit("room-joined", code);
      socket.to(code).emit("user-joined", socket.id);
      console.log(`👥 ${socket.id} joined room ${code}`);
    } else {
      socket.emit("room-error", "Room full or not found");
    }
  });

  // Relay signaling messages
  socket.on("signal", ({ code, data }) => {
    socket.to(code).emit("signal", { id: socket.id, data });
  });

  // Cleanup on disconnect
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
