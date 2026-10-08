const User = require("./User");
const ChatMessage = require("./ChatMessage");
const ChatGroup = require("./ChatGroup");
const GroupMember = require("./GroupMember");
const GroupMessage = require("./GroupMessage");

User.hasMany(ChatMessage, { foreignKey: "senderId", as: "sentMessages", onDelete: "CASCADE" });
User.hasMany(ChatMessage, { foreignKey: "recipientId", as: "receivedMessages", onDelete: "CASCADE" });
ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });
ChatMessage.belongsTo(User, { foreignKey: "recipientId", as: "recipient" });

User.hasMany(ChatGroup, { foreignKey: "createdBy", as: "createdGroups", onDelete: "CASCADE" });
ChatGroup.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

ChatGroup.hasMany(GroupMember, { foreignKey: "groupId", as: "members", onDelete: "CASCADE" });
GroupMember.belongsTo(ChatGroup, { foreignKey: "groupId", as: "group" });
User.hasMany(GroupMember, { foreignKey: "userId", as: "groupMemberships", onDelete: "CASCADE" });
GroupMember.belongsTo(User, { foreignKey: "userId", as: "user" });

ChatGroup.hasMany(GroupMessage, { foreignKey: "groupId", as: "messages", onDelete: "CASCADE" });
GroupMessage.belongsTo(ChatGroup, { foreignKey: "groupId", as: "group" });
User.hasMany(GroupMessage, { foreignKey: "senderId", as: "groupMessages", onDelete: "CASCADE" });
GroupMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });

module.exports = { User, ChatMessage, ChatGroup, GroupMember, GroupMessage };
