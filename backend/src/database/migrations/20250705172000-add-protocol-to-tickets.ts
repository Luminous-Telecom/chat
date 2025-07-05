import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "protocol", {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    });

    // Gerar protocolos para tickets existentes
    await queryInterface.sequelize.query(`
      UPDATE "Tickets" 
      SET protocol = to_char("createdAt", 'yyyyddMMHH24miss') || id::varchar
      WHERE protocol IS NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "protocol");
  }
}; 