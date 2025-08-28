const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public")); // serve your HTML files

// Xirsys credentials
const XIRSYS_URL = "https://global.xirsys.net/_turn/MyFirstApp";
const XIRSYS_AUTH = "Basic " + Buffer.from("backup27914:18954eb4-8410-11f0-aaf2-0242ac140003").toString("base64");

// Endpoint to fetch ICE servers
app.get("/ice", async (req, res) => {
  try {
    const response = await axios.put(
      XIRSYS_URL,
      { format: "urls" },
      { headers: { Authorization: XIRSYS_AUTH, "Content-Type": "application/json" } }
    );
    res.json(response.data.v.iceServers);
  } catch (err) {
    console.error("Xirsys error:", err.message);
    res.status(500).json({ error: "Failed to get ICE servers" });
  }
});

// Handle WebRTC signaling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", () => {
    socket.broadcast.emit("new-peer", socket.id);
  });

  socket.on("signal", (data) => {
    io.to(data.to).emit("signal", { from: socket.id, sdp: data.sdp });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
