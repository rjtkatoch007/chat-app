const { Op } = require("sequelize");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const sequelize = require("../config/database");
const { broadcastNewMessage, getPrivateRoomId } = require("../socket");

const dto = (m) => ({
  id: m.id,
  senderId: m.senderId,
  senderName: m.sender?.name || "Unknown user",
  recipientId: m.recipientId,
  recipientName: m.recipient?.name || "Unknown user",
  message: m.message,
  createdAt: m.createdAt
});

const getLoggedInUser = async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ["id", "name", "email", "phone"] });
  if (!user) return res.status(404).json({ message: "Logged-in user was not found" });
  res.json({ user });
};

const sendMessage = async (req, res) => {
  try {
    const text = typeof req.body.message === "string" ? req.body.message.trim() : "";
    const recipientId = Number(req.body.recipientId);
    if (!text) return res.status(400).json({ message: "Message cannot be empty" });
    if (!Number.isInteger(recipientId) || recipientId <= 0) return res.status(400).json({ message: "Valid recipientId is required" });
    if (recipientId === Number(req.user.id)) return res.status(400).json({ message: "You cannot message yourself" });

    const [sender, recipient] = await Promise.all([
      User.findByPk(req.user.id, { attributes: ["id", "name"] }),
      User.findByPk(recipientId, { attributes: ["id", "name"] })
    ]);
    if (!sender) return res.status(401).json({ message: "Logged-in user was not found" });
    if (!recipient) return res.status(404).json({ message: "Recipient user was not found" });

    const message = await sequelize.transaction((transaction) => ChatMessage.create(
      { senderId: sender.id, recipientId: recipient.id, message: text }, { transaction }
    ));

    const saved = { id: message.id, senderId: sender.id, senderName: sender.name, recipientId: recipient.id, recipientName: recipient.name, message: message.message, createdAt: message.createdAt };
    broadcastNewMessage(saved);
    res.status(201).json({ message: "Chat message saved successfully", chatMessage: saved });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Unable to save chat message" });
  }
};

const getAllMessages = async (req, res) => {
  try {
    const recipientId = Number(req.query.userId);
    if (!Number.isInteger(recipientId) || recipientId <= 0) return res.status(400).json({ message: "Valid userId is required" });

    const currentUserId = Number(req.user.id);
    const messages = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, recipientId },
          { senderId: recipientId, recipientId: currentUserId }
        ]
      },
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      include: [
        { model: User, as: "sender", attributes: ["id", "name"] },
        { model: User, as: "recipient", attributes: ["id", "name"] }
      ]
    });
    res.json({ roomId: getPrivateRoomId(currentUserId, recipientId), messages: messages.map(dto) });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ message: "Unable to fetch conversation" });
  }
};

module.exports = { getLoggedInUser, sendMessage, getAllMessages };
