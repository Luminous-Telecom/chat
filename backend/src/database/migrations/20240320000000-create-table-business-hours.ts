import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("BusinessHours", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      schedules: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
        allowNull: false,
        defaultValue: "INACTIVE"
      },
      tenantId: {
        type: DataTypes.INTEGER,
        references: { model: "Tenants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BusinessHours");
  }
}; 