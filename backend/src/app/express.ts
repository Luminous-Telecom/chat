import "reflect-metadata";
import "express-async-errors";
import { Application, json, urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { logger } from "../utils/logger";

export default async function express(app: Application): Promise<void> {
  const origin = [process.env.FRONTEND_URL || "https://app.lumi-suite.io"];
  app.use(
    cors({
      origin,
      credentials: true,
    })
  );

  if (process.env.NODE_ENV !== "dev") {
    const frontendUrl = process.env.FRONTEND_URL || "'self'";

    app.use(
      helmet({
        crossOriginResourcePolicy: false,
        frameguard: false,
      })
    );

    // Sets all of the defaults, but overrides script-src
    app.use(
      helmet.contentSecurityPolicy({
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "block-all-mixed-content": [],
          "font-src": ["'self'", "https:", "data:"],
          "img-src": ["'self'", "data:"],
          "object-src": ["'none'"],
          "script-src-attr": ["'none'"],
          "style-src": ["'self'", "https:", "'unsafe-inline'"],
          "upgrade-insecure-requests": [],
          "script-src": ["'self'", frontendUrl],
          "frame-ancestors": ["'self'", frontendUrl],
          "connect-src": ["'self'", frontendUrl],
        },
      })
    );
  }

  console.info("cors domain ======>>>>", process.env.FRONTEND_URL);

  app.use(cookieParser());
  app.use(json({ limit: "50MB" }));
  app.use(
    urlencoded({ extended: true, limit: "50MB", parameterLimit: 200000 })
  );

  logger.info("express already in server!");
}
