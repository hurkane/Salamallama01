"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = "Users";
    const columns = [
      { name: "profilePublic", type: Sequelize.BOOLEAN, defaultValue: false },
      {
        name: "Banner",
        type: Sequelize.STRING,
        defaultValue: "Banner/default_banner",
      },
      {
        name: "username",
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      { name: "email", type: Sequelize.STRING, allowNull: false, unique: true },
      { name: "password", type: Sequelize.STRING, allowNull: false },
      { name: "bio", type: Sequelize.STRING, allowNull: true },
      {
        name: "profilePicture",
        type: Sequelize.STRING,
        defaultValue: "profile_picture/default_profile_pic",
      },
      { name: "name", type: Sequelize.STRING, allowNull: true },
      {
        name: "emailVerificationToken",
        type: Sequelize.STRING,
        allowNull: true,
      },
      { name: "passwordResetToken", type: Sequelize.STRING, allowNull: true },
      { name: "emailVerified", type: Sequelize.BOOLEAN, defaultValue: false },
    ];

    const tableDescription = await queryInterface.describeTable(tableName);

    for (const column of columns) {
      if (!tableDescription[column.name]) {
        await queryInterface.addColumn(tableName, column.name, {
          type: column.type,
          defaultValue: column.defaultValue,
          allowNull: column.allowNull,
          unique: column.unique,
        });
      }
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tableName = "Users";
    const columns = [
      "profilePublic",
      "Banner",
      "username",
      "email",
      "password",
      "bio",
      "profilePicture",
      "name",
      "emailVerificationToken",
      "passwordResetToken",
      "emailVerified",
    ];

    const tableDescription = await queryInterface.describeTable(tableName);

    for (const column of columns) {
      if (tableDescription[column]) {
        await queryInterface.removeColumn(tableName, column);
      }
    }
  },
};
