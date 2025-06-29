import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo = await queryInterface.describeTable("Messages");
    
    // Só adicionar a coluna se ela não existir
    if (!tableInfo.dataPayload) {
      return queryInterface.addColumn("Messages", "dataPayload", {
        type: DataTypes.JSONB,
        allowNull: true,
      });
    }
    return Promise.resolve();
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Messages", "dataPayload");
  },
}; 