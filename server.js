/**
 * Walkie-Talkie backend
 * - Express + Socket.IO server
 * - Supports multiple "channels" (rooms)
 * - Push-to-talk: client records a clip, base64-encodes it, and emits it.
 *   Server relays it to everyone else on the same channel.
 * - Tracks online users per channel and "who is currently speaking".
 */

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.get("/", (req, res) => {
  res.send("Walkie-Talkie server is running.");
});
// Simple health check you can hit from a browser to confirm your IP/port works
app.get("/health", (req, res) => {
  res.json({ ok: true, channels: Array.from(channels.keys()) });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 5e6, // 5MB, enough for a short voice clip
});

// channelName -> Map<socketId, { username }>
const channels = new Map();

function getChannelUsers(channel) {
  const map = channels.get(channel);
  if (!map) return [];
  return Array.from(map.values()).map((u) => u.username);
}

function broadcastUserList(channel) {
  io.to(channel).emit("user-list", getChannelUsers(channel));
}

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("join", ({ username, channel }) => {
    if (!username || !channel) return;

    socket.data.username = username;
    socket.data.channel = channel;

    socket.join(channel);

    if (!channels.has(channel)) channels.set(channel, new Map());
    channels.get(channel).set(socket.id, { username });

    console.log(`[join] ${username} -> #${channel}`);

    broadcastUserList(channel);
    socket.to(channel).emit("system-message", `${username} joined the channel`);
  });

  // Push-to-talk: someone pressed the mic button
  socket.on("speaking-start", () => {
    const { channel, username } = socket.data;
    if (!channel) return;
    socket.to(channel).emit("speaking-start", { username });
  });

  socket.on("speaking-end", () => {
    const { channel, username } = socket.data;
    if (!channel) return;
    socket.to(channel).emit("speaking-end", { username });
  });

  // Full audio clip sent as base64 after recording finishes
  socket.on("audio", ({ audio, mimeType }) => {
    const { channel, username } = socket.data;
    if (!channel || !audio) return;
    socket.to(channel).emit("audio", {
      audio,
      mimeType: mimeType || "audio/m4a",
      username,
      timestamp: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    const { channel, username } = socket.data;
    console.log(`[disconnect] ${username || socket.id}`);
    if (channel && channels.has(channel)) {
      channels.get(channel).delete(socket.id);
      if (channels.get(channel).size === 0) {
        channels.delete(channel);
      } else {
        broadcastUserList(channel);
        socket.to(channel).emit("system-message", `${username} left the channel`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Walkie-Talkie server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
