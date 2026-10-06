const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");

// Get the currently logged-in user from the database.
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

    // This makes the logged-in user visible in the backend terminal.
    console.log(
      `Logged-in user: id=${user.id}, name=${user.name}, email=${user.email}, phone=${user.phone}`
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get logged-in user error:", error);
    return res.status(500).json({
      message: "Unable to get logged-in user"
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const messageText = req.body.message?.trim();

    if (!messageText) {
      return res.status(400).json({
        message: "Message cannot be empty"
      });
    }

    // req.user.id comes from the verified JWT, not from the browser.
    const sender = await User.findByPk(req.user.id);

    if (!sender) {
      return res.status(401).json({
        message: "Logged-in user was not found"
      });
    }

    console.log(
      `Saving message from user id=${sender.id}, name=${sender.name}: ${messageText}`
    );

    const chatMessage = await ChatMessage.create({
      senderId: sender.id,
      message: messageText
    });

    return res.status(201).json({
      message: "Chat message saved successfully",
      chatMessage: {
        id: chatMessage.id,
        senderId: chatMessage.senderId,
        message: chatMessage.message,
        createdAt: chatMessage.createdAt
      }
    });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({
      message: "Unable to save chat message",
      error: error.message
    });
  }
};

// Return ALL messages from the database.
const getAllMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.findAll({
      order: [["createdAt", "ASC"]],
      attributes: ["id", "senderId", "message", "createdAt"]
    });

    console.log(
      `Returning ${messages.length} message(s) from database for logged-in user id=${req.user.id}`
    );

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Get all messages error:", error);
    return res.status(500).json({
      message: "Unable to fetch chat messages"
    });
  }
};

module.exports = {
  getLoggedInUser,
  sendMessage,
  getAllMessages
};
