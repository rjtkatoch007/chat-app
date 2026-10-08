const sequelize = require("../../config/database");
const { User, ChatGroup, GroupMember, GroupMessage } = require("../../models");
const { createGroupRoomId } = require("../utils/roomId");

const isMember = (groupId, userId) => GroupMember.findOne({ where: { groupId, userId }, attributes: ["id"] });

const registerGroupHandlers = (io, socket) => {
  socket.on("join_group", async ({ groupId } = {}, ack) => {
    try {
      const id = String(groupId || "").trim();
      const group = await ChatGroup.findByPk(id, { attributes: ["id", "name"] });
      if (!group) return ack?.({ success: false, message: "Group not found" });
      if (!await isMember(id, socket.userId)) return ack?.({ success: false, message: "You are not a member of this group" });
      const room = createGroupRoomId(id);
      if (socket.currentGroupRoom) socket.leave(socket.currentGroupRoom);
      await socket.join(room);
      socket.currentGroupRoom = room;
      socket.currentGroupId = id;
      socket.to(room).emit("group_member_joined", { groupId: id, userId: socket.userId, userName: socket.user.name });
      ack?.({ success: true, roomId: room, group });
    } catch (error) {
      console.error("[Socket.IO] join_group:", error);
      ack?.({ success: false, message: "Unable to join group" });
    }
  });

  socket.on("leave_group", ({ groupId } = {}, ack) => {
    const id = String(groupId || socket.currentGroupId || "").trim();
    const room = createGroupRoomId(id);
    if (room) {
      socket.leave(room);
      socket.to(room).emit("group_member_left", { groupId: id, userId: socket.userId, userName: socket.user.name });
    }
    if (socket.currentGroupId === id) {
      socket.currentGroupRoom = null;
      socket.currentGroupId = null;
    }
    ack?.({ success: true });
  });

  socket.on("send_group_message", async ({ groupId, message } = {}, ack) => {
    try {
      const id = String(groupId || "").trim();
      const text = typeof message === "string" ? message.trim() : "";
      if (!text) return ack?.({ success: false, message: "Message cannot be empty" });
      if (text.length > 5000) return ack?.({ success: false, message: "Message is too long" });
      if (!id || socket.currentGroupId !== id || !await isMember(id, socket.userId)) return ack?.({ success: false, message: "Join this group before sending" });
      const group = await ChatGroup.findByPk(id, { attributes: ["id"] });
      if (!group) return ack?.({ success: false, message: "Group not found" });

      const saved = await sequelize.transaction((transaction) => GroupMessage.create({ groupId: id, senderId: socket.userId, message: text }, { transaction }));
      const payload = { id: saved.id, groupId: id, senderId: socket.userId, senderName: socket.user.name, message: saved.message, createdAt: saved.createdAt };
      io.to(createGroupRoomId(id)).emit("new_group_message", payload);
      ack?.({ success: true, chatMessage: payload });
    } catch (error) {
      console.error("[Socket.IO] send_group_message:", error);
      ack?.({ success: false, message: "Unable to save group message" });
    }
  });
};

module.exports = { registerGroupHandlers };
