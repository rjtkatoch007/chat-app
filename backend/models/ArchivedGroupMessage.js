const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Mirrors GroupMessage; media keys and timestamps are retained for old history.
const ArchivedGroupMessage = sequelize.define("ArchivedGroupMessage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  groupId: { type: DataTypes.UUID, allowNull: false, field: "group_id" },
  senderId: { type: DataTypes.INTEGER, allowNull: false, field: "sender_id" },
  message: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  mediaUrl: { type: DataTypes.TEXT, allowNull: true, field: "media_url" },
  mediaKey: { type: DataTypes.TEXT, allowNull: true, field: "media_key" },
  mediaName: { type: DataTypes.STRING(255), allowNull: true, field: "media_name" },
  mediaType: { type: DataTypes.STRING(150), allowNull: true, field: "media_type" },
  mediaSize: { type: DataTypes.BIGINT, allowNull: true, field: "media_size" }
}, {
  tableName: "ArchivedGroupChat",
  timestamps: true,
  indexes: [
    { fields: ["createdAt"] },
    { fields: ["group_id", "createdAt"] }
  ]
});

module.exports = ArchivedGroupMessage;
