const { createSocketServer, getIO, connectedUsers } = require("./socket/index");
const { User } = require("./models");
const { createPrivateRoomId } = require("./socket/utils/roomId");

const broadcastNewMessage = async (chatMessage) => {
  const io = getIO();
  if (!io || !chatMessage?.senderId || !chatMessage?.recipientId) return;
  const [sender, recipient] = await Promise.all([
    User.findByPk(chatMessage.senderId, { attributes: ["email"] }),
    User.findByPk(chatMessage.recipientId, { attributes: ["email"] })
  ]);
  const roomId = sender && recipient ? createPrivateRoomId(sender.email, recipient.email) : null;
  if (roomId) io.to(roomId).emit("new_message", { ...chatMessage, roomId });
};

module.exports = { createSocketServer, getIO, connectedUsers, broadcastNewMessage, getPrivateRoomId: createPrivateRoomId };
