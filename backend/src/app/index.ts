/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
import "reflect-metadata";
import "express-async-errors";
import "./config-env";
import { createServer } from "http";
import { env } from "process";
import express from "express";
import GracefulShutdown from "http-graceful-shutdown";
import bootstrap from "./boot";
import { initIO } from "../libs/socket";
import { StartAllWhatsAppsSessions } from "../services/WbotServices/StartAllWhatsAppsSessions";
import { addInitialJobs } from "../database";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default async function application() {
  const app: any = express();
  const httpServer: any = createServer(app);
  const port = app.get("port") || env.PORT || 3100;

  await bootstrap(app);

  async function start() {
    const host = app.get("host") || "0.0.0.0";
    
    // Inicializar Socket.IO antes de iniciar o servidor
    const io = initIO(httpServer);
    
    // Iniciar servidor HTTP
    app.server = httpServer.listen(port, host, async () => {
      console.info(`Web server listening at: http://${host}:${port}/`);
      
      try {
        // Iniciar sessões do WhatsApp após o servidor estar rodando
        await StartAllWhatsAppsSessions();
        
        // Adicionar jobs após o Socket.IO estar inicializado
        addInitialJobs();
        
        // Iniciar sincronização periódica de sessões
        const { syncSessionStatus } = require('../libs/wbot');
        
        // Executar sincronização imediatamente após iniciar as sessões
        console.info('Starting initial session sync...');
        await syncSessionStatus();
        
        // Executar sincronização a cada 5 minutos
        setInterval(async () => {
          console.info('Running periodic session sync...');
          await syncSessionStatus();
        }, 5 * 60 * 1000);
      } catch (error) {
        console.error('Error starting WhatsApp sessions:', error);
        process.exit(1);
      }
    });
    
    GracefulShutdown(app.server);
  }

  async function close() {
    return new Promise<void>((resolve, reject) => {
      httpServer.close(err => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    });
  }

  process.on("SIGTERM", close);

  app.start = start;
  app.close = close;

  return app;
}
