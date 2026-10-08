const { Op } = require("sequelize");
const { User, ChatGroup, GroupMember, ChatMessage, GroupMessage } = require("../models");
const { uploadToS3 } = require("../services/mediaStorage");
const { getIO } = require("../socket");
const { createPrivateRoomId, createGroupRoomId } = require("../socket/utils/roomId");

const ALLOWED_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE = Number(process.env.MEDIA_MAX_BYTES) || 25 * 1024 * 1024;

const isAllowedType = (mime) => ALLOWED_PREFIXES.some((prefix) => String(mime || "").toLowerCase().startsWith(prefix)) || [
  "application/pdf", "text/plain", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/msword", "application/vnd.ms-excel"
].includes(String(mime || "").toLowerCase());

const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "A media file is required" });
    if (!isAllowedType(req.file.mimetype)) return res.status(415).json({ message: "This file type is not supported" });
    if (req.file.size > MAX_FILE_SIZE) return res.status(413).json({ message: `File is too large. Maximum is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.` });

    const chatType = String(req.body.chatType || "").trim().toLowerCase();
    const io = getIO();
    if (!io) return res.status(503).json({ message: "Socket.IO is not ready" });

    let savedMessage;
    let folder;

    if (chatType === "private") {
      const recipientId = Number(req.body.recipientId);
      if (!Number.isInteger(recipientId) || recipientId <= 0 || recipientId === Number(req.user.id)) {
        return res.status(400).json({ message: "Valid recipientId is required" });
      }
      const [sender, recipient] = await Promise.all([
        User.findByPk(req.user.id, { attributes: ["id", "name", "email"] }),
        User.findByPk(recipientId, { attributes: ["id", "name", "email"] })
      ]);
      if (!sender) return res.status(401).json({ message: "Logged-in user was not found" });
      if (!recipient) return res.status(404).json({ message: "Recipient not found" });

      const roomId = createPrivateRoomId(sender.email, recipient.email);
      folder = `private/${roomId}`;
      const upload = await uploadToS3({ file: req.file, folder });
      const message = await ChatMessage.create({
        senderId: sender.id, recipientId: recipient.id, message: "",
        mediaUrl: upload.url, mediaKey: upload.key, mediaName: req.file.originalname,
        mediaType: req.file.mimetype, mediaSize: req.file.size
      });
      savedMessage = {
        id: message.id, roomId, senderId: sender.id, senderName: sender.name,
        recipientId: recipient.id, recipientName: recipient.name, message: "",
        mediaUrl: upload.url, mediaName: req.file.originalname, mediaType: req.file.mimetype,
        mediaSize: req.file.size, createdAt: message.createdAt
      };
      io.to(roomId).emit("new_media_message", savedMessage);
    } else if (chatType === "group") {
      const groupId = String(req.body.groupId || "").trim();
      if (!groupId) return res.status(400).json({ message: "Valid groupId is required" });
      const [group, membership, sender] = await Promise.all([
        ChatGroup.findByPk(groupId, { attributes: ["id", "name"] }),
        GroupMember.findOne({ where: { groupId, userId: req.user.id }, attributes: ["id"] }),
        User.findByPk(req.user.id, { attributes: ["id", "name"] })
      ]);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (!membership) return res.status(403).json({ message: "You are not a member of this group" });
      if (!sender) return res.status(401).json({ message: "Logged-in user was not found" });

      const roomId = createGroupRoomId(groupId);
      folder = `group/${groupId}`;
      const upload = await uploadToS3({ file: req.file, folder });
      const message = await GroupMessage.create({
        groupId, senderId: sender.id, message: "",
        mediaUrl: upload.url, mediaKey: upload.key, mediaName: req.file.originalname,
        mediaType: req.file.mimetype, mediaSize: req.file.size
      });
      savedMessage = {
        id: message.id, groupId, senderId: sender.id, senderName: sender.name, message: "",
        mediaUrl: upload.url, mediaName: req.file.originalname, mediaType: req.file.mimetype,
        mediaSize: req.file.size, createdAt: message.createdAt
      };
      io.to(roomId).emit("new_group_media_message", savedMessage);
    } else {
      return res.status(400).json({ message: "chatType must be private or group" });
    }

    return res.status(201).json({ message: "Media uploaded successfully", chatMessage: savedMessage });
  } catch (error) {
    console.error("Media upload error:", error);
    return res.status(500).json({ message: "Unable to upload media" });
  }
};

module.exports = { uploadMedia, MAX_FILE_SIZE };
