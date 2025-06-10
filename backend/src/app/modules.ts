import { readFileSync } from "fs";
import moment from "moment";
import expressInstance, { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
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
    environment: env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true })
    ]
  });

  app.get("/health", async (req, res) => {
    let checkConnection;
    try {
      checkConnection = "Servidor disponível!";
    } catch (e) {
      logger.error('Health check failed', { error: e });
      checkConnection = `Servidor indisponível! ${e}`;
    }
    res.json({
      started: moment(started).format("DD/MM/YYYY HH:mm:ss"),
      currentVersion: version,
      uptime: (Date.now() - Number(started)) / 1000,
      statusService: checkConnection
    });
  });

  // The request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());

  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());

  // Enable CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use("/public", expressInstance.static(uploadConfig.directory));

  // Routes
  app.use(routes);

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  // Global error handler
  app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
    // Verificar se os headers já foram enviados
    if (res.headersSent) {
      logger.warn('Headers already sent, cannot send error response', {
        path: req.path,
        method: req.method,
        error: err.message
      });
      return;
    }

    // Log do erro
    logger.error('Global error handler caught error', {
      path: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack,
      user: req.user?.id
    });

    // Enviar para o Sentry se não for um AppError
    if (!(err instanceof AppError)) {
      Sentry.captureException(err);
    }

    // Tratar erros específicos
    if (err instanceof AppError) {
      if (err.statusCode === 403) {
        logger.warn('Authentication/Authorization error', {
          path: req.path,
          method: req.method,
          error: err.message
        });
      }
      return res.status(err.statusCode).json({ 
        error: err.message,
        code: err.name
      });
    }

    // Erro interno do servidor
    return res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  logger.info("Modules and error handlers configured successfully");
}
