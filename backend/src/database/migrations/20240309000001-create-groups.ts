import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.createTable("Groups", {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        groupId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        whatsappId: {
          type: DataTypes.INTEGER,
          references: { model: "Whatsapps", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        tenantId: {
          type: DataTypes.INTEGER,
          references: { model: "Tenants", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false,
          defaultValue: 1
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      }),
      queryInterface.createTable("GroupContacts", {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        groupId: {
          type: DataTypes.INTEGER,
          references: { model: "Groups", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        contactId: {
          type: DataTypes.INTEGER,
          references: { model: "Contacts", key: "id" },
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
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.dropTable("GroupContacts"),
      queryInterface.dropTable("Groups")
    ]);
  }
}; 