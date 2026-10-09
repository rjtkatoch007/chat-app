const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Mirrors ChatMessage while keeping archived rows separate from the hot table.
const ArchivedChatMessage = sequelize.define("ArchivedChatMessage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  senderId: { type: DataTypes.INTEGER, allowNull: false, field: "sender_id" },
  recipientId: { type: DataTypes.INTEGER, allowNull: false, field: "recipient_id" },
  message: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  mediaUrl: { type: DataTypes.TEXT, allowNull: true, field: "media_url" },
  mediaKey: { type: DataTypes.TEXT, allowNull: true, field: "media_key" },
  mediaName: { type: DataTypes.STRING(255), allowNull: true, field: "media_name" },
  mediaType: { type: DataTypes.STRING(150), allowNull: true, field: "media_type" },
  mediaSize: { type: DataTypes.BIGINT, allowNull: true, field: "media_size" }
}, {
  tableName: "ArchivedChat",
  timestamps: true,
  indexes: [
    { fields: ["createdAt"] },
    { fields: ["sender_id", "recipient_id", "createdAt"] }
  ]
});

module.exports = ArchivedChatMessage;
