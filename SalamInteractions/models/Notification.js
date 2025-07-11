const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Adjust path as necessary

const Notification = sequelize.define("Notification", {
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING, // e.g., 'comment', 'like', 'follow'
    allowNull: false,
  },
  referenceId: {
    type: DataTypes.UUID, // This can be postId, commentId, or followRequestId
    allowNull: false,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  seen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Notification;
