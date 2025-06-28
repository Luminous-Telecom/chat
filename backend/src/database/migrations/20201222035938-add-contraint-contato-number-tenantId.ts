import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addConstraint("Contacts", {
      fields: ["number", "tenantId"],
      type: "unique",
      name: "unique_constraint_contact_number_tenant",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeConstraint(
        "Contacts",
        "unique_constraint_contact_number_tenant"
      ),
    ]);
  },
};
