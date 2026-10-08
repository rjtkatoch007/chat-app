const sequelize = require("../../config/database");
const { User, ChatMessage } = require("../../models");
const { createPrivateRoomId } = require("../utils/roomId");

const registerPrivateHandlers = (io, socket) => {
  socket.on("join_room", async ({ roomId, recipientId } = {}, ack) => {
    try {
      const targetId = Number(recipientId);
      if (!Number.isInteger(targetId) || targetId <= 0 || targetId === Number(socket.userId)) return ack?.({ success: false, message: "Invalid recipient" });
      const recipient = await User.findByPk(targetId, { attributes: ["id", "name", "email"] });
      if (!recipient) return ack?.({ success: false, message: "User not found" });
      const expected = createPrivateRoomId(socket.user.email, recipient.email);
      if (!expected || roomId !== expected) return ack?.({ success: false, message: "Invalid room ID" });

      if (socket.currentPrivateRoom) socket.leave(socket.currentPrivateRoom);
      await socket.join(expected);
      socket.currentPrivateRoom = expected;
      socket.currentRecipientId = targetId;
      ack?.({ success: true, roomId: expected, recipient });
    } catch (error) {
      console.error("[Socket.IO] join_room:", error);
      ack?.({ success: false, message: "Unable to join room" });
    }
  });

  socket.on("leave_room", () => {
    if (socket.currentPrivateRoom) socket.leave(socket.currentPrivateRoom);
    socket.currentPrivateRoom = null;
    socket.currentRecipientId = null;
  });

  socket.on("send_message", async ({ roomId, recipientId, message } = {}, ack) => {
    try {
      const text = typeof message === "string" ? message.trim() : "";
      const targetId = Number(recipientId);
      if (!text) return ack?.({ success: false, message: "Message cannot be empty" });
      if (text.length > 5000) return ack?.({ success: false, message: "Message is too long" });
      if (!Number.isInteger(targetId) || targetId <= 0 || targetId === Number(socket.userId)) return ack?.({ success: false, message: "Invalid recipient" });
      const recipient = await User.findByPk(targetId, { attributes: ["id", "name", "email"] });
      if (!recipient) return ack?.({ success: false, message: "Recipient not found" });
      const expected = createPrivateRoomId(socket.user.email, recipient.email);
      if (!expected || roomId !== expected || socket.currentPrivateRoom !== expected) return ack?.({ success: false, message: "Join the correct room before sending" });

      const saved = await sequelize.transaction((transaction) => ChatMessage.create({ senderId: socket.userId, recipientId: targetId, message: text }, { transaction }));
      const payload = { id: saved.id, roomId: expected, senderId: socket.userId, senderName: socket.user.name, recipientId: targetId, recipientName: recipient.name, message: saved.message, mediaUrl: saved.mediaUrl || null, mediaName: saved.mediaName || null, mediaType: saved.mediaType || null, mediaSize: saved.mediaSize || null, createdAt: saved.createdAt };
      io.to(expected).emit("new_message", payload);
      ack?.({ success: true, chatMessage: payload });
    } catch (error) {
      console.error("[Socket.IO] send_message:", error);
      ack?.({ success: false, message: "Unable to save message" });
    }
  });
};

module.exports = { registerPrivateHandlers };
