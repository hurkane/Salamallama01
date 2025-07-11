const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profilePicture: {
      type: DataTypes.STRING,
      defaultValue: "default_profile_pic.png",
      field: "profilePicture", // Ensure this matches the actual column name
    },
    bio: {
      type: DataTypes.TEXT,
    },
    profilePublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "profilePublic", // Ensure this matches the actual column name
    },
    createdAt: {
      type: DataTypes.DATE,
      field: "createdAt", // Ensure this matches the actual column name
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: "updatedAt", // Ensure this matches the actual column name
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "Users", // Explicitly specify the table name
    timestamps: true,
  }
);

module.exports = User;
