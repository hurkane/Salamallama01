const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("./User");

const Follow = sequelize.define("Follow", {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  followedId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("pending", "approved", "declined"),
    defaultValue: "pending",
  },
});

User.hasMany(Follow, { foreignKey: "followerId", as: "Following" });
User.hasMany(Follow, { foreignKey: "followedId", as: "Followers" });

module.exports = Follow;
