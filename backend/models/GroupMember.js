const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GroupMember = sequelize.define("GroupMember", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  groupId: { type: DataTypes.UUID, allowNull: false, field: "group_id", references: { model: "chat_groups", key: "id" } },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id", references: { model: "users", key: "id" } }
}, {
  tableName: "group_members",
  timestamps: true,
  indexes: [{ unique: true, fields: ["group_id", "user_id"] }]
});

module.exports = GroupMember;
