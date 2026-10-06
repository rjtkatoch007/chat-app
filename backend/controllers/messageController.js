const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const sequelize = require("../config/database");
const { broadcastNewMessage } = require("../websocket");

// Get the actual logged-in user from the verified JWT and database.
const getLoggedInUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "phone"]
    });

    if (!user) {
      return res.status(404).json({
        message: "Logged-in user was not found"
      });
    }

    console.log(
      `[AUTH] Logged-in user -> id=${user.id}, name=${user.name}, email=${user.email}, phone=${user.phone}`
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get logged-in user error:", error);
    return res.status(500).json({
      message: "Unable to get logged-in user"
    });
  }
};

// Save a message using the sender ID from the verified JWT.
const sendMessage = async (req, res) => {
  try {
    const messageText = typeof req.body.message === "string"
      ? req.body.message.trim()
      : "";

    if (!messageText) {
      return res.status(400).json({
        message: "Message cannot be empty"
      });
    }

    const sender = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "phone"]
    });

    if (!sender) {
      return res.status(401).json({
        message: "Logged-in user was not found"
      });
    }

    console.log(
      `[MESSAGE] Saving -> senderId=${sender.id}, senderName=${sender.name}, text="${messageText}"`
    );

    // The transaction makes the database write explicit and safe.
    const chatMessage = await sequelize.transaction(async (transaction) => {
      return ChatMessage.create(
        {
          senderId: sender.id,
          message: messageText
        },
        { transaction }
      );
    });

    const savedMessage = {
      id: chatMessage.id,
      senderId: chatMessage.senderId,
      senderName: sender.name,
      message: chatMessage.message,
      createdAt: chatMessage.createdAt
    };

    console.log(
      `[MESSAGE] Saved -> messageId=${chatMessage.id}, senderId=${chatMessage.senderId}`
    );

    // Database write succeeded. Now notify every authenticated WebSocket client.
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

// Return every message from the database, including the sender's user ID/name.
const getAllMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.findAll({
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      attributes: ["id", "senderId", "message", "createdAt"],
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name"]
        }
      ]
    });

    const result = messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender?.name || "Unknown user",
      message: message.message,
      createdAt: message.createdAt
    }));

    console.log(
      `[MESSAGE] Returning ${result.length} database message(s) to logged-in user id=${req.user.id}`
    );

    return res.status(200).json({ messages: result });
  } catch (error) {
    console.error("Get all messages error:", error);
    return res.status(500).json({
      message: "Unable to fetch chat messages",
      error: error.message
    });
  }
};

module.exports = {
  getLoggedInUser,
  sendMessage,
  getAllMessages
};
