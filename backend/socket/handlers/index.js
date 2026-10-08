const { registerPrivateHandlers } = require("./privateChat");
const { registerGroupHandlers } = require("./groupChat");

const registerSocketHandlers = (io, socket) => {
  registerPrivateHandlers(io, socket);
  registerGroupHandlers(io, socket);

  socket.on("typing", ({ roomId, groupId, isTyping } = {}) => {
    const room = groupId ? `group:${String(groupId).trim()}` : String(roomId || "").trim();
    if (room) socket.to(room).emit("typing", { userId: socket.userId, userName: socket.user.name, isTyping: Boolean(isTyping), roomId: room });
  });
};

module.exports = { registerSocketHandlers };
