const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const ChatMessage = require("./models/ChatMessage");
const sequelize = require("./config/database");

let io = null;

const createSocketServer = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5500",
      methods: ["GET", "POST"]
    }
  });

  // Authenticate every Socket.IO connection using the same JWT as the REST APIs.
  io.use(async (socket, next) => {
    try {
      // Reuse the exact JWT issued by the normal login endpoint.
      // The browser sends it in the Socket.IO handshake as { auth: { token } }.
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== "string") {
        return next(new Error("Authentication token is required"));
      }

      // Verify the JWT before allowing the socket connection.
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded?.id) {
        return next(new Error("Invalid authentication token"));
      }

      // Never trust a user ID supplied by the browser. Look up the user
      // using the ID that came from the verified JWT payload.
      const user = await User.findByPk(decoded.id, {
        attributes: ["id", "name", "email", "phone"]
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      // Store the authenticated identity on the socket. All later socket
      // events can safely use these values instead of client-supplied IDs.
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

    // Socket.IO can also be used to send a message directly.
    // The message is saved first, then broadcast to all connected users.
    socket.on("send_message", async (payload, callback) => {
      try {
        const messageText = typeof payload?.message === "string"
          ? payload.message.trim()
          : "";

        if (!messageText) {
          return callback?.({
            success: false,
            message: "Message cannot be empty"
          });
        }

        const chatMessage = await sequelize.transaction(async (transaction) => {
          return ChatMessage.create(
            {
              // The sender comes from the authenticated socket, never from
              // the client payload. This prevents sender-ID spoofing.
              senderId: socket.userId,
              message: messageText
            },
            { transaction }
          );
        });

        const savedMessage = {
          id: chatMessage.id,
          senderId: socket.userId,
          senderName: socket.user.name,
          message: chatMessage.message,
          createdAt: chatMessage.createdAt
        };

        console.log(
          `[Socket.IO] Message saved -> id=${savedMessage.id}, senderId=${savedMessage.senderId}, text="${savedMessage.message}"`
        );

        // Send the new message to every connected/authenticated user.
        io.emit("new_message", savedMessage);

        callback?.({
          success: true,
          message: "Message saved successfully",
          chatMessage: savedMessage
        });
      } catch (error) {
        console.error("[Socket.IO] Send message error:", error);
        callback?.({
          success: false,
          message: "Unable to save chat message"
        });
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

// Used by the existing REST /message/send API so it can still broadcast
// messages if another client calls that API directly.
const broadcastNewMessage = (chatMessage) => {
  if (io) {
    io.emit("new_message", chatMessage);
  }
};

module.exports = {
  createSocketServer,
  getIO,
  broadcastNewMessage
};
