const { Op } = require("sequelize");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const sequelize = require("../config/database");
const { broadcastNewMessage } = require("../socket");

const toMessageDTO = (message) => ({
  id: message.id,
  senderId: message.senderId,
  senderName: message.sender?.name || "Unknown user",
  recipientId: message.recipientId,
  recipientName: message.recipient?.name || "Unknown user",
  message: message.message,
  createdAt: message.createdAt
});

const getLoggedInUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "phone"]
    });

    if (!user) {
      return res.status(404).json({ message: "Logged-in user was not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get logged-in user error:", error);
    return res.status(500).json({ message: "Unable to get logged-in user" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const messageText = typeof req.body.message === "string"
      ? req.body.message.trim()
      : "";
    const recipientId = Number(req.body.recipientId);

    if (!messageText) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      return res.status(400).json({ message: "A valid recipientId is required" });
    }

    if (recipientId === Number(req.user.id)) {
      return res.status(400).json({ message: "You cannot send a private message to yourself" });
    }

    const [sender, recipient] = await Promise.all([
      User.findByPk(req.user.id, { attributes: ["id", "name"] }),
      User.findByPk(recipientId, { attributes: ["id", "name"] })
    ]);

    if (!sender) {
      return res.status(401).json({ message: "Logged-in user was not found" });
    }

    if (!recipient) {
      return res.status(404).json({ message: "Recipient user was not found" });
    }

    const chatMessage = await sequelize.transaction(async (transaction) => {
      return ChatMessage.create(
        {
          senderId: sender.id,
          recipientId: recipient.id,
          message: messageText
        },
        { transaction }
      );
    });

    const savedMessage = {
      id: chatMessage.id,
      senderId: sender.id,
      senderName: sender.name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      message: chatMessage.message,
      createdAt: chatMessage.createdAt
    };

    broadcastNewMessage(savedMessage);

    return res.status(201).json({
      message: "Chat message saved successfully",
      chatMessage: savedMessage
    });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({
      message: "Unable to save chat message",
      error: error.message
    });
  }
};

// GET /message/all?userId=<recipient> returns only the private conversation
// between the authenticated user and the selected user.
const getAllMessages = async (req, res) => {
  try {
    const selectedUserId = Number(req.query.userId);

    if (!Number.isInteger(selectedUserId) || selectedUserId <= 0) {
      return res.status(400).json({
        message: "A valid userId query parameter is required"
      });
    }

    const otherUser = await User.findByPk(selectedUserId, {
      attributes: ["id", "name"]
    });

    if (!otherUser) {
      return res.status(404).json({ message: "Chat user was not found" });
    }

    const currentUserId = Number(req.user.id);

    const messages = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, recipientId: selectedUserId },
          { senderId: selectedUserId, recipientId: currentUserId }
        ]
      },
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      attributes: ["id", "senderId", "recipientId", "message", "createdAt"],
      include: [
        { model: User, as: "sender", attributes: ["id", "name"] },
        { model: User, as: "recipient", attributes: ["id", "name"] }
      ]
    });

    return res.status(200).json({
      messages: messages.map(toMessageDTO)
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return res.status(500).json({
      message: "Unable to fetch conversation",
      error: error.message
    });
  }
};

module.exports = {
  getLoggedInUser,
  sendMessage,
  getAllMessages
};
