const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const ChatMessage = require("./models/ChatMessage");
const sequelize = require("./config/database");

let io = null;

// One deterministic room per pair of users.
const getPrivateRoomName = (userA, userB) => {
  const ids = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `private_chat:${ids[0]}:${ids[1]}`;
};

const createSocketServer = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5500",
      methods: ["GET", "POST"]
    }
  });

  // Reuse the same JWT authentication used by the REST API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== "string") {
        return next(new Error("Authentication token is required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded?.id) {
        return next(new Error("Invalid authentication token"));
      }

      const user = await User.findByPk(decoded.id, {
        attributes: ["id", "name", "email", "phone"]
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      socket.userId = user.id;
      next();
    } catch (error) {
      console.error("[Socket.IO] Authentication failed:", error.message);
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `[Socket.IO] Connected -> userId=${socket.user.id}, name=${socket.user.name}`
    );

    socket.emit("authenticated", {
      user: {
        id: socket.user.id,
        name: socket.user.name
      }
    });

    // Join the private room for the selected user.
    socket.on("join_chat", async (payload, callback) => {
      try {
        const recipientId = Number(payload?.recipientId);

        if (!Number.isInteger(recipientId) || recipientId <= 0) {
          return callback?.({ success: false, message: "A valid recipientId is required" });
        }

        if (recipientId === Number(socket.userId)) {
          return callback?.({ success: false, message: "You cannot open a private chat with yourself" });
        }

        const recipient = await User.findByPk(recipientId, {
          attributes: ["id", "name"]
        });

        if (!recipient) {
          return callback?.({ success: false, message: "Chat user was not found" });
        }

        if (socket.currentChatRoom) {
          socket.leave(socket.currentChatRoom);
        }

        const roomName = getPrivateRoomName(socket.userId, recipientId);
        await socket.join(roomName);
        socket.currentChatRoom = roomName;
        socket.currentRecipientId = recipientId;

        console.log(
          `[Socket.IO] User ${socket.userId} joined ${roomName}`
        );

        callback?.({
          success: true,
          roomName,
          recipient: {
            id: recipient.id,
            name: recipient.name
          }
        });
      } catch (error) {
        console.error("[Socket.IO] Join chat error:", error);
        callback?.({ success: false, message: "Unable to join private chat" });
      }
    });

    socket.on("leave_chat", (callback) => {
      if (socket.currentChatRoom) {
        socket.leave(socket.currentChatRoom);
        console.log(
          `[Socket.IO] User ${socket.userId} left ${socket.currentChatRoom}`
        );
      }

      socket.currentChatRoom = null;
      socket.currentRecipientId = null;
      callback?.({ success: true });
    });

    socket.on("send_message", async (payload, callback) => {
      try {
        const messageText = typeof payload?.message === "string"
          ? payload.message.trim()
          : "";
        const recipientId = Number(payload?.recipientId);

        if (!messageText) {
          return callback?.({ success: false, message: "Message cannot be empty" });
        }

        if (!Number.isInteger(recipientId) || recipientId <= 0) {
          return callback?.({ success: false, message: "A valid recipientId is required" });
        }

        if (recipientId === Number(socket.userId)) {
          return callback?.({ success: false, message: "You cannot message yourself" });
        }

        const recipient = await User.findByPk(recipientId, {
          attributes: ["id", "name"]
        });

        if (!recipient) {
          return callback?.({ success: false, message: "Recipient user was not found" });
        }

        const roomName = getPrivateRoomName(socket.userId, recipientId);

        // The server decides which room the message belongs to. The client
        // cannot choose an arbitrary room and cannot spoof senderId.
        if (socket.currentChatRoom !== roomName) {
          return callback?.({
            success: false,
            message: "Join this private chat before sending a message"
          });
        }

        const chatMessage = await sequelize.transaction(async (transaction) => {
          return ChatMessage.create(
            {
              senderId: socket.userId,
              recipientId,
              message: messageText
            },
            { transaction }
          );
        });

        const savedMessage = {
          id: chatMessage.id,
          senderId: socket.userId,
          senderName: socket.user.name,
          recipientId: recipient.id,
          recipientName: recipient.name,
          message: chatMessage.message,
          createdAt: chatMessage.createdAt
        };

        console.log(
          `[Socket.IO] Private message saved -> ${socket.userId} -> ${recipientId}, room=${roomName}`
        );

        // Only the two sockets in this private room receive the live message.
        io.to(roomName).emit("new_message", savedMessage);

        callback?.({
          success: true,
          message: "Message saved successfully",
          chatMessage: savedMessage
        });
      } catch (error) {
        console.error("[Socket.IO] Send message error:", error);
        callback?.({ success: false, message: "Unable to save chat message" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket.IO] Disconnected -> userId=${socket.user.id}, reason=${reason}`
      );
    });
  });

  console.log("[Socket.IO] Server initialized");
  return io;
};

const getIO = () => io;

// Existing REST clients can still create a message. The frontend now uses
// Socket.IO for sending, but this helper keeps the REST endpoint compatible.
const broadcastNewMessage = (chatMessage) => {
  if (!io || !chatMessage?.recipientId) return;

  const roomName = getPrivateRoomName(
    chatMessage.senderId,
    chatMessage.recipientId
  );

  io.to(roomName).emit("new_message", chatMessage);
};

module.exports = {
  createSocketServer,
  getIO,
  broadcastNewMessage,
  getPrivateRoomName
};
