const User = require("./User");
const ChatMessage = require("./ChatMessage");
const ChatGroup = require("./ChatGroup");
const GroupMember = require("./GroupMember");
const GroupMessage = require("./GroupMessage");
const ArchivedChatMessage = require("./ArchivedChatMessage");
const ArchivedGroupMessage = require("./ArchivedGroupMessage");

User.hasMany(ChatMessage, { foreignKey: "senderId", as: "sentMessages", onDelete: "CASCADE" });
User.hasMany(ChatMessage, { foreignKey: "recipientId", as: "receivedMessages", onDelete: "CASCADE" });
ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });
ChatMessage.belongsTo(User, { foreignKey: "recipientId", as: "recipient" });

// Archived rows intentionally do not add foreign-key constraints: the archive
// remains readable independently, while associations still support history DTOs.
ArchivedChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender", constraints: false });
ArchivedChatMessage.belongsTo(User, { foreignKey: "recipientId", as: "recipient", constraints: false });

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

ArchivedGroupMessage.belongsTo(User, { foreignKey: "senderId", as: "sender", constraints: false });
ArchivedGroupMessage.belongsTo(ChatGroup, { foreignKey: "groupId", as: "group", constraints: false });

module.exports = { User, ChatMessage, ChatGroup, GroupMember, GroupMessage, ArchivedChatMessage, ArchivedGroupMessage };
