import { Request, Response } from "express";
import { apagarPastaSessao, getWbot, removeWbot } from "../libs/wbot";
import { isSessionClosedError } from "../helpers/HandleSessionError";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { setValue } from "../libs/redisClient";
import { logger } from "../utils/logger";
import { getTbot, removeTbot } from "../libs/tbot";
import { getInstaBot, removeInstaBot } from "../libs/InstaBot";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";

// Cache para controlar operações simultâneas
const operationLocks = new Map<string, boolean>();

// Função para verificar se uma operação já está em andamento
const isOperationInProgress = (key: string): boolean => {
  return operationLocks.get(key) || false;
};

// Função para marcar operação como em andamento
const lockOperation = (key: string): void => {
  operationLocks.set(key, true);
};

// Função para liberar operação
const unlockOperation = (key: string): void => {
  operationLocks.delete(key);
};

// Função para verificar se a sessão está em estado válido
const isSessionInValidState = (whatsapp: any): boolean => {
  const validStates = ["CONNECTED", "READY", "AUTHENTICATED", "qrcode"];
  return validStates.includes(whatsapp.status);
};

// Função para aguardar com timeout
const waitWithTimeout = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;
  
  const lockKey = `start-${whatsappId}`;
  
  // Verificar se já há uma operação em andamento
  if (isOperationInProgress(lockKey)) {
    logger.info(`Start operation already in progress for WhatsApp ${whatsappId}`);
    return res.status(200).json({ message: "Session start already in progress." });
  }
  
  try {
    lockOperation(lockKey);
    
    const whatsapp = await ShowWhatsAppService({
      id: whatsappId,
      tenantId,
      isInternal: true
    });

    // Verificar se a sessão já está em estado válido
    if (isSessionInValidState(whatsapp)) {
      logger.info(`WhatsApp ${whatsappId} already in valid state: ${whatsapp.status}`);
      return res.status(200).json({ 
        message: "Session already active.", 
        status: whatsapp.status 
      });
    }

    // Verificar se já existe uma sessão ativa na memória
    try {
      const existingWbot = getWbot(whatsapp.id);
      if (existingWbot && existingWbot.info && existingWbot.info.wid) {
        logger.info(`WhatsApp ${whatsappId} session already exists in memory`);
        return res.status(200).json({ 
          message: "Session already exists.", 
          status: "CONNECTED" 
        });
      }
    } catch (error) {
      // Sessão não existe na memória, continuar com inicialização
      logger.debug(`No existing session found for WhatsApp ${whatsappId}`);
    }

    await StartWhatsAppSession(whatsapp);

    return res.status(200).json({ message: "Starting session." });
  } catch (error: any) {
    logger.error(`Error starting WhatsApp session ${whatsappId}: ${error.message}`);
    return res.status(500).json({ 
      message: "Error starting session.", 
      error: error.message 
    });
  } finally {
    unlockOperation(lockKey);
  }
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { isQrcode, forceNewSession } = req.body;
  const { tenantId } = req.user;

  const lockKey = `update-${whatsappId}`;
  
  // Verificar se já há uma operação em andamento
  if (isOperationInProgress(lockKey)) {
    logger.info(`Update operation already in progress for WhatsApp ${whatsappId}`);
    return res.status(200).json({ message: "Session update already in progress." });
  }

  try {
    lockOperation(lockKey);

    // Buscar dados atuais do WhatsApp
    const currentWhatsapp = await ShowWhatsAppService({ id: whatsappId, tenantId });

    logger.info(`Update request for WhatsApp ${whatsappId}: forceNewSession=${forceNewSession}, isQrcode=${isQrcode}, currentStatus=${currentWhatsapp.status}`);

    // Verificar se deve forçar nova sessão
    const shouldForceNewSession = forceNewSession || 
      (isQrcode && ["DISCONNECTED", "DESTROYED"].includes(currentWhatsapp.status)) ||
      (currentWhatsapp.retries && currentWhatsapp.retries > 3);

    if (shouldForceNewSession) {
      logger.info(`Forcing new session for WhatsApp ${whatsappId}`);
      
      // Remover sessão existente de forma segura
      try {
        const existingWbot = getWbot(currentWhatsapp.id);
        if (existingWbot) {
          logger.info(`Destroying existing session for WhatsApp ${whatsappId}`);
          
          // Tentar destruir com timeout
          const destroyPromise = new Promise<void>((resolve) => {
            try {
              existingWbot.destroy();
              resolve();
            } catch (destroyError: any) {
              logger.warn(`Error destroying existing session: ${destroyError.message}`);
              resolve();
            }
          });
          
          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              logger.warn(`Timeout destroying session for WhatsApp ${whatsappId}`);
              resolve();
            }, 5000);
          });
          
          await Promise.race([destroyPromise, timeoutPromise]);
          await waitWithTimeout(1000); // Aguardar limpeza
        }
      } catch (getWbotError) {
        logger.debug(`No existing session to destroy for WhatsApp ${whatsappId}`);
      }
      
      // Remover da lista de sessões
      removeWbot(currentWhatsapp.id);
      
      // Limpar pasta de sessão
      await apagarPastaSessao(whatsappId);
      
      // Atualizar banco de dados
      const { whatsapp } = await UpdateWhatsAppService({
        whatsappId,
        whatsappData: { 
          session: "",
          status: "OPENING"
        },
        tenantId
      });
      
      // Aguardar um pouco antes de iniciar nova sessão
      await waitWithTimeout(2000);
      
      await StartWhatsAppSession(whatsapp);
    } else {
      // Verificar se já está em estado válido
      if (isSessionInValidState(currentWhatsapp)) {
        logger.info(`WhatsApp ${whatsappId} already in valid state: ${currentWhatsapp.status}`);
        return res.status(200).json({ 
          message: "Session already active.", 
          status: currentWhatsapp.status 
        });
      }
      
      // Tentar reutilizar sessão existente
      logger.info(`Attempting to reuse existing session for WhatsApp ${whatsappId}`);
      await StartWhatsAppSession(currentWhatsapp);
    }
    
    return res.status(200).json({ message: "Session update initiated." });
  } catch (error: any) {
    logger.error(`Error updating WhatsApp session ${whatsappId}: ${error.message}`);
    return res.status(500).json({ 
      message: "Error updating session.", 
      error: error.message 
    });
  } finally {
    unlockOperation(lockKey);
  }
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;
  
  const lockKey = `remove-${whatsappId}`;
  
  // Verificar se já há uma operação em andamento
  if (isOperationInProgress(lockKey)) {
    logger.info(`Remove operation already in progress for WhatsApp ${whatsappId}`);
    return res.status(200).json({ message: "Session removal already in progress." });
  }

  try {
    lockOperation(lockKey);
    
    const channel = await ShowWhatsAppService({ id: whatsappId, tenantId });
    const io = getIO();

    logger.info(`Removing session for channel ${channel.id} (${channel.type})`);

    if (channel.type === "whatsapp") {
      try {
        // Limpar cache de retry primeiro
        await setValue(`${channel.id}-retryQrCode`, 0);
        
        const wbot = getWbot(channel.id);
        
        // Verificar se a sessão está realmente ativa
        if (wbot && wbot.pupPage && !wbot.pupPage.isClosed()) {
          logger.info(`Destroying active WhatsApp session ${channel.id}`);
          
          // Aguardar operações pendentes com timeout reduzido
          await waitWithTimeout(500);
          
          // Verificar novamente se ainda está ativo
          if (wbot.info && wbot.info.wid) {
            // Usar destroy() com timeout para garantir que não trave
            const destroyPromise = new Promise<void>((resolve, reject) => {
              try {
                wbot.destroy();
                logger.info(`WhatsApp session ${channel.id} destroyed successfully`);
                resolve();
              } catch (destroyError: any) {
                if (isSessionClosedError(destroyError)) {
                  logger.info(`WhatsApp session ${channel.id} was already closed`);
                  resolve();
                } else {
                  logger.error(`Error destroying WhatsApp session ${channel.id}: ${destroyError.message}`);
                  reject(destroyError);
                }
              }
            });

            const timeoutPromise = new Promise<void>((resolve) => {
              setTimeout(() => {
                logger.warn(`Timeout destroying WhatsApp session ${channel.id}`);
                resolve();
              }, 8000); // Timeout de 8 segundos
            });

            await Promise.race([destroyPromise, timeoutPromise]);
          } else {
            logger.info(`WhatsApp session ${channel.id} info not available, skipping destroy`);
          }
        } else {
          logger.info(`WhatsApp session ${channel.id} already disconnected or page closed`);
        }
      } catch (getWbotError: any) {
        if (getWbotError.message && getWbotError.message.includes("ERR_WAPP_NOT_INITIALIZED")) {
          logger.info(`WhatsApp session ${channel.id} not initialized, skipping destroy`);
        } else {
          logger.error(`Error getting WhatsApp session ${channel.id}: ${getWbotError.message}`);
        }
      }
      
      // Sempre remover da lista de sessões, mesmo se destroy falhar
      removeWbot(channel.id);
    }

    if (channel.type === "telegram") {
      try {
        const tbot = getTbot(channel.id);
        
        if (tbot && tbot.telegram) {
          logger.info(`Logging out Telegram session ${channel.id}`);
          
          const logoutPromise = tbot.telegram.logOut().catch(error => {
            if (isSessionClosedError(error)) {
              logger.info(`Telegram session ${channel.id} was already closed`);
            } else {
              logger.error(`Error logging out Telegram session ${channel.id}: ${error.message}`);
            }
          });

          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              logger.warn(`Timeout logging out Telegram session ${channel.id}`);
              resolve();
            }, 5000);
          });

          await Promise.race([logoutPromise, timeoutPromise]);
        } else {
          logger.info(`Telegram session ${channel.id} already disconnected`);
        }
      } catch (getTbotError: any) {
        logger.warn(`Error getting Telegram session ${channel.id}: ${getTbotError.message}`);
      }
      
      removeTbot(channel.id);
    }

    if (channel.type === "instagram") {
      try {
        const instaBot = getInstaBot(channel.id);
        if (instaBot) {
          logger.info(`Destroying Instagram session ${channel.id}`);
          
          const destroyPromise = new Promise<void>((resolve) => {
            try {
              instaBot.destroy();
              resolve();
            } catch (destroyError: any) {
              logger.error(`Error destroying Instagram session: ${destroyError.message}`);
              resolve();
            }
          });

          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              logger.warn(`Timeout destroying Instagram session ${channel.id}`);
              resolve();
            }, 5000);
          });

          await Promise.race([destroyPromise, timeoutPromise]);
        }
      } catch (getInstaBotError: any) {
        logger.warn(`Error getting Instagram session ${channel.id}: ${getInstaBotError.message}`);
      }
      
      removeInstaBot(channel);
    }

    // Atualizar status no banco de dados
    await channel.update({
      status: "DISCONNECTED",
      session: ""
    });

    // Emitir evento de atualização
    io.emit(`${channel.tenantId}:whatsappSession`, {
      action: "update",
      session: {
        id: channel.id,
        name: channel.name,
        status: "DISCONNECTED",
        qrcode: "",
        number: channel.number
      }
    });

    logger.info(`Session ${channel.id} removed successfully`);
    return res.status(200).json({ message: "Session disconnected." });

  } catch (error: any) {
    logger.error(`Error removing session ${whatsappId}: ${error.message}`);
    
    try {
      // Tentar atualizar status mesmo em caso de erro
      const channel = await ShowWhatsAppService({ id: whatsappId, tenantId });
      const io = getIO();
      
      await channel.update({
        status: "DISCONNECTED",
        session: ""
      });

      io.emit(`${channel.tenantId}:whatsappSession`, {
        action: "update",
        session: {
          id: channel.id,
          name: channel.name,
          status: "DISCONNECTED",
          qrcode: "",
          number: channel.number
        }
      });
    } catch (updateError: any) {
      logger.error(`Error updating session status after removal error: ${updateError.message}`);
    }
    
    return res.status(500).json({ 
      message: "Error disconnecting session.", 
      error: error.message 
    });
  } finally {
    unlockOperation(lockKey);
  }
};

const clearCache = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;
  
  const lockKey = `clear-cache-${whatsappId}`;
  
  // Verificar se já há uma operação em andamento
  if (isOperationInProgress(lockKey)) {
    logger.info(`Clear cache operation already in progress for WhatsApp ${whatsappId}`);
    return res.status(200).json({ message: "Cache clearing already in progress." });
  }

  try {
    lockOperation(lockKey);
    
    const channel = await ShowWhatsAppService({ id: whatsappId, tenantId });
    const io = getIO();

    logger.info(`Clearing cache for channel ${channel.id} (${channel.type})`);

    if (channel.type === "whatsapp") {
      try {
        // 1. Limpar cache de retry
        await setValue(`${channel.id}-retryQrCode`, 0);
        
        // 2. Remover sessão da memória
        try {
          const wbot = getWbot(channel.id);
          if (wbot) {
            logger.info(`Destroying active WhatsApp session ${channel.id}`);
            await wbot.destroy().catch(err => {
              logger.warn(`Error destroying session: ${err}`);
            });
          }
        } catch (err) {
          logger.debug(`No active session to destroy for WhatsApp ${channel.id}`);
        }
        
        // 3. Remover da lista de sessões
        removeWbot(channel.id);
        
        // 4. Limpar pasta de sessão
        await apagarPastaSessao(channel.id);
        
        // 5. Limpar cache da sessão
        const { clearSessionState } = require('../libs/wbot');
        clearSessionState(channel.id);
        
        // 6. Atualizar status no banco
        await channel.update({
          status: "DISCONNECTED",
          qrcode: null,
          session: "",
          retries: 0
        });

        // 7. Emitir atualização via socket
        io.emit(`${channel.tenantId}:whatsappSession`, {
          action: "update",
          session: channel
        });

        logger.info(`Cache cleared for WhatsApp session ${channel.id}`);
        return res.status(200).json({ message: "Cache cleared successfully" });
      } catch (error) {
        logger.error(`Error clearing cache for WhatsApp session ${channel.id}: ${error}`);
        throw error;
      }
    }

    return res.status(400).json({ message: "Invalid channel type" });
  } catch (error) {
    logger.error(`Error in clearCache: ${error}`);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    unlockOperation(lockKey);
  }
};

// Função para limpeza periódica do cache de operações
const cleanupOperationLocks = (): void => {
  // Limpar locks que podem ter ficado "presos" (executar periodicamente)
  const maxAge = 5 * 60 * 1000; // 5 minutos
  const now = Date.now();
  
  // Como não temos timestamp dos locks, vamos limpar todos periodicamente
  operationLocks.clear();
  logger.debug('Operation locks cleaned up');
};

// Executar limpeza a cada 10 minutos
setInterval(cleanupOperationLocks, 10 * 60 * 1000);

export default { store, remove, update, clearCache };