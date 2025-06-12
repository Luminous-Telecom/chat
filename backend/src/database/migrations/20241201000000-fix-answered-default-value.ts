import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Primeiro, atualizar todos os tickets existentes que estão com answered=true mas deveriam ser false
    // Tickets com status 'pending' devem ter answered=false
    await queryInterface.sequelize.query(
      `UPDATE "Tickets" SET "answered" = false WHERE "status" = 'pending' AND "answered" = true`
    );
    
    // Alterar o valor padrão da coluna para false
    await queryInterface.changeColumn("Tickets", "answered", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Reverter o valor padrão para true
    await queryInterface.changeColumn("Tickets", "answered", {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  }
};