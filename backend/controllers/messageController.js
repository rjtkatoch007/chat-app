const ChatMessage = require("../models/ChatMessage");

const sendMessage = async (req, res) => {
  try {
    const messageText = req.body.message?.trim();

    if (!messageText) {
      return res.status(400).json({
        message: "Message cannot be empty"
      });
    }

    const chatMessage = await ChatMessage.create({
      senderId: req.user.id,
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
      message: "Unable to save chat message"
    });
  }
};

const getMyMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.findAll({
      where: {
        senderId: req.user.id
      },
      order: [["createdAt", "ASC"]],
      attributes: ["id", "senderId", "message", "createdAt"]
    });

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({
      message: "Unable to fetch chat messages"
    });
  }
};

module.exports = {
  sendMessage,
  getMyMessages
};
