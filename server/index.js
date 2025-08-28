const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// CORS configuration for production
const io = socketIo(server, {
  cors: {
    origin: ["https://your-netlify-app.netlify.app", "http://localhost:3000", "http://127.0.0.1:5500"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: ["https://your-netlify-app.netlify.app", "http://localhost:3000", "http://127.0.0.1:5500"],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "WebRTC Signaling Server is running!" });
});

// Xirsys credentials (use environment variables in production)
const XIRSYS_URL = process.env.XIRSYS_URL || "https://global.xirsys.net/_turn/MyFirstApp";
const XIRSYS_USERNAME = process.env.XIRSYS_USERNAME || "backup27914";
const XIRSYS_SECRET = process.env.XIRSYS_SECRET || "18954eb4-8410-11f0-aaf2-0242ac140003";
const XIRSYS_AUTH = "Basic " + Buffer.from(`${XIRSYS_USERNAME}:${XIRSYS_SECRET}`).toString("base64");

// Endpoint to fetch ICE servers
app.get("/ice", async (req, res) => {
  try {
    console.log("Fetching ICE servers from Xirsys...");
    const response = await axios.put(
      XIRSYS_URL,
      { format: "urls" },
      { 
        headers: { 
          Authorization: XIRSYS_AUTH, 
          "Content-Type": "application/json" 
        } 
      }
    );
    
    console.log("ICE servers received:", response.data.v.iceServers);
    res.json(response.data.v.iceServers);
  } catch (err) {
    console.error("Xirsys error:", err.response?.data || err.message);
    
    // Fallback to public STUN servers if Xirsys fails
    const fallbackServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ];
    
    res.json(fallbackServers);
  }
});

// Store active rooms and users
const rooms = new Map();

// Handle WebRTC signaling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", (roomId = "default-room") => {
    console.log(`Client ${socket.id} joining room: ${roomId}`);
    
    // Leave any existing room
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    
    // Join the new room
    socket.join(roomId);
    socket.currentRoom = roomId;
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    
    // Notify existing users in the room about the new peer
    room.forEach(existingUserId => {
      if (existingUserId !== socket.id) {
        io.to(existingUserId).emit("new-peer", socket.id);
      }
    });
    
    // Add user to room
    room.add(socket.id);
    
    console.log(`Room ${roomId} now has ${room.size} users`);
  });

  socket.on("signal", (data) => {
    console.log(`Signaling from ${socket.id} to ${data.to}`);
    io.to(data.to).emit("signal", { 
      from: socket.id, 
      sdp: data.sdp,
      candidate: data.candidate 
    });
  });

  socket.on("ice-candidate", (data) => {
    console.log(`ICE candidate from ${socket.id} to ${data.to}`);
    io.to(data.to).emit("ice-candidate", {
      from: socket.id,
      candidate: data.candidate
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    
    // Remove user from their room
    if (socket.currentRoom && rooms.has(socket.currentRoom)) {
      const room = rooms.get(socket.currentRoom);
      room.delete(socket.id);
      
      // Notify other users in the room
      room.forEach(userId => {
        io.to(userId).emit("peer-disconnected", socket.id);
      });
      
      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(socket.currentRoom);
      }
      
      console.log(`User left room ${socket.currentRoom}, ${room.size} users remaining`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
