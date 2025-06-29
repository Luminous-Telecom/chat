import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo = await queryInterface.describeTable("Tickets");
    const promises: Promise<void>[] = [];
    
    // Só adicionar as colunas se elas não existirem
    if (!tableInfo.lastMessageAck) {
      promises.push(
        queryInterface.addColumn("Tickets", "lastMessageAck", {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
        })
      );
    }
    
    if (!tableInfo.lastMessageFromMe) {
      promises.push(
        queryInterface.addColumn("Tickets", "lastMessageFromMe", {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: null,
        })
      );
    }
    
    return Promise.all(promises);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Tickets", "lastMessageAck"),
      queryInterface.removeColumn("Tickets", "lastMessageFromMe"),
    ]);
  },
}; 