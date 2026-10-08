const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatGroup = sequelize.define("ChatGroup", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true, len: [1, 100] } },
  inviteCode: { type: DataTypes.STRING(24), allowNull: false, unique: true, field: "invite_code" },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: "created_by", references: { model: "users", key: "id" } }
}, { tableName: "chat_groups", timestamps: true });

module.exports = ChatGroup;
