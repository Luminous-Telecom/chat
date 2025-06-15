import { SequelizeOptions } from 'sequelize-typescript';
import { Dialect } from 'sequelize';

const dbConfig: SequelizeOptions = {
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_bin'
    // freezeTableName: true
  },
  pool: {
    max: 100,
    min: 10,
    acquire: 30000,
    idle: 10000
  },
  dialect: 'postgres' as Dialect,
  timezone: 'UTC',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'chat',
  username: process.env.POSTGRES_USER || 'chat',
  password: process.env.POSTGRES_PASSWORD || 'chat123',
  logging: false
};

module.exports = dbConfig;
