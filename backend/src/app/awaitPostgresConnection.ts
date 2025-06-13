import { exec } from "child_process";
import { promisify } from "util";
import { Sequelize } from "sequelize";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

// eslint-disable-next-line
const dbConfig = require("../config/database");

// Função para aguardar a conexão com o PostgreSQL
const waitForPostgresConnection = async function () {
  const sequelize = new Sequelize(dbConfig);

  while (true) {
    try {
      await sequelize.authenticate();
      logger.info("Conexão com o PostgreSQL estabelecida com sucesso!");

      // Verifica se é produção e se é a instância principal (process.env.pm_id === '0')
      if (process.env.NODE_ENV === "production" && process.env.pm_id === '0') {
        logger.info("Instância principal detectada. Iniciando execução das migrations...");
        try {
          const { stdout, stderr } = await execAsync(
            "npm run copy-templates-files && npx sequelize db:migrate"
          );
          logger.info(`Saída do comando: ${stdout}`);
          if (stderr) {
            logger.error(`Erro ao executar o comando: ${stderr}`);
            throw new Error(`Erro ao executar o comando: ${stderr}`);
          }
          logger.info("Migrations executadas com sucesso!");
        } catch (migrationError) {
          logger.error("Erro ao executar migrations:", migrationError);
          // Não encerra a aplicação em caso de erro nas migrations
        }
      } else if (process.env.NODE_ENV === "production") {
        logger.info("Instância secundária detectada. Aguardando migrations...");
        // Aguarda um tempo para garantir que as migrations foram executadas
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      break;
    } catch (error) {
      logger.info(
        "Falha ao conectar ao PostgreSQL. Tentando novamente em 5 segundos..."
      );
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

export default waitForPostgresConnection;
