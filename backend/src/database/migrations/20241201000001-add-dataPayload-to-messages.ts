import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Messages", "dataPayload", {
      type: DataTypes.JSONB,
      allowNull: true,
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Messages", "dataPayload");
  },
}; 