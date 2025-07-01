import { SequelizeOptions } from "sequelize-typescript";
import { Dialect } from "sequelize";

// Validação das variáveis de ambiente obrigatórias
const requiredEnvVars = {
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  DB_PORT: process.env.DB_PORT,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
};

// Verificar se todas as variáveis estão definidas
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value || value.trim() === '') {
    throw new Error(`Variável de ambiente obrigatória não definida: ${key}`);
  }
}

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
  host: requiredEnvVars.POSTGRES_HOST,
  port: Number(requiredEnvVars.DB_PORT),
  database: requiredEnvVars.POSTGRES_DB,
  username: requiredEnvVars.POSTGRES_USER,
  password: requiredEnvVars.POSTGRES_PASSWORD,
  logging: false,
};

module.exports = dbConfig;
