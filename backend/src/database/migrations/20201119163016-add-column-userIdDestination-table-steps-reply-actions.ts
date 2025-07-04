import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("StepsReplyActions", "userIdDestination", {
      type: DataTypes.INTEGER,
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn(
      "StepsReplyActions",
      "userIdDestination"
    );
  },
};
