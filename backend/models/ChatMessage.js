const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const ChatMessage = sequelize.define("ChatMessage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  senderId: { type: DataTypes.INTEGER, allowNull: false, field: "sender_id", references: { model: "users", key: "id" } },
  recipientId: { type: DataTypes.INTEGER, allowNull: false, field: "recipient_id", references: { model: "users", key: "id" } },
  message: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } }
}, {
  tableName: "chat_messages",
  timestamps: true
});

User.hasMany(ChatMessage, { foreignKey: "senderId", as: "sentMessages", onDelete: "CASCADE" });
User.hasMany(ChatMessage, { foreignKey: "recipientId", as: "receivedMessages", onDelete: "CASCADE" });
ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });
ChatMessage.belongsTo(User, { foreignKey: "recipientId", as: "recipient" });

module.exports = ChatMessage;
