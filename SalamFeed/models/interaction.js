const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Interaction = sequelize.define("Interaction", {
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  commentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  postOwnerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  commentOwnerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Interaction;
