import { SequelizeOptions } from "sequelize-typescript";
import { Dialect } from "sequelize";

const dbConfig: SequelizeOptions = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin",
    // freezeTableName: true
  },
  pool: {
    max: 100,
    min: 10,
    acquire: 30000,
    idle: 10000,
  },
  dialect: "postgres" as Dialect,
  timezone: "UTC",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  logging: false,
};

module.exports = dbConfig;
