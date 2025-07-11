const Sequelize = require("sequelize");
const sequelize = require("../config/db");

const User = require("./User");
const Post = require("./Post");

// Initialize models
User.initModel(sequelize);
Post.initModel(sequelize);

// Associations
User.hasMany(Post, { foreignKey: "userId", as: "Posts" });
Post.belongsTo(User, { foreignKey: "userId", as: "User" });

module.exports = {
  User,
  Post,
  sequelize,
};
