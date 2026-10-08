const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GroupMessage = sequelize.define("GroupMessage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  groupId: { type: DataTypes.UUID, allowNull: false, field: "group_id", references: { model: "chat_groups", key: "id" } },
  senderId: { type: DataTypes.INTEGER, allowNull: false, field: "sender_id", references: { model: "users", key: "id" } },
  message: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } }
}, { tableName: "group_messages", timestamps: true });

module.exports = GroupMessage;
