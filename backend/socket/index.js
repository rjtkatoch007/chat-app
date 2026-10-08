const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { registerSocketHandlers } = require("./handlers");

let io = null;
const connectedUsers = new Map();

const createSocketServer = (server) => {
  io = new Server(server, { cors: { origin: "http://localhost:5500", methods: ["GET", "POST"] } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication token is required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, { attributes: ["id", "name", "email", "phone"] });
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      socket.userId = user.id;
      next();
    } catch (error) {
      console.error("[Socket.IO] Authentication failed:", error.message);
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    const userKey = String(socket.userId);
    const sockets = connectedUsers.get(userKey) || new Set();
    sockets.add(socket.id);
    connectedUsers.set(userKey, sockets);

    socket.emit("authenticated", { user: { id: socket.user.id, name: socket.user.name, email: socket.user.email } });
    registerSocketHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      const current = connectedUsers.get(userKey);
      if (current) {
        current.delete(socket.id);
        if (!current.size) connectedUsers.delete(userKey);
      }
      console.log(`[Socket.IO] Disconnected -> userId=${socket.userId}, reason=${reason}`);
    });
  });

  console.log("[Socket.IO] Server initialized");
  return io;
};

module.exports = { createSocketServer, getIO: () => io, connectedUsers };
