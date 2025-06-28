import { readFileSync } from "fs";
import moment from "moment";
import expressInstance, { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import path from "path";
import routes from "../routes";
import uploadConfig from "../config/upload";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

export default async function modules(app): Promise<void> {
  const { version } = JSON.parse(readFileSync("./package.json").toString());
  const started = new Date();
  const { env } = process;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: env.BACKEND_URL,
    release: version,
  });

  app.get("/health", async (req, res) => {
    let checkConnection;
    try {
      checkConnection = "Servidor disponível!";
    } catch (e) {
      checkConnection = `Servidor indisponível! ${e}`;
    }
    res.json({
      started: moment(started).format("DD/MM/YYYY HH:mm:ss"),
      currentVersion: version,
      uptime: (Date.now() - Number(started)) / 1000,
      statusService: checkConnection,
    });
  });
  app.use(
    "/public",
    expressInstance.static(path.resolve(__dirname, "..", "..", "public"), {
      setHeaders: (res, path) => {
        // Configurar headers específicos para PDFs
        if (path.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        }
      }
    })
  );

  app.use("/api", routes);
  
  // Sentry error handler deve ser adicionado após todas as rotas
  Sentry.setupExpressErrorHandler(app);

  // error handle
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
    if (err instanceof AppError) {
      if (err.statusCode === 403) {
        logger.warn(err);
      } else {
        logger.error(err);
      }
      return res.status(err.statusCode).json({ error: err.message });
    }

    logger.error(err);
    return res.status(500).json({ error: `Internal server error: ${err}` });
  });

  logger.info("modules routes already in server!");
}
