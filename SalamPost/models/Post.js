const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/db");

class Post extends Model {
  static initModel(sequelize) {
    Post.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        media: {
          type: DataTypes.STRING,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        latitude: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        longitude: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        modelName: "Post",
        timestamps: true,
      }
    );
    return Post;
  }
}

module.exports = Post;
