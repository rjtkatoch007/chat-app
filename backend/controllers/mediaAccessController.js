const { ChatMessage, GroupMessage, ArchivedChatMessage, ArchivedGroupMessage, GroupMember } = require("../models");
const { getPresignedDownloadUrl } = require("../services/mediaStorage");

const getMediaUrl = async (req, res) => {
  try {
    const chatType = String(req.params.chatType || "").trim().toLowerCase();
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return res.status(400).json({ message: "Valid messageId is required" });
    }

    let mediaKey;
    let mediaType;
    let mediaName;

    if (chatType === "private") {
      const attributes = ["id", "senderId", "recipientId", "mediaKey", "mediaType", "mediaName"];
      const message = await ChatMessage.findByPk(messageId, { attributes })
        || await ArchivedChatMessage.findByPk(messageId, { attributes });
      if (!message) return res.status(404).json({ message: "Media message not found" });
      const userId = Number(req.user.id);
      if (Number(message.senderId) !== userId && Number(message.recipientId) !== userId) {
        return res.status(403).json({ message: "You are not allowed to access this media" });
      }
      mediaKey = message.mediaKey;
      mediaType = message.mediaType;
      mediaName = message.mediaName;
    } else if (chatType === "group") {
      const attributes = ["id", "groupId", "mediaKey", "mediaType", "mediaName"];
      const message = await GroupMessage.findByPk(messageId, { attributes })
        || await ArchivedGroupMessage.findByPk(messageId, { attributes });
      if (!message) return res.status(404).json({ message: "Media message not found" });
      const membership = await GroupMember.findOne({
        where: { groupId: message.groupId, userId: req.user.id },
        attributes: ["id"]
      });
      if (!membership) return res.status(403).json({ message: "You are not a member of this group" });
      mediaKey = message.mediaKey;
      mediaType = message.mediaType;
      mediaName = message.mediaName;
    } else {
      return res.status(400).json({ message: "chatType must be private or group" });
    }

    if (!mediaKey) return res.status(404).json({ message: "Media object is not available" });
    const url = await getPresignedDownloadUrl({ key: mediaKey, contentType: mediaType, fileName: mediaName });
    return res.json({ url, expiresIn: 3600 });
  } catch (error) {
    console.error("Media access error:", error);
    return res.status(500).json({ message: "Unable to create secure media URL" });
  }
};

module.exports = { getMediaUrl };
