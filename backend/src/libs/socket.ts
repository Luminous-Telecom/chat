import { Server as SocketIO } from "socket.io";
import socketRedis from "socket.io-redis";
import { Server } from "http";
import AppError from "../errors/AppError";
import decodeTokenSocket from "./decodeTokenSocket";
import { logger } from "../utils/logger";
import User from "../models/User";
import Chat from "./socketChat/Chat";

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: "*",
    },
    pingTimeout: 180000,
    pingInterval: 60000,
  });

  const connRedis = {
    host: process.env.IO_REDIS_SERVER,
    port: Number(process.env.IO_REDIS_PORT),
    username: process.env.IO_REDIS_USERNAME,
    password: process.env.IO_REDIS_PASSWORD,
  };

  // apresentando problema na assinatura
  const redis = socketRedis as any;
  io.adapter(redis(connRedis));

  io.use(async (socket, next) => {
    try {
      const token = socket?.handshake?.auth?.token;
      
      // Verificar se o token existe antes de tentar decodificar
      if (!token) {
        logger.warn(`[Socket Auth] Token não fornecido para socket ${socket.id}`);
        socket.emit(`tokenInvalid:${socket.id}`);
        return next(new Error("Token não fornecido"));
      }
      
      const verify = decodeTokenSocket(token);
      if (verify.isValid) {
        const auth = socket?.handshake?.auth;
        socket.handshake.auth = {
          ...auth,
          ...verify.data,
          id: String(verify.data.id),
          tenantId: String(verify.data.tenantId),
        };

        const user = await User.findByPk(verify.data.id, {
          attributes: [
            "id",
            "tenantId",
            "name",
            "email",
            "profile",
            "status",
            "lastLogin",
            "lastOnline",
          ],
        });
        
        if (!user) {
          logger.warn(`[Socket Auth] Usuário não encontrado para ID ${verify.data.id}`);
          socket.emit(`tokenInvalid:${socket.id}`);
          return next(new Error("Usuário não encontrado"));
        }
        
        socket.handshake.auth.user = user;
        logger.info(`[Socket Auth] Usuário ${user.name} (${user.id}) autenticado com sucesso`);
        return next();
      }
      
      logger.warn(`[Socket Auth] Token inválido para socket ${socket.id}`);
      socket.emit(`tokenInvalid:${socket.id}`);
      return next(new Error("Token inválido"));
    } catch (error) {
      logger.error(`[Socket Auth] Erro de autenticação: ${error.message}`);
      socket.emit(`tokenInvalid:${socket.id}`);
      return next(new Error("Erro de autenticação"));
    }
  });

  io.on("connection", socket => {
    const { tenantId } = socket.handshake.auth;
    if (tenantId) {
      // create room to tenant
      socket.join(tenantId.toString());

      socket.on(`tenant:${tenantId}:joinChatBox`, async ticketId => {
        socket.join(`${tenantId}:${ticketId}`);
      });

      socket.on(`${tenantId}:joinNotification`, () => {
        socket.join(`${tenantId}:notification`);
      });

      socket.on(`${tenantId}:joinTickets`, status => {
        socket.join(`${tenantId}:${status}`);
      });
      Chat.register(socket);
    }

    socket.on("disconnect", () => {});
  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};
