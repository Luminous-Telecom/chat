import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "profilePicUrl", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "profilePicUrl");
  },
}; 