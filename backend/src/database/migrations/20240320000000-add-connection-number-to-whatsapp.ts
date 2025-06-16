import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Whatsapps", "connectionNumber", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      comment: "Número para conexão direta via API",
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Whatsapps", "connectionNumber");
  },
};
