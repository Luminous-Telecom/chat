import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import authConfig from "../config/auth";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  tenantId: number;
  iat: number;
  exp: number;
}

const isAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Authentication attempt without token');
      return next(new AppError("Token was not provided.", 403));
    }

    const [, token] = authHeader.split(" ");

    if (!token) {
      logger.warn('Authentication attempt with invalid token format');
      return next(new AppError("Invalid token format.", 403));
    }

    try {
      const decoded = verify(token, authConfig.secret);
      const { id, profile, tenantId } = decoded as TokenPayload;

      if (!id || !profile || !tenantId) {
        logger.warn('Token missing required fields', { id, profile, tenantId });
        return next(new AppError("Invalid token payload.", 403));
      }

      req.user = {
        id,
        profile,
        tenantId
      };

      logger.debug('User authenticated successfully', { id, profile, tenantId });
    } catch (err) {
      logger.warn('Token verification failed', { error: err.message });
      return next(new AppError("Invalid token.", 403));
    }

    return next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    logger.error('Unexpected error in authentication middleware', { error: err });
    return next(new AppError("Authentication failed.", 500));
  }
};

export default isAuth;
