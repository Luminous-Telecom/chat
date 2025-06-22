import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.changeColumn("Campaigns", "message2", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      }),
      queryInterface.changeColumn("Campaigns", "message3", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      }),
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.changeColumn("Campaigns", "message2", {
        type: DataTypes.TEXT,
        allowNull: false,
      }),
      queryInterface.changeColumn("Campaigns", "message3", {
        type: DataTypes.TEXT,
        allowNull: false,
      }),
    ]);
  },
}; 