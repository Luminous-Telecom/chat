import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addConstraint("Tags", {
      fields: ["tag", "tenantId"],
      type: "unique",
      name: "unique_constraint_tag_tenant",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeConstraint("Tags", "unique_constraint_tag_tenant"),
    ]);
  },
};
