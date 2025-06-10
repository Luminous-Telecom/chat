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
import { initBaileys } from "../libs/baileys";
import { StartBaileysSession } from "../services/BaileysServices/StartBaileysSession";
import BaileysConnectionStatus from "../services/BaileysServices/BaileysConnectionStatus";
import { StartAllWhatsAppsSessions } from "../services/WbotServices/StartAllWhatsAppsSessions";
import { addInitialJobs } from "../database";
import BaileysSessionMonitor from '../services/BaileysServices/BaileysSessionMonitor';
import messageQueue from '../services/QueueServices/MessageQueue';
import SystemMetricsService from "../services/MetricsServices/SystemMetrics";
import Whatsapp from "../models/Whatsapp";

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
    
    // Iniciar monitor de sessões
    await BaileysSessionMonitor.start();
    await SystemMetricsService.start();
    
    // Iniciar o servidor HTTP
    return new Promise((resolve, reject) => {
      httpServer.listen(port, host, async () => {
        console.info(`Server is running on port ${port}`);
        
        try {
          // Iniciar sessões do WhatsApp em paralelo
          const whatsapps = await Whatsapp.findAll({
            where: { 
              isActive: true,
              isDeleted: false,
              type: "whatsapp"
            }
          });

          if (whatsapps.length === 0) {
            console.info('No active WhatsApp sessions found');
          } else {
            console.info(`Found ${whatsapps.length} active WhatsApp sessions to start`);
            
            // Iniciar todas as sessões em paralelo com limite de concorrência
            const MAX_CONCURRENT_SESSIONS = 3;
            const chunks: Whatsapp[][] = [];
            for (let i = 0; i < whatsapps.length; i += MAX_CONCURRENT_SESSIONS) {
              chunks.push(whatsapps.slice(i, i + MAX_CONCURRENT_SESSIONS));
            }

            for (const chunk of chunks) {
              await Promise.all(chunk.map(async (whatsapp) => {
                try {
                  if (!whatsapp.id || !whatsapp.tenantId) {
                    console.warn(`Skipping invalid WhatsApp instance: ${JSON.stringify(whatsapp)}`);
                    return;
                  }

                  await StartBaileysSession(whatsapp);
                  await BaileysConnectionStatus(whatsapp);
                  console.info(`Baileys session started for WhatsApp ${whatsapp.id}`);
                } catch (err) {
                  console.error(`Error starting Baileys session for WhatsApp ${whatsapp.id}: ${err}`);
                  BaileysSessionMonitor.recordError(whatsapp.id, err.message);
                }
              }));
            }
          }

          // Iniciar jobs após inicialização do Socket.IO
          await addInitialJobs();
          
          // Iniciar sincronização periódica de sessões
          const { syncSessionStatus, initPeriodicTasks } = require('../libs/wbot');
          
          // Executar sincronização imediatamente após iniciar as sessões
          console.info('Starting initial session sync...');
          await syncSessionStatus();
          
          // Inicializar tarefas periódicas após Socket.IO estar pronto
          console.info('Initializing periodic tasks...');
          initPeriodicTasks();
          
          // Executar sincronização a cada 5 minutos
          setInterval(async () => {
            console.info('Running periodic session sync...');
            await syncSessionStatus();
          }, 5 * 60 * 1000);

          resolve(app);
        } catch (err) {
          console.error('Error during server startup:', err);
          reject(err);
        }
      });

      httpServer.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(`Port ${port} is already in use`);
        } else {
          console.error(error);
        }
        reject(error);
      });
    });
  }

  // Configurar graceful shutdown
  GracefulShutdown(httpServer, {
    signals: "SIGINT SIGTERM",
    timeout: 10000,
    development: process.env.NODE_ENV === "development",
    onShutdown: async () => {
      console.info("Starting graceful shutdown...");
      await BaileysSessionMonitor.stop();
      await SystemMetricsService.stop();
      console.info("Graceful shutdown completed");
    }
  });

  async function close() {
    // Limpar fila de mensagens
    await messageQueue.close();
    
    return new Promise<void>((resolve, reject) => {
      httpServer.close(err => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  // Retornar o objeto app com as funções start e close
  return {
    ...app,
    start,
    close
  };
}
