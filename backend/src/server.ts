import application from "./app";
import { logger } from "./utils/logger";

// Adicionar antes da inicialização do servidor
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
  // Não encerrar o processo, apenas logar o erro
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Não encerrar o processo, apenas logar o erro
});

// Função para emitir o sinal 'ready' para o PM2
const emitReady = () => {
  if (process.send) {
    process.send('ready');
    logger.info('Server is ready - PM2 ready signal sent');
  }
};

application().then((app: any) => {
  app.start().then(() => {
    logger.info("Started system!!");
    // Emitir sinal 'ready' após todas as inicializações
    emitReady();
  }).catch((error: any) => {
    logger.error('Error during startup:', error);
    process.exit(1);
  });
});
