const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const ChatMessage = require("./models/ChatMessage");
const sequelize = require("./config/database");

let io = null;

// Deterministic unique room ID for a pair of users.
const getPrivateRoomId = (userA, userB) => {
  const ids = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `private_${ids[0]}_${ids[1]}`;
};

const createSocketServer = (server) => {
  io = new Server(server, {
    cors: { origin: "http://localhost:5500", methods: ["GET", "POST"] }
  });

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
    console.log(`[Socket.IO] Connected -> userId=${socket.userId}, email=${socket.user.email}`);

    socket.emit("authenticated", {
      user: { id: socket.user.id, name: socket.user.name, email: socket.user.email }
    });

    // Assignment event: frontend sends the desired room ID and joins it.
    socket.on("join_room", async ({ roomId, recipientId }, callback) => {
      try {
        const targetId = Number(recipientId);
        const expectedRoomId = getPrivateRoomId(socket.userId, targetId);
        if (!Number.isInteger(targetId) || targetId <= 0 || targetId === Number(socket.userId)) {
          return callback?.({ success: false, message: "Invalid recipient" });
        }
        if (roomId !== expectedRoomId) {
          return callback?.({ success: false, message: "Invalid room ID" });
        }
        const recipient = await User.findByPk(targetId, { attributes: ["id", "name", "email"] });
        if (!recipient) return callback?.({ success: false, message: "User not found" });

        if (socket.currentRoomId) socket.leave(socket.currentRoomId);
        await socket.join(roomId);
        socket.currentRoomId = roomId;
        socket.currentRecipientId = targetId;

        console.log(`[Socket.IO] user ${socket.userId} joined room ${roomId}`);
        callback?.({ success: true, roomId, recipient });
      } catch (error) {
        console.error("[Socket.IO] join_room error:", error);
        callback?.({ success: false, message: "Unable to join room" });
      }
    });

    socket.on("leave_room", () => {
      if (socket.currentRoomId) socket.leave(socket.currentRoomId);
      socket.currentRoomId = null;
      socket.currentRecipientId = null;
    });

    socket.on("send_message", async ({ roomId, recipientId, message }, callback) => {
      try {
        const text = typeof message === "string" ? message.trim() : "";
        const targetId = Number(recipientId);
        const expectedRoomId = getPrivateRoomId(socket.userId, targetId);

        if (!text) return callback?.({ success: false, message: "Message cannot be empty" });
        if (!Number.isInteger(targetId) || targetId <= 0) return callback?.({ success: false, message: "Invalid recipient" });
        if (roomId !== expectedRoomId || socket.currentRoomId !== expectedRoomId) {
          return callback?.({ success: false, message: "Join the correct room before sending" });
        }

        const recipient = await User.findByPk(targetId, { attributes: ["id", "name", "email"] });
        if (!recipient) return callback?.({ success: false, message: "Recipient not found" });

        const saved = await sequelize.transaction((transaction) => ChatMessage.create({
          senderId: socket.userId,
          recipientId: targetId,
          message: text
        }, { transaction }));

        const payload = {
          id: saved.id,
          roomId,
          senderId: socket.userId,
          senderName: socket.user.name,
          recipientId: targetId,
          recipientName: recipient.name,
          message: saved.message,
          createdAt: saved.createdAt
        };

        // Room-specific broadcast: only clients in this room receive it.
        io.to(roomId).emit("new_message", payload);
        callback?.({ success: true, chatMessage: payload });
      } catch (error) {
        console.error("[Socket.IO] send_message error:", error);
        callback?.({ success: false, message: "Unable to save message" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Disconnected -> userId=${socket.userId}, reason=${reason}`);
    });
  });

  console.log("[Socket.IO] Server initialized");
  return io;
};

const broadcastNewMessage = (chatMessage) => {
  if (!io || !chatMessage?.recipientId) return;
  const roomId = getPrivateRoomId(chatMessage.senderId, chatMessage.recipientId);
  io.to(roomId).emit("new_message", { ...chatMessage, roomId });
};

module.exports = { createSocketServer, getIO: () => io, broadcastNewMessage, getPrivateRoomId };
