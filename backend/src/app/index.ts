/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
import "reflect-metadata";
import "express-async-errors";
import "./config-env";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync } from "fs";
import { env } from "process";
import express from "express";
import GracefulShutdown from "http-graceful-shutdown";
import bootstrap from "./boot";
import { initIO } from "../libs/socket";
import { StartAllWhatsAppsSessions } from "../services/WbotServices/StartAllWhatsAppsSessions";
import startMonitoring from "../services/WbotServices/wbotMonitor";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default async function application() {
  const app: any = express();
  let httpServer: any;

  // Configuração do servidor HTTPS
  if (
    process.env.NODE_ENV === "production" ||
    process.env.USE_HTTPS === "true"
  ) {
    try {
      const options = {
        key: readFileSync(
          process.env.SSL_KEY_PATH ||
            "/etc/letsencrypt/live/devback.fenixnetcom.com.br/privkey.pem"
        ),
        cert: readFileSync(
          process.env.SSL_CERT_PATH ||
            "/etc/letsencrypt/live/devback.fenixnetcom.com.br/fullchain.pem"
        ),
      };
      httpServer = createHttpsServer(options, app);
      console.info("HTTPS server configured");
    } catch (error) {
      console.error("Error loading SSL certificates:", error);
      console.info("Falling back to HTTP server");
      httpServer = createHttpServer(app);
    }
  } else {
    httpServer = createHttpServer(app);
  }

  const port = app.get("port") || env.PORT || 3100;

  await bootstrap(app);

  async function start() {
    const host = app.get("host") || "0.0.0.0";
    app.server = httpServer.listen(port, host, async () => {
      const protocol =
        httpServer instanceof createHttpsServer ? "https" : "http";
      console.info(`Web server listening at: ${protocol}://${host}:${port}/`);
    });

    initIO(app.server);

    // Inicia o monitoramento do WhatsApp
    startMonitoring();

    // Inicia todas as sessões do WhatsApp
    await StartAllWhatsAppsSessions();

    GracefulShutdown(app.server, {
      signals: "SIGINT SIGTERM",
      timeout: 10000, // 10 segundos para finalizar conexões
      development: false,
      onShutdown: async () => {
        console.info("Shutting down gracefully...");
        // Aqui você pode adicionar lógica de limpeza se necessário
      },
    });
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
