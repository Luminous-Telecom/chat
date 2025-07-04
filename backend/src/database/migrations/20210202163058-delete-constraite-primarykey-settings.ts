import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeConstraint("Settings", "Settings_pkey"),
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addConstraint("Settings", {
        name: "Settings_pkey",
        type: "unique",
        fields: ["key"],
      }),
    ]);
  },
};
